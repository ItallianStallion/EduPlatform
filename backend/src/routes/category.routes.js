'use strict';

const express = require('express');
const { Category } = require('../models');

const router = express.Router();

// GET /api/v1/categories — публічний список всіх категорій
router.get('/', async (_req, res, next) => {
  try {
    const categories = await Category.findAll({
      attributes: ['id', 'name', 'icon'],
      order: [['name', 'ASC']],
    });
    res.json({ success: true, data: { categories } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
