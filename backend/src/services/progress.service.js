// src/services/progress.service.js
// Бізнес-логіка прогресу студента по урокам, блокам і курсам.
//
// Курс складається з послідовності БЛОКІВ: кожен урок утворює один блок,
// опціонально доповнений тестом цього блоку (Test.lessonId). Блок
// вважається завершеним, коли урок прочитано І (якщо є тест блоку) тест
// складено. Для legacy-курсів зі старим підсумковим тестом на рівні
// курсу (Test.courseId) цей тест враховується як додатковий "фінальний
// блок" понад звичайні уроки.

'use strict';

const { Op } = require('sequelize');
const { Course, Lesson, Progress, Enrollment, Category, Test, Result, Topic } = require('../models');

// Вага уроку і його тесту в межах одного блоку.
// Якщо в блоці немає тесту — урок важить 100% блоку.
const LESSON_WEIGHT_IN_BLOCK = 70;
const TEST_WEIGHT_IN_BLOCK = 30;

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
// ДОПОМІЖНА ФУНКЦІЯ: статус курсового (legacy) тесту студента
// ─────────────────────────────────────────────────────────────

/**
 * Повертає статус підсумкового (legacy, courseId) тесту студента по курсу.
 * Якщо такого тесту немає взагалі — hasTest: false, passed: null.
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
// ДОПОМІЖНА ФУНКЦІЯ: побудова блоків курсу з прогресом одного студента
// ─────────────────────────────────────────────────────────────

/**
 * Будує список блоків курсу (урок + опціональний тест блоку) разом з
 * прогресом конкретного студента по кожному блоку, а також зведений
 * прогрес по всьому курсу (включно з legacy курсовим тестом, якщо є).
 *
 * @param {string} userId
 * @param {string} courseId
 * @returns {{ blocks, totalLessons, completedLessons, percentage, allLessonsDone, isCompleted, legacyTest }}
 */
const buildCourseBlocksProgress = async (userId, courseId) => {
  const lessons = await Lesson.findAll({
    where: { courseId },
    attributes: ['id', 'title', 'type', 'order'],
    order: [['order', 'ASC']],
  });

  const lessonIds = lessons.map((l) => l.id);

  // Прогрес студента по уроках цього курсу
  const completedProgress = await Progress.findAll({
    where: { userId, lessonId: lessonIds, completed: true },
    attributes: ['lessonId', 'completedAt'],
  });
  const completedLessonMap = {};
  completedProgress.forEach((p) => {
    completedLessonMap[p.lessonId] = p.completedAt;
  });

  // Тести блоків (Test.lessonId) для всіх уроків курсу одним запитом
  const blockTests = lessonIds.length
    ? await Test.findAll({
        where: { lessonId: { [Op.in]: lessonIds } },
        attributes: ['id', 'lessonId', 'title', 'passingScore'],
      })
    : [];
  const blockTestByLessonId = {};
  blockTests.forEach((t) => {
    blockTestByLessonId[t.lessonId] = t;
  });

  // Результати студента по всіх тестах блоків одним запитом
  const blockTestIds = blockTests.map((t) => t.id);
  const blockResults = blockTestIds.length
    ? await Result.findAll({
        where: { userId, testId: { [Op.in]: blockTestIds } },
        attributes: ['testId', 'score', 'passed'],
      })
    : [];
  const resultsByTestId = {};
  blockResults.forEach((r) => {
    if (!resultsByTestId[r.testId]) resultsByTestId[r.testId] = [];
    resultsByTestId[r.testId].push(r);
  });

  // ── Формуємо блоки ──
  let completedLessonsCount = 0;
  let blockWeightSum = 0;
  let blockWeightEarned = 0;
  let allBlocksDone = true;

  const blocks = lessons.map((lesson) => {
    const lessonCompleted = !!completedLessonMap[lesson.id];
    if (lessonCompleted) completedLessonsCount += 1;

    const blockTest = blockTestByLessonId[lesson.id] || null;
    const testResults = blockTest ? resultsByTestId[blockTest.id] || [] : [];
    const testPassed = blockTest ? testResults.some((r) => r.passed) : null;
    const testBestScore =
      testResults.length > 0 ? Math.max(...testResults.map((r) => r.score)) : null;

    const blockCompleted = lessonCompleted && (!blockTest || testPassed);
    if (!blockCompleted) allBlocksDone = false;

    // Зважений % всередині блоку: 100% якщо тесту немає, інакше 70/30
    const lessonWeight = blockTest ? LESSON_WEIGHT_IN_BLOCK : 100;
    const testWeight = blockTest ? TEST_WEIGHT_IN_BLOCK : 0;

    blockWeightSum += 100;
    blockWeightEarned += (lessonCompleted ? lessonWeight : 0) + (testPassed ? testWeight : 0);

    return {
      lesson: { id: lesson.id, title: lesson.title, type: lesson.type, order: lesson.order },
      lessonCompleted,
      completedAt: completedLessonMap[lesson.id] || null,
      test: blockTest
        ? {
            id: blockTest.id,
            title: blockTest.title,
            passingScore: blockTest.passingScore,
            passed: testPassed,
            bestScore: testBestScore,
            attemptsCount: testResults.length,
          }
        : null,
      isCompleted: blockCompleted,
    };
  });

  const totalLessons = lessons.length;
  const allLessonsDone = totalLessons > 0 && completedLessonsCount === totalLessons;

  // ── Тести тем (Test.topicId) — рахуються як додаткові блоки ──
  const topicTests = await Test.findAll({
    where: {},
    include: [{ model: Topic, as: 'topic', attributes: ['id', 'courseId'], where: { courseId }, required: true }],
    attributes: ['id', 'passingScore'],
  });

  let topicTestsEarned = 0;
  let allTopicTestsPassed = true;

  if (topicTests.length > 0) {
    const topicTestIds = topicTests.map((t) => t.id);
    const topicResults = await Result.findAll({
      where: { userId, testId: topicTestIds },
      attributes: ['testId', 'passed'],
    });
    const topicResultsByTestId = {};
    topicResults.forEach((r) => {
      if (!topicResultsByTestId[r.testId]) topicResultsByTestId[r.testId] = [];
      topicResultsByTestId[r.testId].push(r);
    });

    topicTests.forEach((tt) => {
      const results = topicResultsByTestId[tt.id] || [];
      const passed = results.some((r) => r.passed);
      if (passed) topicTestsEarned += 100;
      else allTopicTestsPassed = false;
    });
  }

  // ── Legacy курсовий тест (Test.courseId) — рахується як додатковий блок ──
  const legacyTest = await getTestStatus(userId, courseId);

  let percentage;
  const totalUnits = blocks.length + topicTests.length + (legacyTest.hasTest ? 1 : 0);

  if (totalUnits > 0) {
    const legacyEarned = legacyTest.hasTest ? (legacyTest.passed ? 100 : 0) : 0;
    percentage = Math.round((blockWeightEarned + topicTestsEarned + legacyEarned) / totalUnits);
  } else {
    percentage = 0;
  }

  const isCompleted =
    allLessonsDone &&
    allBlocksDone &&
    (topicTests.length === 0 || allTopicTestsPassed) &&
    (!legacyTest.hasTest || legacyTest.passed);

  return {
    blocks,
    totalLessons,
    completedLessons: completedLessonsCount,
    percentage,
    allLessonsDone,
    allBlocksDone,
    isCompleted,
    legacyTest,
  };
};

// ─────────────────────────────────────────────────────────────
// GET COURSE PROGRESS
// ─────────────────────────────────────────────────────────────

/**
 * Повертає прогрес студента по конкретному курсу, побудований по блоках
 * "урок-тест".
 *
 * isCompleted = всі блоки завершені (урок + тест блоку, якщо є) ТА
 * (legacy курсового тесту немає АБО він складений).
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

  const {
    blocks,
    totalLessons,
    completedLessons,
    percentage,
    allLessonsDone,
    allBlocksDone,
    isCompleted,
    legacyTest,
  } = await buildCourseBlocksProgress(userId, courseId);

  // lessons — лишаємо у відповіді для зворотної сумісності з клієнтами,
  // які ще читають "плаский" список уроків замість blocks.
  const lessonsWithProgress = blocks.map((b) => ({
    id: b.lesson.id,
    title: b.lesson.title,
    type: b.lesson.type,
    order: b.lesson.order,
    completed: b.lessonCompleted,
    completedAt: b.completedAt,
  }));

  return {
    courseId,
    totalLessons,
    completedLessons,
    percentage,
    allLessonsDone,
    allBlocksDone,
    isCompleted,
    test: legacyTest,
    blocks,
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
        include: [{ model: Category, as: 'category', attributes: ['id', 'name', 'icon'] }],
      },
    ],
    attributes: ['courseId', 'enrolledAt'],
  });

  if (enrollments.length === 0) {
    return [];
  }

  // Прогрес по блоках рахуємо по кожному курсу окремо — N+1 по курсам
  // студента (зазвичай невелика кількість), але кожен виклик всередині
  // вже пакетний по уроках/тестах одного курсу.
  const results = await Promise.all(
    enrollments.map(async (enrollment) => {
      const courseId = enrollment.courseId;
      const {
        totalLessons,
        completedLessons,
        percentage,
        allLessonsDone,
        isCompleted,
        legacyTest,
      } = await buildCourseBlocksProgress(userId, courseId);

      return {
        course: enrollment.course,
        enrolledAt: enrollment.enrolledAt,
        totalLessons,
        completedLessons,
        percentage,
        allLessonsDone,
        isCompleted,
        test: { hasTest: legacyTest.hasTest, passed: legacyTest.passed },
      };
    }),
  );

  return results;
};

module.exports = {
  markLessonProgress,
  getCourseProgress,
  getAllUserProgress,
  getTestStatus,
  buildCourseBlocksProgress,
};
