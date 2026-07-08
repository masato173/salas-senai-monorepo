-- ═══════════════════════════════════════════════════════════════════════════
-- RLS Defense in Depth — F4.2b
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Objetivo:
--   Ativar Row Level Security em TODAS as tabelas do schema public e
--   revogar privilégios dos papéis públicos do Supabase (anon,
--   authenticated), como camada adicional de proteção contra acesso
--   direto ao banco.
--
-- Arquitetura:
--   NestJS permanece como único ponto de autenticação e autorização.
--   RLS aqui é "belt and suspenders" (defense in depth), não substituto.
--   Ver docs/adr/ADR-001-rls-defense-in-depth.md.
--
-- Escopo:
--   Todo o schema public: User, Room, Reservation, AuditLog,
--   RefreshToken, _prisma_migrations.
--
-- Segurança do fluxo Prisma:
--   O backend conecta como role postgres (rolbypassrls = true e grants
--   intactos). migrate deploy/dev/resolve e seed continuam funcionando.
--
-- Idempotência:
--   - ENABLE ROW LEVEL SECURITY é idempotente por definição no Postgres.
--   - REVOKE de privilégios inexistentes não gera erro.
--   - Blocos IF EXISTS protegem contra tabelas ausentes.
--
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── User ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c
             JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = 'User') THEN
    EXECUTE 'ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL PRIVILEGES ON public."User" FROM anon';
    EXECUTE 'REVOKE ALL PRIVILEGES ON public."User" FROM authenticated';
  END IF;
END $$;

-- ─── Room ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c
             JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = 'Room') THEN
    EXECUTE 'ALTER TABLE public."Room" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL PRIVILEGES ON public."Room" FROM anon';
    EXECUTE 'REVOKE ALL PRIVILEGES ON public."Room" FROM authenticated';
  END IF;
END $$;

-- ─── Reservation ─────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c
             JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = 'Reservation') THEN
    EXECUTE 'ALTER TABLE public."Reservation" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL PRIVILEGES ON public."Reservation" FROM anon';
    EXECUTE 'REVOKE ALL PRIVILEGES ON public."Reservation" FROM authenticated';
  END IF;
END $$;

-- ─── AuditLog ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c
             JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = 'AuditLog') THEN
    EXECUTE 'ALTER TABLE public."AuditLog" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL PRIVILEGES ON public."AuditLog" FROM anon';
    EXECUTE 'REVOKE ALL PRIVILEGES ON public."AuditLog" FROM authenticated';
  END IF;
END $$;

-- ─── RefreshToken ────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c
             JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = 'RefreshToken') THEN
    EXECUTE 'ALTER TABLE public."RefreshToken" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL PRIVILEGES ON public."RefreshToken" FROM anon';
    EXECUTE 'REVOKE ALL PRIVILEGES ON public."RefreshToken" FROM authenticated';
  END IF;
END $$;

-- ─── _prisma_migrations ──────────────────────────────────────────────────
-- Infra do ORM, mas segue a mesma política: todo o schema public protegido.
-- O Prisma conecta como postgres (bypassa RLS, grants intactos) — migrate
-- deploy/dev/resolve e seed não são afetados.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c
             JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = '_prisma_migrations') THEN
    EXECUTE 'ALTER TABLE public."_prisma_migrations" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL PRIVILEGES ON public."_prisma_migrations" FROM anon';
    EXECUTE 'REVOKE ALL PRIVILEGES ON public."_prisma_migrations" FROM authenticated';
  END IF;
END $$;
