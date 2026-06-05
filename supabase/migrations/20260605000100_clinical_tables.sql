-- Phase 2: clinical tables (patients, appointments, medical_records, dental_records, anamneses)
-- + btree_gist anti-double-booking + audit triggers + patient_consents FK + 2026_09 partition

-- ============ btree_gist (Pitfall 1 — required for EXCLUDE on UUID/text) ============
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============ patients (CLINIC-03, SEC-04, D-05/06/07/08) ============
CREATE TABLE public.patients (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  registered_by   UUID        REFERENCES public.users(id),
  full_name       TEXT        NOT NULL,
  cpf             TEXT        NOT NULL,          -- plaintext (D-06) para busca na recepção
  date_of_birth   DATE,
  phone           TEXT,
  email           TEXT,
  address         TEXT,
  medical_history TEXT,                           -- AES-256-GCM (D-07) aplicado na Server Action
  allergies       TEXT,                           -- AES-256-GCM (D-07)
  medications     TEXT,                           -- AES-256-GCM (D-07)
  deleted_at      TIMESTAMPTZ,                    -- D-08 soft delete
  is_anonymized   BOOLEAN     NOT NULL DEFAULT false,  -- D-08
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_patients_cpf_tenant
  ON public.patients(tenant_id, cpf) WHERE deleted_at IS NULL;
CREATE INDEX idx_patients_tenant_id ON public.patients(tenant_id);
CREATE INDEX idx_patients_name ON public.patients(tenant_id, full_name);

-- ============ appointments (CLINIC-02, D-02/03/04) ============
CREATE TABLE public.appointments (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  dentist_id   UUID        NOT NULL REFERENCES public.users(id),
  patient_id   UUID        REFERENCES public.patients(id),
  start_time   TIMESTAMPTZ NOT NULL,
  end_time     TIMESTAMPTZ NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'agendado'
               CHECK (status IN ('agendado','confirmado','em_atendimento','concluido','cancelado')),
  notes        TEXT,
  source       TEXT        NOT NULL DEFAULT 'interno'
               CHECK (source IN ('interno','publico')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- D-02: bloqueio atômico de double-booking por dentista; cancelados não bloqueiam
  CONSTRAINT no_overlap EXCLUDE USING GIST (
    tenant_id  WITH =,
    dentist_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
  ) WHERE (status NOT IN ('cancelado'))
);
CREATE INDEX idx_appointments_tenant_id ON public.appointments(tenant_id);
CREATE INDEX idx_appointments_dentist_time
  ON public.appointments(tenant_id, dentist_id, start_time);
CREATE INDEX idx_appointments_patient_id ON public.appointments(patient_id);

-- ============ medical_records (CLINIC-05, CLINIC-07, D-09/10) ============
CREATE TABLE public.medical_records (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id     UUID        NOT NULL REFERENCES public.patients(id),
  appointment_id UUID        REFERENCES public.appointments(id),
  dentist_id     UUID        NOT NULL REFERENCES public.users(id),
  diagnosis      TEXT,
  treatment_plan TEXT,
  prescription   TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_medical_records_tenant_id ON public.medical_records(tenant_id);
CREATE INDEX idx_medical_records_patient   ON public.medical_records(patient_id, created_at DESC);
CREATE INDEX idx_medical_records_dentist   ON public.medical_records(dentist_id);

-- ============ dental_records (CLINIC-06, D-12/13/14) — odontograma FDI ============
CREATE TABLE public.dental_records (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id     UUID        NOT NULL REFERENCES public.patients(id),
  appointment_id UUID        REFERENCES public.appointments(id),
  dentist_id     UUID        NOT NULL REFERENCES public.users(id),
  tooth_number   SMALLINT    NOT NULL CHECK (
    tooth_number BETWEEN 11 AND 18 OR
    tooth_number BETWEEN 21 AND 28 OR
    tooth_number BETWEEN 31 AND 38 OR
    tooth_number BETWEEN 41 AND 48
  ),
  status         TEXT        NOT NULL CHECK (status IN (
    'higido','cariado','extraido','em_tratamento',
    'implante','coroa','selante','fraturado','restaurado'
  )),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dental_records_tenant_id ON public.dental_records(tenant_id);
CREATE INDEX idx_dental_records_patient   ON public.dental_records(patient_id, tooth_number);

-- ============ anamneses (CLINIC-08, D-16/17/18/19/20) ============
CREATE TABLE public.anamneses (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id       UUID        NOT NULL REFERENCES public.patients(id),
  responses        JSONB       NOT NULL DEFAULT '{}',   -- respostas CFO fixas (D-18)
  signature_hash   TEXT        NOT NULL,                -- SHA-256 do PNG (D-16)
  signature_url    TEXT,                                -- path opcional no Storage
  signed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address       INET,
  user_agent       TEXT,
  flow             TEXT        NOT NULL DEFAULT 'presencial'
                   CHECK (flow IN ('presencial','link_publico')),
  token            UUID        UNIQUE,                  -- link público (D-17)
  token_expires_at TIMESTAMPTZ,
  token_used_at    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_anamneses_tenant_id  ON public.anamneses(tenant_id);
CREATE INDEX idx_anamneses_patient_id ON public.anamneses(patient_id);
CREATE INDEX idx_anamneses_token      ON public.anamneses(token) WHERE token IS NOT NULL;

-- ============ patient_consents FK (deferred from Phase 1) ============
ALTER TABLE public.patient_consents
  ADD CONSTRAINT patient_consents_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;

-- ============ audit triggers (SEC-03) — reuse existing audit_table_changes() ============
-- audit_table_changes() already exists (Phase 1) and uses NEW.tenant_id / OLD.tenant_id.
CREATE TRIGGER audit_patients
  AFTER INSERT OR UPDATE OR DELETE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();
CREATE TRIGGER audit_appointments
  AFTER INSERT OR UPDATE OR DELETE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();
CREATE TRIGGER audit_medical_records
  AFTER INSERT OR UPDATE OR DELETE ON public.medical_records
  FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();
