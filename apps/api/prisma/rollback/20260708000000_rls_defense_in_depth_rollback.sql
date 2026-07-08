-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK — RLS Defense in Depth (F4.2b)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- USO APENAS EMERGENCIAL. NÃO faz parte do fluxo normal de migrations.
--
-- Reverte a migration 20260708000000_rls_defense_in_depth:
--   1. Desabilita RLS em todas as tabelas do schema public
--   2. Restaura os grants originais de anon e authenticated
--
-- Estado alvo (pós-rollback): idêntico ao pré-migration.
--
-- Como aplicar:
--   Cole este SQL no SQL Editor do Supabase e rode em bloco único.
--
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── User ────────────────────────────────────────────────────────────────
ALTER TABLE public."User" DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public."User" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public."User" TO authenticated;

-- ─── Room ────────────────────────────────────────────────────────────────
ALTER TABLE public."Room" DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public."Room" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public."Room" TO authenticated;

-- ─── Reservation ─────────────────────────────────────────────────────────
ALTER TABLE public."Reservation" DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public."Reservation" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public."Reservation" TO authenticated;

-- ─── AuditLog ────────────────────────────────────────────────────────────
ALTER TABLE public."AuditLog" DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public."AuditLog" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public."AuditLog" TO authenticated;

-- ─── RefreshToken ────────────────────────────────────────────────────────
ALTER TABLE public."RefreshToken" DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public."RefreshToken" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public."RefreshToken" TO authenticated;

-- ─── _prisma_migrations ──────────────────────────────────────────────────
ALTER TABLE public."_prisma_migrations" DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public."_prisma_migrations" TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public."_prisma_migrations" TO authenticated;

COMMIT;
