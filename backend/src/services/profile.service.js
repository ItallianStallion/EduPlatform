// src/services/profile.service.js
// Бізнес-логіка профілю користувача.

'use strict';

const { User, UserProfile } = require('../models');

// ─────────────────────────────────────────────────────────────
// GET PROFILE
// ─────────────────────────────────────────────────────────────

/**
 * Повертає публічні дані користувача разом з його профілем.
 * Ніколи не повертає passwordHash та службові поля (failedLoginAttempts тощо).
 *
 * @param {string} userId
 * @returns {{ id, name, surname, role, profile: { avatar, bio, phone } }}
 */
const getProfile = async (userId) => {
  const user = await User.findByPk(userId, {
    attributes: ['id', 'name', 'surname', 'role', 'createdAt'],
    include: [
      {
        model: UserProfile,
        as: 'profile',
        attributes: ['avatar', 'bio', 'phone'],
        // Якщо профілю ще немає — повертаємо null, не падаємо
        required: false,
      },
    ],
  });

  if (!user) {
    const err = new Error('Користувача не знайдено.');
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  return user;
};

// ─────────────────────────────────────────────────────────────
// UPDATE PROFILE
// ─────────────────────────────────────────────────────────────

/**
 * Оновлює (або створює) профіль поточного користувача.
 * Використовує upsert щоб не потрібна була окрема логіка "якщо профілю немає — створи".
 *
 * @param {string} userId
 * @param {object} data - { avatar?, bio?, phone? }
 * @returns {UserProfile}
 */
const updateProfile = async (userId, data) => {
  // Перевіряємо що користувач існує
  const user = await User.findByPk(userId);
  if (!user) {
    const err = new Error('Користувача не знайдено.');
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  // Дозволені поля (захист від масового присвоєння)
  const allowedFields = ['avatar', 'bio', 'phone'];
  const safeData = {};
  allowedFields.forEach((field) => {
    if (data[field] !== undefined) {
      safeData[field] = data[field];
    }
  });

  // findOrCreate + update — якщо профілю ще немає, створюємо його
  const [profile] = await UserProfile.findOrCreate({
    where: { userId },
    defaults: { userId, ...safeData },
  });

  // Якщо профіль вже існував — оновлюємо
  if (Object.keys(safeData).length > 0) {
    await profile.update(safeData);
  }

  return profile;
};

module.exports = { getProfile, updateProfile };
