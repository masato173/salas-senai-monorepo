// Senhas das contas de seed (issue 2). Vêm SEMPRE de variável de ambiente —
// sem default em nenhum ambiente: uma senha fixa no código vira credencial
// conhecida por qualquer pessoa com acesso ao repositório.
//
// Fica em prisma/ (e não em src/) porque o Dockerfile.api compila o seed
// isolado com `tsc prisma/seed.ts --outDir prisma`: importar de src/ mudaria
// o rootDir e o seed.js deixaria de sair em apps/api/prisma/seed.js.

export const SEED_PASSWORD_MIN_LENGTH = 12;

export interface SeedPasswords {
  admin: string;
  coordenador: string;
  professor: string;
}

type SeedPasswordVar =
  | 'SEED_ADMIN_PASSWORD'
  | 'SEED_COORDENADOR_PASSWORD'
  | 'SEED_PROFESSOR_PASSWORD';

// Devolve a descrição do problema (só o NOME da variável, nunca o valor),
// ou null se a senha é válida.
function problemOf(name: SeedPasswordVar, value: string | undefined): string | null {
  if (value === undefined || value.trim() === '') return `${name} ausente ou vazia`;
  if (value.length < SEED_PASSWORD_MIN_LENGTH) {
    return `${name} deve ter pelo menos ${SEED_PASSWORD_MIN_LENGTH} caracteres`;
  }
  return null;
}

export function resolveSeedPasswords(env: Record<string, string | undefined>): SeedPasswords {
  const admin = env['SEED_ADMIN_PASSWORD'];
  const coordenador = env['SEED_COORDENADOR_PASSWORD'];
  const professor = env['SEED_PROFESSOR_PASSWORD'];

  const problems = [
    problemOf('SEED_ADMIN_PASSWORD', admin),
    problemOf('SEED_COORDENADOR_PASSWORD', coordenador),
    problemOf('SEED_PROFESSOR_PASSWORD', professor),
  ].filter((p): p is string => p !== null);

  if (
    problems.length > 0 ||
    admin === undefined ||
    coordenador === undefined ||
    professor === undefined
  ) {
    throw new Error(`Seed abortado — senhas invalidas: ${problems.join('; ')}.`);
  }

  return { admin, coordenador, professor };
}
