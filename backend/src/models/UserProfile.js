// src/models/UserProfile.js
// Розширений профіль користувача (1:1 з User).
// Зберігає дані, які не є обов'язковими для авторизації.

'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const UserProfile = sequelize.define(
  'UserProfile',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    // userId визначається через association у models/index.js
    avatar: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'URL аватара (S3/R2)',
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: { args: [0, 1000], msg: 'Біографія не може перевищувати 1000 символів' },
      },
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
  },
  {
    tableName: 'user_profiles',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['user_id'] },
    ],
  },
);

module.exports = UserProfile;
