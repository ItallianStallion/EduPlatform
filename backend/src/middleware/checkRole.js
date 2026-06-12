// src/middleware/checkRole.js
// Middleware розмежування доступу за роллю.
// Приклад у route:
//   router.post('/courses', authenticate, checkRole('teacher', 'admin'), createCourse);

'use strict';

/**
 * Фабрика middleware — перевіряє чи роль користувача входить у список дозволених.
 * @param  {...string} allowedRoles - Список дозволених ролей ('student', 'teacher', 'admin')
 * @returns {Function} Express middleware
 */
const checkRole = (...allowedRoles) => {
  return (req, res, next) => {
    // authenticate має вже встановити req.user
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Не авторизовано.',
      });
    }

    const { role } = req.user;

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({
        success: false,
        message: `Доступ заборонено. Потрібна роль: ${allowedRoles.join(' або ')}.`,
      });
    }

    return next();
  };
};

module.exports = { checkRole };
