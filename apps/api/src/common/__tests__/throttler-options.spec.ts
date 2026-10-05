import { describe, it, expect, afterEach, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { ExecutionContext } from '@nestjs/common';
import { throttlerOptionsFactory } from '../throttler-options';

function configWith(throttleSkip: string | undefined): ConfigService {
  return {
    get: vi.fn((key: string) => (key === 'THROTTLE_SKIP' ? throttleSkip : undefined)),
  } as unknown as ConfigService;
}

const ctx = {} as ExecutionContext;

describe('throttlerOptionsFactory (issue 7)', () => {
  afterEach(() => {
    delete process.env['THROTTLE_SKIP'];
  });

  it('mantém o limite global de 100 req/min', () => {
    const options = throttlerOptionsFactory(configWith(undefined));
    expect(options).toMatchObject({ throttlers: [{ name: 'default', ttl: 60_000, limit: 100 }] });
  });

  it("skipIf é true quando o ConfigService diz 'true'", () => {
    const options = throttlerOptionsFactory(configWith('true'));
    expect(options.skipIf?.(ctx)).toBe(true);
  });

  it.each([['false'], [undefined]])('skipIf é false quando o ConfigService diz %s', value => {
    const options = throttlerOptionsFactory(configWith(value));
    expect(options.skipIf?.(ctx)).toBe(false);
  });

  it('ignora process.env cru — decide só pelo ConfigService validado', () => {
    process.env['THROTTLE_SKIP'] = 'true';
    const options = throttlerOptionsFactory(configWith('false'));
    expect(options.skipIf?.(ctx)).toBe(false);
  });
});
