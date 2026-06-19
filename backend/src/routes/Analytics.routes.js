// src/routes/analytics.routes.js
// Маршрути аналітики викладача.

'use strict';

const { Router } = require('express');
const { param } = require('express-validator');
const analyticsController = require('../controllers/Analytics.controller');
const { authenticate } = require('../middleware/auth');
const { checkRole } = require('../middleware/checkRole');

const router = Router();

// Усі маршрути аналітики — лише для авторизованих викладачів
router.use(authenticate, checkRole('teacher'));

/**
 * GET /api/v1/analytics/dashboard
 * Загальний дашборд по всіх курсах викладача. Має бути ВИЩЕ за /courses/:id.
 */
router.get('/dashboard', analyticsController.getTeacherDashboard);

/**
 * GET /api/v1/analytics/courses/:courseId
 * Аналітика по конкретному курсу.
 */
router.get(
  '/courses/:courseId',
  [param('courseId').isUUID(4).withMessage('Невірний формат ID курсу')],
  analyticsController.getCourseAnalytics,
);

/**
 * GET /api/v1/analytics/courses/:courseId/students
 * Список студентів курсу з прогресом.
 */
router.get(
  '/courses/:courseId/students',
  [param('courseId').isUUID(4).withMessage('Невірний формат ID курсу')],
  analyticsController.getCourseStudentsProgress,
);

module.exports = router;