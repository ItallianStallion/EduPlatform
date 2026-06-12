// src/models/Course.js
// Модель курсу.  

'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Course = sequelize.define(
  'Course',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    // teacherId та categoryId визначаються через associations у index.js
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Назва курсу не може бути порожньою' },
        len: { args: [5, 255], msg: 'Назва повинна бути від 5 до 255 символів' },
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    coverImage: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'URL обкладинки курсу (S3/R2)',
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
      validate: {
      min: { args: [0], msg: "Ціна не може бути від'ємною" },
      },
      comment: '0 = безкоштовно',
    },
    status: {
      type: DataTypes.ENUM('draft', 'published'),
      allowNull: false,
      defaultValue: 'draft',
    },
  },
  {
    tableName: 'courses',
    timestamps: true,
    indexes: [
      { fields: ['teacher_id'] },
      { fields: ['category_id'] },
      { fields: ['status'] },
      // Full-text пошук (PostgreSQL GIN-індекс для ILIKE)
      { fields: ['title'] },
    ],
  },
);

module.exports = Course;
