// src/middleware/auth.js

'use strict';

const jwt = require('jsonwebtoken');
const { redisClient } = require('../config/redis'); // ← імпорт Redis

const authenticate = async (req, res, next) => { // ← async обов'язково
  let token = req.cookies?.accessToken;

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

    // ← перевірка blacklist (для logout)
    const isBlacklisted = await redisClient.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return res.status(401).json({ success: false, message: 'Токен інвалідований.' });
    }

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

const optionalAuthenticate = (req, res, next) => {
  let token = req.cookies?.accessToken;
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) token = authHeader.split(' ')[1];
  }
  if (!token) return next();
  try {
    req.user = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  } catch { /* ігноруємо */ }
  return next();
};

module.exports = { authenticate, optionalAuthenticate };