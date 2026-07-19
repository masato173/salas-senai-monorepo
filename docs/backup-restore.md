# Backup e restauração — PostgreSQL (Supabase) (F9.5)

**Decisão registrada:** o projeto usa o **backup automático nativo do
Supabase** — sem script de export customizado. Este documento cobre onde
encontrar os backups, como restaurar em emergência e a rotina de teste.

---

## 1. Onde encontrar os backups

1. Painel do Supabase → projeto do Controle de Salas.
2. Menu lateral: **Database → Backups** (em versões antigas do painel:
   **Settings → Database → Backups**).
3. A aba **Scheduled backups** lista os backups automáticos com data/hora.

## 2. Frequência e retenção

- O backup automático do Supabase é **diário**, com retenção de **7 dias**
  no plano com backups inclusos.
- Point-in-Time Recovery (PITR, restauração por minuto) é um add-on pago —
  não contratado; a granularidade de restauração é **o backup diário**.
- **Confirmar no painel** a frequência/retenção exatas do plano atual: a aba
  Backups mostra a lista real. Se a aba indicar que backups não estão
  disponíveis no plano, tratar como pendência de infra **antes** do go-live
  (upgrade de plano) — sem backup não há plano de recuperação.

## 3. Restauração de emergência (passo a passo)

> A restauração **substitui o banco inteiro** pelo estado do backup
> escolhido. Tudo que foi gravado depois daquele ponto é perdido.

1. **Parar as escritas:** pausar o serviço no Railway (Service → Settings →
   **Pause**) para ninguém gravar durante a restauração.
2. Supabase → **Database → Backups** → localizar o backup desejado
   (o mais recente anterior ao incidente).
3. Clicar em **Restore** no backup escolhido e confirmar.
4. Aguardar — o projeto fica **indisponível durante a restauração**
   (minutos, dependendo do tamanho do banco).
5. Validar o estado restaurado direto no banco (bypassa RLS):
   ```powershell
   Set-Location C:\dev\monorepo\apps\api
   '"SELECT COUNT(*) FROM public.""Reservation"";"' | .\node_modules\.bin\prisma db execute --stdin
   ```
6. Conferir se as migrations aplicadas batem com o repo:
   ```powershell
   .\node_modules\.bin\prisma migrate status
   ```
   Se o backup for anterior a uma migration recente, rodar
   `prisma migrate deploy` (com `DIRECT_URL`, porta 5432 — Bug histórico #12).
7. Religar o serviço no Railway e validar `/health` + um login.
8. Registrar o incidente (o que causou, backup usado, dados perdidos).

## 4. Teste periódico de restauração (recomendação)

Backup que nunca foi restaurado é backup que não existe:

- **Trimestralmente**, restaurar um backup num ambiente de **staging**
  (quando existir — um segundo projeto Supabase gratuito serve) e validar:
  contagem de linhas das tabelas principais (`User`, `Room`, `Reservation`,
  `Schedule`), um login e uma listagem de reservas.
- Nunca testar restauração no projeto de produção.
- Anotar a data do último teste aqui:

| Data do teste | Backup usado | Resultado |
| ------------- | ------------ | --------- |
| —             | —            | —         |
