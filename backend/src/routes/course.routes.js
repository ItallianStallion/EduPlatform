// src/routes/course.routes.js
// Маршрути курсів

'use strict';

const { Router } = require('express');
const { query, param, body } = require('express-validator');
const courseController = require('../controllers/course.controller');
const { authenticate, optionalAuthenticate } = require('../middleware/auth');
const { checkRole } = require('../middleware/checkRole');

const router = Router();

// ─────────────────────────────────────────────────────────────
// ПУБЛІЧНІ МАРШРУТИ (без авторизації)
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/courses
 * Публічний каталог курсів з пошуком, фільтрацією та пагінацією.
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('page повинен бути цілим числом > 0'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit від 1 до 50'),
    query('price').optional().isIn(['free', 'paid', 'any']).withMessage('price: free | paid | any'),
    query('sortBy')
      .optional()
      .isIn(['popular', 'newest', 'price_asc', 'price_desc'])
      .withMessage('sortBy: popular | newest | price_asc | price_desc'),
  ],
  courseController.getCourses,
);

// ─────────────────────────────────────────────────────────────
// ВИКЛАДАЧ: МОЇ КУРСИ (має бути ВИЩЕ за /:id, інакше Express сприйме 'my' за ID)
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/courses/my
 * Всі курси поточного викладача (включно з draft).
 */
router.get('/my', authenticate, checkRole('teacher'), courseController.getMyCourses);

// ─────────────────────────────────────────────────────────────
// ВИКЛАДАЧ: СТВОРЕННЯ КУРСУ
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/v1/courses
 * Створення нового курсу. Тільки для викладачів.
 */
router.post(
  '/',
  authenticate,
  checkRole('teacher'),
  [
    body('title')
      .trim()
      .isLength({ min: 5, max: 255 })
      .withMessage('Назва курсу повинна бути від 5 до 255 символів'),
    body('description').optional().isString(),
    body('categoryId').optional().isUUID(4).withMessage('Невірний формат categoryId'),
    body('price').optional().isFloat({ min: 0 }).withMessage('Ціна не може бути від\'ємною'),
    body('coverImage').optional().isString(),
    body('accessMode').optional().isIn(['open', 'sequential']).withMessage("accessMode: 'open' або 'sequential'"),
  ],
  courseController.createCourse,
);

/**
 * GET /api/v1/courses/:id
 * Деталі одного курсу. Публічний для published, приватний для draft (тільки автор).
 */
router.get(
  '/:id',  optionalAuthenticate, 
  [param('id').isUUID(4).withMessage('Невірний формат ID курсу')],
  courseController.getCourseById,
);

/**
 * PATCH /api/v1/courses/:id
 * Редагування курсу. Тільки власник-викладач.
 */
router.patch(
  '/:id',
  authenticate,
  checkRole('teacher'),
  [
    param('id').isUUID(4).withMessage('Невірний формат ID курсу'),
    body('title').optional().trim().isLength({ min: 5, max: 255 }),
    body('description').optional().isString(),
    body('categoryId').optional().isUUID(4),
    body('price').optional().isFloat({ min: 0 }),
    body('coverImage').optional().isString(),
    body('accessMode').optional().isIn(['open', 'sequential']),
  ],
  courseController.updateCourse,
);

/**
 * PATCH /api/v1/courses/:id/publish
 * Публікація курсу (draft → published).
 */
router.patch(
  '/:id/publish',
  authenticate,
  checkRole('teacher'),
  [param('id').isUUID(4).withMessage('Невірний формат ID курсу')],
  courseController.publishCourse,
);

/**
 * PATCH /api/v1/courses/:id/unpublish
 * Знімає курс з публікації (published → draft).
 */
router.patch(
  '/:id/unpublish',
  authenticate,
  checkRole('teacher'),
  [param('id').isUUID(4).withMessage('Невірний формат ID курсу')],
  courseController.unpublishCourse,
);

/**
 * POST /api/v1/courses/:id/enroll
 * Запис на курс. Тільки для авторизованих студентів.
 */
router.post(
  '/:id/enroll',
  authenticate,
  checkRole('student'),
  [param('id').isUUID(4).withMessage('Невірний формат ID курсу')],
  courseController.enrollInCourse,
);

module.exports = router;
