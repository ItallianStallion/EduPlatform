// src/services/topic.service.js
// Бізнес-логіка тем курсу.

'use strict';

const { Course, Topic, Lesson, Test, Enrollment } = require('../models');

// ─── Допоміжні ───────────────────────────────────────────────

const assertCourseOwner = async (courseId, teacherId) => {
  const course = await Course.findByPk(courseId);
  if (!course) {
    const err = new Error('Курс не знайдено.');
    err.statusCode = 404; err.isOperational = true; throw err;
  }
  if (course.teacherId !== teacherId) {
    const err = new Error('Ви не є власником цього курсу.');
    err.statusCode = 403; err.isOperational = true; throw err;
  }
  return course;
};

const assertTopicOwner = async (topicId, teacherId) => {
  const topic = await Topic.findByPk(topicId);
  if (!topic) {
    const err = new Error('Тему не знайдено.');
    err.statusCode = 404; err.isOperational = true; throw err;
  }
  await assertCourseOwner(topic.courseId, teacherId);
  return topic;
};

const assertEnrolled = async (courseId, userId) => {
  const enrollment = await Enrollment.findOne({ where: { userId, courseId } });
  if (!enrollment) {
    const err = new Error('Доступ заборонено. Спочатку запишіться на курс.');
    err.statusCode = 403; err.isOperational = true; throw err;
  }
};

// ─── GET ─────────────────────────────────────────────────────

/**
 * Повертає всі теми курсу з уроками і тестами.
 * Студент — тільки для enrolled курсів.
 * Викладач/адмін — завжди.
 */
const getTopicsByCourse = async (courseId, requester) => {
  const course = await Course.findByPk(courseId);
  if (!course) {
    const err = new Error('Курс не знайдено.');
    err.statusCode = 404; err.isOperational = true; throw err;
  }

  if (requester.role === 'student') {
    await assertEnrolled(courseId, requester.id);
  } else if (requester.role === 'teacher' && course.teacherId !== requester.id) {
    const err = new Error('Ви не є власником цього курсу.');
    err.statusCode = 403; err.isOperational = true; throw err;
  }

  const topics = await Topic.findAll({
    where: { courseId },
    include: [
      {
        model: Lesson,
        as: 'lessons',
        attributes: ['id', 'title', 'type', 'order', 'topicId'],
        order: [['order', 'ASC']],
      },
      {
        model: Test,
        as: 'test',
        attributes: ['id', 'title', 'passingScore', 'maxAttempts', 'questionsCount'],
        required: false,
      },
    ],
    order: [['order', 'ASC']],
  });

  return topics;
};

// ─── CREATE ──────────────────────────────────────────────────

const createTopic = async (teacherId, courseId, data) => {
  await assertCourseOwner(courseId, teacherId);

  const { title, description, order } = data;

  let topicOrder = order;
  if (topicOrder === undefined) {
    const last = await Topic.findOne({
      where: { courseId },
      order: [['order', 'DESC']],
      attributes: ['order'],
    });
    topicOrder = last ? last.order + 1 : 0;
  }

  return Topic.create({ courseId, title, description: description || null, order: topicOrder });
};

// ─── UPDATE ──────────────────────────────────────────────────

const updateTopic = async (topicId, teacherId, updates) => {
  const topic = await assertTopicOwner(topicId, teacherId);

  const allowed = ['title', 'description', 'order'];
  const safe = {};
  allowed.forEach((f) => { if (updates[f] !== undefined) safe[f] = updates[f]; });

  await topic.update(safe);
  return topic;
};

// ─── DELETE ──────────────────────────────────────────────────

const deleteTopic = async (topicId, teacherId) => {
  const topic = await assertTopicOwner(topicId, teacherId);

  // Від'єднуємо уроки від теми (SET NULL через асоціацію)
  await Lesson.update({ topicId: null }, { where: { topicId } });

  await topic.destroy();
};

// ─── ASSIGN LESSONS ──────────────────────────────────────────

/**
 * Призначає список уроків до теми.
 * lessonIds — масив UUID уроків. Всі уроки мають належати цьому курсу.
 */
const assignLessons = async (topicId, teacherId, lessonIds) => {
  const topic = await assertTopicOwner(topicId, teacherId);

  // Перевіряємо що всі уроки належать цьому курсу
  const lessons = await Lesson.findAll({
    where: { id: lessonIds, courseId: topic.courseId },
  });

  if (lessons.length !== lessonIds.length) {
    const err = new Error('Деякі уроки не належать цьому курсу.');
    err.statusCode = 422; err.isOperational = true; throw err;
  }

  await Lesson.update({ topicId }, { where: { id: lessonIds } });

  return topic;
};

module.exports = { getTopicsByCourse, createTopic, updateTopic, deleteTopic, assignLessons };
