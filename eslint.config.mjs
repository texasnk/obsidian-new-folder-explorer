import eslint from '@eslint/js';
import parser from '@typescript-eslint/parser';
import plugin from '@typescript-eslint/eslint-plugin';

export default [
  eslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    languageOptions: {
      parser,
      globals: {
        HTMLElement: 'readonly',
        HTMLInputElement: 'readonly',
        MouseEvent: 'readonly',
      },
    },
    plugins: { '@typescript-eslint': plugin },
    rules: plugin.configs.recommended.rules,
  },
  { ignores: ['main.js', 'node_modules', 'coverage'] },
];
