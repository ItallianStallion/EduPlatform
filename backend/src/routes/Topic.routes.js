// src/routes/Topic.routes.js

'use strict';

const express = require('express');
const { body} = require('express-validator');
const { authenticate, optionalAuthenticate } = require('../middleware/auth');
const { checkRole } = require('../middleware/checkRole');
const ctrl = require('../controllers/Topic.controller');

const router = express.Router();

// GET /api/v1/topics/course/:courseId — список тем з уроками (публічно для безкоштовних, інакше — авторизація)
router.get(
  '/course/:courseId',
  optionalAuthenticate,
  ctrl.getTopicsByCourse,
);

// POST /api/v1/topics/course/:courseId — створити тему (teacher)
router.post(
  '/course/:courseId',
  authenticate,
  checkRole('teacher', 'admin'),
  [
    body('title').notEmpty().isString().isLength({ min: 2, max: 255 }),
    body('description').optional({ nullable: true }).isString(),
    body('order').optional().isInt({ min: 0 }),
  ],
  ctrl.createTopic,
);

// PATCH /api/v1/topics/:id — редагувати тему (teacher)
router.patch(
  '/:id',
  authenticate,
  checkRole('teacher', 'admin'),
  [
    body('title').optional().isString().isLength({ min: 2, max: 255 }),
    body('description').optional({ nullable: true }).isString(),
    body('order').optional().isInt({ min: 0 }),
  ],
  ctrl.updateTopic,
);

// DELETE /api/v1/topics/:id — видалити тему (teacher)
router.delete(
  '/:id',
  authenticate,
  checkRole('teacher', 'admin'),
  ctrl.deleteTopic,
);

// PUT /api/v1/topics/:id/lessons — призначити уроки до теми (teacher)
router.put(
  '/:id/lessons',
  authenticate,
  checkRole('teacher', 'admin'),
  [
    body('lessonIds').isArray({ min: 1 }).withMessage('lessonIds — непорожній масив UUID'),
    body('lessonIds.*').isUUID(),
  ],
  ctrl.assignLessons,
);

module.exports = router;
