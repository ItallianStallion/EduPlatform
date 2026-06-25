// src/services/course.service.js
// Бізнес-логіка: каталог курсів, пошук, фільтрація, запис на курс.

'use strict';

const { Op, fn, col, literal } = require('sequelize');
const { sequelize } = require('../config/database');
const { Course, User, Category, Enrollment, Test, Lesson } = require('../models');
const { redisClient } = require('../config/redis');

const COURSES_CACHE_TTL = 5 * 60; // 5 хвилин кешування каталогу
const PLATFORM_COMMISSION = parseFloat(process.env.PLATFORM_COMMISSION_RATE) || 0.1;

// ─────────────────────────────────────────────────────────────
// КАТАЛОГ, ПОШУК, ФІЛЬТРАЦІЯ
// ─────────────────────────────────────────────────────────────

/**
 * Повертає список опублікованих курсів з пошуком, фільтрацією,
 * сортуванням та пагінацією.
 *
 * @param {object} params
 * @param {string} [params.q]          - Рядок пошуку (мінімум 3 символи)
 * @param {string} [params.categoryId] - Фільтр за категорією
 * @param {string} [params.price]      - 'free' | 'paid' | 'any' (default: 'any')
 * @param {string} [params.sortBy]     - 'popular' | 'newest' | 'price_asc' | 'price_desc'
 * @param {number} [params.page]       - Сторінка (default: 1)
 * @param {number} [params.limit]      - Результатів на сторінці (default: 12)
 * @returns {{ courses: Course[], totalCount: number, page: number, totalPages: number }}
 */
const getCourses = async ({
  q,
  categoryId,
  price = 'any',
  sortBy = 'newest',
  page = 1,
  limit = 12,
}) => {
  // Генеруємо ключ кешу на основі параметрів запиту
  const cacheKey = `courses:${JSON.stringify({ q, categoryId, price, sortBy, page, limit })}`;

  // Перевіряємо кеш Redis
  const cached = await redisClient.get(cacheKey).catch(() => null);
  if (cached) {
    return JSON.parse(cached);
  }

  // --- Побудова WHERE-умов ---
  const where = { status: 'published' };

  // Пошук: мінімум 3 символи, інакше повертаємо всі курси
  if (q && q.trim().length >= 3) {
    where[Op.or] = [
      { title: { [Op.iLike]: `%${q.trim()}%` } },
      { description: { [Op.iLike]: `%${q.trim()}%` } },
    ];
  }

  // Фільтр за категорією
  if (categoryId) {
    where.categoryId = categoryId;
  }

  // Фільтр за ціною
  if (price === 'free') {
    where.price = 0;
  } else if (price === 'paid') {
    where.price = { [Op.gt]: 0 };
  }

  // --- Побудова ORDER BY ---
  let order;
  switch (sortBy) {
    case 'popular':
      // Сортуємо за кількістю студентів (COUNT enrollments)
      order = [[literal('"enrollmentCount"'), 'DESC NULLS LAST']];
      break;
    case 'price_asc':
      order = [['price', 'ASC']];
      break;
    case 'price_desc':
      order = [['price', 'DESC']];
      break;
    case 'newest':
    default:
      order = [['createdAt', 'DESC']];
  }

  // --- Пагінація ---
  const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);

  // --- Запит до БД ---
  const { count, rows } = await Course.findAndCountAll({
    where,
    attributes: {
      include: [
        // Додаємо кількість студентів для сортування та відображення
        [fn('COUNT', literal('DISTINCT "enrollments"."id"')), 'enrollmentCount'],
        [fn('COUNT', literal('DISTINCT "lessons"."id"')), 'lessonsCount'],
      ],
    },
    include: [
      {
        model: Enrollment,
        as: 'enrollments',
        attributes: [], // Не вибираємо поля enrollment, лише COUNT
        required: false,
      },
      {
        model: Lesson,
        as: 'lessons',
        attributes: [],
        required: false,
      },
      {
        model: User,
        as: 'teacher',
        attributes: ['id', 'name', 'surname'],
      },
      {
        model: Category,
        as: 'category',
        attributes: ['id', 'name', 'icon'],
      },
    ],
    group: ['Course.id', 'teacher.id', 'category.id'],
    order,
    limit: parseInt(limit, 10),
    offset,
    subQuery: false, // Важливо при GROUP BY з paginaton
    distinct: true,
  });

  const result = {
    courses: rows,
    totalCount: count.length, // count — масив об'єктів при GROUP BY
    page: parseInt(page, 10),
    totalPages: Math.ceil(count.length / parseInt(limit, 10)),
    limit: parseInt(limit, 10),
  };

  // Кешуємо результат у Redis
  await redisClient
    .set(cacheKey, JSON.stringify(result), 'EX', COURSES_CACHE_TTL)
    .catch(() => null);

  return result;
};

// ─────────────────────────────────────────────────────────────
// ЗАПИС НА КУРС
// ─────────────────────────────────────────────────────────────

/**
 * Записує користувача на курс. Обробляє безкоштовні та платні курси.
 * Дозволено студентам (на будь-який курс) і викладачам (на чужий курс —
 * викладач теж може навчатись, але не на власному курсі).
 *
 * Бізнес-правила:
 * 1. Власник курсу не може записатись на власний курс.
 * 2. Користувач не може записатись двічі на один курс.
 * 3. Безкоштовний курс → одразу створюємо Enrollment.
 * 4. Платний курс → симуляція оплати → 10% платформі, 90% на баланс викладача.
 * 5. Після успішного запису — емітуємо подію для email-сповіщення.
 *
 * @param {string} courseId - ID курсу
 * @param {string} userId   - ID користувача, що записується (з req.user)
 * @returns {{ enrollment: Enrollment, paymentResult?: object }}
 */
const enrollInCourse = async (courseId, userId) => {
  // 1. Знаходимо курс із даними викладача
  const course = await Course.findOne({
    where: { id: courseId, status: 'published' },
    include: [{ model: User, as: 'teacher', attributes: ['id', 'balance'] }],
  });

  if (!course) {
    const err = new Error('Курс не знайдено або ще не опубліковано.');
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  // 2. Власник курсу не може записатись на власний курс
  if (course.teacherId === userId) {
    const err = new Error('Ви є автором цього курсу. Запис на власний курс неможливий.');
    err.statusCode = 400;
    err.isOperational = true;
    err.code = 'OWN_COURSE';
    throw err;
  }

  // 3. Перевіряємо чи користувач вже записаний
  const existingEnrollment = await Enrollment.findOne({
    where: { userId, courseId },
  });

  if (existingEnrollment) {
    const err = new Error('Ви вже записані на цей курс.');
    err.statusCode = 409;
    err.isOperational = true;
    err.code = 'ALREADY_ENROLLED';
    throw err;
  }

  // 4. Безкоштовний курс — одразу записуємо
  if (parseFloat(course.price) === 0) {
    const enrollment = await Enrollment.create({ userId, courseId });

    // Інвалідуємо кеш каталогу (кількість студентів змінилась)
    await invalidateCoursesCache();

    // Емітуємо подію для майбутнього email-підтвердження (заглушка)
    emitEnrollmentEvent({ type: 'FREE_ENROLLMENT', studentId: userId, courseId, course });

    return { enrollment, isFree: true };
  }

  // 5. Платний курс — транзакція з симуляцією платежу
  const transaction = await sequelize.transaction();

  try {
    // Симуляція платіжного процесингу (Stripe/LiqPay заглушка)
    const paymentResult = await simulatePayment({
      amount: parseFloat(course.price),
      studentId: userId,
      courseId,
    });

    // Нараховуємо 90% викладачу
    const teacherAmount = parseFloat(course.price) * (1 - PLATFORM_COMMISSION);
    await User.increment('balance', {
      by: teacherAmount,
      where: { id: course.teacherId },
      transaction,
    });

    // Створюємо запис про зарахування
    const enrollment = await Enrollment.create({ userId, courseId }, { transaction });

    await transaction.commit();

    // Інвалідуємо кеш
    await invalidateCoursesCache();

    // Емітуємо події для email-сповіщень
    emitEnrollmentEvent({
      type: 'PAID_ENROLLMENT',
      studentId: userId,
      courseId,
      course,
      teacherId: course.teacherId,
      amount: parseFloat(course.price),
      teacherAmount,
      platformAmount: parseFloat(course.price) * PLATFORM_COMMISSION,
      paymentId: paymentResult.transactionId,
    });

    return {
      enrollment,
      isFree: false,
      paymentResult: {
        transactionId: paymentResult.transactionId,
        amount: parseFloat(course.price),
        teacherReceived: teacherAmount,
        platformFee: parseFloat(course.price) * PLATFORM_COMMISSION,
      },
    };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

// ─────────────────────────────────────────────────────────────
// ДОПОМІЖНІ ФУНКЦІЇ
// ─────────────────────────────────────────────────────────────

/**
 * Симуляція платіжного шлюзу (Stripe/LiqPay заглушка).
 * У реальному проєкті тут буде виклик Stripe API.
 * Симулюємо 95% успішних платежів (5% — failure для тестування).
 */
const simulatePayment = async ({ amount, studentId, courseId }) => {
  // Імітуємо затримку мережі
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Генеруємо ID транзакції (у реальному — з відповіді Stripe)
  const transactionId = `txn_sim_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  console.info(
    `[Payment] Симуляція оплати: ${amount} UAH, студент: ${studentId}, курс: ${courseId}, txn: ${transactionId}`,
  );

  return { success: true, transactionId, amount };
};

/**
 * Заглушка для події email/WebSocket-сповіщення.
 * У майбутньому → EventEmitter або черга завдань (Bull/BullMQ).
 */
const emitEnrollmentEvent = (payload) => {
  // TODO: замінити на Bull queue або EventEmitter
  console.info('[Event] EnrollmentEvent:', JSON.stringify(payload, null, 2));
  // Приклад майбутньої реалізації:
  // emailQueue.add('sendEnrollmentConfirmation', { studentId: payload.studentId, ... });
  // if (payload.type === 'PAID_ENROLLMENT') {
  //   emailQueue.add('notifyTeacher', { teacherId: payload.teacherId, ... });
  // }
};

/**
 * Інвалідує всі ключі кешу каталогу курсів.
 */
const invalidateCoursesCache = async () => {
  const keys = await redisClient.keys('courses:*').catch(() => []);
  if (keys.length > 0) {
    await redisClient.del(...keys).catch(() => null);
  }
};

// ─────────────────────────────────────────────────────────────
// ВИКЛАДАЧ: СТВОРЕННЯ, РЕДАГУВАННЯ, ПУБЛІКАЦІЯ КУРСІВ
// ─────────────────────────────────────────────────────────────

/**
 * Створює новий курс. Курс завжди стартує зі статусом 'draft'.
 *
 * @param {string} teacherId - ID викладача (з req.user)
 * @param {object} data - { title, description, categoryId, price, coverImage, accessMode? }
 */
const createCourse = async (teacherId, data) => {
  const { title, description, categoryId, price, coverImage, accessMode } = data;

  // Якщо вказана категорія — перевіряємо що вона існує
  if (categoryId) {
    const category = await Category.findByPk(categoryId);
    if (!category) {
      const err = new Error('Вказана категорія не знайдена.');
      err.statusCode = 404;
      err.isOperational = true;
      throw err;
    }
  }

  const course = await Course.create({
    teacherId,
    categoryId: categoryId || null,
    title,
    description: description || null,
    coverImage: coverImage || null,
    price: price || 0,
    accessMode: accessMode === 'sequential' ? 'sequential' : 'open',
    status: 'draft', // Завжди стартує як чернетка
  });

  return course;
};

/**
 * Видаляє курс. Дозволено лише власнику курсу.
 *
 * @param {string} courseId
 * @param {string} teacherId - ID викладача, що робить запит
 */
const deleteCourse = async (courseId, teacherId) => {
  const course = await Course.findByPk(courseId);

  if (!course) {
    const err = new Error('Курс не знайдено.');
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  // Перевірка власності: тільки автор курсу може видалити
  if (course.teacherId !== teacherId) {
    const err = new Error('Ви не можете видалити курс, який вам не належить.');
    err.statusCode = 403;
    err.isOperational = true;
    throw err;
  }

  await course.destroy();
  await invalidateCoursesCache();
};

/**
 * Редагує курс. Дозволено лише власнику курсу.
 *
 * @param {string} courseId
 * @param {string} teacherId - ID викладача, що робить запит
 * @param {object} updates - поля для оновлення
 */
const updateCourse = async (courseId, teacherId, updates) => {
  const course = await Course.findByPk(courseId);

  if (!course) {
    const err = new Error('Курс не знайдено.');
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  // Перевірка власності: тільки автор курсу може редагувати
  if (course.teacherId !== teacherId) {
    const err = new Error('Ви не можете редагувати курс, який вам не належить.');
    err.statusCode = 403;
    err.isOperational = true;
    throw err;
  }

  // Дозволені поля для оновлення (захист від масового присвоєння)
  const allowedFields = ['title', 'description', 'categoryId', 'price', 'coverImage', 'accessMode'];
  const safeUpdates = {};
  allowedFields.forEach((field) => {
    if (updates[field] !== undefined) {
      safeUpdates[field] = updates[field];
    }
  });

  await course.update(safeUpdates);
  await invalidateCoursesCache();

  return course;
};

/**
 * Перемикає статус курсу draft <-> published.
 * Перед публікацією перевіряє що курс має мінімально необхідні дані.
 *
 * @param {string} courseId
 * @param {string} teacherId
 * @param {string} action - 'publish' | 'unpublish'
 */
const setCourseStatus = async (courseId, teacherId, action) => {
  const course = await Course.findByPk(courseId);

  if (!course) {
    const err = new Error('Курс не знайдено.');
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  if (course.teacherId !== teacherId) {
    const err = new Error('Ви не можете публікувати курс, який вам не належить.');
    err.statusCode = 403;
    err.isOperational = true;
    throw err;
  }

  if (action === 'publish') {
    // Базова перевірка перед публікацією
    if (!course.title || course.title.trim().length < 5) {
      const err = new Error('Курс повинен мати назву мінімум 5 символів перед публікацією.');
      err.statusCode = 422;
      err.isOperational = true;
      throw err;
    }

    // Курс ОБОВ'ЯЗКОВО повинен мати хоча б один тест перед публікацією —
    // або legacy підсумковий тест курсу (Test.courseId), або тест хоча б
    // одного блоку "урок-тест" (Test.lessonId на урок цього курсу).
    const courseTest = await Test.findOne({ where: { courseId } });
    const blockTest = courseTest
      ? null
      : await Test.findOne({
          include: [
            { model: Lesson, as: 'lesson', attributes: [], where: { courseId }, required: true },
          ],
        });

    if (!courseTest && !blockTest) {
      const err = new Error(
        'Перед публікацією курсу потрібно створити хоча б один тест — підсумковий тест курсу або тест хоча б одного блоку "урок-тест".',
      );
      err.statusCode = 422;
      err.isOperational = true;
      err.code = 'TEST_REQUIRED';
      throw err;
    }

    await course.update({ status: 'published' });
  } else {
    await course.update({ status: 'draft' });
  }

  await invalidateCoursesCache();
  return course;
};

/**
 * Повертає всі курси конкретного викладача (включно з draft).
 *
 * @param {string} teacherId
 */
const getMyCourses = async (teacherId) => {
  const courses = await Course.findAll({
    where: { teacherId },
    include: [
      { model: Category, as: 'category', attributes: ['id', 'name', 'icon'] },
      {
        model: Enrollment,
        as: 'enrollments',
        attributes: [],
      },
    ],
    attributes: {
      include: [[fn('COUNT', literal('DISTINCT "enrollments"."id"')), 'enrollmentCount']],
    },
    group: ['Course.id', 'category.id'],
    order: [['createdAt', 'DESC']],
    subQuery: false,
  });

  return courses;
};

/**
 * Повертає деталі одного курсу за ID.
 * Якщо курс — draft, доступ має лише власник.
 *
 * @param {string} courseId
 * @param {object} [requester] - { id, role } поточного користувача (опціонально)
 */
const getCourseById = async (courseId, requester = null) => {
  const course = await Course.findOne({
    where: { id: courseId },
    include: [
      { model: User, as: 'teacher', attributes: ['id', 'name', 'surname'] },
      { model: Category, as: 'category', attributes: ['id', 'name', 'icon'] },
      { model: Enrollment, as: 'enrollments', attributes: [] },
    ],
    attributes: {
      include: [[fn('COUNT', literal('DISTINCT "enrollments"."id"')), 'enrollmentCount']],
    },
    group: ['Course.id', 'teacher.id', 'category.id'],
    subQuery: false,
  });

  if (!course) {
    const err = new Error('Курс не знайдено.');
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  // Чернетку (draft) бачить лише автор
  if (course.status === 'draft') {
    const isOwner = requester && requester.id === course.teacherId;
    if (!isOwner) {
      const err = new Error('Курс не знайдено.'); // Не розкриваємо що курс існує
      err.statusCode = 404;
      err.isOperational = true;
      throw err;
    }
  }

  return course;
};

module.exports = {
  getCourses,
  enrollInCourse,
  createCourse,
  updateCourse,
  deleteCourse,
  setCourseStatus,
  getMyCourses,
  getCourseById,
};
