// src/controllers/test.controller.js
// HTTP-шар тестів.

'use strict';

const { validationResult } = require('express-validator');
const testService = require('../services/test.service');

/**
 * GET /api/v1/tests/course/:courseId
 * Повертає тест курсу. Студенту — без правильних відповідей.
 */
const getTestByCourse = async (req, res, next) => {
  try {
    const test = await testService.getTestByCourse(req.params.courseId, req.user || null);
    return res.status(200).json({ success: true, data: { test } });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/v1/tests/course/:courseId
 * Створення тесту для курсу. Тільки власник-викладач.
 * Body: { title, questions: [{question, options, correctIndex}], passingScore? }
 */
const createTest = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const test = await testService.createTest(req.user.id, req.params.courseId, req.body);

    return res.status(201).json({
      success: true,
      message: 'Тест створено.',
      data: { test },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/v1/tests/:id/submit
 * Студент здає тест.
 * Body: { answers: number[] }
 */
const submitTest = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const result = await testService.submitTest(req.user.id, req.params.id, req.body.answers);

    const message = result.passed
      ? `Вітаємо! Тест складено успішно (${result.score}%).`
      : `Тест не складено (${result.score}%). Потрібно мінімум ${result.passingScore}%.`;

    return res.status(200).json({
      success: true,
      message,
      data: result,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/v1/tests/course/:courseId/results
 * Результати поточного користувача по тестах курсу.
 */
const getUserTestResults = async (req, res, next) => {
  try {
    const results = await testService.getUserTestResults(req.user.id, req.params.courseId);
    return res.status(200).json({ success: true, data: { results } });
  } catch (err) {
    return next(err);
  }
};

/**
 * PATCH /api/v1/tests/:id
 * Редагування тесту (наприклад, maxAttempts, passingScore). Тільки власник.
 */
const updateTest = async (req, res, next) => {
  try {
    const test = await testService.updateTest(req.params.id, req.user.id, req.body);
    return res.status(200).json({
      success: true,
      message: 'Тест оновлено.',
      data: { test },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/v1/tests/lesson/:lessonId
 * Повертає тест блоку (прив'язаний до уроку). Студенту — без правильних
 * відповідей, доступний лише після завершення уроку цього блоку.
 */
const getTestByLesson = async (req, res, next) => {
  try {
    const test = await testService.getTestByLesson(req.params.lessonId, req.user || null);
    return res.status(200).json({ success: true, data: { test } });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/v1/tests/lesson/:lessonId
 * Створення тесту блоку, прив'язаного до уроку. Тільки власник-викладач.
 * Body: { title, questions: [{question, options, correctIndex}], passingScore? }
 */
const createTestForLesson = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const test = await testService.createTestForLesson(req.user.id, req.params.lessonId, req.body);

    return res.status(201).json({
      success: true,
      message: 'Тест блоку створено.',
      data: { test },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/v1/tests/lesson/:lessonId/results
 * Результати поточного користувача по тесту блоку.
 */
const getUserTestResultsByLesson = async (req, res, next) => {
  try {
    const results = await testService.getUserTestResultsByLesson(req.user.id, req.params.lessonId);
    return res.status(200).json({ success: true, data: { results } });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/v1/tests/topic/:topicId
 * Повертає деталі тесту теми.
 * Викладач/адмін — з правильними відповідями.
 * Студент — без правильних відповідей.
 */
const getTestByTopic = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const test = await testService.getTestByTopic(req.params.topicId, req.user || null);
    return res.status(200).json({ success: true, data: { test } });
  } catch (err) {
    return next(err);
  }
};

/**
 * PATCH /api/v1/tests/topic/:topicId
 * Редагування тесту теми. Тільки власник курсу.
 * Body: { title?, questions?, passingScore?, maxAttempts? }
 */
const updateTopicTest = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const test = await testService.updateTopicTest(req.params.topicId, req.user.id, req.body);
    return res.status(200).json({
      success: true,
      message: 'Тест теми оновлено.',
      data: { test },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * DELETE /api/v1/tests/lesson/:lessonId
 * Видалення тесту блоку, прив'язаного до уроку. Тільки власник-викладач.
 */
const deleteTestForLesson = async (req, res, next) => {
  try {
    await testService.deleteTestForLesson(req.params.lessonId, req.user.id);
    return res.status(200).json({
      success: true,
      message: 'Тест блоку видалено.',
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * DELETE /api/v1/tests/topic/:topicId
 * Видалення тесту теми. Тільки власник курсу.
 */
const deleteTopicTest = async (req, res, next) => {
  try {
    await testService.deleteTopicTest(req.params.topicId, req.user.id);
    return res.status(200).json({
      success: true,
      message: 'Тест теми видалено.',
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  getTestByCourse,
  getTestByLesson,
  getTestByTopic,
  createTest,
  createTestForLesson,
  updateTest,
  updateTopicTest,
  deleteTestForLesson,
  deleteTopicTest,
  submitTest,
  getUserTestResults,
  getUserTestResultsByLesson,
};
