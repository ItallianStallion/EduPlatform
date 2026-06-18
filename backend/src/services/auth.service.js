// src/services/auth.service.js
// Вся бізнес-логіка авторизації. Контролер викликає тільки сервіс.

'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { redisClient } = require('../config/redis');

// ─────────────────────────────────────────────────────────────
// Допоміжні функції
// ─────────────────────────────────────────────────────────────

/**
 * Генерує пару JWT токенів (access + refresh).
 */
const generateTokens = (payload) => {
  const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
  return { accessToken, refreshToken };
};

/**
 * Зберігає refresh-токен у Redis з TTL 7 днів.
 * Ключ: refresh:{userId} — якщо користувач логується з нового пристрою,
 * старий токен перезаписується (single-session підхід для MVP).
 */
const saveRefreshToken = async (userId, refreshToken) => {
  const ttl = 7 * 24 * 60 * 60; // 7 днів у секундах
  await redisClient.set(`refresh:${userId}`, refreshToken, 'EX', ttl);
};

// ─────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────

/**
 * Логін з повним захистом:
 * - Перевірка існування email
 * - Перевірка блокування акаунту (locked_until)
 * - Перевірка бану (is_banned)
 * - Перевірка паролю через bcrypt
 * - Brute-force захист (failed_login_attempts → locked_until)
 * - Видача access + refresh токенів у httpOnly cookies
 *
 * @param {string} email
 * @param {string} password
 * @returns {{ user: object, accessToken: string, refreshToken: string }}
 * @throws {{ statusCode: number, message: string, isOperational: true }}
 */
const login = async (email, password) => {
  // 1. Шукаємо користувача за email
  const user = await User.findOne({ where: { email: email.toLowerCase().trim() } });

  if (!user) {
    // Навмисно розмита помилка (не «невірний пароль», а відсутність email)
    const err = new Error('Ми не знайшли Ваш email. Зареєструйтеся.');
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  // 2. Перевірка бану
  if (user.isBanned) {
    const err = new Error('Ваш акаунт заблоковано. Зверніться до підтримки.');
    err.statusCode = 403;
    err.isOperational = true;
    throw err;
  }

  // 3. Перевірка тимчасового блокування (brute-force)
  if (user.lockedUntil && new Date() < new Date(user.lockedUntil)) {
    const remainingMs = new Date(user.lockedUntil) - new Date();
    const remainingMin = Math.ceil(remainingMs / 60000);
    const err = new Error(
      `Ваш акаунт заблоковано. Спробуйте ще через ${remainingMin} хв.`,
    );
    err.statusCode = 423; // HTTP 423 Locked
    err.isOperational = true;
    // Прапорець для фронтенду — деактивувати кнопку «Увійти»
    err.lockUntil = user.lockedUntil;
    throw err;
  }

  // 4. Перевірка паролю
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordValid) {
    // Інкрементуємо лічильник невдалих спроб
    const newAttempts = user.failedLoginAttempts + 1;
    const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS, 10) || 3;
    const lockMinutes = parseInt(process.env.LOCK_DURATION_MINUTES, 10) || 30;

    if (newAttempts >= maxAttempts) {
      // Блокуємо акаунт на 30 хвилин
      const lockUntil = new Date(Date.now() + lockMinutes * 60 * 1000);
      await user.update({ failedLoginAttempts: newAttempts, lockedUntil: lockUntil });

      const err = new Error(
        `Ваш акаунт заблоковано. Спробуйте ще через ${lockMinutes} хвилин.`,
      );
      err.statusCode = 423;
      err.isOperational = true;
      err.lockUntil = lockUntil;
      throw err;
    }

    // Зберігаємо кількість спроб і повідомляємо скільки залишилось
    await user.update({ failedLoginAttempts: newAttempts });
    const attemptsLeft = maxAttempts - newAttempts;
    const err = new Error(
      `Невірний пароль. Залишилось спроб: ${attemptsLeft}. Після ${maxAttempts} спроб акаунт буде заблоковано.`,
    );
    err.statusCode = 401;
    err.isOperational = true;
    err.attemptsLeft = attemptsLeft;
    throw err;
  }

  // 5. Пароль вірний — скидаємо лічильник невдалих спроб
  await user.update({ failedLoginAttempts: 0, lockedUntil: null });

  // 6. Генеруємо JWT токени
  const payload = { id: user.id, email: user.email, role: user.role };
  const { accessToken, refreshToken } = generateTokens(payload);

  // 7. Зберігаємо refresh у Redis
  await saveRefreshToken(user.id, refreshToken);

  return {
    user: user.toSafeJSON(),
    accessToken,
    refreshToken,
  };
};

// ─────────────────────────────────────────────────────────────
// REFRESH TOKEN
// ─────────────────────────────────────────────────────────────

/**
 * Оновлює access-токен за дійсним refresh-токеном.
 */
const refreshAccessToken = async (refreshToken) => {
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    const err = new Error('Refresh токен недійсний або прострочений.');
    err.statusCode = 401;
    err.isOperational = true;
    throw err;
  }

  // Перевіряємо чи збігається з тим, що у Redis
  const storedToken = await redisClient.get(`refresh:${decoded.id}`);
  if (storedToken !== refreshToken) {
    const err = new Error('Refresh токен не відповідає збереженому. Увійдіть знову.');
    err.statusCode = 401;
    err.isOperational = true;
    throw err;
  }

  const payload = { id: decoded.id, email: decoded.email, role: decoded.role };
  const { accessToken, refreshToken: newRefreshToken } = generateTokens(payload);
  await saveRefreshToken(decoded.id, newRefreshToken);

  return { accessToken, refreshToken: newRefreshToken };
};

// ─────────────────────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────────────────────

/**
 * Видаляє refresh-токен з Redis (інвалідує сесію).
 */
const logout = async (userId) => {
  await redisClient.del(`refresh:${userId}`);
};

/**
 * Реєстрація нового користувача.
 * ВАЖЛИВО: через публічну реєстрацію дозволені лише ролі 'student' та 'teacher'.
 * Роль 'admin' може призначити лише інший admin через окремий ендпоінт.
 *
 * @param {string} name
 * @param {string} surname
 * @param {string} email
 * @param {string} password
 * @param {string} [role='student'] - 'student' | 'teacher'
 */
const register = async (name, surname, email, password, role = 'student') => {
  const existing = await User.findOne({ where: { email: email.toLowerCase().trim() } });
  if (existing) {
    const err = new Error('Цей email вже зареєстровано.');
    err.statusCode = 409;
    err.isOperational = true;
    throw err;
  }

  // Захист: публічна реєстрація не може створити admin-акаунт
  const allowedRoles = ['student', 'teacher'];
  const safeRole = allowedRoles.includes(role) ? role : 'student';

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await User.create({
    name,
    surname,
    email: email.toLowerCase().trim(),
    passwordHash,
    role: safeRole,
  });

  return user.toSafeJSON();
};

module.exports = { login, refreshAccessToken, logout, register };
