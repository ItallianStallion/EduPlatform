// src/models/Topic.js
// Тема курсу — група уроків з опціональним тестом.
// Один курс має багато тем, кожна тема має свої уроки і може мати один тест.

'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Topic = sequelize.define(
  'Topic',
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
        notEmpty: { msg: 'Назва теми не може бути порожньою' },
        len: { args: [2, 255], msg: 'Назва теми: від 2 до 255 символів' },
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Порядок теми в курсі
    order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: { args: [0], msg: 'Порядок теми не може бути від\'ємним' },
      },
    },
  },
  {
    tableName: 'topics',
    timestamps: true,
    indexes: [
      { fields: ['course_id'] },
      { fields: ['course_id', 'order'] },
    ],
  },
);

module.exports = Topic;
