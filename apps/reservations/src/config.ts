// Configuração central do app.

// Salas disponíveis para reserva (nome real = o que o backend grava na planilha)
export const SALAS = [
  '01 Sala',
  '02 Lab. Elétrica',
  '03 Sala',
  '04 Lab. Eletrônica',
  '05 Sala',
  '06 Sala',
  '33 Lab. SMT',
  '35 Lab',
  '36 Lab',
  '37 Lab',
  '600/602 Sala',
  '601 Sala',
  '603 Sala',
  '605 Sala',
  '606/604 Sala',
  '607 Sala',
  '608 Sala',
  '609 Sala',
  '610 Lab. Inf.',
  '611 Lab. Inf.',
  '701 Sala',
  '702 Sala',
  '703 Sala',
  '706 Sala',
  '707 Sala',
  '708 Lab. CLP',
  '709 Lab. TBO',
  '710 Lab. CLP',
  '711 Lab. Elétrica',
  '713 Lab. Eletrônica ',
  '500 Lab. Inf.',
  '503 Lab. Inf.',
  '505 Lab. Inf.',
  '507 Lab. Inf.',
] as const;

// Usuário fixo por enquanto (Fase 2 trará login real)
export const CURRENT_USER = {
  userId: 'prof-001',
  userEmail: 'professor@senai.edu',
  professor: 'Professor SENAI',
};
