/** @type {import("eslint").Linter.Config} */
module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'prettier',
  ],
  rules: {
    // Qualidade
    '@typescript-eslint/no-explicit-any':          'error',
    '@typescript-eslint/no-unused-vars':            ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/no-floating-promises':      'error',

    // Segurança
    'no-eval':                                      'error',
    'no-implied-eval':                              'error',
    'no-new-func':                                  'error',
    '@typescript-eslint/no-unsafe-assignment':      'warn',
    '@typescript-eslint/no-unsafe-member-access':   'warn',

    // Boas práticas
    'prefer-const':                                 'error',
    'no-var':                                       'error',
    'eqeqeq':                                       ['error', 'always'],
    'no-console':                                   ['warn', { allow: ['warn', 'error'] }],
  },
};
