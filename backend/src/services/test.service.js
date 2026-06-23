// src/services/test.service.js
// Бізнес-логіка тестів: створення, здача з лімітом спроб, результати.
//
// Тест може належати:
//  - уроку (lessonId)  — НОВИЙ формат: блок "урок-тест". Тест доступний
//    студенту лише після завершення свого уроку.
//  - курсу (courseId)  — LEGACY формат: один підсумковий тест на весь
//    курс (для курсів, які ще не перейшли на блокову структуру).
//    Доступний лише після завершення ВСІХ уроків курсу (sequential-режим).

'use strict';

const { Test, Course, Enrollment, Result, Lesson, Progress } = require('../models');

// ─────────────────────────────────────────────────────────────
// ДОПОМІЖНІ ФУНКЦІЇ
// ─────────────────────────────────────────────────────────────

/**
 * Прибирає correctIndex з питань та додає інформацію про спроби.
 * Спільна серіалізація тесту для студента — незалежно від того,
 * блоковий це тест чи курсовий.
 */
const serializeTestForStudent = (test, attemptsUsed) => {
  const attemptsLeft = test.maxAttempts ? Math.max(test.maxAttempts - attemptsUsed, 0) : null;

  const safeQuestions = test.questions.map(({ question, options }) => ({
    question,
    options,
    // correctIndex навмисно відсутній
  }));

  return {
    id: test.id,
    title: test.title,
    courseId: test.courseId,
    lessonId: test.lessonId,
    passingScore: test.passingScore,
    maxAttempts: test.maxAttempts,
    attemptsUsed,
    attemptsLeft, // null = необмежено
    questionsCount: test.questions.length,
    questions: safeQuestions,
  };
};

/**
 * Перевіряє, що студент завершив конкретний урок (для доступу до тесту
 * блоку). Викладач/admin завжди мають доступ.
 */
const assertLessonCompletedForBlockTest = async (userId, lesson) => {
  const progress = await Progress.findOne({
    where: { userId, lessonId: lesson.id, completed: true },
  });

  if (!progress) {
    const err = new Error('Тест блоку буде доступний після завершення уроку цього блоку.');
    err.statusCode = 403;
    err.isOperational = true;
    err.code = 'LESSON_NOT_FINISHED';
    throw err;
  }
};

// ─────────────────────────────────────────────────────────────
// GET TEST ПО КУРСУ (legacy — підсумковий тест курсу)
// ─────────────────────────────────────────────────────────────

/**
 * Повертає підсумковий тест курсу (legacy-формат, courseId на Test).
 * Студент отримує питання БЕЗ correctIndex + інформацію про залишок спроб.
 * Якщо курс у режимі 'sequential' — тест доступний студенту лише після
 * завершення ВСІХ уроків курсу.
 *
 * @param {string} courseId
 * @param {{ id: string, role: string } | null} requester
 */
const getTestByCourse = async (courseId, requester) => {
  const course = await Course.findByPk(courseId);
  if (!course || course.status !== 'published') {
    const isOwner = requester && requester.role === 'teacher' && course?.teacherId === requester.id;
    if (!isOwner) {
      const err = new Error('Курс не знайдено або ще не опубліковано.');
      err.statusCode = 404;
      err.isOperational = true;
      throw err;
    }
  }

  const test = await Test.findOne({ where: { courseId } });

  if (!test) {
    const err = new Error('Підсумковий тест для цього курсу ще не створено.');
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  const isTeacherOrAdmin =
    requester &&
    (requester.role === 'admin' ||
      (requester.role === 'teacher' && course.teacherId === requester.id));

  if (isTeacherOrAdmin) {
    return test;
  }

  // ── Студент: перевіряємо доступ за режимом курсу ──
  if (!requester) {
    const err = new Error('Потрібна авторизація.');
    err.statusCode = 401;
    err.isOperational = true;
    throw err;
  }

  const enrollment = await Enrollment.findOne({ where: { userId: requester.id, courseId } });
  if (!enrollment) {
    const err = new Error('Ви не записані на цей курс.');
    err.statusCode = 403;
    err.isOperational = true;
    throw err;
  }

  if (course.accessMode === 'sequential') {
    const totalLessons = await Lesson.count({ where: { courseId } });
    const completedLessons = await Progress.count({
      where: { userId: requester.id, completed: true },
      include: [
        { model: Lesson, as: 'lesson', attributes: [], where: { courseId }, required: true },
      ],
    });

    if (totalLessons > 0 && completedLessons < totalLessons) {
      const err = new Error('Тест буде доступний після завершення всіх уроків курсу.');
      err.statusCode = 403;
      err.isOperational = true;
      err.code = 'COURSE_NOT_FINISHED';
      throw err;
    }
  }

  const attemptsUsed = await Result.count({ where: { userId: requester.id, testId: test.id } });
  return serializeTestForStudent(test, attemptsUsed);
};

// ─────────────────────────────────────────────────────────────
// GET TEST ПО УРОКУ (новий формат — тест блоку)
// ─────────────────────────────────────────────────────────────

/**
 * Повертає тест блоку, прив'язаний до конкретного уроку.
 * Студент отримує питання БЕЗ correctIndex + інформацію про залишок спроб.
 * Тест доступний студенту лише ПІСЛЯ завершення уроку цього блоку
 * (незалежно від accessMode курсу — блокова логіка завжди послідовна
 * в межах одного блоку: спочатку урок, потім тест).
 *
 * @param {string} lessonId
 * @param {{ id: string, role: string } | null} requester
 */
const getTestByLesson = async (lessonId, requester) => {
  const lesson = await Lesson.findByPk(lessonId, { include: [{ model: Course, as: 'course' }] });

  if (!lesson) {
    const err = new Error('Урок не знайдено.');
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  const { course } = lesson;
  const isOwnerOrAdmin =
    requester &&
    (requester.role === 'admin' ||
      (requester.role === 'teacher' && course?.teacherId === requester.id));

  if (!course || (course.status !== 'published' && !isOwnerOrAdmin)) {
    const err = new Error('Курс не знайдено або ще не опубліковано.');
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  const test = await Test.findOne({ where: { lessonId } });

  if (!test) {
    const err = new Error('Тест для цього блоку ще не створено.');
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  if (isOwnerOrAdmin) {
    return test;
  }

  // ── Студент: перевіряємо доступ ──
  if (!requester) {
    const err = new Error('Потрібна авторизація.');
    err.statusCode = 401;
    err.isOperational = true;
    throw err;
  }

  const enrollment = await Enrollment.findOne({
    where: { userId: requester.id, courseId: course.id },
  });
  if (!enrollment) {
    const err = new Error('Ви не записані на цей курс.');
    err.statusCode = 403;
    err.isOperational = true;
    throw err;
  }

  // Тест блоку завжди вимагає завершення свого уроку — незалежно від
  // accessMode курсу. Це і є суть блокової структури "урок-тест".
  await assertLessonCompletedForBlockTest(requester.id, lesson);

  const attemptsUsed = await Result.count({ where: { userId: requester.id, testId: test.id } });
  return serializeTestForStudent(test, attemptsUsed);
};

// ─────────────────────────────────────────────────────────────
// CREATE TEST
// ─────────────────────────────────────────────────────────────

/**
 * Створює тест блоку, прив'язаний до уроку. Урок може мати лише один тест.
 * courseId визначається автоматично з уроку.
 *
 * @param {string} teacherId
 * @param {string} lessonId
 * @param {object} data - { title, questions, passingScore?, maxAttempts? }
 */
const createTestForLesson = async (teacherId, lessonId, data) => {
  const lesson = await Lesson.findByPk(lessonId);

  if (!lesson) {
    const err = new Error('Урок не знайдено.');
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  const course = await Course.findByPk(lesson.courseId);
  if (!course || course.teacherId !== teacherId) {
    const err = new Error('Ви не є власником цього курсу.');
    err.statusCode = 403;
    err.isOperational = true;
    throw err;
  }

  const existingTest = await Test.findOne({ where: { lessonId } });
  if (existingTest) {
    const err = new Error('Тест для цього уроку (блоку) вже існує. Використайте редагування.');
    err.statusCode = 409;
    err.isOperational = true;
    throw err;
  }

  const test = await Test.create({
    lessonId,
    courseId: null,
    title: data.title,
    questions: data.questions,
    passingScore: data.passingScore || 70,
    maxAttempts: data.maxAttempts || null,
  });

  return test;
};

/**
 * Створює підсумковий тест курсу (legacy-формат, courseId на Test).
 * Курс може мати лише один такий тест.
 *
 * @param {string} teacherId
 * @param {string} courseId
 * @param {object} data - { title, questions, passingScore?, maxAttempts? }
 */
const createTest = async (teacherId, courseId, data) => {
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

  const existingTest = await Test.findOne({ where: { courseId } });
  if (existingTest) {
    const err = new Error('Підсумковий тест для цього курсу вже існує. Використайте редагування.');
    err.statusCode = 409;
    err.isOperational = true;
    throw err;
  }

  const test = await Test.create({
    courseId,
    lessonId: null,
    title: data.title,
    questions: data.questions,
    passingScore: data.passingScore || 70,
    // Якщо maxAttempts не вказано (або 0/falsy) — необмежена кількість спроб
    maxAttempts: data.maxAttempts || null,
  });

  return test;
};

/**
 * Редагує тест (блоковий або курсовий) — наприклад, змінити maxAttempts
 * чи passingScore. Тільки власник курсу.
 *
 * @param {string} testId
 * @param {string} teacherId
 * @param {object} updates - { title?, questions?, passingScore?, maxAttempts? }
 */
const updateTest = async (testId, teacherId, updates) => {
  const test = await Test.findByPk(testId, {
    include: [
      { model: Course, as: 'course' },
      { model: Lesson, as: 'lesson', include: [{ model: Course, as: 'course' }] },
    ],
  });

  if (!test) {
    const err = new Error('Тест не знайдено.');
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  const ownerCourse = test.course || test.lesson?.course;
  if (!ownerCourse || ownerCourse.teacherId !== teacherId) {
    const err = new Error('Ви не є власником цього тесту.');
    err.statusCode = 403;
    err.isOperational = true;
    throw err;
  }

  const allowedFields = ['title', 'questions', 'passingScore', 'maxAttempts'];
  const safeUpdates = {};
  allowedFields.forEach((field) => {
    if (updates[field] !== undefined) {
      safeUpdates[field] = field === 'maxAttempts' ? updates[field] || null : updates[field];
    }
  });

  await test.update(safeUpdates);
  return test;
};

// ─────────────────────────────────────────────────────────────
// SUBMIT TEST
// ─────────────────────────────────────────────────────────────

/**
 * Студент здає тест (блоковий або курсовий) — перевіряємо ліміт спроб,
 * відповіді, рахуємо бал, ЗБЕРІГАЄМО спробу в Result (для подальшого
 * підрахунку attemptsUsed).
 *
 * @param {string} userId
 * @param {string} testId
 * @param {number[]} answers
 * @returns {{ score, passed, passingScore, correctCount, totalQuestions, details, attemptsUsed, attemptsLeft }}
 */
const submitTest = async (userId, testId, answers) => {
  const test = await Test.findByPk(testId, {
    include: [{ model: Lesson, as: 'lesson' }],
  });

  if (!test) {
    const err = new Error('Тест не знайдено.');
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  const courseId = test.courseId || test.lesson?.courseId;

  const enrollment = await Enrollment.findOne({
    where: { userId, courseId },
  });

  if (!enrollment) {
    const err = new Error('Ви не записані на цей курс.');
    err.statusCode = 403;
    err.isOperational = true;
    throw err;
  }

  // Тест блоку — урок має бути завершений перед спробою (захист від
  // прямого виклику submit в обхід getTestByLesson).
  if (test.lessonId) {
    await assertLessonCompletedForBlockTest(userId, test.lesson);
  }

  // ── Перевірка ліміту спроб ──
  const attemptsUsed = await Result.count({ where: { userId, testId } });

  if (test.maxAttempts && attemptsUsed >= test.maxAttempts) {
    const err = new Error(
      `Ви використали всі дозволені спроби (${test.maxAttempts}). Повторна здача тесту неможлива.`,
    );
    err.statusCode = 403;
    err.isOperational = true;
    err.code = 'MAX_ATTEMPTS_REACHED';
    throw err;
  }

  const { questions } = test;

  if (!Array.isArray(answers) || answers.length !== questions.length) {
    const err = new Error(`Потрібно надати рівно ${questions.length} відповідей.`);
    err.statusCode = 422;
    err.isOperational = true;
    throw err;
  }

  let correctCount = 0;
  const details = questions.map((q, i) => {
    const isCorrect = answers[i] === q.correctIndex;
    if (isCorrect) correctCount += 1;
    return {
      question: q.question,
      yourAnswer: q.options[answers[i]] ?? null,
      correctAnswer: q.options[q.correctIndex],
      isCorrect,
    };
  });

  const score = Math.round((correctCount / questions.length) * 100);
  const passed = score >= test.passingScore;

  // Зберігаємо спробу
  const result = await Result.create({
    userId,
    testId,
    score,
    passed,
    answers,
    completedAt: new Date(),
  });

  const newAttemptsUsed = attemptsUsed + 1;
  const attemptsLeft = test.maxAttempts ? Math.max(test.maxAttempts - newAttemptsUsed, 0) : null;

  return {
    resultId: result.id,
    testId: test.id,
    lessonId: test.lessonId,
    courseId,
    score,
    passed,
    passingScore: test.passingScore,
    correctCount,
    totalQuestions: questions.length,
    details,
    maxAttempts: test.maxAttempts,
    attemptsUsed: newAttemptsUsed,
    attemptsLeft, // null = необмежено
  };
};

// ─────────────────────────────────────────────────────────────
// GET USER TEST RESULTS
// ─────────────────────────────────────────────────────────────

/**
 * Спільна допоміжна функція: формує об'єкт результатів тесту для студента.
 */
const getResultsForTest = async (userId, test) => {
  const attempts = await Result.findAll({
    where: { userId, testId: test.id },
    order: [['completedAt', 'DESC']],
    attributes: ['id', 'score', 'passed', 'completedAt'],
  });

  const bestScore = attempts.length > 0 ? Math.max(...attempts.map((a) => a.score)) : null;
  const hasPassed = attempts.some((a) => a.passed);

  return {
    testId: test.id,
    lessonId: test.lessonId,
    courseId: test.courseId,
    title: test.title,
    passingScore: test.passingScore,
    questionsCount: test.questions.length,
    maxAttempts: test.maxAttempts,
    attemptsUsed: attempts.length,
    attemptsLeft: test.maxAttempts ? Math.max(test.maxAttempts - attempts.length, 0) : null,
    bestScore,
    hasPassed,
    attempts,
  };
};

/**
 * Повертає підсумковий тест курсу (legacy) + всю історію спроб студента.
 *
 * @param {string} userId
 * @param {string} courseId
 */
const getUserTestResults = async (userId, courseId) => {
  const enrollment = await Enrollment.findOne({ where: { userId, courseId } });

  if (!enrollment) {
    const err = new Error('Ви не записані на цей курс.');
    err.statusCode = 403;
    err.isOperational = true;
    throw err;
  }

  const test = await Test.findOne({ where: { courseId } });

  if (!test) {
    return null; // Тест ще не створено — не помилка
  }

  return getResultsForTest(userId, test);
};

/**
 * Повертає тест блоку (по уроку) + всю історію спроб студента.
 *
 * @param {string} userId
 * @param {string} lessonId
 */
const getUserTestResultsByLesson = async (userId, lessonId) => {
  const lesson = await Lesson.findByPk(lessonId);
  if (!lesson) {
    const err = new Error('Урок не знайдено.');
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  const enrollment = await Enrollment.findOne({ where: { userId, courseId: lesson.courseId } });
  if (!enrollment) {
    const err = new Error('Ви не записані на цей курс.');
    err.statusCode = 403;
    err.isOperational = true;
    throw err;
  }

  const test = await Test.findOne({ where: { lessonId } });
  if (!test) {
    return null; // Тест для блоку ще не створено — не помилка
  }

  return getResultsForTest(userId, test);
};


// ─────────────────────────────────────────────────────────────
// CREATE TEST FOR TOPIC
// ─────────────────────────────────────────────────────────────

/**
 * Створює тест для теми курсу.
 * Тема може мати лише один тест.
 *
 * @param {string} teacherId
 * @param {string} topicId
 * @param {object} data - { title, questions, passingScore?, maxAttempts? }
 */
const createTestForTopic = async (teacherId, topicId, data) => {
  const topic = await Topic.findByPk(topicId);

  if (!topic) {
    const err = new Error('Тему не знайдено.');
    err.statusCode = 404; err.isOperational = true; throw err;
  }

  const course = await Course.findByPk(topic.courseId);
  if (!course || course.teacherId !== teacherId) {
    const err = new Error('Ви не є власником цього курсу.');
    err.statusCode = 403; err.isOperational = true; throw err;
  }

  const existing = await Test.findOne({ where: { topicId } });
  if (existing) {
    const err = new Error('Тест для цієї теми вже існує. Використайте редагування.');
    err.statusCode = 409; err.isOperational = true; throw err;
  }

  return Test.create({
    topicId,
    courseId: null,
    lessonId: null,
    title: data.title,
    questions: data.questions,
    passingScore: data.passingScore || 70,
    maxAttempts: data.maxAttempts || null,
  });
};

module.exports = {
  getTestByCourse,
  getTestByLesson,
  createTest,
  createTestForLesson,
  createTestForTopic,
  updateTest,
  submitTest,
  getUserTestResults,
  getUserTestResultsByLesson,
};
