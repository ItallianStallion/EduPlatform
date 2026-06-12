// src/middleware/auth.js
// Middleware перевірки JWT access-токена з httpOnly cookie.
// Додає req.user = { id, email, role } для наступних обробників.

'use strict';

const jwt = require('jsonwebtoken');

/**
 * Перевіряє access JWT з cookie або Authorization header.
 * При успіху — додає req.user, при невдачі — повертає 401.
 */
const authenticate = (req, res, next) => {
  // 1. Пробуємо витягти токен з httpOnly cookie (пріоритет)
  let token = req.cookies?.accessToken;

  // 2. Fallback: Bearer token з Authorization header (для мобільних клієнтів)
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Токен авторизації відсутній. Будь ласка, увійдіть в систему.',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    // Зберігаємо payload у запиті (id, email, role)
    req.user = decoded;
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Сесія закінчилась. Будь ласка, увійдіть знову.',
        code: 'TOKEN_EXPIRED',
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Недійсний токен авторизації.',
    });
  }
};

module.exports = { authenticate };
