// src/services/progress.service.js
// Бізнес-логіка прогресу студента по урокам і курсам.

'use strict';

const { fn, col } = require('sequelize');
const { Course, Lesson, Progress, Enrollment, Category } = require('../models');

// ─────────────────────────────────────────────────────────────
// MARK LESSON PROGRESS
// ─────────────────────────────────────────────────────────────

/**
 * Позначає урок як пройдений або непройдений.
 * Використовує upsert — якщо запис вже є, оновлює його.
 *
 * Бізнес-правило: студент повинен бути записаний на курс уроку.
 *
 * @param {string} userId
 * @param {string} lessonId
 * @param {boolean} completed
 * @returns {Progress}
 */
const markLessonProgress = async (userId, lessonId, completed) => {
  // Знаходимо урок та перевіряємо запис на курс
  const lesson = await Lesson.findByPk(lessonId, {
    attributes: ['id', 'courseId'],
  });

  if (!lesson) {
    const err = new Error('Урок не знайдено.');
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  const enrollment = await Enrollment.findOne({
    where: { userId, courseId: lesson.courseId },
  });

  if (!enrollment) {
    const err = new Error('Ви не записані на цей курс.');
    err.statusCode = 403;
    err.isOperational = true;
    throw err;
  }

  // upsert: створюємо або оновлюємо запис прогресу
  const [progress] = await Progress.findOrCreate({
    where: { userId, lessonId },
    defaults: {
      userId,
      lessonId,
      completed,
      completedAt: completed ? new Date() : null,
    },
  });

  // Якщо запис вже існував — оновлюємо
  if (progress.completed !== completed) {
    await progress.update({
      completed,
      completedAt: completed ? new Date() : null,
    });
  }

  return progress;
};

// ─────────────────────────────────────────────────────────────
// GET COURSE PROGRESS
// ─────────────────────────────────────────────────────────────

/**
 * Повертає прогрес студента по конкретному курсу:
 * скільки уроків є, скільки пройдено, відсоток завершення.
 *
 * @param {string} userId
 * @param {string} courseId
 */
const getCourseProgress = async (userId, courseId) => {
  // Перевіряємо що студент записаний
  const enrollment = await Enrollment.findOne({ where: { userId, courseId } });
  if (!enrollment) {
    const err = new Error('Ви не записані на цей курс.');
    err.statusCode = 403;
    err.isOperational = true;
    throw err;
  }

  // Всі уроки курсу
  const lessons = await Lesson.findAll({
    where: { courseId },
    attributes: ['id', 'title', 'type', 'order'],
    order: [['order', 'ASC']],
  });

  // Пройдені уроки цього студента
  const completedProgress = await Progress.findAll({
    where: {
      userId,
      lessonId: lessons.map((l) => l.id),
      completed: true,
    },
    attributes: ['lessonId', 'completedAt'],
  });

  const completedSet = new Set(completedProgress.map((p) => p.lessonId));

  // Об'єднуємо дані
  const lessonsWithProgress = lessons.map((lesson) => ({
    id: lesson.id,
    title: lesson.title,
    type: lesson.type,
    order: lesson.order,
    completed: completedSet.has(lesson.id),
    completedAt: completedProgress.find((p) => p.lessonId === lesson.id)?.completedAt || null,
  }));

  const totalLessons = lessons.length;
  const completedCount = completedSet.size;
  const percentage = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  return {
    courseId,
    totalLessons,
    completedLessons: completedCount,
    percentage,
    isCompleted: percentage === 100,
    lessons: lessonsWithProgress,
  };
};

// ─────────────────────────────────────────────────────────────
// GET ALL USER PROGRESS (дашборд студента)
// ─────────────────────────────────────────────────────────────

/**
 * Повертає прогрес студента по всіх курсах на які він записаний.
 * Використовується для дашборду студента.
 *
 * @param {string} userId
 */
const getAllUserProgress = async (userId) => {
  // Всі курси студента через enrollments
  const enrollments = await Enrollment.findAll({
    where: { userId },
    include: [
      {
        model: Course,
        as: 'course',
        attributes: ['id', 'title', 'coverImage', 'price'],
        include: [
          { model: Category, as: 'category', attributes: ['id', 'name', 'icon'] },
        ],
      },
    ],
    attributes: ['courseId', 'enrolledAt'],
  });

  if (enrollments.length === 0) {
    return [];
  }

  const courseIds = enrollments.map((e) => e.courseId);

  // Кількість уроків по кожному курсу
  const lessonCounts = await Lesson.findAll({
    where: { courseId: courseIds },
    attributes: [
      'courseId',
      [fn('COUNT', col('id')), 'total'],
    ],
    group: ['courseId'],
    raw: true,
  });

  const lessonCountMap = {};
  lessonCounts.forEach((row) => {
    lessonCountMap[row.courseId] = parseInt(row.total, 10);
  });

  // Пройдені уроки студента по цих курсах
  const completedProgress = await Progress.findAll({
    where: { userId, completed: true },
    include: [
      {
        model: Lesson,
        as: 'lesson',
        attributes: ['courseId'],
        where: { courseId: courseIds },
        required: true,
      },
    ],
    attributes: ['id'],
    raw: true,
  });

  // Рахуємо пройдені уроки по кожному курсу
  const completedCountMap = {};
  completedProgress.forEach((row) => {
    const cId = row['lesson.courseId'];
    completedCountMap[cId] = (completedCountMap[cId] || 0) + 1;
  });

  // Збираємо фінальну відповідь
  return enrollments.map((enrollment) => {
    const courseId = enrollment.courseId;
    const total = lessonCountMap[courseId] || 0;
    const completed = completedCountMap[courseId] || 0;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      course: enrollment.course,
      enrolledAt: enrollment.enrolledAt,
      totalLessons: total,
      completedLessons: completed,
      percentage,
      isCompleted: total > 0 && percentage === 100,
    };
  });
};

module.exports = { markLessonProgress, getCourseProgress, getAllUserProgress };
