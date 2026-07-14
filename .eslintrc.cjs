/* ESLint config da raiz do monorepo.
   Ignora apps/, packages/ e tests/ — cada um tem config propria. */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  env: { node: true, es2021: true },
  ignorePatterns: [
    'apps/',
    'packages/',
    'tests/',
    'node_modules/',
    'dist/',
  ],
  rules: {
    '@typescript-eslint/no-require-imports': 'off',
  },
};