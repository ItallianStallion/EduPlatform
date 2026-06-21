import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Викликати setState(true/null) на початку ефекту перед async fetch —
      // ідіоматичний, рекомендований React-документацією паттерн завантаження
      // даних (isLoading/error). Це експериментальне правило орієнтоване на
      // React Compiler і дає масові фолс-позитиви на звичайних fetch-ефектах.
      'react-hooks/set-state-in-effect': 'off',
      // Контексти (AuthContext, ToastContext) навмисно експортують і
      // Provider, і відповідний хук з одного файлу — стандартний паттерн
      // Context API. Впливає лише на Fast Refresh у дев-режимі, не на код.
      'react-refresh/only-export-components': 'off',
    },
  },
])
