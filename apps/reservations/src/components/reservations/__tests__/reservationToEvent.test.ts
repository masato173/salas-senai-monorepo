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
};

describe('reservationToEvent()', () => {
  it('mapeia uma reserva completa para o shape do EventInput', () => {
    const event = reservationToEvent(SAMPLE);

    expect(event).toEqual({
      id:    'r-1',
      title: '603 Sala · ADS-A',
      start: '2026-12-10T08:00:00',
      end:   '2026-12-10T10:00:00',
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
});
