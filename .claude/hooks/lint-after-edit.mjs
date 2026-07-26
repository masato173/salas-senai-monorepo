#!/usr/bin/env node
// Roda ESLint --fix no arquivo tocado, logo apos Edit/Write.
// PostToolUse — nunca bloqueia (sempre exit 0). Grava em arquivo alem
// de stdout/stderr, pra nao depender do Claude Code relayar o feedback.
import { execSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

let input = '';
process.stdin.on('data', c => { input += c; });
process.stdin.on('end', () => {
  const logPath = '.claude/hooks/lint-log.txt';
  try {
    const data = JSON.parse(input);
    const filePath = data?.tool_input?.file_path ?? '';
    if (!/\.(ts|tsx)$/.test(filePath)) {
      process.exit(0);
    }
    let output = '';
    try {
      output = execSync(`npx eslint --fix "${filePath}"`, {
        cwd: process.cwd(),
        timeout: 15000,
        encoding: 'utf8',
      });
      appendFileSync(logPath, `[OK] ${filePath}\n`);
    } catch (e) {
      output = (e.stdout ?? '') + (e.stderr ?? '');
      appendFileSync(logPath, `[LINT ISSUE] ${filePath}\n${output}\n---\n`);
      // Ainda assim NAO bloqueia — so reporta. process.stdout entrega o
      // texto de volta pro Claude Code como feedback do hook.
      console.log(output);
    }
    process.exit(0);
  } catch (err) {
    appendFileSync(logPath, `[HOOK ERROR] ${String(err)}\n`);
    process.exit(0);
  }
});