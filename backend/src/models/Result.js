// src/models/Result.js
// Результат однієї спроби здачі тесту студентом.
// ВАЖЛИВО: на відміну від попередньої версії, кожна спроба ЗБЕРІГАЄТЬСЯ —
// це необхідно, щоб рахувати кількість використаних спроб (maxAttempts на Test).

'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Result = sequelize.define(
  'Result',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    // userId, testId визначаються через associations у models/index.js
    score: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Відсоток правильних відповідей (0-100)',
    },
    passed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    // Відповіді студента: масив індексів обраних варіантів по порядку питань
    answers: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'results',
    timestamps: true,
    indexes: [{ fields: ['user_id', 'test_id'] }, { fields: ['test_id'] }],
  },
);

module.exports = Result;
