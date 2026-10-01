import { describe, it, expect, vi } from 'vitest';
import { RealtimeGateway, COORDINATORS_ROOM } from '../realtime.gateway';

function makeGateway(verify: (token: string) => unknown) {
  const jwtService = { verify: vi.fn(verify) };
  return new RealtimeGateway(jwtService as never);
}

function makeSocket(token?: string) {
  return {
    handshake: { auth: token !== undefined ? { token } : {} },
    join: vi.fn(),
    disconnect: vi.fn(),
    data: undefined as unknown,
  };
}

function joinedRooms(socket: ReturnType<typeof makeSocket>): string[] {
  return (socket.join.mock.calls as [string][]).map(([room]) => room);
}

function jwtFor(role: string) {
  return () => ({ sub: `${role.toLowerCase()}-1`, email: 'x@senai.edu', role });
}

describe('RealtimeGateway.handleConnection — rooms (Issue 5, A4)', () => {
  it('PROFESSOR entra só na room do próprio userId', () => {
    const socket = makeSocket('tok');
    makeGateway(jwtFor('PROFESSOR')).handleConnection(socket as never);

    expect(joinedRooms(socket)).toEqual(['professor-1']);
    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it.each(['COORDENADOR', 'ADMIN'])('%s entra na própria room e na de coordenadores', role => {
    const socket = makeSocket('tok');
    makeGateway(jwtFor(role)).handleConnection(socket as never);

    expect(joinedRooms(socket)).toEqual([`${role.toLowerCase()}-1`, COORDINATORS_ROOM]);
  });

  it('sem token desconecta e não entra em room nenhuma', () => {
    const socket = makeSocket();
    makeGateway(jwtFor('ADMIN')).handleConnection(socket as never);

    expect(socket.disconnect).toHaveBeenCalled();
    expect(socket.join).not.toHaveBeenCalled();
  });

  it('token inválido desconecta e não entra em room nenhuma', () => {
    const socket = makeSocket('lixo');
    makeGateway(() => {
      throw new Error('invalid signature');
    }).handleConnection(socket as never);

    expect(socket.disconnect).toHaveBeenCalled();
    expect(socket.join).not.toHaveBeenCalled();
  });
});
