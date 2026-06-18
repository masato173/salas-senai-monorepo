const base = require('@salas-senai/eslint-config');

module.exports = {
  ...base,
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  overrides: [
    {
      // any em mocks de teste eh padrao; nao queremos friccao aqui.
      files: ['**/*.test.ts', '**/*.test.tsx'],
      rules: {
        '@typescript-eslint/no-explicit-any':         'off',
        '@typescript-eslint/no-unsafe-assignment':    'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
      },
    },
  ],
};
