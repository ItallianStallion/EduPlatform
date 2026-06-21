// src/routes/lesson.routes.js
// Маршрути уроків.

'use strict';

const { Router } = require('express');
const { body, param } = require('express-validator');
const lessonController = require('../controllers/Lesson.controller');
const { authenticate } = require('../middleware/auth');
const { checkRole } = require('../middleware/checkRole');

const router = Router();

/**
 * GET /api/v1/lessons/course/:courseId
 * Список уроків курсу. Доступ: записаний студент / власник-викладач / admin.
 */
router.get(
  '/course/:courseId',
  authenticate,
  [param('courseId').isUUID(4).withMessage('Невірний формат ID курсу')],
  lessonController.getLessonsByCourse,
);

/**
 * POST /api/v1/lessons/course/:courseId
 * Створення уроку. Тільки викладач-власник курсу.
 */
router.post(
  '/course/:courseId',
  authenticate,
  checkRole('teacher'),
  [
    param('courseId').isUUID(4).withMessage('Невірний формат ID курсу'),
    body('title').trim().notEmpty().withMessage('Назва уроку обов\'язкова'),
    body('type').optional().isIn(['video', 'text', 'pdf']),
    body('content').optional({ nullable: true }).isString(),
    body('videoUrl').optional({ nullable: true }).isString(),
    body('pdfUrl').optional({ nullable: true }).isString(),
    body('order').optional().isInt({ min: 0 }),
  ],
  lessonController.createLesson,
);

/**
 * GET /api/v1/lessons/:id
 * Деталі одного уроку.
 */
router.get(
  '/:id',
  authenticate,
  [param('id').isUUID(4).withMessage('Невірний формат ID уроку')],
  lessonController.getLessonById,
);

/**
 * PATCH /api/v1/lessons/:id
 * Редагування уроку. Тільки власник курсу.
 */
router.patch(
  '/:id',
  authenticate,
  checkRole('teacher'),
  [param('id').isUUID(4).withMessage('Невірний формат ID уроку')],
  lessonController.updateLesson,
);

/**
 * DELETE /api/v1/lessons/:id
 * Видалення уроку. Тільки власник курсу.
 */
router.delete(
  '/:id',
  authenticate,
  checkRole('teacher'),
  [param('id').isUUID(4).withMessage('Невірний формат ID уроку')],
  lessonController.deleteLesson,
);

module.exports = router;