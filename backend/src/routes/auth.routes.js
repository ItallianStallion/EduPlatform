// src/routes/auth.routes.js
// Маршрути авторизації.

'use strict';

const { Router } = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');

const router = Router();

/**
 * POST /api/v1/auth/register
 * Реєстрація нового користувача.
 * Body: { name, surname, email, password, role? }
 * role: 'student' (default) | 'teacher'. 'admin' заборонено через публічну реєстрацію.
 */
router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage("Ім'я обов'язкове"),
    body('surname').trim().notEmpty().withMessage("Прізвище обов'язкове"),
    body('email').trim().isEmail().withMessage('Невірний email').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Пароль мінімум 6 символів'),
    body('role')
      .optional()
      .isIn(['student', 'teacher'])
      .withMessage("role повинен бути 'student' або 'teacher'"),
  ],
  authController.register,
);

/**
 * POST /api/v1/auth/login
 * Вхід у систему.
 * Body: { email: string, password: string }
 */
router.post(
  '/login',
  [
    body('email')
      .trim()
      .isEmail()
      .withMessage('Введіть коректний email')
      .normalizeEmail(),
    body('password')
      .notEmpty()
      .withMessage("Пароль обов'язковий")
      .isLength({ min: 6 })
      .withMessage('Пароль повинен містити мінімум 6 символів'),
  ],
  authController.login,
);

/**
 * POST /api/v1/auth/refresh
 * Оновлення access-токена (refresh-токен з cookie).
 */
router.post('/refresh', authController.refresh);

/**
 * POST /api/v1/auth/logout
 * Вихід із системи. Потрібна авторизація.
 */
router.post('/logout', authenticate, authController.logout);

module.exports = router;
