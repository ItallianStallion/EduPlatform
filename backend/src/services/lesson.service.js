// src/services/lesson.service.js
// Бізнес-логіка уроків: CRUD з перевіркою доступу.

'use strict';

const { Course, Lesson, Enrollment } = require('../models');

// ─────────────────────────────────────────────────────────────
// ДОПОМІЖНІ ФУНКЦІЇ
// ─────────────────────────────────────────────────────────────

/**
 * Перевіряє чи має користувач доступ до уроків курсу.
 * Доступ мають: власник-викладач, записані студенти, адміни.
 *
 * @param {string} courseId
 * @param {{ id: string, role: string }} requester
 */
const assertCourseAccess = async (courseId, requester) => {
  const course = await Course.findByPk(courseId);

  if (!course || course.status !== 'published') {
    // Викладач і адмін бачать і чернетки
    if (!(requester.role === 'teacher' && course?.teacherId === requester.id) && requester.role !== 'admin') {
      const err = new Error('Курс не знайдено або ще не опубліковано.');
      err.statusCode = 404;
      err.isOperational = true;
      throw err;
    }
  }

  // Студент — перевіряємо enrollment
  if (requester.role === 'student') {
    const enrollment = await Enrollment.findOne({
      where: { userId: requester.id, courseId },
    });
    if (!enrollment) {
      const err = new Error('Доступ заборонено. Спочатку запишіться на курс.');
      err.statusCode = 403;
      err.isOperational = true;
      throw err;
    }
  }

  return course;
};

/**
 * Перевіряє що викладач є власником курсу.
 */
const assertCourseOwner = async (courseId, teacherId) => {
  const course = await Course.findByPk(courseId);

  if (!course) {
    const err = new Error('Курс не знайдено.');
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  if (course.teacherId !== teacherId) {
    const err = new Error('Ви не є власником цього курсу.');
    err.statusCode = 403;
    err.isOperational = true;
    throw err;
  }

  return course;
};

// ─────────────────────────────────────────────────────────────
// GET
// ─────────────────────────────────────────────────────────────

/**
 * Повертає список уроків курсу, відсортованих за order.
 * Доступ: власник-викладач, записаний студент, адмін.
 *
 * @param {string} courseId
 * @param {{ id: string, role: string }} requester
 */
const getLessonsByCourse = async (courseId, requester) => {
  await assertCourseAccess(courseId, requester);

  const lessons = await Lesson.findAll({
    where: { courseId },
    // Студенти не бачать повний контент у списку — лише метадані
    attributes: requester.role === 'student'
      ? ['id', 'title', 'type', 'order', 'createdAt']
      : ['id', 'title', 'type', 'order', 'content', 'videoUrl', 'pdfUrl', 'createdAt'],
    order: [['order', 'ASC']],
  });

  return lessons;
};

/**
 * Повертає деталі одного уроку.
 * Доступ: той самий що і getLessonsByCourse.
 *
 * @param {string} lessonId
 * @param {{ id: string, role: string }} requester
 */
const getLessonById = async (lessonId, requester) => {
  const lesson = await Lesson.findByPk(lessonId);

  if (!lesson) {
    const err = new Error('Урок не знайдено.');
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  // Перевіряємо доступ до батьківського курсу
  await assertCourseAccess(lesson.courseId, requester);

  return lesson;
};

// ─────────────────────────────────────────────────────────────
// CREATE / UPDATE / DELETE
// ─────────────────────────────────────────────────────────────

/**
 * Створює новий урок у курсі.
 * Автоматично визначає наступний order якщо не передано.
 *
 * @param {string} teacherId
 * @param {string} courseId
 * @param {object} data - { title, type?, content?, videoUrl?, pdfUrl?, order? }
 */
const createLesson = async (teacherId, courseId, data) => {
  await assertCourseOwner(courseId, teacherId);

  const { title, type, content, videoUrl, pdfUrl, order } = data;

  // Якщо order не передано — ставимо в кінець
  let lessonOrder = order;
  if (lessonOrder === undefined) {
    const lastLesson = await Lesson.findOne({
      where: { courseId },
      order: [['order', 'DESC']],
      attributes: ['order'],
    });
    lessonOrder = lastLesson ? lastLesson.order + 1 : 0;
  }

  const lesson = await Lesson.create({
    courseId,
    title,
    type: type || 'text',
    content: content || null,
    videoUrl: videoUrl || null,
    pdfUrl: pdfUrl || null,
    order: lessonOrder,
  });

  return lesson;
};

/**
 * Оновлює урок. Тільки власник курсу.
 *
 * @param {string} lessonId
 * @param {string} teacherId
 * @param {object} updates
 */
const updateLesson = async (lessonId, teacherId, updates) => {
  const lesson = await Lesson.findByPk(lessonId);

  if (!lesson) {
    const err = new Error('Урок не знайдено.');
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  await assertCourseOwner(lesson.courseId, teacherId);

  const allowedFields = ['title', 'type', 'content', 'videoUrl', 'pdfUrl', 'order'];
  const safeUpdates = {};
  allowedFields.forEach((field) => {
    if (updates[field] !== undefined) {
      safeUpdates[field] = updates[field];
    }
  });

  await lesson.update(safeUpdates);
  return lesson;
};

/**
 * Видаляє урок. Тільки власник курсу.
 *
 * @param {string} lessonId
 * @param {string} teacherId
 */
const deleteLesson = async (lessonId, teacherId) => {
  const lesson = await Lesson.findByPk(lessonId);

  if (!lesson) {
    const err = new Error('Урок не знайдено.');
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  await assertCourseOwner(lesson.courseId, teacherId);
  await lesson.destroy();
};

module.exports = { getLessonsByCourse, getLessonById, createLesson, updateLesson, deleteLesson };
