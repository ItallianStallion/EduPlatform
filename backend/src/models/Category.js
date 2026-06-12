// src/models/Category.js
// Категорії курсів.  

'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Category = sequelize.define(
  'Category',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: { msg: 'Назва категорії не може бути порожньою' },
      },
    },
    // Назва іконки (наприклад, 'code', 'design', 'business')
    icon: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: 'book',
    },
  },
  {
    tableName: 'categories',
    timestamps: true,
  },
);

module.exports = Category;
