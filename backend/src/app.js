// src/app.js
// Ядро Express-застосунку: middleware, маршрути, глобальний error handler.
// server.js імпортує цей файл і запускає HTTP-сервер.

'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
require('dotenv').config();

// --- Маршрути (Dev #1) ---
const authRoutes = require('./routes/auth.routes');
const courseRoutes = require('./routes/course.routes');
const adminRoutes = require('./routes/admin.routes');

// --- Маршрути (Dev #2) ---
const profileRoutes  = require('./routes/Profile.routes');
const lessonRoutes   = require('./routes/Lesson.routes');
const progressRoutes = require('./routes/Progress.routes');
const testRoutes     = require('./routes/Test.routes');
const analyticsRoutes = require('./routes/Analytics.routes');

const app = express();

// ─────────────────────────────────────────────────────────────
// 1. SECURITY MIDDLEWARE
// ─────────────────────────────────────────────────────────────

// Helmet додає захисні HTTP-заголовки (XSS, clickjacking тощо)
app.use(helmet());

// CORS — дозволяємо запити тільки з вказаного origin
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true, // Дозволяємо httpOnly cookies
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// ─────────────────────────────────────────────────────────────
// 2. BUILT-IN MIDDLEWARE
// ─────────────────────────────────────────────────────────────

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// HTTP-логування (тільки не у test-середовищі)
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ─────────────────────────────────────────────────────────────
// 3. HEALTH CHECK (для Docker / CI)
// ─────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
  });
});

// ─────────────────────────────────────────────────────────────
// 4. ROUTES
// ─────────────────────────────────────────────────────────────

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/courses', courseRoutes);
app.use('/api/v1/admin', adminRoutes); 

// --- Маршрути (Dev #2) ---
app.use('/api/v1/profiles',   profileRoutes);
app.use('/api/v1/lessons',    lessonRoutes);
app.use('/api/v1/progress',   progressRoutes);
app.use('/api/v1/tests',      testRoutes);
app.use('/api/v1/analytics',  analyticsRoutes);

// ─────────────────────────────────────────────────────────────
// 5. 404 HANDLER
// ─────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Маршрут не знайдено' });
});

// ─────────────────────────────────────────────────────────────
// 6. GLOBAL ERROR HANDLER
// Повинен бути ОСТАННІМ middleware з 4 параметрами.
// ─────────────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  // Sequelize validation error
  if (err.name === 'SequelizeValidationError') {
    const messages = err.errors.map((e) => e.message);
    return res.status(422).json({ success: false, message: 'Помилка валідації', errors: messages });
  }

  // Sequelize unique constraint
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ success: false, message: 'Такий запис вже існує' });
  }

  // JWT помилки
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Недійсний токен авторизації' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Токен авторизації прострочений' });
  }

  // Кастомні операційні помилки ({ statusCode, message })
  if (err.isOperational) {
    return res.status(err.statusCode || 400).json({ success: false, message: err.message });
  }

  // Непередбачені помилки — логуємо, але не відкриваємо деталі клієнту
  console.error('[ERROR]', err);
  return res.status(500).json({
    success: false,
    message: 'Внутрішня помилка сервера',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

module.exports = app;