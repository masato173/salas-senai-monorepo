import { describe, it, expect } from 'vitest';
import { resolveSocketTarget } from '../api';

// #21 — o socket.io-client trata o CAMINHO da URL como namespace, não como
// caminho do transporte. A URL leva só origem + namespace; o caminho da base
// da API vai para a opção `path`.
describe('resolveSocketTarget', () => {
  it.each([
    // [API_BASE, origem do site, url esperada, path esperado]
    // nginx do infra/docker (mesma origem)
    ['/api', 'http://localhost', 'http://localhost/rooms', '/api/socket.io'],
    ['/api/', 'http://192.0.2.10', 'http://192.0.2.10/rooms', '/api/socket.io'],
    // build do GitHub Pages (URL absoluta) — igual a hoje
    [
      'https://api.exemplo.com',
      'https://pages.exemplo.io',
      'https://api.exemplo.com/rooms',
      '/socket.io',
    ],
    [
      'https://api.exemplo.com/',
      'https://pages.exemplo.io',
      'https://api.exemplo.com/rooms',
      '/socket.io',
    ],
    // base absoluta com prefixo
    [
      'https://host.exemplo/prefixo',
      'https://pages.exemplo.io',
      'https://host.exemplo/rooms',
      '/prefixo/socket.io',
    ],
    // dev (default de config/api.ts) — igual a hoje
    ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:3000/rooms', '/socket.io'],
  ])('%s (site em %s) → url %s, path %s', (apiBase, pageOrigin, url, path) => {
    expect(resolveSocketTarget(apiBase, pageOrigin, '/rooms')).toEqual({ url, path });
  });

  it.each(['/api', 'https://host.exemplo/prefixo'])(
    'o caminho da base (%s) nunca entra no namespace',
    apiBase => {
      const { url } = resolveSocketTarget(apiBase, 'http://localhost', '/rooms');

      expect(new URL(url).pathname).toBe('/rooms');
    },
  );
});
