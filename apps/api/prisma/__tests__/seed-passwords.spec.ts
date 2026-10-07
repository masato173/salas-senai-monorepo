import { describe, it, expect } from 'vitest';
import { resolveSeedPasswords, SEED_PASSWORD_MIN_LENGTH } from '../seed-passwords';

// Valores sentinela fictícios — só servem pra provar que nenhum valor de
// senha aparece em mensagem de erro.
const ADMIN = 'sentinela-admin-AAAA';
const COORD = 'sentinela-coord-BBBB';
const PROF = 'sentinela-prof-CCCC';

const VALID = {
  SEED_ADMIN_PASSWORD: ADMIN,
  SEED_COORDENADOR_PASSWORD: COORD,
  SEED_PROFESSOR_PASSWORD: PROF,
};

function errorOf(fn: () => unknown): Error {
  try {
    fn();
  } catch (e) {
    if (e instanceof Error) return e;
    throw new Error('lançou algo que não é Error');
  }
  throw new Error('esperava que lançasse');
}

describe('resolveSeedPasswords (issue 2)', () => {
  it('exige no mínimo 12 caracteres', () => {
    expect(SEED_PASSWORD_MIN_LENGTH).toBe(12);
  });

  it('com as 3 variáveis válidas, retorna as 3 senhas', () => {
    expect(resolveSeedPasswords(VALID)).toEqual({
      admin: ADMIN,
      coordenador: COORD,
      professor: PROF,
    });
  });

  it.each(['SEED_ADMIN_PASSWORD', 'SEED_COORDENADOR_PASSWORD', 'SEED_PROFESSOR_PASSWORD'])(
    'variável ausente (%s) lança citando o nome',
    name => {
      const env: Record<string, string> = { ...VALID };
      delete env[name];
      expect(errorOf(() => resolveSeedPasswords(env)).message).toContain(name);
    },
  );

  it.each([[''], ['   '], ['\t\n']])('variável vazia ou só espaços (%j) lança', value => {
    const err = errorOf(() => resolveSeedPasswords({ ...VALID, SEED_ADMIN_PASSWORD: value }));
    expect(err.message).toContain('SEED_ADMIN_PASSWORD');
  });

  it('variável com menos de 12 caracteres lança sem ecoar o valor', () => {
    const curta = 'curta-11chr'; // 11 caracteres
    expect(curta).toHaveLength(11);
    const err = errorOf(() => resolveSeedPasswords({ ...VALID, SEED_PROFESSOR_PASSWORD: curta }));
    expect(err.message).toContain('SEED_PROFESSOR_PASSWORD');
    expect(err.message).toContain('12');
    expect(err.message).not.toContain(curta);
  });

  it('a mensagem de erro nunca contém o valor de nenhuma senha', () => {
    const err = errorOf(() =>
      resolveSeedPasswords({ ...VALID, SEED_COORDENADOR_PASSWORD: 'curtinha' }),
    );
    for (const value of [ADMIN, COORD, PROF, 'curtinha']) {
      expect(err.message).not.toContain(value);
    }
  });

  it('várias inválidas ao mesmo tempo: a mensagem cita todas', () => {
    const err = errorOf(() => resolveSeedPasswords({ SEED_ADMIN_PASSWORD: 'x' }));
    expect(err.message).toContain('SEED_ADMIN_PASSWORD');
    expect(err.message).toContain('SEED_COORDENADOR_PASSWORD');
    expect(err.message).toContain('SEED_PROFESSOR_PASSWORD');
  });
});
