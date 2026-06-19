import { describe, it, expect } from 'vitest';
import { buildUpdatePayload, type FormFieldsForUpdate } from '../buildUpdatePayload';

const FORM: FormFieldsForUpdate = {
  date:   '2030-04-10',
  start:  '08:00',
  end:    '09:00',
  reason: 'aula',
};

describe('buildUpdatePayload()', () => {
  describe('edit-single (C1)', () => {
    it('monta payload com TODOS os 7 campos (incluindo data)', () => {
      const result = buildUpdatePayload({
        mode: 'edit-single',
        form: FORM,
        initialValues: { id: 'r-1' },
        salaName: '604 Sala',
        turma:    'ADS-A',
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.mode).toBe('edit-single');
      expect(result.payload).toEqual({
        id:         'r-1',
        sala:       '604 Sala',
        data:       '2030-04-10',
        inicio:     '08:00',
        fim:        '09:00',
        turma:      'ADS-A',
        observacao: 'aula',
      });
    });

    it('retorna error quando initialValues.id ausente', () => {
      const result = buildUpdatePayload({
        mode: 'edit-single',
        form: FORM,
        initialValues: {},
        salaName: '604 Sala',
        turma:    'ADS-A',
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toMatch(/id/i);
    });
  });

  describe('edit-group (C2)', () => {
    it('monta payload com 6 campos (groupId, sala, inicio, fim, turma, observacao)', () => {
      const result = buildUpdatePayload({
        mode: 'edit-group',
        form: FORM,
        initialValues: { groupId: 'grp-xyz' },
        salaName: '604 Sala',
        turma:    'ADS-A',
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.mode).toBe('edit-group');
      expect(result.payload).toEqual({
        groupId:    'grp-xyz',
        sala:       '604 Sala',
        inicio:     '08:00',
        fim:        '09:00',
        turma:      'ADS-A',
        observacao: 'aula',
      });
    });

    it('payload de grupo NÃO contém o campo `data` (defesa crítica vs C2)', () => {
      // Cada linha do grupo mantém a sua data própria — payload do C2 SEM data.
      const result = buildUpdatePayload({
        mode: 'edit-group',
        form: FORM,
        initialValues: { groupId: 'grp-xyz' },
        salaName: '604 Sala',
        turma:    'ADS-A',
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.payload).not.toHaveProperty('data');
    });

    it('retorna error quando initialValues.groupId ausente', () => {
      const result = buildUpdatePayload({
        mode: 'edit-group',
        form: FORM,
        initialValues: {},
        salaName: '604 Sala',
        turma:    'ADS-A',
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toMatch(/groupId/i);
    });
  });

  it('repassa observacao vazia sem mexer', () => {
    const result = buildUpdatePayload({
      mode: 'edit-single',
      form: { ...FORM, reason: '' },
      initialValues: { id: 'r-1' },
      salaName: '604 Sala',
      turma:    'ADS-A',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.observacao).toBe('');
  });

  it('repassa salaName e turma sem transformacao (backend trim)', () => {
    const result = buildUpdatePayload({
      mode: 'edit-single',
      form: FORM,
      initialValues: { id: 'r-1' },
      salaName: '  604 Sala  ',
      turma:    '  ADS-A  ',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Backend (validateUpdatePayload / updateReservation) faz o trim final.
    // Frontend repassa raw — evita lossy round-trip.
    expect(result.payload.sala).toBe('  604 Sala  ');
    expect(result.payload.turma).toBe('  ADS-A  ');
  });
});
