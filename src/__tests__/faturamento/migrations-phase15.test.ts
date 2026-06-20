/**
 * Phase 15 — Faturamento/NFS-e & Convênios/TISS — Migration source-inspection
 * Test type: readFileSync source-inspection (mirrors Phase 14 migrations-phase14.test.ts pattern)
 *
 * All assertions are intentionally RED until Plans 02/03/04 create the 5 migration files.
 * Empty-string fallback (existsSync guard) ensures tests FAIL (not skip) while files are absent.
 *
 * Requirements encoded:
 *   OS-01  — service_orders unique per appointment; appointment_procedures table
 *   OS-02  — nfse_records table + D-27 NFS-e status enum
 *   OS-03  — charges.service_order_id ALTER (link OS ↔ charge)
 *   CONV-01 — insurers + insurer_prices tables
 *   CONV-02 — tiss_lotes + tiss_guides + tiss_guide_items tables
 *   CONV-03 — glosa_motivos seed (ANS Tabela 38 codes)
 *   D-27   — All enum CHECK constraints verbatim
 *   D-30   — idempotency_key UNIQUE index on service_orders
 *   D-25   — next_os_number SECURITY DEFINER function
 *   D-18   — RLS write-by-role: get_my_role() IN ('admin', ...)
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// ─── File paths ──────────────────────────────────────────────────────────────

const MIGRATIONS_DIR = join(process.cwd(), 'supabase/migrations')

// Wave 0: these files do NOT exist yet — existsSync guard yields empty string → RED
const CATALOG_FILE = join(MIGRATIONS_DIR, '20260620000100_faturamento_catalog_tables.sql')
const OS_FILE      = join(MIGRATIONS_DIR, '20260620000200_faturamento_os_tables.sql')
const TISS_FILE    = join(MIGRATIONS_DIR, '20260620000300_faturamento_tiss_tables.sql')
const RLS_FILE     = join(MIGRATIONS_DIR, '20260620000400_faturamento_rls.sql')
const SEED_FILE    = join(MIGRATIONS_DIR, '20260620000500_faturamento_seed.sql')

const catalogSQL = existsSync(CATALOG_FILE) ? readFileSync(CATALOG_FILE, 'utf-8') : ''
const osSQL      = existsSync(OS_FILE)      ? readFileSync(OS_FILE,      'utf-8') : ''
const tissSQL    = existsSync(TISS_FILE)    ? readFileSync(TISS_FILE,    'utf-8') : ''
const rlsSQL     = existsSync(RLS_FILE)     ? readFileSync(RLS_FILE,     'utf-8') : ''
const seedSQL    = existsSync(SEED_FILE)    ? readFileSync(SEED_FILE,    'utf-8') : ''

// ─── Catalog migration (20260620000100) ──────────────────────────────────────

describe('Phase 15 catalog migration (20260620000100) — services', () => {
  it('creates the services table', () => {
    expect(catalogSQL).toMatch(/CREATE TABLE public\.services/)
  })

  it('has clinic_id NOT NULL FK to clinics ON DELETE CASCADE', () => {
    expect(catalogSQL).toMatch(
      /clinic_id\s+UUID\s+NOT NULL REFERENCES public\.clinics\(id\) ON DELETE CASCADE/
    )
  })

  it('has valor_particular NUMERIC(12,2) (CLAUDE.md: money = NUMERIC(12,2))', () => {
    expect(catalogSQL).toMatch(/valor_particular\s+NUMERIC\(12,2\)/)
  })

  it('has tuss_code (D-05: TUSS code optional per service)', () => {
    expect(catalogSQL).toMatch(/tuss_code\s+TEXT/)
  })

  it('has aliquota_iss_override NUMERIC(5,4) (Pitfall 7 — per-service ISS override)', () => {
    expect(catalogSQL).toMatch(/aliquota_iss_override\s+NUMERIC\(5,4\)/)
  })

  it('has idx_services_clinic index', () => {
    expect(catalogSQL).toMatch(/idx_services_clinic/)
  })
})

describe('Phase 15 catalog migration (20260620000100) — insurer_prices (CONV-01)', () => {
  it('creates the insurer_prices table', () => {
    expect(catalogSQL).toMatch(/CREATE TABLE public\.insurer_prices/)
  })

  it('has UNIQUE(insurer_id, service_id) constraint', () => {
    expect(catalogSQL).toMatch(/UNIQUE \(insurer_id, service_id\)/)
  })

  it('has idx_insurer_prices_clinic index', () => {
    expect(catalogSQL).toMatch(/idx_insurer_prices_clinic/)
  })
})

describe('Phase 15 catalog migration (20260620000100) — unit_fiscal_config (D-16)', () => {
  it('creates the unit_fiscal_config table', () => {
    expect(catalogSQL).toMatch(/CREATE TABLE public\.unit_fiscal_config/)
  })

  it('has aliquota_iss_padrao NUMERIC(5,4) NOT NULL DEFAULT 0.05', () => {
    expect(catalogSQL).toMatch(/aliquota_iss_padrao\s+NUMERIC\(5,4\)/)
  })

  it('has regime_emissao CHECK competencia|caixa (D-20)', () => {
    expect(catalogSQL).toMatch(
      /regime_emissao[\s\S]*CHECK \(regime_emissao IN \('competencia', 'caixa'\)\)/
    )
  })
})

describe('Phase 15 catalog migration (20260620000100) — glosa_motivos (D-14)', () => {
  it('creates the glosa_motivos table', () => {
    expect(catalogSQL).toMatch(/CREATE TABLE public\.glosa_motivos/)
  })

  it('has codigo_ans TEXT NOT NULL', () => {
    expect(catalogSQL).toMatch(/codigo_ans\s+TEXT\s+NOT NULL/)
  })

  it('has idx_glosa_motivos_clinic index', () => {
    expect(catalogSQL).toMatch(/idx_glosa_motivos_clinic/)
  })
})

// ─── OS migration (20260620000200) ───────────────────────────────────────────

describe('Phase 15 OS migration (20260620000200) — insurers (CONV-01)', () => {
  it('creates the insurers table', () => {
    expect(osSQL).toMatch(/CREATE TABLE public\.insurers/)
  })

  it('has registro_ans TEXT (ANS insurer registration)', () => {
    expect(osSQL).toMatch(/registro_ans\s+TEXT/)
  })

  it('has idx_insurers_clinic index', () => {
    expect(osSQL).toMatch(/idx_insurers_clinic/)
  })
})

describe('Phase 15 OS migration (20260620000200) — appointment_procedures (OS-01, D-09)', () => {
  it('creates the appointment_procedures table', () => {
    expect(osSQL).toMatch(/CREATE TABLE public\.appointment_procedures/)
  })

  it('has appointment_id FK to appointments', () => {
    expect(osSQL).toMatch(
      /appointment_id\s+UUID\s+NOT NULL REFERENCES public\.appointments\(id\)/
    )
  })

  it('has service_id FK to services', () => {
    expect(osSQL).toMatch(
      /service_id\s+UUID\s+NOT NULL REFERENCES public\.services\(id\)/
    )
  })

  it('has idx_appointment_procedures_appointment index', () => {
    expect(osSQL).toMatch(/idx_appointment_procedures_appointment/)
  })
})

describe('Phase 15 OS migration (20260620000200) — service_orders (OS-01, D-10, D-12, D-25)', () => {
  it('creates the service_orders table', () => {
    expect(osSQL).toMatch(/CREATE TABLE public\.service_orders/)
  })

  it('has D-27 OS status CHECK (rascunho/faturada/cancelada)', () => {
    expect(osSQL).toMatch(
      /CHECK \(status IN \('rascunho', 'faturada', 'cancelada'\)\)/
    )
  })

  it('has D-27 pagador CHECK (particular/convenio)', () => {
    expect(osSQL).toMatch(
      /CHECK \(pagador IN \('particular', 'convenio'\)\)/
    )
  })

  it('has idempotency_key TEXT (D-30)', () => {
    expect(osSQL).toMatch(/idempotency_key\s+TEXT/)
  })

  it('has total NUMERIC(12,2) for OS total (D-25)', () => {
    expect(osSQL).toMatch(/total\s+NUMERIC\(12,2\)/)
  })

  it('has desconto_total and acrescimo_total (D-25 discount/surcharge)', () => {
    expect(osSQL).toMatch(/desconto_total\s+NUMERIC\(12,2\)/)
    expect(osSQL).toMatch(/acrescimo_total\s+NUMERIC\(12,2\)/)
  })

  it('OS-01 uniqueness: UNIQUE INDEX on service_orders(appointment_id) WHERE appointment_id IS NOT NULL', () => {
    expect(osSQL).toMatch(
      /CREATE UNIQUE INDEX[\s\S]*service_orders\(appointment_id\)[\s\S]*WHERE appointment_id IS NOT NULL/
    )
  })

  it('D-30 idempotency: UNIQUE INDEX on service_orders(idempotency_key)', () => {
    expect(osSQL).toMatch(
      /CREATE UNIQUE INDEX[\s\S]*service_orders\(idempotency_key\)/
    )
  })

  it('has idx_service_orders_clinic index', () => {
    expect(osSQL).toMatch(/idx_service_orders_clinic/)
  })
})

describe('Phase 15 OS migration (20260620000200) — service_order_items (D-25, D-29)', () => {
  it('creates the service_order_items table', () => {
    expect(osSQL).toMatch(/CREATE TABLE public\.service_order_items/)
  })

  it('has service_order_id FK to service_orders', () => {
    expect(osSQL).toMatch(
      /service_order_id\s+UUID\s+NOT NULL REFERENCES public\.service_orders\(id\)/
    )
  })

  it('has valor_total NUMERIC(12,2) (item snapshot total — D-25)', () => {
    expect(osSQL).toMatch(/valor_total\s+NUMERIC\(12,2\)\s+NOT NULL/)
  })

  it('has professional_id (D-29: executor profissional para repasse futuro)', () => {
    expect(osSQL).toMatch(/professional_id\s+UUID/)
  })

  it('has idx_service_order_items_clinic index', () => {
    expect(osSQL).toMatch(/idx_service_order_items_clinic/)
  })
})

describe('Phase 15 OS migration (20260620000200) — nfse_records (OS-02)', () => {
  it('creates the nfse_records table', () => {
    expect(osSQL).toMatch(/CREATE TABLE public\.nfse_records/)
  })

  it('has D-27 NFS-e status CHECK (processando/emitida/cancelada/erro)', () => {
    expect(osSQL).toMatch(
      /CHECK \(status IN \('processando', 'emitida', 'cancelada', 'erro'\)\)/
    )
  })

  it('has service_order_id FK to service_orders', () => {
    expect(osSQL).toMatch(
      /service_order_id\s+UUID\s+REFERENCES public\.service_orders\(id\)/
    )
  })

  it('has aliquota_iss NUMERIC(5,4) for ISS rate', () => {
    expect(osSQL).toMatch(/aliquota_iss\s+NUMERIC\(5,4\)\s+NOT NULL/)
  })

  it('has valor_iss NUMERIC(12,2) for ISS amount (integer-cent math)', () => {
    expect(osSQL).toMatch(/valor_iss\s+NUMERIC\(12,2\)\s+NOT NULL/)
  })

  it('has idx_nfse_records_clinic index', () => {
    expect(osSQL).toMatch(/idx_nfse_records_clinic/)
  })
})

describe('Phase 15 OS migration (20260620000200) — charges ALTER (OS-03, Open Question 2)', () => {
  it('ALTERs charges table to add service_order_id', () => {
    expect(osSQL).toMatch(
      /ALTER TABLE public\.charges[\s\S]*service_order_id/
    )
  })
})

describe('Phase 15 OS migration (20260620000200) — next_os_number function (D-25/A1)', () => {
  it('creates next_os_number function', () => {
    expect(osSQL).toMatch(
      /CREATE OR REPLACE FUNCTION[\s\S]*next_os_number/
    )
  })

  it('next_os_number function is SECURITY DEFINER', () => {
    expect(osSQL).toMatch(/SECURITY DEFINER/)
  })
})

describe('Phase 15 OS migration — clinic_id indexes (sample 3 tables)', () => {
  it('idx_services_clinic (catalog file)', () => {
    expect(catalogSQL).toMatch(/CREATE INDEX[\s\S]*services\(clinic_id\)/)
  })

  it('idx_service_orders_clinic (os file)', () => {
    expect(osSQL).toMatch(/CREATE INDEX[\s\S]*service_orders\(clinic_id\)/)
  })

  it('idx_nfse_records_clinic (os file)', () => {
    expect(osSQL).toMatch(/CREATE INDEX[\s\S]*nfse_records\(clinic_id\)/)
  })
})

// ─── TISS migration (20260620000300) ─────────────────────────────────────────

describe('Phase 15 TISS migration (20260620000300) — tiss_lotes (CONV-02)', () => {
  it('creates the tiss_lotes table', () => {
    expect(tissSQL).toMatch(/CREATE TABLE public\.tiss_lotes/)
  })

  it('has D-27 TISS lote status CHECK (em_analise/.../recurso)', () => {
    expect(tissSQL).toMatch(
      /CHECK \(status IN \('em_analise', 'autorizada', 'glosada', 'paga', 'recurso'\)\)/
    )
  })

  it('has protocolo TEXT (returned by provider on send)', () => {
    expect(tissSQL).toMatch(/protocolo\s+TEXT/)
  })

  it('has idx_tiss_lotes_clinic index', () => {
    expect(tissSQL).toMatch(/idx_tiss_lotes_clinic/)
  })
})

describe('Phase 15 TISS migration (20260620000300) — tiss_guides (CONV-02)', () => {
  it('creates the tiss_guides table', () => {
    expect(tissSQL).toMatch(/CREATE TABLE public\.tiss_guides/)
  })

  it('has D-27 TISS guide status CHECK (em_analise/.../recurso)', () => {
    expect(tissSQL).toMatch(
      /CHECK \(status IN \('em_analise', 'autorizada', 'glosada', 'paga', 'recurso'\)\)/
    )
  })

  it('has service_order_id FK to service_orders NOT NULL', () => {
    expect(tissSQL).toMatch(
      /service_order_id\s+UUID\s+NOT NULL REFERENCES public\.service_orders\(id\)/
    )
  })

  it('has valor_glosado NUMERIC(12,2) NOT NULL DEFAULT 0 (D-28)', () => {
    expect(tissSQL).toMatch(/valor_glosado\s+NUMERIC\(12,2\)\s+NOT NULL/)
  })

  it('has idx_tiss_guides_clinic index', () => {
    expect(tissSQL).toMatch(/idx_tiss_guides_clinic/)
  })
})

describe('Phase 15 TISS migration (20260620000300) — tiss_guide_items (D-28, CONV-03)', () => {
  it('creates the tiss_guide_items table', () => {
    expect(tissSQL).toMatch(/CREATE TABLE public\.tiss_guide_items/)
  })

  it('has guide_id FK to tiss_guides', () => {
    expect(tissSQL).toMatch(
      /guide_id\s+UUID\s+NOT NULL REFERENCES public\.tiss_guides\(id\)/
    )
  })

  it('has motivo_glosa_id FK to glosa_motivos (D-14)', () => {
    expect(tissSQL).toMatch(
      /motivo_glosa_id\s+UUID\s+REFERENCES public\.glosa_motivos\(id\)/
    )
  })

  it('has valor_glosado NUMERIC(12,2) per item (D-28 glosa per item)', () => {
    expect(tissSQL).toMatch(/valor_glosado\s+NUMERIC\(12,2\)\s+NOT NULL/)
  })

  it('has glosa_status TEXT CHECK (pendente/glosada/em_recurso/paga)', () => {
    expect(tissSQL).toMatch(
      /glosa_status\s+TEXT[\s\S]*CHECK \(glosa_status IN \('pendente', 'glosada', 'em_recurso', 'paga'\)\)/
    )
  })

  it('has idx_tiss_guide_items_clinic index', () => {
    expect(tissSQL).toMatch(/idx_tiss_guide_items_clinic/)
  })
})

// ─── RLS migration (20260620000400) ──────────────────────────────────────────

describe('Phase 15 RLS migration (20260620000400) — service_orders', () => {
  it('enables RLS on service_orders', () => {
    expect(rlsSQL).toMatch(
      /ALTER TABLE public\.service_orders ENABLE ROW LEVEL SECURITY/
    )
  })

  it('has tenant read policy using clinic_id = get_my_tenant_id()', () => {
    expect(rlsSQL).toMatch(
      /clinic_id = get_my_tenant_id\(\)/
    )
  })

  it('has admin write policy with WITH CHECK (T-14-02 pattern)', () => {
    expect(rlsSQL).toMatch(/WITH CHECK/)
  })

  it('D-18: write policy restricts to admin role using get_my_role()', () => {
    expect(rlsSQL).toMatch(
      /get_my_role\(\) IN \([^)]*'admin'/
    )
  })
})

// ─── Seed migration (20260620000500) ─────────────────────────────────────────

describe('Phase 15 seed migration (20260620000500) — glosa_motivos ANS seed (CONV-03)', () => {
  it('inserts into glosa_motivos', () => {
    expect(seedSQL).toMatch(/INSERT INTO public\.glosa_motivos/)
  })

  it('seeds ANS code 1001 (Número da carteira inválido)', () => {
    expect(seedSQL).toMatch(/1001/)
  })

  it('seeds ANS code 9901 (Outros — defined per operadora)', () => {
    expect(seedSQL).toMatch(/9901/)
  })
})

describe('Phase 15 seed migration (20260620000500) — services seed (D-07)', () => {
  it('seeds standard dental services or creates seed function/trigger', () => {
    expect(seedSQL).toMatch(/seed_services|seed_faturamento/)
  })
})
