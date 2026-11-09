// Guard do build na Vercel (ADR-010) — chamado no topo do vite.config.ts.
//
// Na Vercel o frontend chama a API por URL absoluta (VITE_API_URL). Sem ela,
// config/api.ts cai no fallback http://localhost:3000: o build passa e o
// login quebra em produção sem nenhum erro visível. Este guard transforma
// isso em falha de build.
//
// Fora da Vercel (dev, CI, Docker) devolve sempre null: nada muda.
// Função pura (recebe o env) para ser testável sem o Vite.

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]']);

export function vercelApiUrlError(
  env: Readonly<Record<string, string | undefined>>,
): string | null {
  if (!env['VERCEL']) return null;

  const raw = env['VITE_API_URL']?.trim() ?? '';
  const exemplo = 'ex.: https://api.agendasalas.com.br';
  if (raw === '') {
    return `[vercel] VITE_API_URL ausente: defina nas variáveis do projeto na Vercel (${exemplo}).`;
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return `[vercel] VITE_API_URL deve ser uma URL absoluta https:// (${exemplo}); recebido: ${raw}`;
  }
  const host = url.hostname.toLowerCase();
  if (LOCAL_HOSTS.has(host) || host.endsWith('.localhost')) {
    return `[vercel] VITE_API_URL aponta para a máquina local (${url.host}); use a URL pública da API (${exemplo}).`;
  }
  if (url.protocol !== 'https:') {
    return `[vercel] VITE_API_URL deve usar https:// (o site é https; http seria conteúdo misto); recebido: ${raw}`;
  }
  if (raw.endsWith('/')) {
    return `[vercel] VITE_API_URL sem barra no final (o apiClient concatena os caminhos); recebido: ${raw}`;
  }
  return null;
}
