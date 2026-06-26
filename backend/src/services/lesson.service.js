// src/services/lesson.service.js
// Бізнес-логіка уроків: CRUD з перевіркою доступу.
//
// Курс будується БЛОКАМИ: кожен урок утворює один блок, опціонально
// доповнений тестом цього блоку (Test.lessonId). Курс може бути в
// одному з двох режимів (Course.accessMode):
//  - 'open'       — студент бачить і відкриває будь-який урок одразу.
//  - 'sequential' — блок N доступний студенту лише після того, як
//                   ПОВНІСТЮ завершено блок N-1 (за полем order) —
//                   тобто пройдено урок N-1 І, якщо в ньому є тест,
//                   цей тест складено.

'use strict';

const { Course, Lesson, Enrollment, Progress, Test, Result } = require('../models');

// ─────────────────────────────────────────────────────────────
// ДОПОМІЖНІ ФУНКЦІЇ
// ─────────────────────────────────────────────────────────────

/**
 * Чи є запитувач власником курсу або admin'ом (тобто НЕ "учнем" цього курсу).
 * Використовується замість прямої перевірки `role === 'student'`, щоб
 * викладач, який навчається на чужому курсі, отримував той самий досвід
 * (блокування уроків, статус тестів), що і студент.
 */
const isOwnerOrAdmin = (course, requester) =>
  requester.role === 'admin' || (requester.role === 'teacher' && course.teacherId === requester.id);

/**
 * Чи записаний користувач на курс (Enrollment існує).
 * Власника/адміна тут не перевіряємо — це робиться окремо через isOwnerOrAdmin.
 *
 * @param {string} courseId
 * @param {{ id: string, role: string }|null} requester
 */
const isEnrolled = async (courseId, requester) => {
  if (!requester) return false;
  const enrollment = await Enrollment.findOne({
    where: { userId: requester.id, courseId },
    attributes: ['id'],
  });
  return !!enrollment;
};

/**
 * Перевіряє чи має користувач доступ до уроків курсу.
 *
 * Доступ без формального запису мають: власник-викладач курсу, admin.
 * Усі інші — студенти, а також ВИКЛАДАЧІ, які не є власником цього курсу —
 * повинні бути записані (Enrollment), щоб бачити контент уроків. Це навмисно
 * уніфіковано: викладач, що хоче навчатись на чужому курсі, проходить той
 * самий шлях запису, що і студент (включно з оплатою для платних курсів).
 *
 * @param {string} courseId
 * @param {{ id: string, role: string }} requester
 */
const assertCourseAccess = async (courseId, requester) => {
  const course = await Course.findByPk(courseId);

  if (!course) {
    const err = new Error('Курс не знайдено або ще не опубліковано.');
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  // Незалогінений — показуємо структуру курсу (назви уроків/тем)
  if (!requester) {
    if (course.status !== 'published') {
      const err = new Error('Курс не знайдено або ще не опубліковано.');
      err.statusCode = 404;
      err.isOperational = true;
      throw err;
    }
    return course;
  }

  const ownerOrAdmin = isOwnerOrAdmin(course, requester);

  if (course.status !== 'published' && !ownerOrAdmin) {
    const err = new Error('Курс не знайдено або ще не опубліковано.');
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  // Структуру (назви уроків) бачать усі — доступ до контенту перевіряється при відкритті уроку.
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
    include: [
      { model: Lesson, as: 'lesson', attributes: ['id'], where: { courseId }, required: true },
    ],
    attributes: ['lessonId'],
  });
  return new Set(completed.map((p) => p.lessonId));
};

/**
 * Повертає Set з id уроків курсу, чий тест блоку студент вже склав
 * (passed: true хоча б одна спроба). Уроки без тесту блоку сюди не
 * потрапляють — це навмисно, перевіряється окремо через blockTestByLessonId.
 *
 * @param {string} userId
 * @param {string} courseId
 */
const getPassedBlockTestLessonIdsSet = async (userId, courseId) => {
  const lessons = await Lesson.findAll({ where: { courseId }, attributes: ['id'] });
  const lessonIds = lessons.map((l) => l.id);
  if (lessonIds.length === 0) return { passedSet: new Set(), blockTestLessonIds: new Set() };

  const blockTests = await Test.findAll({
    where: { lessonId: lessonIds },
    attributes: ['id', 'lessonId'],
  });
  if (blockTests.length === 0) return { passedSet: new Set(), blockTestLessonIds: new Set() };

  const testIdToLessonId = {};
  blockTests.forEach((t) => {
    testIdToLessonId[t.id] = t.lessonId;
  });

  const passedResults = await Result.findAll({
    where: { userId, testId: Object.keys(testIdToLessonId), passed: true },
    attributes: ['testId'],
  });

  const passedSet = new Set(passedResults.map((r) => testIdToLessonId[r.testId]));
  const blockTestLessonIds = new Set(blockTests.map((t) => t.lessonId));

  return { passedSet, blockTestLessonIds };
};

/**
 * Додає прапорець `locked` до кожного уроку (для студента в sequential-режимі).
 * Блок з найменшим order завжди відкритий. Кожен наступний блок —
 * лише якщо ПОПЕРЕДНІЙ блок повністю завершений: урок пройдено І,
 * якщо в ньому є тест блоку, цей тест складено.
 *
 * Для викладача/адміна та для режиму 'open' — locked завжди false.
 *
 * @param {Lesson[]} lessons - відсортовані за order ASC
 * @param {object} course
 * @param {{ id: string, role: string }} requester
 */
const annotateLockStatus = async (lessons, course, requester) => {
  const isSequentialForLearner = course.accessMode === 'sequential'
    && requester
    && !isOwnerOrAdmin(course, requester);

  if (!isSequentialForLearner) {
    return lessons.map((lesson) => ({ ...lesson.get({ plain: true }), locked: false }));
  }

  const completedSet = await getCompletedLessonIdsSet(requester.id, course.id);
  const { passedSet, blockTestLessonIds } = await getPassedBlockTestLessonIdsSet(
    requester.id,
    course.id,
  );

  const isBlockDone = (lessonId) => {
    const lessonDone = completedSet.has(lessonId);
    const hasBlockTest = blockTestLessonIds.has(lessonId);
    return lessonDone && (!hasBlockTest || passedSet.has(lessonId));
  };

  let previousBlockDone = true; // перший блок завжди відкритий
  return lessons.map((lesson) => {
    const locked = !previousBlockDone;
    previousBlockDone = isBlockDone(lesson.id);
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
  const isLearner = !requester || !isOwnerOrAdmin(course, requester);

  const lessons = await Lesson.findAll({
    where: { courseId },
    attributes: isLearner
      ? ['id', 'title', 'type', 'order', 'createdAt']
      : ['id', 'title', 'type', 'order', 'content', 'videoUrl', 'pdfUrl', 'createdAt'],
    order: [['order', 'ASC']],
  });

  return annotateLockStatus(lessons, course, requester);
};

/**
 * Повертає курс як список БЛОКІВ: кожен блок = урок + метадані тесту
 * цього блоку (якщо є), у тому ж порядку, що й уроки. Зручно для
 * фронтенду, щоб не робити окремий запит за тестом на кожен урок.
 *
 * Метадані тесту НЕ містять питань/відповідей — лише існування,
 * id, назву та (для студента) короткий статус проходження.
 *
 * @param {string} courseId
 * @param {{ id: string, role: string }} requester
 */
const getCourseBlocks = async (courseId, requester) => {
  const course = await assertCourseAccess(courseId, requester);
  const ownerOrAdmin = !!requester && isOwnerOrAdmin(course, requester);
  const isLearner = !ownerOrAdmin;
  const enrolled = ownerOrAdmin || (await isEnrolled(courseId, requester));

  const lessons = await Lesson.findAll({
    where: { courseId },
    attributes: isLearner
      ? ['id', 'title', 'type', 'order', 'createdAt']
      : ['id', 'title', 'type', 'order', 'content', 'videoUrl', 'pdfUrl', 'createdAt'],
    order: [['order', 'ASC']],
  });

  const lessonsWithLock = await annotateLockStatus(lessons, course, requester);
  const lessonIds = lessons.map((l) => l.id);

  const blockTests = lessonIds.length
    ? await Test.findAll({
        where: { lessonId: lessonIds },
        attributes: ['id', 'lessonId', 'title', 'passingScore', 'maxAttempts'],
      })
    : [];
  const testByLessonId = {};
  blockTests.forEach((t) => {
    testByLessonId[t.lessonId] = t;
  });

  // Для учня (студента або викладача-не-власника) — короткий статус
  // "складено/не складено" по кожному тесту блоку, без розкриття питань.
  let passedSet = new Set();
  if (isLearner && requester && blockTests.length > 0) {
    const blockTestIds = blockTests.map((t) => t.id);
    const passedResults = await Result.findAll({
      where: { userId: requester.id, testId: blockTestIds, passed: true },
      attributes: ['testId'],
    });
    passedSet = new Set(passedResults.map((r) => r.testId));
  }

  const blocks = lessonsWithLock.map((lesson) => {
    const blockTest = testByLessonId[lesson.id] || null;
    return {
      lesson,
      test: blockTest
        ? {
            id: blockTest.id,
            title: blockTest.title,
            passingScore: blockTest.passingScore,
            maxAttempts: blockTest.maxAttempts,
            passed: isLearner ? passedSet.has(blockTest.id) : null,
          }
        : null,
    };
  });

  return { blocks, enrolled };
};

/**
 * Повертає деталі одного уроку.
 * У sequential-режимі студент не може відкрити заблокований урок
 * (тобто урок наступного блоку, поки попередній блок не завершено
 * повністю — урок + тест блоку) — повертається 403 з поясненням.
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
  const ownerOrAdmin = requester && isOwnerOrAdmin(course, requester);

  // Контент уроку (відео/текст/PDF) доступний лише записаним студентам,
  // власнику курсу або admin'у. Незалогінений або незаписаний користувач
  // бачить структуру курсу (через getCourseBlocks/getLessonsByCourse), але
  // не сам контент — інакше платні курси були б відкриті будь-кому.
  if (!ownerOrAdmin) {
    const enrolled = requester && (await isEnrolled(lesson.courseId, requester));
    if (!enrolled) {
      const err = new Error('Щоб відкрити цей урок, потрібно записатись на курс.');
      err.statusCode = 403;
      err.isOperational = true;
      err.code = 'NOT_ENROLLED';
      throw err;
    }
  }

  // Перевірка блокування для учня (студента або чужого викладача) в sequential-режимі
  if (course.accessMode === 'sequential' && !ownerOrAdmin) {
    const allLessons = await Lesson.findAll({
      where: { courseId: lesson.courseId },
      attributes: ['id', 'order'],
      order: [['order', 'ASC']],
    });

    const completedSet = await getCompletedLessonIdsSet(requester.id, lesson.courseId);
    const { passedSet, blockTestLessonIds } = await getPassedBlockTestLessonIdsSet(
      requester.id,
      lesson.courseId,
    );

    const isBlockDone = (lessonId2) => {
      const lessonDone = completedSet.has(lessonId2);
      const hasBlockTest = blockTestLessonIds.has(lessonId2);
      return lessonDone && (!hasBlockTest || passedSet.has(lessonId2));
    };

    let previousBlockDone = true;
    for (const l of allLessons) {
      const locked = !previousBlockDone;
      if (l.id === lesson.id) {
        if (locked) {
          const err = new Error(
            'Цей урок ще заблокований. Спочатку завершіть попередній блок курсу (урок і його тест).',
          );
          err.statusCode = 403;
          err.isOperational = true;
          err.code = 'LESSON_LOCKED';
          throw err;
        }
        break;
      }
      previousBlockDone = isBlockDone(l.id);
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
 * Видалення уроку каскадно видаляє і тест його блоку (onDelete: CASCADE
 * на Test.lessonId), якщо такий є.
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

module.exports = {
  getLessonsByCourse,
  getCourseBlocks,
  getLessonById,
  createLesson,
  updateLesson,
  deleteLesson,
};
