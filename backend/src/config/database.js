// src/config/database.js
// Налаштування підключення до PostgreSQL через Sequelize ORM.

'use strict';

const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    dialect: 'postgres',

    // Пул з'єднань — оптимально для MVP
    pool: {
      max: 10, // Максимум одночасних з'єднань
      min: 2, // Мінімум активних з'єднань
      acquire: 30000, // Таймаут на отримання з'єднання (мс)
      idle: 10000, // Час до закриття неактивного з'єднання (мс)
    },

    // SQL-логування лише у dev-режимі
    logging: process.env.DB_LOGGING === 'true' ? console.info : false,

    // Автоматично перетворює camelCase на snake_case у БД
    define: {
      underscored: true,
      timestamps: true, // createdAt / updatedAt автоматично
      freezeTableName: false, // Sequelize сам додає 's' до імені таблиці
    },

    dialectOptions: {
      // Для production з SSL (AWS RDS, Railway тощо):
      // ssl: { require: true, rejectUnauthorized: false },
    },
  },
);

module.exports = { sequelize, Sequelize };
