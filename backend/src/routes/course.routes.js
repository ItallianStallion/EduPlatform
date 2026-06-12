// src/routes/course.routes.js
// Маршрути курсів.  

'use strict';

const { Router } = require('express');
const { query, param } = require('express-validator');
const courseController = require('../controllers/course.controller');
const { authenticate } = require('../middleware/auth');
const { checkRole } = require('../middleware/checkRole');

const router = Router();

/**
 * GET /api/v1/courses
 * Публічний каталог курсів з пошуком, фільтрацією та пагінацією.
 * Відкритий endpoint — авторизація не потрібна.
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('page повинен бути цілим числом > 0'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit від 1 до 50'),
    query('price')
      .optional()
      .isIn(['free', 'paid', 'any'])
      .withMessage('price: free | paid | any'),
    query('sortBy')
      .optional()
      .isIn(['popular', 'newest', 'price_asc', 'price_desc'])
      .withMessage('sortBy: popular | newest | price_asc | price_desc'),
  ],
  courseController.getCourses,
);

/**
 * POST /api/v1/courses/:id/enroll
 * Запис на курс. Тільки для авторизованих студентів.
 */
router.post(
  '/:id/enroll',
  authenticate,
  checkRole('student'), // Тільки студенти можуть записуватись
  [
    param('id').isUUID(4).withMessage('Невірний формат ID курсу'),
  ],
  courseController.enrollInCourse,
);

module.exports = router;
