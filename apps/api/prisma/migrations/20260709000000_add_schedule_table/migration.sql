-- ═══════════════════════════════════════════════════════════════════════════
-- F5.7 — Tabela Schedule para sincronização de aulas do Apps Script
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Sem FK para Room (sala é string-name do Apps Script — pode ter variações).
-- RLS aplicado (paridade com ADR-001 — todo schema public protegido).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE "Schedule" (
    "id"    TEXT NOT NULL,
    "date"  TEXT NOT NULL,
    "sala"  TEXT NOT NULL,
    "turma" TEXT NOT NULL,
    "mes"   TEXT NOT NULL,
    "turno" TEXT,
    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Schedule_date_idx"      ON "Schedule"("date");
CREATE INDEX "Schedule_sala_date_idx" ON "Schedule"("sala", "date");

-- RLS (paridade com ADR-001)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c
             JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = 'Schedule') THEN
    EXECUTE 'ALTER TABLE public."Schedule" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL PRIVILEGES ON public."Schedule" FROM anon';
    EXECUTE 'REVOKE ALL PRIVILEGES ON public."Schedule" FROM authenticated';
  END IF;
END $$;
