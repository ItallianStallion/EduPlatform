// src/services/test.service.js
// Бізнес-логіка тестів: створення, здача, результати.

'use strict';

const { Test, Course, Enrollment } = require('../models');

// ─────────────────────────────────────────────────────────────
// GET TEST
// ─────────────────────────────────────────────────────────────

/**
 * Повертає тест курсу.
 * Студент отримує питання БЕЗ correctIndex (захист від читання відповідей з API).
 * Викладач/адмін — повні дані.
 *
 * @param {string} courseId
 * @param {{ id: string, role: string } | null} requester
 */
const getTestByCourse = async (courseId, requester) => {
  const course = await Course.findByPk(courseId);
  if (!course || course.status !== 'published') {
    // Викладач бачить свій тест навіть у draft
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

  // Студент — прибираємо correctIndex з відповіді
  const isTeacherOrAdmin =
    requester && (requester.role === 'admin' ||
    (requester.role === 'teacher' && course.teacherId === requester.id));

  if (!isTeacherOrAdmin) {
    const safeQuestions = test.questions.map(({ question, options }) => ({
      question,
      options,
      // correctIndex навмисно відсутній
    }));

    return {
      id: test.id,
      title: test.title,
      passingScore: test.passingScore,
      questionsCount: test.questions.length,
      questions: safeQuestions,
    };
  }

  return test;
};

// ─────────────────────────────────────────────────────────────
// CREATE TEST
// ─────────────────────────────────────────────────────────────

/**
 * Створює тест для курсу. Курс може мати лише один тест.
 *
 * @param {string} teacherId
 * @param {string} courseId
 * @param {object} data - { title, questions, passingScore? }
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

  // Перевіряємо чи тест вже існує
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
  });

  return test;
};

// ─────────────────────────────────────────────────────────────
// SUBMIT TEST
// ─────────────────────────────────────────────────────────────

/**
 * Студент здає тест — перевіряємо відповіді, рахуємо бал.
 * Студент повинен бути записаний на курс.
 *
 * @param {string} userId
 * @param {string} testId
 * @param {number[]} answers - масив індексів обраних відповідей
 * @returns {{ score, passed, passingScore, correctCount, totalQuestions, details }}
 */
const submitTest = async (userId, testId, answers) => {
  const test = await Test.findByPk(testId);

  if (!test) {
    const err = new Error('Тест не знайдено.');
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  // Перевіряємо enrollment
  const enrollment = await Enrollment.findOne({
    where: { userId, courseId: test.courseId },
  });

  if (!enrollment) {
    const err = new Error('Ви не записані на цей курс.');
    err.statusCode = 403;
    err.isOperational = true;
    throw err;
  }

  const questions = test.questions;

  if (!Array.isArray(answers) || answers.length !== questions.length) {
    const err = new Error(`Потрібно надати рівно ${questions.length} відповідей.`);
    err.statusCode = 422;
    err.isOperational = true;
    throw err;
  }

  // Перевіряємо відповіді
  let correctCount = 0;
  const details = questions.map((q, i) => {
    const isCorrect = answers[i] === q.correctIndex;
    if (isCorrect) correctCount++;
    return {
      question: q.question,
      yourAnswer: q.options[answers[i]] ?? null,
      correctAnswer: q.options[q.correctIndex],
      isCorrect,
    };
  });

  const score = Math.round((correctCount / questions.length) * 100);
  const passed = score >= test.passingScore;

  return {
    testId: test.id,
    score,
    passed,
    passingScore: test.passingScore,
    correctCount,
    totalQuestions: questions.length,
    details,
  };
};

// ─────────────────────────────────────────────────────────────
// GET USER TEST RESULTS
// ─────────────────────────────────────────────────────────────

/**
 * Повертає тест курсу і перевіряє чи студент записаний.
 * Використовується для відображення результатів (history не зберігаємо в MVP —
 * повертаємо лише метадані тесту і прохідний бал для UI).
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

  return {
    testId: test.id,
    title: test.title,
    passingScore: test.passingScore,
    questionsCount: test.questions.length,
  };
};

module.exports = { getTestByCourse, createTest, submitTest, getUserTestResults };
