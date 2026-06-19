// src/routes/progress.routes.js
// Маршрути прогресу студента.

'use strict';

const { Router } = require('express');
const { body, param } = require('express-validator');
const progressController = require('../controllers/Progress.controller');
const { authenticate } = require('../middleware/auth');

const router = Router();

// Усі маршрути прогресу потребують авторизації
router.use(authenticate);

/**
 * GET /api/v1/progress/me
 * Прогрес поточного студента по всіх курсах. Має бути ВИЩЕ за /courses/:id.
 */
router.get('/me', progressController.getMyProgress);

/**
 * POST /api/v1/progress/lessons/:lessonId
 * Позначає урок як пройдений.
 * Body: { completed?: boolean }
 */
router.post(
  '/lessons/:lessonId',
  [
    param('lessonId').isUUID(4).withMessage('Невірний формат ID уроку'),
    body('completed').optional().isBoolean(),
  ],
  progressController.markLessonProgress,
);

/**
 * GET /api/v1/progress/courses/:courseId
 * Прогрес по конкретному курсу.
 */
router.get(
  '/courses/:courseId',
  [param('courseId').isUUID(4).withMessage('Невірний формат ID курсу')],
  progressController.getCourseProgress,
);

module.exports = router;