// src/server.js
// Точка входу: підключає БД, Redis, потім стартує HTTP-сервер.

'use strict';

require('dotenv').config();
const app = require('./app');
const { sequelize } = require('./config/database');
const { redisClient } = require('./config/redis');

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Перевіряємо підключення до PostgreSQL
    await sequelize.authenticate();
    console.info('[DB] PostgreSQL підключено успішно');

    // Синхронізація моделей. У проєкту ще немає окремих міграцій,
    // тому sync() створює/оновлює таблиці автоматично при кожному старті.
    await sequelize.sync({ alter: true });
    console.info('[DB] Моделі синхронізовано (alter mode)');

    // Перевіряємо підключення до Redis
    await redisClient.ping();
    console.info('[Redis] Підключено успішно');

    app.listen(PORT, () => {
      console.info(`[Server] EduPlatform API запущено на порту ${PORT} (${process.env.NODE_ENV})`);
    });
  } catch (err) {
    console.error('[Server] Помилка запуску:', err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.info("[Server] SIGTERM отримано. Закриваємо з'єднання...");
  await sequelize.close();
  await redisClient.quit();
  process.exit(0);
});

startServer();
