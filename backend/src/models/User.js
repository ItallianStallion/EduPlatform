// src/models/User.js
// Модель таблиці users.  

'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const User = sequelize.define(
  'User',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: { msg: "Ім'я не може бути порожнім" },
        len: { args: [2, 100], msg: "Ім'я повинно бути від 2 до 100 символів" },
      },
    },
    surname: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Прізвище не може бути порожнім' },
      },
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: { msg: 'Цей email вже зареєстровано' },
      validate: {
        isEmail: { msg: 'Невірний формат email' },
      },
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      // Не повертаємо хеш у JSON відповідях
      // (додатково реалізовано через toSafeJSON нижче)
    },
    role: {
      type: DataTypes.ENUM('student', 'teacher', 'admin'),
      allowNull: false,
      defaultValue: 'student',
    },
    // Брute-force захист
    failedLoginAttempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    lockedUntil: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    // Бан від адміна
    isBanned: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    // Баланс викладача (нараховується після продажів курсів)
    balance: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0,
      allowNull: false,
      validate: {
        min: { args: [0], msg: 'Баланс не може бути від\'ємним'},
      },
    },
  },
  {
    tableName: 'users',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['email'] },
      { fields: ['role'] },
    ],
  },
);

// Метод для безпечного повернення даних (без passwordHash)
User.prototype.toSafeJSON = function () {
  const values = { ...this.get() };
  delete values.passwordHash;
  return values;
};

module.exports = User;
