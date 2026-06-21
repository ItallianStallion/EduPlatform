// src/services/lesson.service.js
// Бізнес-логіка уроків: CRUD з перевіркою доступу.
//
// Курс може бути в одному з двох режимів (Course.accessMode):
//  - 'open'       — студент бачить і відкриває будь-який урок одразу.
//  - 'sequential' — урок N доступний студенту лише після того, як він
//                   позначив пройденим урок N-1 (за полем order).

'use strict';

const { Course, Lesson, Enrollment, Progress } = require('../models');

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
    if (!(requester.role === 'teacher' && course?.teacherId === requester.id) && requester.role !== 'admin') {
      const err = new Error('Курс не знайдено або ще не опубліковано.');
      err.statusCode = 404;
      err.isOperational = true;
      throw err;
    }
  }

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

/**
 * Повертає Set з id уроків, які студент вже позначив пройденими, по курсу.
 *
 * @param {string} userId
 * @param {string} courseId
 */
const getCompletedLessonIdsSet = async (userId, courseId) => {
  const completed = await Progress.findAll({
    where: { userId, completed: true },
    include: [{ model: Lesson, as: 'lesson', attributes: ['id'], where: { courseId }, required: true }],
    attributes: ['lessonId'],
  });
  return new Set(completed.map((p) => p.lessonId));
};

/**
 * Додає прапорець `locked` до кожного уроку (для студента в sequential-режимі).
 * Урок з найменшим order завжди відкритий. Кожен наступний — лише якщо
 * попередній (за order) вже пройдений.
 *
 * Для викладача/адміна та для режиму 'open' — locked завжди false.
 *
 * @param {Lesson[]} lessons - відсортовані за order ASC
 * @param {object} course
 * @param {{ id: string, role: string }} requester
 */
const annotateLockStatus = async (lessons, course, requester) => {
  const isSequentialForStudent = course.accessMode === 'sequential' && requester.role === 'student';

  if (!isSequentialForStudent) {
    return lessons.map((lesson) => ({ ...lesson.get({ plain: true }), locked: false }));
  }

  const completedSet = await getCompletedLessonIdsSet(requester.id, course.id);

  let previousCompleted = true; // перший урок завжди відкритий
  return lessons.map((lesson) => {
    const locked = !previousCompleted;
    // Якщо поточний урок НЕ пройдений — усі наступні будуть заблоковані
    previousCompleted = completedSet.has(lesson.id);
    return { ...lesson.get({ plain: true }), locked };
  });
};

// ─────────────────────────────────────────────────────────────
// GET
// ─────────────────────────────────────────────────────────────

/**
 * Повертає список уроків курсу, відсортованих за order, з прапорцем
 * locked для кожного (актуально лише для студента в sequential-режимі).
 *
 * @param {string} courseId
 * @param {{ id: string, role: string }} requester
 */
const getLessonsByCourse = async (courseId, requester) => {
  const course = await assertCourseAccess(courseId, requester);

  const lessons = await Lesson.findAll({
    where: { courseId },
    attributes: requester.role === 'student'
      ? ['id', 'title', 'type', 'order', 'createdAt']
      : ['id', 'title', 'type', 'order', 'content', 'videoUrl', 'pdfUrl', 'createdAt'],
    order: [['order', 'ASC']],
  });

  return annotateLockStatus(lessons, course, requester);
};

/**
 * Повертає деталі одного уроку.
 * У sequential-режимі студент не може відкрити заблокований урок —
 * повертається 403 з поясненням.
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

  const course = await assertCourseAccess(lesson.courseId, requester);

  // Перевірка блокування для студента в sequential-режимі
  if (course.accessMode === 'sequential' && requester.role === 'student') {
    const allLessons = await Lesson.findAll({
      where: { courseId: lesson.courseId },
      attributes: ['id', 'order'],
      order: [['order', 'ASC']],
    });

    const completedSet = await getCompletedLessonIdsSet(requester.id, lesson.courseId);

    let previousCompleted = true;
    for (const l of allLessons) {
      const locked = !previousCompleted;
      if (l.id === lesson.id) {
        if (locked) {
          const err = new Error(
            'Цей урок ще заблокований. Спочатку завершіть попередній урок курсу.',
          );
          err.statusCode = 403;
          err.isOperational = true;
          err.code = 'LESSON_LOCKED';
          throw err;
        }
        break;
      }
      previousCompleted = completedSet.has(l.id);
    }
  }

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
