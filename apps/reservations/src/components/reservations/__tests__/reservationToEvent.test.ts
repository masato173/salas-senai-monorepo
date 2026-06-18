import { describe, it, expect } from 'vitest';
import { reservationToEvent } from '../reservationToEvent';
import type { CreatedReservationRow } from '../../../services/appsScript';

const SAMPLE: CreatedReservationRow = {
  id:         'r-1',
  sala:       '603 Sala',
  data:       '2026-12-10',
  inicio:     '08:00',
  fim:        '10:00',
  professor:  'Fulano',
  turma:      'ADS-A',
  observacao: '',
  status:     'ACTIVE',
  createdBy:  'professor@senai.edu',
  createdAt:  '2026-06-01T12:00:00.000Z',
  updatedAt:  '2026-06-01T12:00:00.000Z',
  groupId:    'r-1',  // Sprint 4 Fase A: única → groupId === id
};

describe('reservationToEvent()', () => {
  it('mapeia uma reserva completa para o shape do EventInput', () => {
    const event = reservationToEvent(SAMPLE);

    expect(event).toEqual({
      id:    'r-1',
      title: '603 Sala · ADS-A',
      start: '2026-12-10T08:00:00',
      end:   '2026-12-10T10:00:00',
      extendedProps: {
        sala:       '603 Sala',
        data:       '2026-12-10',
        inicio:     '08:00',
        fim:        '10:00',
        professor:  'Fulano',
        observacao: '',
        createdBy:  'professor@senai.edu',
        groupId:    'r-1',
      },
    });
  });

  it('title concatena sala e turma com separador " · " (middot)', () => {
    const event = reservationToEvent({ ...SAMPLE, sala: '710 Lab. CLP', turma: 'ELT-3B' });

    expect(event.title).toBe('710 Lab. CLP · ELT-3B');
  });

  it('start segue formato YYYY-MM-DDTHH:MM:00 sem timezone suffix', () => {
    const event = reservationToEvent(SAMPLE);

    expect(event.start).toBe('2026-12-10T08:00:00');
    expect(event.start).not.toMatch(/Z|\+\d{2}:\d{2}/); // sem Z, sem offset explícito
    expect(event.start).not.toMatch(/\.\d{3}/);          // sem milissegundos
  });

  it('end segue formato YYYY-MM-DDTHH:MM:00 sem timezone suffix', () => {
    const event = reservationToEvent({ ...SAMPLE, fim: '23:00' });

    expect(event.end).toBe('2026-12-10T23:00:00');
    expect(event.end).not.toMatch(/Z|\+\d{2}:\d{2}/);
  });

  it('NÃO converte para Date — start e end são strings', () => {
    // Determinístico independente do timezone do browser.
    // FullCalendar parseia respeitando timeZone='America/Manaus' do calendar.
    const event = reservationToEvent(SAMPLE);

    expect(typeof event.start).toBe('string');
    expect(typeof event.end).toBe('string');
    expect(event.start).not.toBeInstanceOf(Date);
    expect(event.end).not.toBeInstanceOf(Date);
  });

  it('anexa extendedProps com os 8 campos consumidos pelo modal (inclui groupId — Fase B)', () => {
    const event = reservationToEvent(SAMPLE);

    expect(event.extendedProps).toBeDefined();
    expect(Object.keys(event.extendedProps!).sort()).toEqual(
      ['createdBy', 'data', 'fim', 'groupId', 'inicio', 'observacao', 'professor', 'sala'].sort(),
    );
  });

  it('extendedProps.groupId === id quando reserva unica (Sprint 4 Fase A)', () => {
    const event = reservationToEvent(SAMPLE);

    expect(event.extendedProps?.groupId).toBe('r-1');
    expect(event.extendedProps?.groupId).toBe(event.id);
  });

  it('extendedProps.groupId compartilhado e distinto do id quando reserva de periodo', () => {
    const event = reservationToEvent({ ...SAMPLE, id: 'r-1', groupId: 'grp-shared-xyz' });

    expect(event.extendedProps?.groupId).toBe('grp-shared-xyz');
    expect(event.extendedProps?.groupId).not.toBe(event.id);
  });

  it("extendedProps.groupId === '' quando linha legacy (sem groupId no row)", () => {
    // Linhas pre-Fase-A nao tem coluna N — backend devolve groupId undefined.
    // Mapper aplica ?? '' pra normalizar pro modal.
    const legacy = { ...SAMPLE, groupId: undefined } as unknown as CreatedReservationRow;
    const event  = reservationToEvent(legacy);

    expect(event.extendedProps?.groupId).toBe('');
  });

  it('preserva createdBy em extendedProps (owner-check antecipado em 4.2b)', () => {
    const event = reservationToEvent({ ...SAMPLE, createdBy: 'outro.prof@senai.edu' });

    expect(event.extendedProps?.createdBy).toBe('outro.prof@senai.edu');
  });

  it('NÃO inclui status, turma, id ou timestamps em extendedProps', () => {
    // Guarda defensiva: se um dia o mapper começar a copiar campos a mais,
    // o modal precisa ser revisitado junto. Esse teste força a revisão.
    const event = reservationToEvent(SAMPLE);
    const props = event.extendedProps ?? {};

    expect(props).not.toHaveProperty('status');
    expect(props).not.toHaveProperty('turma');
    expect(props).not.toHaveProperty('id');
    expect(props).not.toHaveProperty('createdAt');
    expect(props).not.toHaveProperty('updatedAt');
  });
});
