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

module.exports = { getCourses, enrollInCourse };
