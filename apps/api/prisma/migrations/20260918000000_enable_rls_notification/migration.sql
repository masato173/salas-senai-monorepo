-- ═══════════════════════════════════════════════════════════════════════════
-- RLS na tabela Notification — paridade com ADR-001
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A migration 20260727192910_add_reservation_created_by_and_notification criou
-- a tabela Notification sem aplicar o padrão da ADR-001 (RLS deny-all + REVOKE
-- de anon/authenticated). Era a única das 7 tabelas do schema public fora do
-- padrão — ou seja, alcançável pela chave anon do Supabase caso ela vazasse,
-- expondo título/corpo das notificações e o userId de cada destinatário.
--
-- Migration puramente aditiva: não altera schema, dados nem migrations
-- anteriores. Mesmo bloco usado em 20260709000000_add_schedule_table.
--
-- Nenhuma linha de código de aplicação muda: o backend conecta como role
-- postgres (rolbypassrls = true, grants intactos) — ver ADR-001.
--
-- Idempotência:
--   - ENABLE ROW LEVEL SECURITY é idempotente por definição no Postgres.
--   - REVOKE de privilégios inexistentes não gera erro.
--   - Bloco IF EXISTS protege contra tabela ausente.
--
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Notification ────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c
             JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = 'Notification') THEN
    EXECUTE 'ALTER TABLE public."Notification" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL PRIVILEGES ON public."Notification" FROM anon';
    EXECUTE 'REVOKE ALL PRIVILEGES ON public."Notification" FROM authenticated';
  END IF;
END $$;
