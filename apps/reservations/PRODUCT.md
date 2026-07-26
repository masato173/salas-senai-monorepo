# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Todas as três roles do RBAC são audiências primárias — confirmado explicitamente (não há uma persona única priorizada sobre as outras). Todas são staff/corpo técnico-administrativo do SENAI Manaus; não existe superfície voltada a aluno neste app.

- **PROFESSOR** — maior frequência de uso. Reserva salas no dia a dia (reserva única ou por período/range), vê a própria agenda ("Minha Agenda"), consulta disponibilidade. Reservas que cria nascem `PENDING` (precisam de aprovação).
- **COORDENADOR** — aprova/rejeita reservas pendentes de professores, pode reservar em nome de um professor específico (proxy — o dono registrado é o professor, não quem criou), mesma capacidade de reserva do PROFESSOR. Reservas que cria nascem já `APPROVED`.
- **ADMIN** — hierarquia mais alta (RBAC: ADMIN > COORDENADOR > PROFESSOR, herda tudo do nível abaixo). Gestão institucional: usuários (role/status ativo), salas, auditoria, disparo manual do sync de aulas.

## Product Purpose

Sistema institucional de reserva e gestão de salas do SENAI Manaus. Permite ao staff ver disponibilidade de sala em tempo real (aulas sincronizadas da planilha institucional + reservas ad-hoc), criar reservas com detecção de conflito automática, e permite a coordenadores/admins gerenciar aprovações, usuários e salas. Sucesso = nenhuma sala é reservada em duplicidade silenciosamente, e o processo legado manual (Google Sheets) fica inteiramente substituído como backend de reserva.

## Positioning

Substitui um processo manual via Google Sheets — sem trava confiável de conflito, sem auditoria, sem aprovação por papel — por um sistema que garante detecção de conflito em tempo real no nível do banco (lock + transação, autoritativo no servidor, nunca só no frontend), aprovação automática por role (COORDENADOR/ADMIN aprovam na hora; PROFESSOR passa por aprovação), e log de auditoria persistente de toda ação. Confirmado explicitamente como o motivo central de existir do produto.

## Operating Context

- O sync de aulas (Google Apps Script → planilha institucional) ainda alimenta os dados de aula — professores editam a planilha diretamente pra atribuição de turma/horário de aula; este app é autoridade só sobre _reservas_, não sobre aulas.
- Atualização em tempo real via WebSocket — mudança de status de reserva reflete sem reload pra outros usuários olhando o mesmo dia/sala.
- Instituição opera em horário de Manaus (UTC-4) — tratamento de data é um ponto historicamente sensível do projeto (bugs documentados de UTC vs. hora local).
- Turnos (Matutino/Vespertino/Noturno) são um conceito estrutural herdado da planilha legada, ainda usado como filtro.

## Capabilities and Constraints

- RBAC hierárquico: PROFESSOR < COORDENADOR < ADMIN — role mais alta sempre passa em qualquer gate de role mais baixa.
- Detecção de conflito é sempre autoritativa no servidor (lock + transação); o frontend pode mostrar conflito como UX otimista, nunca como única proteção.
- Aprovação de reserva: automática quando criada por COORDENADOR/ADMIN; `PENDING` (precisa aprovação) quando criada por PROFESSOR.
- Reserva por proxy: COORDENADOR/ADMIN pode criar reserva em nome de um PROFESSOR específico — o professor fica registrado como dono, não quem criou.
- Cancelamento é idempotente (soft-delete, state-based) — repetir cancelamento numa reserva já cancelada não é erro.
- Em aberto / não decidido: não existe hoje papel ou superfície voltada a aluno; não há confirmação se está nos planos.

## Brand Commitments

Identidade institucional: SENAI Manaus, sistema "Controle de Salas SENAI". Nenhum manual de marca formal ou exigência externa vinculante foi confirmado — a implementação visual atual do repositório é a autoridade de trabalho até segunda ordem (a paleta/tipografia específicas ficam documentadas em DESIGN.md via `/impeccable document`, não aqui).

## Evidence on Hand

Sistema em produção real, em uso ativo por staff do SENAI Manaus (não é protótipo). Não há métricas de adoção, depoimento de usuário, ou pesquisa de usuário registrada no repositório — nenhum dado desse tipo deve ser inventado em trabalho futuro.

## Product Principles

- Nunca permitir sala reservada em duplicidade — detecção de conflito é inegociável e sempre autoritativa no servidor.
- Toda ação de reserva é auditável — quem fez o quê, quando, aprovado por quem.
- Fricção de aprovação escala com a autoridade da role — coordenador/admin andam rápido (auto-aprovação), professor passa por uma checagem leve.
- O processo manual legado nunca deve voltar — este sistema é fonte única de verdade pra reservas, sem sync bidirecional com planilha.
- As três roles são usuárias de primeira classe, não uma primária e duas secundárias — confirmado explicitamente.

## Accessibility & Inclusion

Perguntado explicitamente: nenhuma exigência formal de acessibilidade (ex: WCAG) confirmada como vinculante além da prática já implementada.
