// src/controllers/course.controller.js
// HTTP-шар для курсів: каталог, пошук, запис на курс.

'use strict';

const { validationResult } = require('express-validator');
const courseService = require('../services/course.service');

/**
 * GET /api/v1/courses
 * Каталог курсів з пошуком, фільтрацією, сортуванням та пагінацією.
 *
 * Query params:
 *   q          - рядок пошуку (мін. 3 символи, інакше всі курси)
 *   categoryId - UUID категорії
 *   price      - 'free' | 'paid' | 'any'
 *   sortBy     - 'popular' | 'newest' | 'price_asc' | 'price_desc'
 *   page       - номер сторінки (default: 1)
 *   limit      - записів на сторінці (default: 12, max: 50)
 */
const getCourses = async (req, res, next) => {
  try {
    const { q, categoryId, price, sortBy, page, limit } = req.query;

    // Обмежуємо limit для захисту від перевантаження
    const safeLimit = Math.min(parseInt(limit, 10) || 12, 50);

    const result = await courseService.getCourses({
      q,
      categoryId,
      price,
      sortBy,
      page: parseInt(page, 10) || 1,
      limit: safeLimit,
    });

    // Якщо нічого не знайдено — повертаємо порожній масив (фронтенд рендерить повідомлення)
    return res.status(200).json({
      success: true,
      data: {
        courses: result.courses,
        totalCount: result.totalCount, // Для відображення "Знайдено N курсів"
        page: result.page,
        totalPages: result.totalPages,
        limit: result.limit,
      },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/v1/courses/:id/enroll
 * Запис студента на курс. Потрібна авторизація (роль: student).
 */
const enrollInCourse = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const courseId = req.params.id;
    const studentId = req.user.id; // Встановлює middleware authenticate

    const result = await courseService.enrollInCourse(courseId, studentId);

    // Підбираємо повідомлення залежно від типу курсу
    const message = result.isFree
      ? 'Вітаємо! Ви успішно записались на курс.'
      : `Вітаємо! Оплату підтверджено. Ви записались на курс.`;

    return res.status(201).json({
      success: true,
      message,
      data: {
        enrollmentId: result.enrollment.id,
        enrolledAt: result.enrollment.enrolledAt,
        ...(result.paymentResult && { payment: result.paymentResult }),
      },
    });
  } catch (err) {
    // Якщо студент вже записаний — повертаємо специфічний статус
    if (err.code === 'ALREADY_ENROLLED') {
      return res.status(409).json({
        success: false,
        message: err.message,
        code: 'ALREADY_ENROLLED',
      });
    }
    return next(err);
  }
};

/**
 * POST /api/v1/courses
 * Створення нового курсу. Тільки для викладачів.
 * Body: { title, description, categoryId, price, coverImage }
 */
const createCourse = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const teacherId = req.user.id;
    const course = await courseService.createCourse(teacherId, req.body);

    return res.status(201).json({
      success: true,
      message: 'Курс створено як чернетка. Опублікуйте його, коли будете готові.',
      data: { course },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * PATCH /api/v1/courses/:id
 * Редагування курсу. Тільки власник-викладач.
 */
const updateCourse = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const course = await courseService.updateCourse(req.params.id, req.user.id, req.body);

    return res.status(200).json({
      success: true,
      message: 'Курс оновлено.',
      data: { course },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * PATCH /api/v1/courses/:id/publish
 * Публікує курс (draft → published).
 */
const publishCourse = async (req, res, next) => {
  try {
    const course = await courseService.setCourseStatus(req.params.id, req.user.id, 'publish');

    return res.status(200).json({
      success: true,
      message: 'Курс опубліковано! Тепер він видимий студентам.',
      data: { course },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * PATCH /api/v1/courses/:id/unpublish
 * Знімає курс з публікації (published → draft).
 */
const unpublishCourse = async (req, res, next) => {
  try {
    const course = await courseService.setCourseStatus(req.params.id, req.user.id, 'unpublish');

    return res.status(200).json({
      success: true,
      message: 'Курс знято з публікації.',
      data: { course },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/v1/courses/my
 * Повертає всі курси поточного викладача (включно з draft).
 */
const getMyCourses = async (req, res, next) => {
  try {
    const courses = await courseService.getMyCourses(req.user.id);

    return res.status(200).json({
      success: true,
      data: { courses },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/v1/courses/:id
 * Деталі одного курсу.
 */
const getCourseById = async (req, res, next) => {
  try {
    // req.user може бути відсутній (публічний доступ для published курсів)
    const course = await courseService.getCourseById(req.params.id, req.user || null);

    return res.status(200).json({
      success: true,
      data: { course },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * DELETE /api/v1/courses/:id
 * Видалення курсу. Тільки власник-викладач.
 */
const deleteCourse = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    await courseService.deleteCourse(req.params.id, req.user.id);

    return res.status(200).json({
      success: true,
      message: 'Курс видалено.',
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  getCourses,
  enrollInCourse,
  createCourse,
  updateCourse,
  deleteCourse,
  publishCourse,
  unpublishCourse,
  getMyCourses,
  getCourseById,
};
