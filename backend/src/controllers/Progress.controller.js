// src/controllers/progress.controller.js
// HTTP-шар прогресу студента.

'use strict';

const progressService = require('../services/progress.service');

/**
 * POST /api/v1/progress/lessons/:lessonId
 * Позначає урок як пройдений (або не пройдений).
 * Body: { completed?: boolean } (default: true)
 */
const markLessonProgress = async (req, res, next) => {
  try {
    const completed = req.body.completed !== undefined ? req.body.completed : true;
    const progress = await progressService.markLessonProgress(
      req.user.id,
      req.params.lessonId,
      completed,
    );

    return res.status(200).json({
      success: true,
      message: completed ? 'Урок позначено як пройдений.' : 'Позначку про прогрес знято.',
      data: { progress },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/v1/progress/courses/:courseId
 * Прогрес поточного користувача по конкретному курсу.
 */
const getCourseProgress = async (req, res, next) => {
  try {
    const progress = await progressService.getCourseProgress(req.user.id, req.params.courseId);
    return res.status(200).json({ success: true, data: progress });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/v1/progress/me
 * Прогрес поточного користувача по всіх курсах (дашборд студента).
 */
const getMyProgress = async (req, res, next) => {
  try {
    const progress = await progressService.getAllUserProgress(req.user.id);
    return res.status(200).json({ success: true, data: { courses: progress } });
  } catch (err) {
    return next(err);
  }
};

module.exports = { markLessonProgress, getCourseProgress, getMyProgress };