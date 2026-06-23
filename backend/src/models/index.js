// src/models/index.js
// Центральна точка імпорту всіх моделей та оголошення зв'язків (associations).
// щоб уникнути циклічних залежностей.

'use strict';

const User = require('./User');
const Category = require('./Category');
const Course = require('./Course');
const Enrollment = require('./Enrollment');

// ─────────────────────────────────────────────────────────────
// Моделі Dev #2
// ─────────────────────────────────────────────────────────────
const UserProfile = require('./UserProfile');
const Lesson = require('./Lesson');
const Progress = require('./Progress');
const Test = require('./Test');
const Result = require('./Result');
const Topic = require('./Topic');

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

// --- Зв'язки Dev #2 ---
User.hasOne(UserProfile, { foreignKey: 'userId', as: 'profile', onDelete: 'CASCADE' });
UserProfile.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Course.hasMany(Lesson, { foreignKey: 'courseId', as: 'lessons', onDelete: 'CASCADE' });
Lesson.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });

// Progress: студент ↔ урок (який урок пройдено)
User.hasMany(Progress, { foreignKey: 'userId', as: 'progress' });
Progress.belongsTo(User, { foreignKey: 'userId', as: 'student' });

Lesson.hasMany(Progress, { foreignKey: 'lessonId', as: 'progress', onDelete: 'CASCADE' });
Progress.belongsTo(Lesson, { foreignKey: 'lessonId', as: 'lesson' });

// Test: курс має опціонально один підсумковий тест (legacy-формат —
// курс без блокової структури, де тест прив'язаний напряму до курсу).
Course.hasOne(Test, {
  foreignKey: { name: 'courseId', allowNull: true },
  as: 'test',
  onDelete: 'CASCADE',
});
Test.belongsTo(Course, { foreignKey: { name: 'courseId', allowNull: true }, as: 'course' });

// Test: урок (блок) має опціонально один тест — новий формат
// "урок-тест". Один урок не може мати два тести (unique index у моделі).
Lesson.hasOne(Test, {
  foreignKey: { name: 'lessonId', allowNull: true },
  as: 'test',
  onDelete: 'CASCADE',
});
Test.belongsTo(Lesson, { foreignKey: { name: 'lessonId', allowNull: true }, as: 'lesson' });

// Result: кожна спроба здачі тесту студентом (для лічильника maxAttempts)
User.hasMany(Result, { foreignKey: 'userId', as: 'testResults' });
Result.belongsTo(User, { foreignKey: 'userId', as: 'student' });

Test.hasMany(Result, { foreignKey: 'testId', as: 'results', onDelete: 'CASCADE' });
Result.belongsTo(Test, { foreignKey: 'testId', as: 'test' });

// --- Topic: курс має багато тем ---
Course.hasMany(Topic, { foreignKey: 'courseId', as: 'topics', onDelete: 'CASCADE' });
Topic.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });

// --- Topic ↔ Lesson ---
Topic.hasMany(Lesson, { foreignKey: 'topicId', as: 'lessons', onDelete: 'SET NULL' });
Lesson.belongsTo(Topic, { foreignKey: 'topicId', as: 'topic' });

// --- Topic ↔ Test (один тест на тему) ---
Topic.hasOne(Test, { foreignKey: 'topicId', allowNull: true, as: 'test', onDelete: 'CASCADE' });
Test.belongsTo(Topic, { foreignKey: { name: 'topicId', allowNull: true }, as: 'topic' });

module.exports = {
  User,
  Category,
  Course,
  Enrollment,
  UserProfile,
  Lesson,
  Progress,
  Test,
  Result,
  Topic,
};
