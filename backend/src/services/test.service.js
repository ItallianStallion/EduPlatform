// src/services/test.service.js
// Бізнес-логіка тестів: створення, здача з лімітом спроб, результати.

'use strict';

const { Test, Course, Enrollment, Result, Lesson, Progress } = require('../models');

// ─────────────────────────────────────────────────────────────
// GET TEST
// ─────────────────────────────────────────────────────────────

/**
 * Повертає тест курсу.
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
    const err = new Error('Тест для цього курсу ще не створено.');
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  const isTeacherOrAdmin =
    requester && (requester.role === 'admin' ||
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
      include: [{ model: Lesson, as: 'lesson', attributes: [], where: { courseId }, required: true }],
    });

    if (totalLessons > 0 && completedLessons < totalLessons) {
      const err = new Error(
        'Тест буде доступний після завершення всіх уроків курсу.',
      );
      err.statusCode = 403;
      err.isOperational = true;
      err.code = 'COURSE_NOT_FINISHED';
      throw err;
    }
  }

  // Рахуємо скільки спроб студент вже використав
  const attemptsUsed = await Result.count({ where: { userId: requester.id, testId: test.id } });
  const attemptsLeft = test.maxAttempts ? Math.max(test.maxAttempts - attemptsUsed, 0) : null;

  const safeQuestions = test.questions.map(({ question, options }) => ({
    question,
    options,
    // correctIndex навмисно відсутній
  }));

  return {
    id: test.id,
    title: test.title,
    passingScore: test.passingScore,
    maxAttempts: test.maxAttempts,
    attemptsUsed,
    attemptsLeft, // null = необмежено
    questionsCount: test.questions.length,
    questions: safeQuestions,
  };
};

// ─────────────────────────────────────────────────────────────
// CREATE TEST
// ─────────────────────────────────────────────────────────────

/**
 * Створює тест для курсу. Курс може мати лише один тест.
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
    const err = new Error('Тест для цього курсу вже існує. Використайте редагування.');
    err.statusCode = 409;
    err.isOperational = true;
    throw err;
  }

  const test = await Test.create({
    courseId,
    title: data.title,
    questions: data.questions,
    passingScore: data.passingScore || 70,
    // Якщо maxAttempts не вказано (або 0/falsy) — необмежена кількість спроб
    maxAttempts: data.maxAttempts || null,
  });

  return test;
};

/**
 * Редагує тест курсу (наприклад, змінити maxAttempts чи passingScore).
 * Тільки власник курсу.
 *
 * @param {string} testId
 * @param {string} teacherId
 * @param {object} updates - { title?, questions?, passingScore?, maxAttempts? }
 */
const updateTest = async (testId, teacherId, updates) => {
  const test = await Test.findByPk(testId, { include: [{ model: Course, as: 'course' }] });

  if (!test) {
    const err = new Error('Тест не знайдено.');
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  if (test.course.teacherId !== teacherId) {
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
 * Студент здає тест — перевіряємо ліміт спроб, відповіді, рахуємо бал,
 * ЗБЕРІГАЄМО спробу в Result (для подальшого підрахунку attemptsUsed).
 *
 * @param {string} userId
 * @param {string} testId
 * @param {number[]} answers
 * @returns {{ score, passed, passingScore, correctCount, totalQuestions, details, attemptsUsed, attemptsLeft }}
 */
const submitTest = async (userId, testId, answers) => {
  const test = await Test.findByPk(testId);

  if (!test) {
    const err = new Error('Тест не знайдено.');
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  const enrollment = await Enrollment.findOne({
    where: { userId, courseId: test.courseId },
  });

  if (!enrollment) {
    const err = new Error('Ви не записані на цей курс.');
    err.statusCode = 403;
    err.isOperational = true;
    throw err;
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
 * Повертає тест курсу + всю історію спроб студента.
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

  const attempts = await Result.findAll({
    where: { userId, testId: test.id },
    order: [['completedAt', 'DESC']],
    attributes: ['id', 'score', 'passed', 'completedAt'],
  });

  const bestScore = attempts.length > 0 ? Math.max(...attempts.map((a) => a.score)) : null;
  const hasPassed = attempts.some((a) => a.passed);

  return {
    testId: test.id,
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

module.exports = { getTestByCourse, createTest, updateTest, submitTest, getUserTestResults };
