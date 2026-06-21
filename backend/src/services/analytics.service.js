// src/services/analytics.service.js
// Бізнес-логіка аналітики для викладача.

'use strict';

const { fn, col, Op } = require('sequelize');
const { Course, User, Lesson, Enrollment, Progress, Category, Test, Result } = require('../models');

// Вага уроків і тесту у зваженому % завершення курсу.
// Узгоджено з src/services/progress.service.js — щоб викладач і студент
// бачили однакові цифри прогресу.
const LESSONS_WEIGHT = 70;
const TEST_WEIGHT = 30;

// ─────────────────────────────────────────────────────────────
// ДОПОМІЖНА ФУНКЦІЯ
// ─────────────────────────────────────────────────────────────

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
// АНАЛІТИКА ОДНОГО КУРСУ
// ─────────────────────────────────────────────────────────────

/**
 * Повертає детальну аналітику по одному курсу:
 * кількість студентів, дохід, середній прогрес.
 *
 * @param {string} courseId
 * @param {string} teacherId
 */
const getCourseAnalytics = async (courseId, teacherId) => {
  const course = await assertCourseOwner(courseId, teacherId);

  // Кількість студентів та дата останнього запису
  const enrollmentStats = await Enrollment.findAll({
    where: { courseId },
    attributes: [
      [fn('COUNT', col('id')), 'totalStudents'],
      [fn('MAX', col('enrolled_at')), 'lastEnrollmentAt'],
    ],
    raw: true,
  });

  const totalStudents = parseInt(enrollmentStats[0]?.totalStudents, 10) || 0;
  const lastEnrollmentAt = enrollmentStats[0]?.lastEnrollmentAt || null;

  // Загальна кількість уроків
  const totalLessons = await Lesson.count({ where: { courseId } });

  // Чи має курс тест взагалі
  const test = await Test.findOne({ where: { courseId }, attributes: ['id'] });

  // Середній прогрес студентів (зважено: 70% уроки + 30% тест, як і у
  // студентському progress.service.js, щоб цифри не розходилися)
  let averageProgress = 0;
  let studentsPassedTest = 0;
  let studentsCompletedCourse = 0;

  if (totalStudents > 0) {
    // Кількість пройдених уроків по кожному студенту
    const courseLessonIds = await Lesson.findAll({
      where: { courseId },
      attributes: ['id'],
      raw: true,
    }).then((rows) => rows.map((r) => r.id));

    const completedRows =
      totalLessons > 0
        ? await Progress.findAll({
            where: {
              completed: true,
              lessonId: { [Op.in]: courseLessonIds },
            },
            attributes: [
              [col('Progress.user_id'), 'userId'],
              [fn('COUNT', col('Progress.id')), 'completedCount'],
            ],
            group: [col('Progress.user_id')],
            raw: true,
          })
        : [];

    const completedLessonsMap = {};
    completedRows.forEach((row) => {
      completedLessonsMap[row.userId] = parseInt(row.completedCount, 10);
    });

    // Хто з зарахованих студентів вже склав тест (якщо тест є)
    let passedUserIds = new Set();
    if (test) {
      const passedResults = await Result.findAll({
        where: { testId: test.id, passed: true },
        attributes: ['userId'],
        group: ['userId'],
        raw: true,
      });
      passedUserIds = new Set(passedResults.map((r) => r.userId));
    }

    const enrolledUserIds = await Enrollment.findAll({
      where: { courseId },
      attributes: ['userId'],
      raw: true,
    }).then((rows) => rows.map((r) => r.userId));

    let percentageSum = 0;
    enrolledUserIds.forEach((userId) => {
      const completed = completedLessonsMap[userId] || 0;
      const allLessonsDone = totalLessons > 0 && completed === totalLessons;
      const lessonsPart =
        totalLessons > 0 ? (completed / totalLessons) * LESSONS_WEIGHT : LESSONS_WEIGHT;
      const testPassed = test ? passedUserIds.has(userId) : false;
      const testPart = !test ? TEST_WEIGHT : testPassed ? TEST_WEIGHT : 0;

      percentageSum += lessonsPart + testPart;
      if (testPassed) studentsPassedTest += 1;
      if (allLessonsDone && (!test || testPassed)) studentsCompletedCourse += 1;
    });

    averageProgress = Math.round(percentageSum / totalStudents);
  }

  // Дохід від курсу (ціна × кількість студентів)
  const price = parseFloat(course.price);
  const revenue = price * totalStudents;
  const platformFee = revenue * (parseFloat(process.env.PLATFORM_COMMISSION_RATE) || 0.1);
  const teacherRevenue = revenue - platformFee;

  return {
    course: {
      id: course.id,
      title: course.title,
      status: course.status,
      price,
    },
    students: {
      total: totalStudents,
      lastEnrollmentAt,
      completedCourse: studentsCompletedCourse,
      passedTest: studentsPassedTest,
    },
    lessons: {
      total: totalLessons,
    },
    test: {
      hasTest: !!test,
    },
    progress: {
      averagePercentage: averageProgress,
    },
    revenue: {
      gross: revenue,
      platformFee: Math.round(platformFee * 100) / 100,
      teacherNet: Math.round(teacherRevenue * 100) / 100,
    },
  };
};

// ─────────────────────────────────────────────────────────────
// СПИСОК СТУДЕНТІВ З ПРОГРЕСОМ
// ─────────────────────────────────────────────────────────────

/**
 * Повертає список студентів курсу з їх індивідуальним прогресом.
 *
 * @param {string} courseId
 * @param {string} teacherId
 */
const getCourseStudentsProgress = async (courseId, teacherId) => {
  await assertCourseOwner(courseId, teacherId);

  const totalLessons = await Lesson.count({ where: { courseId } });
  const test = await Test.findOne({ where: { courseId }, attributes: ['id', 'passingScore'] });

  // Всі студенти курсу
  const enrollments = await Enrollment.findAll({
    where: { courseId },
    include: [
      {
        model: User,
        as: 'student',
        attributes: ['id', 'name', 'surname', 'email'],
      },
    ],
    attributes: ['userId', 'enrolledAt'],
    order: [['enrolledAt', 'DESC']],
  });

  if (enrollments.length === 0) return [];

  const userIds = enrollments.map((e) => e.userId);

  // Отримуємо id уроків курсу, щоб уникнути проблемного JOIN з GROUP BY у PostgreSQL
  const courseLessonIds = await Lesson.findAll({
    where: { courseId },
    attributes: ['id'],
    raw: true,
  }).then((rows) => rows.map((r) => r.id));

  // Прогрес по всіх студентах одним запитом
  const progressRows = await Progress.findAll({
    where: {
      userId: { [Op.in]: userIds },
      completed: true,
      lessonId: { [Op.in]: courseLessonIds },
    },
    attributes: [
      [col('Progress.user_id'), 'userId'],
      [fn('COUNT', col('Progress.id')), 'completedCount'],
    ],
    group: [col('Progress.user_id')],
    raw: true,
  });

  const progressMap = {};
  progressRows.forEach((row) => {
    progressMap[row.userId] = parseInt(row.completedCount, 10);
  });

  // Результати тесту по всіх студентах курсу одним запитом
  const bestScoreMap = {};
  const passedMap = {};
  const attemptsMap = {};
  if (test) {
    const results = await Result.findAll({
      where: { userId: { [Op.in]: userIds }, testId: test.id },
      attributes: ['userId', 'score', 'passed'],
      raw: true,
    });

    results.forEach((r) => {
      attemptsMap[r.userId] = (attemptsMap[r.userId] || 0) + 1;
      if (r.passed) passedMap[r.userId] = true;
      if (bestScoreMap[r.userId] === undefined || r.score > bestScoreMap[r.userId]) {
        bestScoreMap[r.userId] = r.score;
      }
    });
  }

  return enrollments.map((enrollment) => {
    const completed = progressMap[enrollment.userId] || 0;
    const allLessonsDone = totalLessons > 0 && completed === totalLessons;

    const testPassed = test ? !!passedMap[enrollment.userId] : false;
    const lessonsPart =
      totalLessons > 0 ? (completed / totalLessons) * LESSONS_WEIGHT : LESSONS_WEIGHT;
    const testPart = !test ? TEST_WEIGHT : testPassed ? TEST_WEIGHT : 0;
    const percentage = Math.round(lessonsPart + testPart);

    return {
      student: enrollment.student,
      enrolledAt: enrollment.enrolledAt,
      completedLessons: completed,
      totalLessons,
      percentage,
      allLessonsDone,
      isCompleted: allLessonsDone && (!test || testPassed),
      test: test
        ? {
            hasTest: true,
            passed: testPassed,
            bestScore: bestScoreMap[enrollment.userId] ?? null,
            attemptsCount: attemptsMap[enrollment.userId] || 0,
            passingScore: test.passingScore,
          }
        : { hasTest: false, passed: null, bestScore: null, attemptsCount: 0 },
    };
  });
};

// ─────────────────────────────────────────────────────────────
// ДАШБОРД ВИКЛАДАЧА
// ─────────────────────────────────────────────────────────────

/**
 * Зведена аналітика по всіх курсах викладача.
 *
 * @param {string} teacherId
 */
const getTeacherDashboard = async (teacherId) => {
  // Всі курси викладача
  const courses = await Course.findAll({
    where: { teacherId },
    attributes: ['id', 'title', 'status', 'price', 'createdAt'],
    include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }],
    order: [['createdAt', 'DESC']],
  });

  if (courses.length === 0) {
    return {
      summary: {
        totalCourses: 0,
        publishedCourses: 0,
        totalStudents: 0,
        totalRevenue: 0,
        teacherBalance: 0,
      },
      courses: [],
    };
  }

  const courseIds = courses.map((c) => c.id);

  // Кількість студентів по кожному курсу
  const enrollmentCounts = await Enrollment.findAll({
    where: { courseId: courseIds },
    attributes: ['courseId', [fn('COUNT', col('id')), 'count']],
    group: ['courseId'],
    raw: true,
  });

  const enrollmentMap = {};
  enrollmentCounts.forEach((row) => {
    enrollmentMap[row.courseId] = parseInt(row.count, 10);
  });

  // Баланс викладача з моделі User
  const teacher = await User.findByPk(teacherId, { attributes: ['balance'] });

  const COMMISSION = parseFloat(process.env.PLATFORM_COMMISSION_RATE) || 0.1;

  // Формуємо список курсів з аналітикою
  const coursesWithStats = courses.map((course) => {
    const students = enrollmentMap[course.id] || 0;
    const gross = parseFloat(course.price) * students;
    const teacherNet = gross * (1 - COMMISSION);

    return {
      id: course.id,
      title: course.title,
      status: course.status,
      price: parseFloat(course.price),
      category: course.category,
      students,
      revenue: {
        gross: Math.round(gross * 100) / 100,
        teacherNet: Math.round(teacherNet * 100) / 100,
      },
    };
  });

  // Зведені підсумки
  const totalStudents = coursesWithStats.reduce((s, c) => s + c.students, 0);
  const totalRevenue = coursesWithStats.reduce((s, c) => s + c.revenue.gross, 0);
  const publishedCourses = courses.filter((c) => c.status === 'published').length;

  return {
    summary: {
      totalCourses: courses.length,
      publishedCourses,
      totalStudents,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      teacherBalance: parseFloat(teacher?.balance || 0),
    },
    courses: coursesWithStats,
  };
};

module.exports = { getCourseAnalytics, getCourseStudentsProgress, getTeacherDashboard };
