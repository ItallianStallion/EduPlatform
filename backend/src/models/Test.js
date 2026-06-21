// src/models/Test.js
// Тест курсу або тест блоку (урок+тест).
// Тест прив'язується АБО до courseId (старий формат — підсумковий тест
// курсу), АБО до lessonId (новий формат — тест конкретного блоку
// "урок-тест"). Рівно одне з двох полів має бути заповнене.
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
    // courseId та lessonId визначаються через associations у models/index.js.
    // courseId (nullable) — для старого формату "один тест на курс".
    // lessonId (nullable, unique) — для нового формату "тест блоку".
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
            if (
              typeof q.correctIndex !== 'number' ||
              q.correctIndex < 0 ||
              q.correctIndex >= q.options.length
            ) {
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
        min: { args: [0], msg: "Прохідний бал не може бути від'ємним" },
        max: { args: [100], msg: 'Прохідний бал не може перевищувати 100' },
      },
    },
    // Максимальна кількість дозволених спроб. null = необмежено.
    // Викладач задає це число при створенні тесту.
    maxAttempts: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      validate: {
        min: { args: [1], msg: 'Кількість спроб повинна бути мінімум 1' },
      },
      comment: 'null = необмежена кількість спроб',
    },
  },
  {
    tableName: 'tests',
    timestamps: true,
    indexes: [
      // courseId більше не unique — курс може мати кілька тестів
      // (по одному на блок) + опціонально один підсумковий курсовий тест.
      { fields: ['course_id'] },
      // Один тест на урок (блок) — урок не може мати два тести.
      { unique: true, fields: ['lesson_id'] },
    ],
    validate: {
      // Тест повинен належати рівно одному "власнику": або курсу
      // (підсумковий тест), або уроку (тест блоку). Ніколи обом і
      // ніколи жодному — інакше незрозуміло, де його показувати.
      exactlyOneOwner() {
        const hasCourse = !!this.courseId;
        const hasLesson = !!this.lessonId;
        if (hasCourse === hasLesson) {
          throw new Error(
            "Тест повинен бути прив'язаний рівно до одного: або courseId (підсумковий тест курсу), або lessonId (тест блоку).",
          );
        }
      },
    },
  },
);

module.exports = Test;
