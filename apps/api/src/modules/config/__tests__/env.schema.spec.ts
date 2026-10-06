import { describe, it, expect } from 'vitest';
import { envSchema } from '../env.schema';

// Valores fictícios — só satisfazem o schema (JWT_* exigem 32+ caracteres).
const BASE = {
  JWT_SECRET: 'x'.repeat(32),
  JWT_REFRESH_SECRET: 'y'.repeat(32),
};

describe('envSchema — THROTTLE_SKIP x NODE_ENV (issue 7)', () => {
  it('rejeita THROTTLE_SKIP=true com NODE_ENV=production, com issue no path THROTTLE_SKIP', () => {
    const result = envSchema.safeParse({ ...BASE, NODE_ENV: 'production', THROTTLE_SKIP: 'true' });

    expect(result.success).toBe(false);
    if (result.success) return;
    const issue = result.error.issues.find(i => i.path.join('.') === 'THROTTLE_SKIP');
    expect(issue).toBeDefined();
  });

  it('a mensagem de erro cita THROTTLE_SKIP e produção', () => {
    const result = envSchema.safeParse({ ...BASE, NODE_ENV: 'production', THROTTLE_SKIP: 'true' });

    expect(result.success).toBe(false);
    if (result.success) return;
    const message = result.error.issues.map(i => i.message).join(' ');
    expect(message).toContain('THROTTLE_SKIP');
    expect(message.toLowerCase()).toContain('producao');
  });

  it('aceita THROTTLE_SKIP=false em produção', () => {
    const result = envSchema.safeParse({ ...BASE, NODE_ENV: 'production', THROTTLE_SKIP: 'false' });
    expect(result.success).toBe(true);
  });

  it('aceita produção sem THROTTLE_SKIP', () => {
    const result = envSchema.safeParse({ ...BASE, NODE_ENV: 'production' });
    expect(result.success).toBe(true);
  });

  it('aceita THROTTLE_SKIP=true em development', () => {
    const result = envSchema.safeParse({ ...BASE, NODE_ENV: 'development', THROTTLE_SKIP: 'true' });
    expect(result.success).toBe(true);
  });

  it('aceita THROTTLE_SKIP=true em test', () => {
    const result = envSchema.safeParse({ ...BASE, NODE_ENV: 'test', THROTTLE_SKIP: 'true' });
    expect(result.success).toBe(true);
  });

  it('aceita THROTTLE_SKIP=true sem NODE_ENV (default development — caso do CI e2e)', () => {
    const result = envSchema.safeParse({ ...BASE, THROTTLE_SKIP: 'true' });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.NODE_ENV).toBe('development');
  });
});
