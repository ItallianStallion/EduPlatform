// src/services/progress.service.js
// Бізнес-логіка прогресу студента по урокам і курсам.

'use strict';

const { fn, col } = require('sequelize');
const { Course, Lesson, Progress, Enrollment, Category, Test, Result } = require('../models');

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
// ДОПОМІЖНА ФУНКЦІЯ: статус тесту студента по курсу
// ─────────────────────────────────────────────────────────────

/**
 * Повертає статус тесту студента по курсу.
 * Якщо тесту немає взагалі — hasTest: false, passed: null (не блокує
 * завершення курсу — курс без тесту завершується лише уроками).
 *
 * @param {string} userId
 * @param {string} courseId
 */
const getTestStatus = async (userId, courseId) => {
  const test = await Test.findOne({ where: { courseId }, attributes: ['id', 'passingScore'] });

  if (!test) {
    return { hasTest: false, passed: null, bestScore: null, attemptsCount: 0 };
  }

  const results = await Result.findAll({
    where: { userId, testId: test.id },
    attributes: ['score', 'passed'],
  });

  const passed = results.some((r) => r.passed);
  const bestScore = results.length > 0 ? Math.max(...results.map((r) => r.score)) : null;

  return {
    hasTest: true,
    passed,
    bestScore,
    attemptsCount: results.length,
    passingScore: test.passingScore,
  };
};

// ─────────────────────────────────────────────────────────────
// GET COURSE PROGRESS
// ─────────────────────────────────────────────────────────────

/**
 * Повертає прогрес студента по конкретному курсу.
 *
 * isCompleted = 100% уроків пройдено ТА (тесту немає АБО тест складено).
 * Без цієї перевірки студент міг отримати "курс завершено" просто
 * прочитавши всі уроки, навіть не здавши чи провалив тест.
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
  const allLessonsDone = totalLessons > 0 && completedCount === totalLessons;

  // Враховуємо тест у визначенні "завершеності" курсу
  const testStatus = await getTestStatus(userId, courseId);
  const isCompleted = allLessonsDone && (!testStatus.hasTest || testStatus.passed);

  // ── Зважений прогрес: уроки = 70%, тест = 30% ──
  // Якщо в курсі немає уроків — лекційна частина вважається "виконаною" (70%).
  // Якщо тесту немає взагалі (теоретично, бо публікація без тесту заблокована) —
  // тестова частина теж вважається "виконаною" (30%), щоб не псувати % за відсутній тест.
  const LESSONS_WEIGHT = 70;
  const TEST_WEIGHT = 30;

  const lessonsPart = totalLessons > 0 ? (completedCount / totalLessons) * LESSONS_WEIGHT : LESSONS_WEIGHT;
  const testPart = !testStatus.hasTest ? TEST_WEIGHT : (testStatus.passed ? TEST_WEIGHT : 0);
  const percentage = Math.round(lessonsPart + testPart);

  return {
    courseId,
    totalLessons,
    completedLessons: completedCount,
    percentage,
    allLessonsDone,
    isCompleted,
    test: testStatus,
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

  // ── Тести по всіх курсах студента одним запитом ──
  const tests = await Test.findAll({
    where: { courseId: courseIds },
    attributes: ['id', 'courseId'],
    raw: true,
  });

  const courseTestMap = {};
  tests.forEach((t) => {
    courseTestMap[t.courseId] = t.id;
  });

  const testIds = tests.map((t) => t.id);

  const allResults = testIds.length
    ? await Result.findAll({
        where: { userId, testId: testIds },
        attributes: ['testId', 'passed'],
        raw: true,
      })
    : [];

  const passedTestIds = new Set(allResults.filter((r) => r.passed).map((r) => r.testId));

  // Збираємо фінальну відповідь
  const LESSONS_WEIGHT = 70;
  const TEST_WEIGHT = 30;

  return enrollments.map((enrollment) => {
    const courseId = enrollment.courseId;
    const total = lessonCountMap[courseId] || 0;
    const completed = completedCountMap[courseId] || 0;
    const allLessonsDone = total > 0 && completed === total;

    const testId = courseTestMap[courseId];
    const hasTest = !!testId;
    const testPassed = hasTest ? passedTestIds.has(testId) : null;

    const isCompleted = allLessonsDone && (!hasTest || testPassed);

    const lessonsPart = total > 0 ? (completed / total) * LESSONS_WEIGHT : LESSONS_WEIGHT;
    const testPart = !hasTest ? TEST_WEIGHT : (testPassed ? TEST_WEIGHT : 0);
    const percentage = Math.round(lessonsPart + testPart);

    return {
      course: enrollment.course,
      enrolledAt: enrollment.enrolledAt,
      totalLessons: total,
      completedLessons: completed,
      percentage,
      allLessonsDone,
      isCompleted,
      test: { hasTest, passed: testPassed },
    };
  });
};

module.exports = { markLessonProgress, getCourseProgress, getAllUserProgress, getTestStatus };
