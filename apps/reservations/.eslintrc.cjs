const base = require('@salas-senai/eslint-config');

module.exports = {
  root: true,
  ...base,
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  overrides: [
    {
      // any em mocks de teste eh padrao; nao queremos friccao aqui.
      // Sprint 5 F2: explicit-function-return-type tambem 'off' em testes —
      // helpers (function mockFetchOnce, etc.) sao one-shot, tipar e ruido.
      files: ['**/*.test.ts', '**/*.test.tsx'],
      rules: {
        '@typescript-eslint/no-explicit-any':               'off',
        '@typescript-eslint/no-unsafe-assignment':          'off',
        '@typescript-eslint/no-unsafe-member-access':       'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
      },
    },
    {
      // Sprint 5 F2: componentes React + helpers visuais locais. JSX ja documenta
      // o retorno; tipar `function Field(): JSX.Element` em cada um eh ruido.
      // Regra continua ATIVA em `.ts` (logica de dominio) — la o retorno importa.
      files: ['**/*.tsx'],
      rules: {
        '@typescript-eslint/explicit-function-return-type': 'off',
      },
    },
  ],
};
