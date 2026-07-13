-- =============================================================================
-- Migration: 20260712000100_crc_tables.sql
-- Phase: 18-crc-marketing / Plan 02
-- Purpose: Create the 6 CRC & Marketing tables:
--   lead_sources      (CRC-01, D-03) — catálogo gerenciável de origens de lead
--   campaigns         (CRC-02/03, D-05/D-06) — campanhas de reativação
--   leads             (CRC-01, D-01/D-04) — funil de leads (kanban)
--   nps_responses     (CRC-04, D-12/D-13) — coleta de NPS via token público
--   referrals         (CRC-05, D-16/D-18) — vínculo indicador → indicado
--   referral_rewards  (CRC-05, D-17/D-19) — ledger de recompensas por indicação
--
-- Requirements: CRC-01, CRC-02, CRC-03, CRC-04, CRC-05
-- Dependencies:
--   public.clinics(id)
--   public.units(id)             — 20260614000100_units_table.sql
--   public.patients(id)          — 20260605000100_clinical_tables.sql
--   public.appointments(id)      — 20260605000100_clinical_tables.sql
--
-- Conventions (CLAUDE.md):
--   - clinic_id NOT NULL FK ON DELETE CASCADE, indexed on every table
--   - deleted_at TIMESTAMPTZ soft delete where PII is involved (leads carry name/phone)
--   - NUMERIC(12,2) for money columns
--   - NO RLS here — all Phase 18 RLS is in 20260712000300_crc_rls.sql
--
-- CRITICAL (Pitfall 5 / Phase 17 42P17 trap): NO timezone-cast expression
-- index anywhere in this migration. NPS dedup uses UNIQUE(appointment_id) — a plain
-- column, safe for supabase-js .onConflict('appointment_id').
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. lead_sources — catálogo gerenciável de origens (D-03)
-- ---------------------------------------------------------------------------
-- Lista fixa gerenciável: seed inicial de 7 origens (trigger abaixo) + admin pode
-- adicionar novas. Base da agregação de conversão/ROI por origem — NÃO campo livre.
CREATE TABLE public.lead_sources (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id  UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  is_default BOOLEAN     NOT NULL DEFAULT true,   -- seeded rows; admin-added rows = false
  ativo      BOOLEAN     NOT NULL DEFAULT true,   -- soft-delete-in-use guard (desativar em vez de excluir)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_sources_clinic ON public.lead_sources(clinic_id);
-- lower(name) é IMMUTABLE — permitido em índice único (ao contrário de timezone casts)
CREATE UNIQUE INDEX idx_lead_sources_name ON public.lead_sources(clinic_id, lower(name));

COMMENT ON TABLE public.lead_sources IS 'Catálogo gerenciável de origens de lead (D-03). Seed inicial via trigger seed_lead_sources_on_clinic.';

-- ---------------------------------------------------------------------------
-- 2. campaigns — campanhas de reativação (CRC-03)
-- ---------------------------------------------------------------------------
-- D-07: segmentação "inativo há X dias" + filtros opcionais (filters JSONB).
-- D-09/D-10: IA L2 monta preview_message; disparo manual exige aprovação (approval_request_id).
-- status: rascunho → aguardando_aprovacao → aprovada → enviada, ou rejeitada/cancelada.
CREATE TABLE public.campaigns (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id            UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id              UUID        NOT NULL REFERENCES public.units(id),
  name                 TEXT        NOT NULL,
  inactive_days        INT         NOT NULL,
  filters              JSONB       NOT NULL DEFAULT '{}',
  channel_whatsapp     BOOLEAN     NOT NULL DEFAULT false,
  channel_email        BOOLEAN     NOT NULL DEFAULT false,
  preview_message      TEXT,
  recipient_count      INT,
  status               TEXT        NOT NULL DEFAULT 'rascunho'
                       CHECK (status IN ('rascunho', 'aguardando_aprovacao', 'aprovada', 'enviada', 'rejeitada', 'cancelada')),
  approval_request_id  UUID,
  deleted_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaigns_clinic_status ON public.campaigns(clinic_id, status);

COMMENT ON TABLE  public.campaigns                   IS 'Campanhas de reativação segmentada (D-07/D-08). Disparo manual gated por approval_requests (D-09).';
COMMENT ON COLUMN public.campaigns.filters            IS 'Filtros opcionais do segmento (D-07): último procedimento, faixa etária, unidade — não é query builder livre.';
COMMENT ON COLUMN public.campaigns.approval_request_id IS 'FK lógica (sem constraint) para approval_requests.id — type=''ai_action'', agent_key=''crc-campaign'' (Pitfall 1 RESEARCH).';

-- ---------------------------------------------------------------------------
-- 3. leads — funil de leads (CRC-01, D-01/D-04)
-- ---------------------------------------------------------------------------
-- D-01: Novo → Contatado → Agendado → Convertido / Perdido.
-- D-04: conversão cria/vincula um patient (patient_id). Lead e paciente são entidades distintas.
-- D-16: referred_by_patient_id amarra origem 'Indicação' ao programa de indicação.
CREATE TABLE public.leads (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id              UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id                UUID        NOT NULL REFERENCES public.units(id),
  source_id              UUID        NOT NULL REFERENCES public.lead_sources(id) ON DELETE RESTRICT,
  full_name              TEXT        NOT NULL,
  phone                  TEXT,
  email                  TEXT,
  stage                  TEXT        NOT NULL DEFAULT 'novo'
                         CHECK (stage IN ('novo', 'contatado', 'agendado', 'convertido', 'perdido')),
  lost_reason            TEXT,
  patient_id             UUID        REFERENCES public.patients(id) ON DELETE SET NULL,
  referred_by_patient_id UUID        REFERENCES public.patients(id) ON DELETE SET NULL,
  campaign_id            UUID        REFERENCES public.campaigns(id) ON DELETE SET NULL,
  notes                  TEXT,
  stage_changed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at             TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_leads_clinic          ON public.leads(clinic_id);
CREATE INDEX idx_leads_clinic_stage    ON public.leads(clinic_id, stage);
CREATE INDEX idx_leads_clinic_source   ON public.leads(clinic_id, source_id);
CREATE INDEX idx_leads_campaign        ON public.leads(campaign_id) WHERE campaign_id IS NOT NULL;

COMMENT ON TABLE  public.leads                    IS 'Funil de leads (D-01). Kanban drag-and-drop entre estágios; conversão vincula patient_id (D-04).';
COMMENT ON COLUMN public.leads.patient_id          IS 'Preenchido na conversão do lead (stage=convertido) — D-04.';
COMMENT ON COLUMN public.leads.referred_by_patient_id IS 'Paciente que indicou este lead (D-16) — recepção vincula ao cadastrar.';
COMMENT ON COLUMN public.leads.stage_changed_at    IS 'Timestamp da última mudança de estágio — drives "X dias no estágio" na UI.';

-- ---------------------------------------------------------------------------
-- 4. nps_responses — coleta de NPS pós-consulta (CRC-04, D-12/D-13)
-- ---------------------------------------------------------------------------
-- D-12: cron noturno varre atendimentos concluídos e cria 1 row por appointment.
-- D-13: token single-use (padrão anamnese Fase 2) — rota pública sem sessão.
-- Pitfall 5: UNIQUE(appointment_id) é coluna simples — sem expressão de data no índice.
CREATE TABLE public.nps_responses (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id             UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id               UUID        REFERENCES public.units(id),   -- nullable: resolvido a partir do appointment
  appointment_id        UUID        NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  patient_id            UUID        NOT NULL REFERENCES public.patients(id),
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  token_expires_at      TIMESTAMPTZ NOT NULL,
  token_used_at         TIMESTAMPTZ,
  score                 INT         CHECK (score BETWEEN 0 AND 10),
  comment                TEXT,
  detractor_treated_at  TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (appointment_id),   -- Pitfall 5: dedup por atendimento, coluna simples (não expressão de data)
  UNIQUE (token)
);

CREATE INDEX idx_nps_responses_clinic ON public.nps_responses(clinic_id);
CREATE INDEX idx_nps_responses_token  ON public.nps_responses(token);

COMMENT ON TABLE  public.nps_responses               IS 'Coleta de NPS via link público com token single-use (D-13). 1 row por appointment concluído (Pitfall 5).';
COMMENT ON COLUMN public.nps_responses.token          IS 'Token single-use UUID (122-bit), gerado no cron de convite (D-12). Padrão anamnese Fase 2.';
COMMENT ON COLUMN public.nps_responses.detractor_treated_at IS 'Marcado pela recepção/gestor ao tratar o resgate de um detrator (score 0-6) — D-15.';

-- ---------------------------------------------------------------------------
-- 5. referrals — vínculo indicador → indicado (CRC-05, D-16/D-18)
-- ---------------------------------------------------------------------------
-- 1 row por (referrer, referred) — lead_id UNIQUE: um lead é indicado por exatamente 1 paciente.
CREATE TABLE public.referrals (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id            UUID          NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  referrer_patient_id  UUID          NOT NULL REFERENCES public.patients(id),
  lead_id              UUID          NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  reward_amount        NUMERIC(12,2),   -- preenchido na conversão do indicado (D-18); NULL = ainda não convertido
  credited_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (lead_id)
);

CREATE INDEX idx_referrals_clinic   ON public.referrals(clinic_id);
CREATE INDEX idx_referrals_referrer ON public.referrals(referrer_patient_id);

COMMENT ON TABLE  public.referrals               IS 'Programa de indicação (D-16). Registrado ao cadastrar o lead; recompensa creditada na conversão (D-18).';
COMMENT ON COLUMN public.referrals.reward_amount IS 'Valor de crédito/desconto (D-17), preenchido apenas quando lead_id.stage = convertido.';

-- ---------------------------------------------------------------------------
-- 6. referral_rewards — ledger de recompensas (CRC-05, D-17/D-19)
-- ---------------------------------------------------------------------------
-- v1: apenas type='credito' é criado (D-19 é read-only/informacional). type='uso' reservado
-- para futura UI de resgate (Fase 20 Portal) — CHECK mantido aberto para forward-compat.
CREATE TABLE public.referral_rewards (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id    UUID          NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id   UUID          NOT NULL REFERENCES public.patients(id),
  referral_id  UUID          NOT NULL REFERENCES public.referrals(id) ON DELETE CASCADE,
  amount       NUMERIC(12,2) NOT NULL,
  type         TEXT          NOT NULL DEFAULT 'credito' CHECK (type IN ('credito', 'uso')),
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_referral_rewards_clinic_patient ON public.referral_rewards(clinic_id, patient_id);

COMMENT ON TABLE  public.referral_rewards      IS 'Ledger de recompensas por indicação (D-17). v1 cria apenas linhas type=credito; type=uso é forward-compat (Fase 20).';

-- ---------------------------------------------------------------------------
-- 7. seed_lead_sources_on_clinic() — seed automático de 7 origens padrão (D-03)
-- ---------------------------------------------------------------------------
-- Mirrors seed_financial_categories() (20260606000300_financial_categories_seed.sql).
CREATE OR REPLACE FUNCTION public.seed_lead_sources_on_clinic()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.lead_sources (clinic_id, name, is_default)
  VALUES
    (NEW.id, 'Indicação', true),
    (NEW.id, 'Google',    true),
    (NEW.id, 'Instagram', true),
    (NEW.id, 'Facebook',  true),
    (NEW.id, 'Walk-in',   true),
    (NEW.id, 'WhatsApp',  true),
    (NEW.id, 'Outro',     true);
  RETURN NEW;
END;
$$;

CREATE TRIGGER seed_lead_sources_on_clinic
  AFTER INSERT ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION public.seed_lead_sources_on_clinic();

-- ---------------------------------------------------------------------------
-- 8. Backfill: seed default lead_sources for existing clinics
-- ---------------------------------------------------------------------------
INSERT INTO public.lead_sources (clinic_id, name, is_default)
SELECT c.id, s.name, true
FROM public.clinics c
CROSS JOIN (
  VALUES ('Indicação'), ('Google'), ('Instagram'), ('Facebook'), ('Walk-in'), ('WhatsApp'), ('Outro')
) AS s(name)
ON CONFLICT DO NOTHING;
