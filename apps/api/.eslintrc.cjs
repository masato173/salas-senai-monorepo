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
      files: ['**/*.test.ts', '**/*.spec.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any':               'off',
        '@typescript-eslint/no-unsafe-assignment':          'off',
        '@typescript-eslint/no-unsafe-call':                'off',
        '@typescript-eslint/no-unsafe-argument':            'off',
        '@typescript-eslint/no-unsafe-call':                'off',
        '@typescript-eslint/no-unsafe-argument':            'off',
        '@typescript-eslint/no-unsafe-member-access':       'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
      },
    },
  ],
};
