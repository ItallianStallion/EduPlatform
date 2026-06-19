// src/models/Test.js
// Тест курсу. Один курс має один підсумковий тест.
// Питання зберігаються як JSONB-масив для гнучкості без окремої таблиці.

'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Test = sequelize.define(
  'Test',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    // courseId визначається через association у models/index.js
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Назва тесту не може бути порожньою' },
      },
    },
    // Масив питань: [{ question: string, options: string[], correctIndex: number }]
    questions: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      validate: {
        isValidQuestions(value) {
          if (!Array.isArray(value) || value.length === 0) {
            throw new Error('Тест повинен містити хоча б одне питання');
          }
          value.forEach((q, i) => {
            if (!q.question || typeof q.question !== 'string') {
              throw new Error(`Питання #${i + 1}: відсутній текст питання`);
            }
            if (!Array.isArray(q.options) || q.options.length < 2) {
              throw new Error(`Питання #${i + 1}: потрібно мінімум 2 варіанти відповіді`);
            }
            if (typeof q.correctIndex !== 'number' || q.correctIndex < 0 || q.correctIndex >= q.options.length) {
              throw new Error(`Питання #${i + 1}: невірний correctIndex`);
            }
          });
        },
      },
    },
    // Мінімальний прохідний бал у відсотках (0–100)
    passingScore: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 70,
      validate: {
        min: { args: [0], msg: 'Прохідний бал не може бути від\'ємним' },
        max: { args: [100], msg: 'Прохідний бал не може перевищувати 100' },
      },
    },
  },
  {
    tableName: 'tests',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['course_id'] },
    ],
  },
);

module.exports = Test;
