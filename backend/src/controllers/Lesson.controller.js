// src/controllers/lesson.controller.js
// HTTP-шар уроків.

'use strict';

const { validationResult } = require('express-validator');
const lessonService = require('../services/lesson.service');

/**
 * GET /api/v1/lessons/course/:courseId
 * Список уроків курсу (доступ лише для записаних студентів / власника / admin).
 */
const getLessonsByCourse = async (req, res, next) => {
  try {
    const lessons = await lessonService.getLessonsByCourse(req.params.courseId, req.user);
    return res.status(200).json({ success: true, data: { lessons } });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/v1/lessons/course/:courseId/blocks
 * Курс як список блоків: кожен блок = урок + метадані тесту цього блоку
 * (без питань/відповідей). Зручно для рендеру структури "урок-тест,
 * урок-тест" одним запитом.
 */
const getCourseBlocks = async (req, res, next) => {
  try {
    const { blocks, enrolled } = await lessonService.getCourseBlocks(req.params.courseId, req.user);
    return res.status(200).json({ success: true, data: { blocks, enrolled } });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/v1/lessons/:id
 * Деталі одного уроку.
 */
const getLessonById = async (req, res, next) => {
  try {
    const lesson = await lessonService.getLessonById(req.params.id, req.user);
    return res.status(200).json({ success: true, data: { lesson } });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/v1/lessons/course/:courseId
 * Створення уроку. Тільки власник курсу (викладач).
 */
const createLesson = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const lesson = await lessonService.createLesson(req.user.id, req.params.courseId, req.body);

    return res.status(201).json({
      success: true,
      message: 'Урок створено.',
      data: { lesson },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * PATCH /api/v1/lessons/:id
 * Редагування уроку. Тільки власник курсу.
 */
const updateLesson = async (req, res, next) => {
  try {
    const lesson = await lessonService.updateLesson(req.params.id, req.user.id, req.body);
    return res.status(200).json({
      success: true,
      message: 'Урок оновлено.',
      data: { lesson },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * DELETE /api/v1/lessons/:id
 * Видалення уроку. Тільки власник курсу.
 */
const deleteLesson = async (req, res, next) => {
  try {
    await lessonService.deleteLesson(req.params.id, req.user.id);
    return res.status(200).json({ success: true, message: 'Урок видалено.' });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  getLessonsByCourse,
  getCourseBlocks,
  getLessonById,
  createLesson,
  updateLesson,
  deleteLesson,
};
