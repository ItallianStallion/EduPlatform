// src/models/Enrollment.js
// Записи студентів на курси.  

'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Enrollment = sequelize.define(
  'Enrollment',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    // userId та courseId визначаються через associations у index.js
    enrolledAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'enrollments',
    timestamps: true,
    indexes: [
      // Унікальна пара: студент може записатись на курс лише один раз
      { unique: true, fields: ['user_id', 'course_id'] },
      { fields: ['user_id'] },
      { fields: ['course_id'] },
    ],
  },
);

module.exports = Enrollment;
