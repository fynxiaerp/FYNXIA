-- Phase 7 Plan 03: ai_agent_config table — autonomy level L0–L4 per agent per rede (SYS-04 / D-05)
-- Stores ONLY configuration; enforcement of L0–L4 tiers and human-approval gates is Phase 10 (AIG).
-- Pattern: USING + WITH CHECK via get_my_tenant_id() / get_my_role() (existing RLS convention)

-- ============ ai_agent_config table ============

CREATE TABLE public.ai_agent_config (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id      UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id        UUID        REFERENCES public.units(id) ON DELETE CASCADE,  -- NULL = network-level config (D-05)
  agent_key      TEXT        NOT NULL,
  autonomy_level TEXT        NOT NULL DEFAULT 'L0'
                 CHECK (autonomy_level IN ('L0', 'L1', 'L2', 'L3', 'L4')),
  enabled        BOOLEAN     NOT NULL DEFAULT true,
  limits         JSONB       NOT NULL DEFAULT '{}'::jsonb,  -- future per-agent tiers/caps (Phase 10)
  updated_by     UUID        REFERENCES public.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_agent_config_clinic ON public.ai_agent_config(clinic_id);

-- PARTIAL unique indexes (INFO 8 from 07-RESEARCH):
-- PostgreSQL treats NULL values as DISTINCT in standard UNIQUE constraints, so a plain
-- UNIQUE(clinic_id, agent_key, unit_id) would NOT deduplicate network-level rows
-- (unit_id IS NULL) and ON CONFLICT DO NOTHING would never trigger for those rows.
-- Two partial unique indexes correctly enforce deduplication for each scope:

-- Network-level config (unit_id IS NULL): one row per clinic+agent across the whole rede
CREATE UNIQUE INDEX uq_ai_agent_config_network
  ON public.ai_agent_config (clinic_id, agent_key)
  WHERE unit_id IS NULL;

-- Unit-level override (unit_id IS NOT NULL): one row per clinic+agent+unit
CREATE UNIQUE INDEX uq_ai_agent_config_unit
  ON public.ai_agent_config (clinic_id, agent_key, unit_id)
  WHERE unit_id IS NOT NULL;

-- ============ Seed: both known v1 agents at L0 for all existing active clinics ============
-- agent_key values match src/lib/agents/: 'confirmation' (appointment confirmation) and
-- 'collection' (payment collection). Seeded at network level (unit_id NULL) with L0 enabled.
-- ON CONFLICT uses the partial index predicate (WHERE unit_id IS NULL) to match correctly.

INSERT INTO public.ai_agent_config (clinic_id, agent_key, autonomy_level, enabled)
SELECT c.id, k.agent_key, 'L0', true
FROM public.clinics c
CROSS JOIN (VALUES ('confirmation'), ('collection')) AS k(agent_key)
WHERE c.deleted_at IS NULL
ON CONFLICT (clinic_id, agent_key) WHERE unit_id IS NULL DO NOTHING;

-- ============ RLS — ai_agent_config ============

ALTER TABLE public.ai_agent_config ENABLE ROW LEVEL SECURITY;

-- All tenant members can read their rede's agent config (UI displays current autonomy level)
CREATE POLICY "ai_agent_config_tenant_read" ON public.ai_agent_config
  FOR SELECT USING (clinic_id = get_my_tenant_id());

-- Only admin / superadmin may modify agent config (T-07-12: non-admin cannot raise autonomy)
CREATE POLICY "ai_agent_config_admin_write" ON public.ai_agent_config
  FOR ALL
  USING (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin')
  )
  WITH CHECK (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin')
  );
