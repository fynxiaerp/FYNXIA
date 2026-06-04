-- Phase 1: invitations, patient_consents, audit trigger, future partitions

-- ============ invitations (D-04, D-05) ============
CREATE TABLE public.invitations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  invited_by  UUID        NOT NULL REFERENCES public.users(id),
  email       TEXT        NOT NULL,
  role        TEXT        NOT NULL CHECK (role IN ('admin','dentist','receptionist','patient','superadmin')),
  token       UUID        NOT NULL DEFAULT gen_random_uuid(),
  status      TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','accepted','expired','revoked')),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT now() + interval '24 hours',
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_invitations_tenant_id ON public.invitations(tenant_id);
CREATE INDEX idx_invitations_email ON public.invitations(email);
CREATE UNIQUE INDEX idx_invitations_one_pending
  ON public.invitations(tenant_id, email) WHERE status = 'pending';
CREATE INDEX idx_invitations_expires_at ON public.invitations(expires_at) WHERE status = 'pending';

-- ============ patient_consents (SEC-05, D-09) ============
CREATE TABLE public.patient_consents (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id     UUID        NOT NULL,  -- FK to patients(id) added in Phase 2
  consent_type   TEXT        NOT NULL CHECK (consent_type IN (
                               'data_processing','marketing_whatsapp',
                               'medical_record_sharing','ai_processing')),
  policy_version TEXT        NOT NULL,
  ip_address     INET,
  user_agent     TEXT,
  consented_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_patient_consents_tenant_id ON public.patient_consents(tenant_id);
CREATE INDEX idx_patient_consents_patient_id ON public.patient_consents(patient_id);

-- ============ hybrid audit trigger (SEC-02, D-13, D-14) ============
CREATE OR REPLACE FUNCTION public.audit_table_changes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    tenant_id, actor_id, action, table_name, record_id, old_values, new_values, created_at
  ) VALUES (
    COALESCE(
      CASE TG_OP WHEN 'DELETE' THEN OLD.tenant_id ELSE NEW.tenant_id END,
      (SELECT get_my_tenant_id())
    ),
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    CASE TG_OP WHEN 'DELETE' THEN OLD.id ELSE NEW.id END,
    CASE TG_OP WHEN 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE TG_OP WHEN 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    now()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;
-- NOTE: public.clinics has no tenant_id column; its id IS the tenant id.
-- For the clinics trigger, use a dedicated function variant referencing NEW.id.
CREATE OR REPLACE FUNCTION public.audit_clinics_changes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    tenant_id, actor_id, action, table_name, record_id, old_values, new_values, created_at
  ) VALUES (
    CASE TG_OP WHEN 'DELETE' THEN OLD.id ELSE NEW.id END,
    auth.uid(),
    TG_OP, TG_TABLE_NAME,
    CASE TG_OP WHEN 'DELETE' THEN OLD.id ELSE NEW.id END,
    CASE TG_OP WHEN 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE TG_OP WHEN 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    now()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER audit_clinics
  AFTER INSERT OR UPDATE OR DELETE ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION public.audit_clinics_changes();
CREATE TRIGGER audit_users
  AFTER INSERT OR UPDATE OR DELETE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();

-- ============ future audit_logs partitions (Pitfall 7) ============
CREATE TABLE public.audit_logs_2026_07 PARTITION OF public.audit_logs
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE public.audit_logs_2026_08 PARTITION OF public.audit_logs
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
