import { PrismaClient, RoomType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { resolveSeedPasswords } from './seed-passwords';

// F9.2 — o seed cria usuários com senhas de teste (SEED_*_PASSWORD, issue 2).
// Rodar contra o banco de produção seria uma falha de segurança grave: qualquer
// pessoa com acesso a este repositório saberia as credenciais. Abortar sempre.
if (process.env['NODE_ENV'] === 'production') {
  throw new Error(
    'Seed bloqueado: NODE_ENV=production. O seed cria usuários com senhas de ' +
      'teste conhecidas e nunca deve rodar contra o banco de produção.',
  );
}

// Issue 2 — senhas só por env, validadas ANTES de qualquer acesso ao banco
// (o PrismaClient é criado logo abaixo). Ausente/curta: aborta sem ecoar valor.
const seedPasswords = resolveSeedPasswords(process.env);

const directUrl = process.env['DIRECT_URL'];
if (!directUrl) throw new Error('DIRECT_URL nao configurada');
const prisma = new PrismaClient({
  datasources: { db: { url: directUrl } },
});

// 34 salas confirmadas em apps/reservations/src/config.ts
// Nome exato = o que o backend grava na planilha (preservar trailing spaces)
const SALAS: Array<{ name: string; type: RoomType }> = [
  { name: '01 Sala', type: 'SALA_COMUM' },
  { name: '02 Lab. Elétrica', type: 'LAB_ELETRICA' },
  { name: '03 Sala', type: 'SALA_COMUM' },
  { name: '04 Lab. Eletrônica', type: 'LAB_ELETRONICA' },
  { name: '05 Sala', type: 'SALA_COMUM' },
  { name: '06 Sala', type: 'SALA_COMUM' },
  { name: '33 Lab. SMT', type: 'LAB_SMT' },
  { name: '35 Lab', type: 'LAB_GERAL' },
  { name: '36 Lab', type: 'LAB_GERAL' },
  { name: '37 Lab', type: 'LAB_GERAL' },
  { name: '600/602 Sala', type: 'SALA_COMUM' },
  { name: '601 Sala', type: 'SALA_COMUM' },
  { name: '603 Sala', type: 'SALA_COMUM' },
  { name: '605 Sala', type: 'SALA_COMUM' },
  { name: '606/604 Sala', type: 'SALA_COMUM' },
  { name: '607 Sala', type: 'SALA_COMUM' },
  { name: '608 Sala', type: 'SALA_COMUM' },
  { name: '609 Sala', type: 'SALA_COMUM' },
  { name: '610 Lab. Inf.', type: 'LAB_INFORMATICA' },
  { name: '611 Lab. Inf.', type: 'LAB_INFORMATICA' },
  { name: '701 Sala', type: 'SALA_COMUM' },
  { name: '702 Sala', type: 'SALA_COMUM' },
  { name: '703 Sala', type: 'SALA_COMUM' },
  { name: '706 Sala', type: 'SALA_COMUM' },
  { name: '707 Sala', type: 'SALA_COMUM' },
  { name: '708 Lab. CLP', type: 'LAB_CLP' },
  { name: '709 Lab. TBO', type: 'LAB_GERAL' },
  { name: '710 Lab. CLP', type: 'LAB_CLP' },
  { name: '711 Lab. Elétrica', type: 'LAB_ELETRICA' },
  { name: '713 Lab. Eletrônica ', type: 'LAB_ELETRONICA' }, // espaço preservado
  { name: '500 Lab. Inf.', type: 'LAB_INFORMATICA' },
  { name: '503 Lab. Inf.', type: 'LAB_INFORMATICA' },
  { name: '505 Lab. Inf.', type: 'LAB_INFORMATICA' },
  { name: '507 Lab. Inf.', type: 'LAB_INFORMATICA' },
];

async function main(): Promise<void> {
  console.log('Seeding rooms...');

  for (const sala of SALAS) {
    await prisma.room.upsert({
      where: { name: sala.name },
      update: { type: sala.type },
      create: { name: sala.name, type: sala.type },
    });
  }

  const count = await prisma.room.count();
  console.log(`Done. ${count} rooms in database.`);

  // Usuário admin para desenvolvimento — trocar senha em produção
  console.log('Seeding admin user...');
  const passwordHash = await bcrypt.hash(seedPasswords.admin, 12);
  await prisma.user.upsert({
    where: { email: 'admin@senai.edu' },
    update: {},
    create: { name: 'Admin SENAI', email: 'admin@senai.edu', passwordHash, role: 'ADMIN' },
  });
  console.log('Admin: admin@senai.edu (senha vinda de SEED_ADMIN_PASSWORD)');

  // Professor para testes
  console.log('Seeding professor user...');
  const professorHash = await bcrypt.hash(seedPasswords.professor, 12);
  await prisma.user.upsert({
    where: { email: 'professor@senai.edu' },
    update: {},
    create: {
      name: 'Professor SENAI',
      email: 'professor@senai.edu',
      passwordHash: professorHash,
      role: 'PROFESSOR',
    },
  });
  console.log('Professor: professor@senai.edu (senha vinda de SEED_PROFESSOR_PASSWORD)');

  // Coordenador para testes
  console.log('Seeding coordenador user...');
  const coordenadorHash = await bcrypt.hash(seedPasswords.coordenador, 12);
  await prisma.user.upsert({
    where: { email: 'coordenador@senai.edu' },
    update: {},
    create: {
      name: 'Coordenador SENAI',
      email: 'coordenador@senai.edu',
      passwordHash: coordenadorHash,
      role: 'COORDENADOR',
    },
  });
  console.log('Coordenador: coordenador@senai.edu (senha vinda de SEED_COORDENADOR_PASSWORD)');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
