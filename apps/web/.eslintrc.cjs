const base = require('@salas-senai/eslint-config');
module.exports = {
  ...base,
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
};
