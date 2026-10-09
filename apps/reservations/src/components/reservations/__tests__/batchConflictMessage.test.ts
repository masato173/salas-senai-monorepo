import { describe, it, expect } from 'vitest';
import { batchConflictMessage } from '../batchConflictMessage';

describe('batchConflictMessage (#22)', () => {
  it('409 do backend sem details → mostra a mensagem do backend (não "Conflito em 0 data(s)")', () => {
    const msg = batchConflictMessage({
      code: 'CONFLICT',
      message: 'Conflito de horário em 1 data(s): 10/07/2026. Nenhuma alteração foi salva.',
    });
    expect(msg).toBe('Conflito de horário em 1 data(s): 10/07/2026. Nenhuma alteração foi salva.');
    expect(msg).not.toContain('0 data(s)');
  });

  it('sem details e sem mensagem → texto padrão em PT-BR', () => {
    expect(batchConflictMessage({ code: 'CONFLICT', message: '' })).toBe(
      'Conflito de horário. Nenhuma alteração foi salva.',
    );
  });

  it('com details.conflicts → lista as datas (DD/MM), comportamento anterior preservado', () => {
    expect(
      batchConflictMessage({
        code: 'CONFLICT',
        message: 'x',
        details: { conflicts: ['2026-07-10', '2026-07-17'] },
      }),
    ).toBe('Conflito em 2 data(s): 10/07, 17/07');
  });

  it('mais de 10 datas → mostra 10 e resume o resto', () => {
    const conflicts = Array.from(
      { length: 12 },
      (_, i) => `2026-07-${String(i + 1).padStart(2, '0')}`,
    );
    expect(
      batchConflictMessage({ code: 'CONFLICT', message: 'x', details: { conflicts } }),
    ).toMatch(/^Conflito em 12 data\(s\): .* \(\+2 mais\)$/);
  });
});
