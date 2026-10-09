import { describe, it, expect } from 'vitest';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { UsersController } from '../users.controller';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';

// Issue 6 — contrato de autorização de /users travado em teste.
//
// O RolesGuard usa getAllAndOverride([handler, classe]): o @Roles do handler
// SUBSTITUI o da classe, não acumula. Um @Roles de classe aqui seria código
// morto que parece proteção. Por isso: nenhum @Roles de classe, e todo
// handler declara o seu explicitamente. A contenção do COORDENADOR (não
// promover a ADMIN, não alterar ADMIN nem outro COORDENADOR) vive nos gates
// de UsersService — ver users.service.spec.ts.
//
// Handler novo sem entrada neste mapa FAZ O TESTE FALHAR: a regra de quem
// pode chamá-lo precisa ser decidida e registrada aqui.
const EXPECTED_ROLES: Record<string, Role[]> = {
  listUsers: [Role.COORDENADOR, Role.ADMIN],
  listProfessors: [Role.COORDENADOR, Role.ADMIN],
  updateRole: [Role.COORDENADOR, Role.ADMIN],
  setActive: [Role.COORDENADOR, Role.ADMIN],
};

const reflector = new Reflector();

function handlerNames(): string[] {
  return Object.getOwnPropertyNames(UsersController.prototype).filter(
    name => name !== 'constructor',
  );
}

describe('UsersController — contrato de autorização (issue 6)', () => {
  it('a classe não tem @Roles (seria sobrescrito por todo handler)', () => {
    expect(reflector.get<Role[] | undefined>(ROLES_KEY, UsersController)).toBeUndefined();
  });

  it('todo handler do controller tem expectativa explícita neste teste', () => {
    expect(handlerNames().sort()).toEqual(Object.keys(EXPECTED_ROLES).sort());
  });

  it.each(Object.entries(EXPECTED_ROLES))('%s exige %j', (name, roles) => {
    const handler = (UsersController.prototype as unknown as Record<string, () => unknown>)[name];
    expect(handler).toBeTypeOf('function');
    if (handler === undefined) return;
    expect(reflector.get<Role[] | undefined>(ROLES_KEY, handler)).toEqual(roles);
  });
});
