/* Config propria do pacote de config compartilhado.
   Este index.js e JS CommonJS puro (nao TS), entao NAO usa o parser TS
   nem type-checking. root:true impede herdar a config de app (que exige
   parser TS + tsconfig que nao existe aqui). */
module.exports = {
  root: true,
  parserOptions: { ecmaVersion: 2021, sourceType: 'script' },
  env: { node: true, es2021: true },
  extends: ['eslint:recommended'],
};
