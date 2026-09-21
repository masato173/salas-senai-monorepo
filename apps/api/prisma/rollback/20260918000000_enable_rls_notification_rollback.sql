-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK — RLS na tabela Notification
-- ═══════════════════════════════════════════════════════════════════════════
--
-- USO APENAS EMERGENCIAL. NÃO faz parte do fluxo normal de migrations.
--
-- Reverte a migration 20260918000000_enable_rls_notification:
--   1. Desabilita RLS na tabela Notification
--   2. Restaura os grants originais de anon e authenticated
--
-- Estado alvo (pós-rollback): idêntico ao pré-migration.
--
-- Como aplicar:
--   Cole este SQL no SQL Editor do Supabase e rode em bloco único.
--
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── Notification ────────────────────────────────────────────────────────
ALTER TABLE public."Notification" DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public."Notification" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public."Notification" TO authenticated;

COMMIT;
