// src/controllers/analytics.controller.js
// HTTP-шар аналітики викладача.

'use strict';

const analyticsService = require('../services/analytics.service');

/**
 * GET /api/v1/analytics/courses/:courseId
 * Аналітика по одному курсу.
 */
const getCourseAnalytics = async (req, res, next) => {
  try {
    const analytics = await analyticsService.getCourseAnalytics(req.params.courseId, req.user.id);
    return res.status(200).json({ success: true, data: analytics });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/v1/analytics/courses/:courseId/students
 * Список студентів курсу з індивідуальним прогресом.
 */
const getCourseStudentsProgress = async (req, res, next) => {
  try {
    const students = await analyticsService.getCourseStudentsProgress(
      req.params.courseId,
      req.user.id,
    );
    return res.status(200).json({ success: true, data: { students } });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/v1/analytics/dashboard
 * Загальний дашборд викладача по всіх курсах.
 */
const getTeacherDashboard = async (req, res, next) => {
  try {
    const dashboard = await analyticsService.getTeacherDashboard(req.user.id);
    return res.status(200).json({ success: true, data: dashboard });
  } catch (err) {
    return next(err);
  }
};

module.exports = { getCourseAnalytics, getCourseStudentsProgress, getTeacherDashboard };