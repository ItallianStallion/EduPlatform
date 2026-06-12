// src/config/redis.js
// Єдиний Redis-клієнт для всього застосунку (ioredis).
// Використовується для: refresh-токенів, кешу курсів, rate-limiting.

'use strict';

const Redis = require('ioredis');
require('dotenv').config();

const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB, 10) || 0,
  retryStrategy: (times) => {
    if (times > 5) {
      console.error('[Redis] Не вдалось підключитись після 5 спроб');
      return null; // Зупиняємо ретраї
    }
    return Math.min(times * 200, 2000); // Затримка між ретраями
  },
  lazyConnect: true, // Підключаємось явно при старті сервера
});

redisClient.on('error', (err) => {
  console.error('[Redis] Помилка:', err.message);
});

module.exports = { redisClient };
