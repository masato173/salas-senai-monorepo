#!/usr/bin/env node
// Bloqueia Edit/Write em arquivos .env (exceto .env.example).
// PreToolUse — exit 2 cancela a chamada da tool antes de executar.
let input = '';
process.stdin.on('data', c => { input += c; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const filePath = data?.tool_input?.file_path ?? '';
    const isEnvFile =
      /(^|[\\/])\.env(\.[^.\\/]+)?$/.test(filePath) &&
      !/\.env\.example$/.test(filePath);
    if (isEnvFile) {
      console.error(
        `Bloqueado: edicao de arquivo de segredo (${filePath}). ` +
        `Edite .env manualmente fora do Claude Code.`
      );
      process.exit(2);
    }
    process.exit(0);
  } catch {
    process.exit(0); // parse falhou -> nao bloqueia, evita travar o fluxo
  }
});