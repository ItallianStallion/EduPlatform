// src/controllers/admin.controller.js
// HTTP-шар адмін-панелі.
'use strict';

const { validationResult } = require('express-validator');
const adminService = require('../services/admin.service');

/**
 * GET /api/v1/admin/users
 * Список всіх користувачів з фільтрацією та пагінацією.
 */
const getAllUsers = async (req, res, next) => {
  try {
    const { role, q, page, limit } = req.query;
    const result = await adminService.getAllUsers({
      role,
      q,
      page: parseInt(page, 10) || 1,
      limit: Math.min(parseInt(limit, 10) || 20, 100),
    });

    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
};

/**
 * PATCH /api/v1/admin/users/:id/role
 * Зміна ролі користувача.
 * Body: { role: 'student' | 'teacher' | 'admin' }
 */
const changeUserRole = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const { role } = req.body;
    const user = await adminService.changeUserRole(req.params.id, role, req.user.id);

    return res.status(200).json({
      success: true,
      message: `Роль користувача змінено на '${role}'.`,
      data: { user },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * PATCH /api/v1/admin/users/:id/ban
 * Блокування користувача.
 */
const banUser = async (req, res, next) => {
  try {
    const user = await adminService.banUser(req.params.id);
    return res.status(200).json({
      success: true,
      message: 'Користувача заблоковано.',
      data: { user },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * PATCH /api/v1/admin/users/:id/unban
 * Розблокування користувача.
 */
const unbanUser = async (req, res, next) => {
  try {
    const user = await adminService.unbanUser(req.params.id);
    return res.status(200).json({
      success: true,
      message: 'Користувача розблоковано.',
      data: { user },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/v1/admin/courses
 * Всі курси (будь-якого статусу) для модерації.
 */
const getAllCourses = async (req, res, next) => {
  try {
    const { status, page, limit } = req.query;
    const result = await adminService.getAllCoursesForModeration({
      status,
      page: parseInt(page, 10) || 1,
      limit: Math.min(parseInt(limit, 10) || 20, 100),
    });

    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
};

/**
 * PATCH /api/v1/admin/courses/:id/unpublish
 * Примусове зняття курсу з публікації (наприклад, через скаргу).
 */
const moderateUnpublishCourse = async (req, res, next) => {
  try {
    const course = await adminService.moderateUnpublishCourse(req.params.id);
    return res.status(200).json({
      success: true,
      message: 'Курс знято з публікації адміністратором.',
      data: { course },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  getAllUsers,
  changeUserRole,
  banUser,
  unbanUser,
  getAllCourses,
  moderateUnpublishCourse,
};
