import { describe, it, expect } from 'vitest';
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  UpdateReservationSelectedDto,
  UPDATE_SELECTED_MAX_IDS,
} from '../dtos/update-reservation-selected.dto';

// #22 — o lote roda numa única transação (lock por (sala, data) de todos os
// itens). Teto igual ao do createRange (60) para limitar a duração da tx.
async function idsErrors(count: number): Promise<string[]> {
  const ids = Array.from({ length: count }, (_, i) => `res-${i}`);
  const dto = plainToInstance(UpdateReservationSelectedDto, { ids, fim: '11:00' });
  const errors = await validate(dto);
  return errors.filter(e => e.property === 'ids').flatMap(e => Object.keys(e.constraints ?? {}));
}

describe('UpdateReservationSelectedDto.ids — teto do lote (#22)', () => {
  it('teto é 60', () => {
    expect(UPDATE_SELECTED_MAX_IDS).toBe(60);
  });

  it('60 ids → válido', async () => {
    expect(await idsErrors(60)).toEqual([]);
  });

  it('61 ids → arrayMaxSize', async () => {
    expect(await idsErrors(61)).toContain('arrayMaxSize');
  });

  it('vazio continua inválido (arrayMinSize)', async () => {
    expect(await idsErrors(0)).toContain('arrayMinSize');
  });
});
