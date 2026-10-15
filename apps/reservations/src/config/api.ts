// Fonte única de verdade para URL do backend.
// Usado por apiClient.ts e socketClient.ts.
// Absoluta (dev, build do GitHub Pages) ou relativa à origem do site ('/api',
// atrás do nginx do infra/docker — ADR-009). Sem barra no final.
export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

// Socket.IO (#21): o socket.io-client trata o CAMINHO da URL como NAMESPACE,
// não como caminho do transporte — io('/api/rooms') entraria no namespace
// '/api/rooms' em /socket.io e a conexão falharia em silêncio. Por isso a URL
// leva só origem + namespace, e o caminho da base vai para a opção `path`:
//   '/api'                 → <origem do site>/rooms, path '/api/socket.io'
//   'https://host'         → https://host/rooms,     path '/socket.io' (padrão)
//   'https://host/prefixo' → https://host/rooms,     path '/prefixo/socket.io'
export function resolveSocketTarget(
  apiBase: string,
  pageOrigin: string,
  namespace: string,
): { url: string; path: string } {
  const base = new URL(apiBase, pageOrigin);
  const basePath = base.pathname.replace(/\/+$/, '');
  return { url: `${base.origin}${namespace}`, path: `${basePath}/socket.io` };
}
