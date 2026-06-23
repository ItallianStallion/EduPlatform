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
    body('title').trim().notEmpty().withMessage("Назва тесту обов'язкова"),
    body('questions').isArray({ min: 1 }).withMessage('Потрібно хоча б одне питання'),
    body('passingScore').optional().isInt({ min: 0, max: 100 }),
    body('maxAttempts')
      .optional({ nullable: true })
      .isInt({ min: 1 })
      .withMessage(
        'maxAttempts повинен бути цілим числом ≥ 1 (або не вказаний для необмеженої кількості)',
      ),
  ],
  testController.createTest,
);

/**
 * GET /api/v1/tests/lesson/:lessonId
 * Тест блоку (без правильних відповідей для студента). Доступний лише
 * після завершення уроку цього блоку.
 */
router.get(
  '/lesson/:lessonId',
  authenticate,
  [param('lessonId').isUUID(4).withMessage('Невірний формат ID уроку')],
  testController.getTestByLesson,
);

/**
 * POST /api/v1/tests/lesson/:lessonId
 * Створення тесту блоку, прив'язаного до уроку. Тільки викладач-власник курсу.
 * Body: { title, questions: [{ question, options, correctIndex }], passingScore? }
 */
router.post(
  '/lesson/:lessonId',
  authenticate,
  checkRole('teacher'),
  [
    param('lessonId').isUUID(4).withMessage('Невірний формат ID уроку'),
    body('title').trim().notEmpty().withMessage("Назва тесту обов'язкова"),
    body('questions').isArray({ min: 1 }).withMessage('Потрібно хоча б одне питання'),
    body('passingScore').optional().isInt({ min: 0, max: 100 }),
    body('maxAttempts')
      .optional({ nullable: true })
      .isInt({ min: 1 })
      .withMessage(
        'maxAttempts повинен бути цілим числом ≥ 1 (або не вказаний для необмеженої кількості)',
      ),
  ],
  testController.createTestForLesson,
);

/**
 * GET /api/v1/tests/lesson/:lessonId/results
 * Результати поточного студента по тесту блоку.
 */
router.get(
  '/lesson/:lessonId/results',
  authenticate,
  [param('lessonId').isUUID(4).withMessage('Невірний формат ID уроку')],
  testController.getUserTestResultsByLesson,
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
 * Здача тесту. Студенти — завжди; викладачі — якщо записані на чужий курс
 * (перевірка Enrollment відбувається у test.service.js).
 * Body: { answers: number[] }
 */
router.post(
  '/:id/submit',
  authenticate,
  checkRole('student', 'teacher'),
  [
    param('id').isUUID(4).withMessage('Невірний формат ID тесту'),
    body('answers').isArray({ min: 1 }).withMessage('Потрібен масив відповідей'),
  ],
  testController.submitTest,
);

/**
 * PATCH /api/v1/tests/:id
 * Редагування тесту. Тільки власник курсу.
 * Body: { title?, questions?, passingScore?, maxAttempts? }
 */
router.patch(
  '/:id',
  authenticate,
  checkRole('teacher'),
  [
    param('id').isUUID(4).withMessage('Невірний формат ID тесту'),
    body('passingScore').optional().isInt({ min: 0, max: 100 }),
    body('maxAttempts').optional({ nullable: true }).isInt({ min: 1 }),
  ],
  testController.updateTest,
);


/**
 * POST /api/v1/tests/topic/:topicId
 * Створення тесту для теми курсу.
 */
router.post(
  '/topic/:topicId',
  authenticate,
  checkRole('teacher'),
  [
    body('title').notEmpty().isString(),
    body('questions').isArray({ min: 1 }),
    body('passingScore').optional().isInt({ min: 0, max: 100 }),
    body('maxAttempts').optional({ nullable: true }).isInt({ min: 1 }),
  ],
  async (req, res, next) => {
    const { validationResult } = require('express-validator');
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }
    try {
      const { createTestForTopic } = require('../services/test.service');
      const test = await createTestForTopic(req.user.id, req.params.topicId, req.body);
      return res.status(201).json({ success: true, message: 'Тест теми створено.', data: { test } });
    } catch (err) {
      return next(err);
    }
  },
);

module.exports = router;
