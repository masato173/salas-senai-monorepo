// Issue 2 — senha de teste nunca tem default. Variável ausente FALHA o teste
// com mensagem clara, em vez de cair numa string vazia (401 confuso no login)
// ou numa senha conhecida. No CI elas vêm do step "Generate ephemeral E2E
// passwords"; localmente, defina E2E_*_PASSWORD com os mesmos valores das
// SEED_*_PASSWORD usadas no seed.
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`${name} nao definida — os testes E2E exigem essa variavel (sem default).`);
  }
  return value;
}
