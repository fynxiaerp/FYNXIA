-- Phase 10 Plan 02: approval_requests — unified approval queue (AIG-02, AUD-02)
-- Serves both AI-action approval (type='ai_action') and estorno by alçada (type='estorno').
-- Idempotency: uq_approval_requests_idempotency prevents double-execution (T-10-08, Pitfall 2).
-- RLS: USING + WITH CHECK on all write policies (T-10-07 Tampering mitigation).
-- Alçada enforcement for UPDATE is in the Server Action (required_role is per-row, not static).

CREATE TABLE public.approval_requests (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id         UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  type              TEXT        NOT NULL CHECK (type IN ('ai_action', 'estorno')),
  payload           JSONB       NOT NULL DEFAULT '{}'::jsonb,
  agent_key         TEXT,                                   -- for type='ai_action'
  required_role     TEXT        NOT NULL DEFAULT 'admin',   -- alçada (min role to approve)
  requested_by      UUID        NOT NULL REFERENCES public.users(id),
  approver          UUID        REFERENCES public.users(id),
  status            TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected','expired')),
  decided_at        TIMESTAMPTZ,
  reason            TEXT,                                   -- motivo (estorno) / approver note
  idempotency_key   TEXT,
  executed_at       TIMESTAMPTZ,                            -- set after payload execution
  expires_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_approval_requests_clinic ON public.approval_requests(clinic_id);
CREATE INDEX idx_approval_requests_status ON public.approval_requests(clinic_id, status);

-- Partial unique index: prevents double-execution for requests with an idempotency_key (T-10-08)
CREATE UNIQUE INDEX uq_approval_requests_idempotency
  ON public.approval_requests(clinic_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

-- Tenant members read their clinic's approval requests
CREATE POLICY "approval_requests_tenant_read" ON public.approval_requests
  FOR SELECT USING (clinic_id = get_my_tenant_id());

-- Any tenant member can submit a request (INSERT); tenant scoping enforced via WITH CHECK
CREATE POLICY "approval_requests_tenant_insert" ON public.approval_requests
  FOR INSERT WITH CHECK (clinic_id = get_my_tenant_id());

-- Approve/reject UPDATE: tenant-scoped; alçada is additionally enforced in the Server Action
-- (required_role check is dynamic per-row and cannot live in a static policy).
CREATE POLICY "approval_requests_tenant_update" ON public.approval_requests
  FOR UPDATE
  USING (clinic_id = get_my_tenant_id())
  WITH CHECK (clinic_id = get_my_tenant_id());
