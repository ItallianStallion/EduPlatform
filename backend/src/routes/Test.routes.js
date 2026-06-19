// src/routes/test.routes.js
// Маршрути тестів.

'use strict';

const { Router } = require('express');
const { body, param } = require('express-validator');
const testController = require('../controllers/Test.controller');
const { authenticate } = require('../middleware/auth');
const { checkRole } = require('../middleware/checkRole');

const router = Router();

/**
 * GET /api/v1/tests/course/:courseId
 * Тест курсу (без правильних відповідей для студента).
 */
router.get(
  '/course/:courseId',
  authenticate,
  [param('courseId').isUUID(4).withMessage('Невірний формат ID курсу')],
  testController.getTestByCourse,
);

/**
 * POST /api/v1/tests/course/:courseId
 * Створення тесту. Тільки викладач-власник курсу.
 * Body: { title, questions: [{ question, options, correctIndex }], passingScore? }
 */
router.post(
  '/course/:courseId',
  authenticate,
  checkRole('teacher'),
  [
    param('courseId').isUUID(4).withMessage('Невірний формат ID курсу'),
    body('title').trim().notEmpty().withMessage('Назва тесту обов\'язкова'),
    body('questions').isArray({ min: 1 }).withMessage('Потрібно хоча б одне питання'),
    body('passingScore').optional().isInt({ min: 0, max: 100 }),
  ],
  testController.createTest,
);

/**
 * GET /api/v1/tests/course/:courseId/results
 * Результати поточного студента по тестах курсу.
 */
router.get(
  '/course/:courseId/results',
  authenticate,
  [param('courseId').isUUID(4).withMessage('Невірний формат ID курсу')],
  testController.getUserTestResults,
);

/**
 * POST /api/v1/tests/:id/submit
 * Студент здає тест.
 * Body: { answers: number[] }
 */
router.post(
  '/:id/submit',
  authenticate,
  checkRole('student'),
  [
    param('id').isUUID(4).withMessage('Невірний формат ID тесту'),
    body('answers').isArray({ min: 1 }).withMessage('Потрібен масив відповідей'),
  ],
  testController.submitTest,
);

module.exports = router;