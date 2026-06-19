// src/routes/profile.routes.js
// Маршрути профілю користувача.

'use strict';

const { Router } = require('express');
const { body, param } = require('express-validator');
const profileController = require('../controllers/Profile.controller');
const { authenticate } = require('../middleware/auth');

const router = Router();

/**
 * GET /api/v1/profiles/me
 * Профіль поточного користувача. Має бути ВИЩЕ за /:id.
 */
router.get('/me', authenticate, profileController.getMyProfile);

/**
 * PATCH /api/v1/profiles/me
 * Body: { avatar?, bio?, phone? }
 */
router.patch(
  '/me',
  authenticate,
  [
    body('avatar').optional().isString(),
    body('bio').optional().isString().isLength({ max: 1000 }),
    body('phone').optional().isString().isLength({ max: 20 }),
  ],
  profileController.updateMyProfile,
);

/**
 * GET /api/v1/profiles/:id
 * Публічний профіль користувача за ID.
 */
router.get(
  '/:id',
  [param('id').isUUID(4).withMessage('Невірний формат ID користувача')],
  profileController.getProfile,
);

module.exports = router;