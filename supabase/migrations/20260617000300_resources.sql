-- Phase 11 Plan 03: resources table (RES-01)
-- Physical resources (rooms, chairs, equipment) per clinic + unit.
-- status enum: ativo | manutencao | inativo (RES-02: manutencao blocks booking).
-- tipo enum: sala | cadeira | equipamento.
-- deleted_at: LGPD soft-delete.
-- Indexes: clinic_id + unit_id (CLAUDE.md: index every FK used in RLS/WHERE).

CREATE TABLE public.resources (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id             UUID        NOT NULL REFERENCES public.units(id),
  nome                TEXT        NOT NULL,
  tipo                TEXT        NOT NULL
                      CHECK (tipo IN ('sala', 'cadeira', 'equipamento')),
  patrimonio          TEXT,                          -- RES-01: asset tag
  numero_serie        TEXT,                          -- RES-01: serial number
  status              TEXT        NOT NULL DEFAULT 'ativo'
                      CHECK (status IN ('ativo', 'manutencao', 'inativo')),
  manutencao_prevista DATE,                          -- scheduled maintenance date
  deleted_at          TIMESTAMPTZ,                   -- LGPD soft delete
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Mandatory indexes on every FK used in RLS clauses (CLAUDE.md anti-pattern guard)
CREATE INDEX idx_resources_clinic_id ON public.resources(clinic_id);
CREATE INDEX idx_resources_unit_id   ON public.resources(unit_id);
