// src/routes/admin.routes.js
// Маршрути адмін-панелі. Усі вимагають authenticate + роль 'admin'.

'use strict';

const { Router } = require('express');
const { body, param, query } = require('express-validator');
const adminController = require('../controllers/admin.controller');
const { authenticate } = require('../middleware/auth');
const { checkRole } = require('../middleware/checkRole');

const router = Router();

// Усі маршрути нижче доступні лише адміну
router.use(authenticate, checkRole('admin'));

// ─────────────────────────────────────────────────────────────
// КОРИСТУВАЧІ
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/admin/users
 * Список користувачів. Query: ?role=&q=&page=&limit=
 */
router.get(
  '/users',
  [
    query('role').optional().isIn(['student', 'teacher', 'admin']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  adminController.getAllUsers,
);

/**
 * PATCH /api/v1/admin/users/:id/role
 * Body: { role: 'student' | 'teacher' | 'admin' }
 */
router.patch(
  '/users/:id/role',
  [
    param('id').isUUID(4).withMessage('Невірний формат ID користувача'),
    body('role')
      .isIn(['student', 'teacher', 'admin'])
      .withMessage("role повинен бути 'student', 'teacher' або 'admin'"),
  ],
  adminController.changeUserRole,
);

/**
 * PATCH /api/v1/admin/users/:id/ban
 */
router.patch(
  '/users/:id/ban',
  [param('id').isUUID(4).withMessage('Невірний формат ID користувача')],
  adminController.banUser,
);

/**
 * PATCH /api/v1/admin/users/:id/unban
 */
router.patch(
  '/users/:id/unban',
  [param('id').isUUID(4).withMessage('Невірний формат ID користувача')],
  adminController.unbanUser,
);

// ─────────────────────────────────────────────────────────────
// МОДЕРАЦІЯ КУРСІВ
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/admin/courses
 * Query: ?status=draft|published&page=&limit=
 */
router.get(
  '/courses',
  [
    query('status').optional().isIn(['draft', 'published']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  adminController.getAllCourses,
);

/**
 * PATCH /api/v1/admin/courses/:id/unpublish
 * Примусове зняття курсу з публікації.
 */
router.patch(
  '/courses/:id/unpublish',
  [param('id').isUUID(4).withMessage('Невірний формат ID курсу')],
  adminController.moderateUnpublishCourse,
);

module.exports = router;
