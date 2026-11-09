import { describe, it, expect } from 'vitest';
import { vercelApiUrlError } from '../vercelBuildGuard';

const API = 'https://api.agendasalas.com.br';

// Build na Vercel (ADR-010): sem VITE_API_URL válida, o bundle cairia no
// fallback http://localhost:3000 de config/api.ts e o login falharia em
// produção sem nenhum erro no build.
describe('vercelApiUrlError', () => {
  it.each([undefined, '', 'http://localhost:3000', '/api', `${API}/`])(
    'fora da Vercel (sem VERCEL) → null para VITE_API_URL=%s (comportamento de hoje)',
    url => {
      expect(vercelApiUrlError({ VITE_API_URL: url })).toBeNull();
    },
  );

  it(`na Vercel com ${API} → null`, () => {
    expect(vercelApiUrlError({ VERCEL: '1', VITE_API_URL: API })).toBeNull();
  });

  it.each([undefined, '', '   '])('na Vercel com VITE_API_URL ausente (%j) → erro', url => {
    const error = vercelApiUrlError({ VERCEL: '1', VITE_API_URL: url });

    expect(error).toContain('VITE_API_URL');
    expect(error).toContain('ausente');
  });

  it.each([
    'http://localhost:3000',
    'https://localhost',
    'https://127.0.0.1:3000',
    'https://[::1]',
    'https://0.0.0.0',
    'https://app.localhost',
  ])('na Vercel apontando para a máquina local (%s) → erro', url => {
    const error = vercelApiUrlError({ VERCEL: '1', VITE_API_URL: url });

    expect(error).toContain('VITE_API_URL');
    expect(error).toContain('local');
  });

  it.each(['http://api.agendasalas.com.br', '/api', 'api.agendasalas.com.br'])(
    'na Vercel sem URL https absoluta (%s) → erro',
    url => {
      const error = vercelApiUrlError({ VERCEL: '1', VITE_API_URL: url });

      expect(error).toContain('VITE_API_URL');
      expect(error).toContain('https://');
    },
  );

  it('na Vercel com barra no final → erro (o apiClient geraria //auth/login)', () => {
    const error = vercelApiUrlError({ VERCEL: '1', VITE_API_URL: `${API}/` });

    expect(error).toContain('VITE_API_URL');
    expect(error).toContain('barra');
  });
});
