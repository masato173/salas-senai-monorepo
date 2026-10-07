// GlobalSetup — acorda Supabase antes de rodar specs (Bug #1).
// POST /auth/login valida NestJS + PostgreSQL de uma vez.

import { requireEnv } from './env';

export default async function waitForBackend(): Promise<void> {
  const API_URL = process.env['API_URL'] ?? 'http://localhost:3000';
  const EMAIL = process.env['E2E_ADMIN_EMAIL'] ?? '';
  const PASSWORD = requireEnv('E2E_ADMIN_PASSWORD');

  const MAX_RETRIES = 10;
  const RETRY_DELAY_MS = 3_000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
      });
      if (res.ok) {
        console.log(`[E2E] Backend ready after ${attempt} attempt(s) — Supabase awake`);
        return;
      }
    } catch {
      // NestJS ainda não respondeu
    }
    console.log(`[E2E] Waiting for backend... ${attempt}/${MAX_RETRIES}`);
    await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
  }

  throw new Error('[E2E] Backend did not become ready in time');
}
