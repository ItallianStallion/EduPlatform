// src/services/analytics.service.js
// Бізнес-логіка аналітики для викладача.

'use strict';

const { fn, col, Op } = require('sequelize');
const { Course, User, Lesson, Enrollment, Progress, Category } = require('../models');

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

  // Середній прогрес студентів (% пройдених уроків)
  let averageProgress = 0;
  if (totalStudents > 0 && totalLessons > 0) {
    // Отримуємо id уроків курсу, щоб уникнути проблемного JOIN з GROUP BY у PostgreSQL
    const courseLessonIds = await Lesson.findAll({
      where: { courseId },
      attributes: ['id'],
      raw: true,
    }).then((rows) => rows.map((r) => r.id));

    const completedRows = await Progress.findAll({
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
    });

    const totalCompleted = completedRows.reduce(
      (sum, row) => sum + parseInt(row.completedCount, 10),
      0,
    );
    // Середній % по всіх студентах
    averageProgress = Math.round((totalCompleted / (totalStudents * totalLessons)) * 100);
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
    },
    lessons: {
      total: totalLessons,
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
    attributes: [[col('Progress.user_id'), 'userId'], [fn('COUNT', col('Progress.id')), 'completedCount']],
    group: [col('Progress.user_id')],
    raw: true,
  });

  const progressMap = {};
  progressRows.forEach((row) => {
    progressMap[row.userId] = parseInt(row.completedCount, 10);
  });

  return enrollments.map((enrollment) => {
    const completed = progressMap[enrollment.userId] || 0;
    const percentage = totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0;

    return {
      student: enrollment.student,
      enrolledAt: enrollment.enrolledAt,
      completedLessons: completed,
      totalLessons,
      percentage,
      isCompleted: percentage === 100,
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
    include: [
      { model: Category, as: 'category', attributes: ['id', 'name'] },
    ],
    order: [['createdAt', 'DESC']],
  });

  if (courses.length === 0) {
    return {
      summary: { totalCourses: 0, publishedCourses: 0, totalStudents: 0, totalRevenue: 0, teacherBalance: 0 },
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