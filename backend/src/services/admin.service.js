// src/services/admin.service.js
// Бізнес-логіка адмін-панелі: керування користувачами та модерація курсів.

'use strict';

const { Op } = require('sequelize');
const { User, Course, Category } = require('../models');

// ─────────────────────────────────────────────────────────────
// КЕРУВАННЯ КОРИСТУВАЧАМИ
// ─────────────────────────────────────────────────────────────

/**
 * Повертає список всіх користувачів з пагінацією та опціональним фільтром за роллю.
 *
 * @param {object} params
 * @param {string} [params.role]   - Фільтр за роллю ('student' | 'teacher' | 'admin')
 * @param {string} [params.q]      - Пошук за email/іменем
 * @param {number} [params.page]
 * @param {number} [params.limit]
 */
const getAllUsers = async ({ role, q, page = 1, limit = 20 }) => {
  const where = {};

  if (role) {
    where.role = role;
  }

  if (q && q.trim().length > 0) {
    where[Op.or] = [
      { email: { [Op.iLike]: `%${q.trim()}%` } },
      { name: { [Op.iLike]: `%${q.trim()}%` } },
      { surname: { [Op.iLike]: `%${q.trim()}%` } },
    ];
  }

  const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);

  const { count, rows } = await User.findAndCountAll({
    where,
    attributes: { exclude: ['passwordHash'] }, // Ніколи не повертаємо хеш паролю
    order: [['createdAt', 'DESC']],
    limit: parseInt(limit, 10),
    offset,
  });

  return {
    users: rows,
    totalCount: count,
    page: parseInt(page, 10),
    totalPages: Math.ceil(count / parseInt(limit, 10)),
  };
};

/**
 * Змінює роль користувача.
 * Захист: адмін не може випадково розжалувати себе самого (залишити систему без адмінів).
 *
 * @param {string} userId        - ID користувача, якому змінюють роль
 * @param {string} newRole       - 'student' | 'teacher' | 'admin'
 * @param {string} requesterId   - ID адміна, що робить запит
 */
const changeUserRole = async (userId, newRole, requesterId) => {
  const allowedRoles = ['student', 'teacher', 'admin'];
  if (!allowedRoles.includes(newRole)) {
    const err = new Error("Невірна роль. Дозволено: 'student', 'teacher', 'admin'.");
    err.statusCode = 422;
    err.isOperational = true;
    throw err;
  }

  const user = await User.findByPk(userId);
  if (!user) {
    const err = new Error('Користувача не знайдено.');
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  // Захист від самостійного пониження останнього адміна
  if (userId === requesterId && user.role === 'admin' && newRole !== 'admin') {
    const adminCount = await User.count({ where: { role: 'admin' } });
    if (adminCount <= 1) {
      const err = new Error('Ви не можете понизити себе — ви останній адмін у системі.');
      err.statusCode = 403;
      err.isOperational = true;
      throw err;
    }
  }

  await user.update({ role: newRole });
  return user.toSafeJSON();
};

/**
 * Блокує користувача (is_banned = true).
 *
 * @param {string} userId
 */
const banUser = async (userId) => {
  const user = await User.findByPk(userId);
  if (!user) {
    const err = new Error('Користувача не знайдено.');
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  if (user.role === 'admin') {
    const err = new Error('Неможливо заблокувати адміна.');
    err.statusCode = 403;
    err.isOperational = true;
    throw err;
  }

  await user.update({ isBanned: true });
  return user.toSafeJSON();
};

/**
 * Розблоковує користувача (is_banned = false).
 *
 * @param {string} userId
 */
const unbanUser = async (userId) => {
  const user = await User.findByPk(userId);
  if (!user) {
    const err = new Error('Користувача не знайдено.');
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  await user.update({ isBanned: false, failedLoginAttempts: 0, lockedUntil: null });
  return user.toSafeJSON();
};

// ─────────────────────────────────────────────────────────────
// МОДЕРАЦІЯ КУРСІВ
// ─────────────────────────────────────────────────────────────

/**
 * Повертає всі курси (будь-якого статусу) для модерації адміном.
 *
 * @param {object} params
 * @param {string} [params.status] - 'draft' | 'published'
 * @param {number} [params.page]
 * @param {number} [params.limit]
 */
const getAllCoursesForModeration = async ({ status, page = 1, limit = 20 }) => {
  const where = {};
  if (status) {
    where.status = status;
  }

  const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);

  const { count, rows } = await Course.findAndCountAll({
    where,
    include: [
      { model: User, as: 'teacher', attributes: ['id', 'name', 'surname', 'email'] },
      { model: Category, as: 'category', attributes: ['id', 'name'] },
    ],
    order: [['createdAt', 'DESC']],
    limit: parseInt(limit, 10),
    offset,
  });

  return {
    courses: rows,
    totalCount: count,
    page: parseInt(page, 10),
    totalPages: Math.ceil(count / parseInt(limit, 10)),
  };
};

/**
 * Адмін примусово знімає курс з публікації (наприклад, через скаргу).
 *
 * @param {string} courseId
 */
const moderateUnpublishCourse = async (courseId) => {
  const course = await Course.findByPk(courseId);
  if (!course) {
    const err = new Error('Курс не знайдено.');
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  await course.update({ status: 'draft' });
  return course;
};

module.exports = {
  getAllUsers,
  changeUserRole,
  banUser,
  unbanUser,
  getAllCoursesForModeration,
  moderateUnpublishCourse,
};
