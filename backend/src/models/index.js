// src/models/index.js
// Центральна точка імпорту всіх моделей та оголошення зв'язків (associations).
// щоб уникнути циклічних залежностей.

'use strict';

const User = require('./User');
const Category = require('./Category');
const Course = require('./Course');
const Enrollment = require('./Enrollment');

// ─────────────────────────────────────────────────────────────
// Моделі Dev #2;
// const UserProfile = require('./UserProfile');
// const Lesson = require('./Lesson');
// const Progress = require('./Progress');
// const Test = require('./Test');
// ─────────────────────────────────────────────────────────────

// --- User ↔ Course (викладач є автором багатьох курсів) ---
User.hasMany(Course, {
  foreignKey: { name: 'teacherId', allowNull: false },
  as: 'teacherCourses',
  onDelete: 'CASCADE',
});
Course.belongsTo(User, {
  foreignKey: { name: 'teacherId', allowNull: false },
  as: 'teacher',
});

// --- Category ↔ Course ---
Category.hasMany(Course, {
  foreignKey: { name: 'categoryId', allowNull: true },
  as: 'courses',
  onDelete: 'SET NULL',
});
Course.belongsTo(Category, {
  foreignKey: { name: 'categoryId', allowNull: true },
  as: 'category',
});

// --- User ↔ Course через Enrollments (N:M) ---
User.belongsToMany(Course, {
  through: Enrollment,
  foreignKey: 'userId',
  otherKey: 'courseId',
  as: 'enrolledCourses',
});
Course.belongsToMany(User, {
  through: Enrollment,
  foreignKey: 'courseId',
  otherKey: 'userId',
  as: 'enrolledStudents',
});

// Прямі зв'язки з Enrollment (для JOIN-запитів)
User.hasMany(Enrollment, { foreignKey: 'userId', as: 'enrollments' });
Enrollment.belongsTo(User, { foreignKey: 'userId', as: 'student' });

Course.hasMany(Enrollment, { foreignKey: 'courseId', as: 'enrollments' });
Enrollment.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });

// --- Зв'язки Dev #2  ---
// User.hasOne(UserProfile, { foreignKey: 'userId', as: 'profile', onDelete: 'CASCADE' });
// UserProfile.belongsTo(User, { foreignKey: 'userId', as: 'user' });
// Course.hasMany(Lesson, { foreignKey: 'courseId', as: 'lessons', onDelete: 'CASCADE' });
// Lesson.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });

module.exports = { User, Category, Course, Enrollment };
