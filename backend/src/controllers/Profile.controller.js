// src/controllers/profile.controller.js
// HTTP-шар профілю користувача.

'use strict';

const { validationResult } = require('express-validator');
const profileService = require('../services/profile.service');

/**
 * GET /api/v1/profiles/:id
 * Повертає профіль користувача (публічна інформація).
 */
const getProfile = async (req, res, next) => {
  try {
    const user = await profileService.getProfile(req.params.id);
    return res.status(200).json({ success: true, data: { user } });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/v1/profiles/me
 * Повертає профіль поточного авторизованого користувача.
 */
const getMyProfile = async (req, res, next) => {
  try {
    const user = await profileService.getProfile(req.user.id);
    return res.status(200).json({ success: true, data: { user } });
  } catch (err) {
    return next(err);
  }
};

/**
 * PATCH /api/v1/profiles/me
 * Оновлює профіль поточного користувача.
 * Body: { avatar?, bio?, phone? }
 */
const updateMyProfile = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const profile = await profileService.updateProfile(req.user.id, req.body);

    return res.status(200).json({
      success: true,
      message: 'Профіль оновлено.',
      data: { profile },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = { getProfile, getMyProfile, updateMyProfile };