// Origens de CORS configuráveis via CORS_ORIGIN (lista separada por vírgula).
// Fallback preserva o comportamento local: dev server (5173) e preview (4173).
// Extraído pra não duplicar a string de fallback entre main.ts (CORS HTTP) e
// RealtimeGateway (CORS do WebSocket) — mesma origem deve valer nos dois.
export function resolveCorsOrigins(): string[] {
  return process.env['CORS_ORIGIN']
    ? process.env['CORS_ORIGIN'].split(',').map(o => o.trim())
    : ['http://localhost:5173', 'http://localhost:4173'];
}
