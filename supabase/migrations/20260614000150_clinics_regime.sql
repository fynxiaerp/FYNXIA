-- =============================================================================
-- Migration: 20260614000150_clinics_regime.sql
-- Phase: 07-sistema-multiunidade-pap-is / Plan 02
-- Purpose: Add `regime_tributario` column to `clinics` (the rede/tenant table).
--          Lands in Wave 1 (NOT Wave 3) so Plan 05's empresa form (SYS-01) can
--          persist the regime without any additional db push gate.
-- SYS-01: Empresa form persists CNPJ + regime_tributario on the rede.
-- T-07-23: CHECK constraint restricts to the 4 valid Brazilian tax regimes;
--          prevents invalid regime values from being stored (Zod enum in Plan 05
--          is the second layer of defence).
-- Nullable: existing redes have no regime yet; the empresa form sets it on first save.
-- Values from 07-CONTEXT.md §D-01 / Claude's Discretion:
--   simples_nacional, lucro_presumido, lucro_real, mei
-- =============================================================================

ALTER TABLE public.clinics
  ADD COLUMN regime_tributario TEXT
  CHECK (regime_tributario IN ('simples_nacional', 'lucro_presumido', 'lucro_real', 'mei'));
