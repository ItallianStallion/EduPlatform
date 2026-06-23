// src/controllers/Topic.controller.js

'use strict';

const topicService = require('../services/topic.service');

// GET /api/v1/topics/course/:courseId
const getTopicsByCourse = async (req, res, next) => {
  try {
    const topics = await topicService.getTopicsByCourse(req.params.courseId, req.user);
    res.json({ success: true, data: { topics } });
  } catch (err) { next(err); }
};

// POST /api/v1/topics/course/:courseId
const createTopic = async (req, res, next) => {
  try {
    const topic = await topicService.createTopic(req.user.id, req.params.courseId, req.body);
    res.status(201).json({ success: true, message: 'Тему створено.', data: { topic } });
  } catch (err) { next(err); }
};

// PATCH /api/v1/topics/:id
const updateTopic = async (req, res, next) => {
  try {
    const topic = await topicService.updateTopic(req.params.id, req.user.id, req.body);
    res.json({ success: true, message: 'Тему оновлено.', data: { topic } });
  } catch (err) { next(err); }
};

// DELETE /api/v1/topics/:id
const deleteTopic = async (req, res, next) => {
  try {
    await topicService.deleteTopic(req.params.id, req.user.id);
    res.json({ success: true, message: 'Тему видалено. Уроки збережено без теми.' });
  } catch (err) { next(err); }
};

// PUT /api/v1/topics/:id/lessons
const assignLessons = async (req, res, next) => {
  try {
    const topic = await topicService.assignLessons(req.params.id, req.user.id, req.body.lessonIds);
    res.json({ success: true, message: 'Уроки призначено до теми.', data: { topic } });
  } catch (err) { next(err); }
};

module.exports = { getTopicsByCourse, createTopic, updateTopic, deleteTopic, assignLessons };
