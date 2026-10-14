-- Papeis do Supabase exigidos pelas migrations de RLS (ADR-001).
-- No Postgres proprio eles nao fazem login nem tem permissao nenhuma;
-- existem so para os REVOKE das migrations funcionarem.
-- Mesmo bloco do passo "Create Supabase roles" do job e2e do CI.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END
$$;