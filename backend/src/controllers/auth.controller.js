// src/controllers/auth.controller.js
// HTTP-шар авторизації. Контролер лише валідує вхід та викликає сервіс.
// Вся логіка — у auth.service.js.

'use strict';

const { validationResult } = require('express-validator');
const authService = require('../services/auth.service');

// Константи для налаштування cookies
// sameSite: 'none' потрібен коли фронтенд і бекенд на різних доменах (cross-origin).
// Вимагає secure: true, тому в production завжди https.
const IS_SECURE = process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true';
const COOKIE_OPTIONS_BASE = {
  httpOnly: true,
  secure: IS_SECURE,
  sameSite: IS_SECURE ? 'none' : 'lax',
};

/**
 * POST /api/v1/auth/login
 * Вхід у систему — повертає access + refresh токени у httpOnly cookies.
 */
const login = async (req, res, next) => {
  try {
    // Перевіряємо результати express-validator
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;
    const { user, accessToken, refreshToken } = await authService.login(email, password);

    // Встановлюємо httpOnly cookies
    res.cookie('accessToken', accessToken, {
      ...COOKIE_OPTIONS_BASE,
      maxAge: 15 * 60 * 1000, // 15 хвилин
    });
    res.cookie('refreshToken', refreshToken, {
      ...COOKIE_OPTIONS_BASE,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 днів
    });

    return res.status(200).json({
      success: true,
      message: 'Вхід успішний',
      data: { user },
    });
  } catch (err) {
    // Передаємо операційні помилки у глобальний error handler
    return next(err);
  }
};

/**
 * POST /api/v1/auth/refresh
 * Оновлює access-токен за допомогою refresh-токена з cookie.
 */
const refresh = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'Refresh токен відсутній.' });
    }

    const { accessToken, refreshToken: newRefreshToken } = await authService.refreshAccessToken(refreshToken);

    res.cookie('accessToken', accessToken, {
      ...COOKIE_OPTIONS_BASE,
      maxAge: 15 * 60 * 1000,
    });
    res.cookie('refreshToken', newRefreshToken, {
      ...COOKIE_OPTIONS_BASE,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({ success: true, message: 'Токен оновлено' });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/v1/auth/logout
 * Вихід із системи — видаляємо cookies та refresh-токен з Redis.
 */
const logout = async (req, res, next) => {
  try {
    // req.user встановлюється middleware authenticate
    if (req.user?.id) {
      await authService.logout(req.user.id);
    }

    // Очищуємо cookies
    res.clearCookie('accessToken', COOKIE_OPTIONS_BASE);
    res.clearCookie('refreshToken', COOKIE_OPTIONS_BASE);

    return res.status(200).json({ success: true, message: 'Вихід успішний' });
  } catch (err) {
    return next(err);
  }
};

const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const { name, surname, email, password, role } = req.body;
    const user = await authService.register(name, surname, email, password, role);

    return res.status(201).json({
      success: true,
      message: 'Реєстрація успішна',
      data: { user },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = { login, refresh, logout, register };
