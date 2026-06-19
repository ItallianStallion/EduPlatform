// src/models/Progress.js
// Прогрес студента по урокам.
// Фіксує які уроки пройдено (completed=true) та коли.

'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Progress = sequelize.define(
  'Progress',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    // userId та lessonId визначаються через associations у models/index.js
    completed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    tableName: 'progress',
    timestamps: true,
    indexes: [
      // Унікальна пара: один запис прогресу на студента/урок
      { unique: true, fields: ['user_id', 'lesson_id'] },
      { fields: ['user_id'] },
      { fields: ['lesson_id'] },
    ],
  },
);

module.exports = Progress;
