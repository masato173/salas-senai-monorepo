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

  // TRUST_PROXY é obrigatório em produção (#21) — entra no input só para
  // isolar o THROTTLE_SKIP.
  it('aceita THROTTLE_SKIP=false em produção', () => {
    const result = envSchema.safeParse({
      ...BASE,
      NODE_ENV: 'production',
      TRUST_PROXY: '1',
      THROTTLE_SKIP: 'false',
    });
    expect(result.success).toBe(true);
  });

  it('aceita produção sem THROTTLE_SKIP', () => {
    const result = envSchema.safeParse({ ...BASE, NODE_ENV: 'production', TRUST_PROXY: '1' });
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

// Saltos de proxy confiáveis (Express 'trust proxy'). O valor chega ao
// app.set já convertido: a string '1' o Express leria como o IP 0.0.0.1, e
// 'false' derrubaria o boot ("invalid IP address").
describe('envSchema — TRUST_PROXY (#21)', () => {
  const PROD = { ...BASE, NODE_ENV: 'production' };

  it('rejeita produção sem TRUST_PROXY, com issue no path TRUST_PROXY citando produção', () => {
    const result = envSchema.safeParse(PROD);

    expect(result.success).toBe(false);
    if (result.success) return;
    const issue = result.error.issues.find(i => i.path.join('.') === 'TRUST_PROXY');
    expect(issue).toBeDefined();
    expect(issue?.message.toLowerCase()).toContain('producao');
  });

  it.each([
    ['1', 1],
    ['0', 0],
    ['2', 2],
  ])("produção com TRUST_PROXY='%s' → número %i", (raw, expected) => {
    const result = envSchema.safeParse({ ...PROD, TRUST_PROXY: raw });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.TRUST_PROXY).toBe(expected);
  });

  it("produção com TRUST_PROXY='false' → false (booleano)", () => {
    const result = envSchema.safeParse({ ...PROD, TRUST_PROXY: 'false' });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.TRUST_PROXY).toBe(false);
  });

  // 'true' confiaria em qualquer X-Forwarded-For enviado pelo cliente.
  it.each(['1.5', '-1', 'abc', '', 'true', ' 1'])("rejeita TRUST_PROXY='%s'", raw => {
    for (const NODE_ENV of ['production', 'development']) {
      const result = envSchema.safeParse({ ...BASE, NODE_ENV, TRUST_PROXY: raw });

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.issues.some(i => i.path.join('.') === 'TRUST_PROXY')).toBe(true);
    }
  });

  it.each(['development', 'test'])(
    'NODE_ENV=%s sem TRUST_PROXY → ok, default false (sem proxy à frente)',
    NODE_ENV => {
      const result = envSchema.safeParse({ ...BASE, NODE_ENV });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.TRUST_PROXY).toBe(false);
    },
  );

  it('sem NODE_ENV nem TRUST_PROXY (caso do CI e2e) → ok, default false', () => {
    const result = envSchema.safeParse(BASE);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.TRUST_PROXY).toBe(false);
  });
});
