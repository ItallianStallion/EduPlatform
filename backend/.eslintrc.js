// .eslintrc.js — спільний конфіг ESLint для всієї команди
// Гарантує однаковий стиль коду, щоб Git не фіксував відмінності у синтаксисі.
module.exports = {
  env: {
    node: true,
    es2022: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 2022,
  },
  rules: {
    'no-console': 'off',
  },
};
