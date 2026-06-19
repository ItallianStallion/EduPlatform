// src/models/Lesson.js
// Урок курсу. Один курс має багато уроків з порядковим номером.

'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Lesson = sequelize.define(
  'Lesson',
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
        notEmpty: { msg: 'Назва уроку не може бути порожньою' },
        len: { args: [2, 255], msg: 'Назва уроку повинна бути від 2 до 255 символів' },
      },
    },
    type: {
      type: DataTypes.ENUM('video', 'text', 'pdf'),
      allowNull: false,
      defaultValue: 'text',
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Текстовий контент уроку (для type=text)',
    },
    videoUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'URL відео (YouTube embed або S3)',
    },
    pdfUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'URL PDF-файлу (S3/R2)',
    },
    // Порядок уроків у курсі
    order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: { args: [0], msg: 'Порядок уроку не може бути від\'ємним' },
      },
    },
  },
  {
    tableName: 'lessons',
    timestamps: true,
    indexes: [
      { fields: ['course_id'] },
      { fields: ['course_id', 'order'] },
    ],
  },
);

module.exports = Lesson;
