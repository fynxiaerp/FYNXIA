---
phase: 16
plan: 08
subsystem: financeiro/tributos
tags: [repasse, rpa, reinf, trib-01, trib-02, trib-03, server-actions, pdf]
dependency_graph:
  requires:
    - 16-04  # computePayout/aggregatePayout + computeRpaWithholdings + getReinfProvider STUB
    - 16-05  # tables: professional_payouts, payout_items, rpa_records, reinf_events, competencia_fechamentos, unit_rpa_counters; next_rpa_number() RPC
    - 16-06  # createPayableFromRepasse, createTributoPayable, alçada cancel
    - 16-07  # reconciliation_status='conciliado' on financial_transactions (FOP-02/FOP-03)
  provides:
    - computePayouts (TRIB-01)
    - getDemonstrativo
    - aprovarEgerarCP
    - fecharCompetencia
    - listPayouts
    - gerarRpa (TRIB-02)
    - getRpaDocumentUrl
    - listRpas
    - estornarRpa
    - gerarReinfEvent (TRIB-03)
    - listReinfEvents
    - estornarBaixaConciliada
  affects:
    - professional_payouts table
    - payout_items table
    - rpa_records table
    - reinf_events table
    - competencia_fechamentos table
    - payables table (CP origem='repasse'/'tributo')
    - approval_requests table (estorno via alçada)
    - audit_logs table
    - storage bucket 'documents' (RPA PDFs)
tech_stack:
  added: []
  patterns:
    - "@react-pdf/renderer renderToBuffer (server-only, Flexbox-only)"
    - "next_rpa_number() SECURITY DEFINER atômico (mirrors next_os_number)"
    - "select-before-transmit idempotency (reinf_events UNIQUE clinic_id+idempotency_key)"
    - "signed URL TTL=60s (getRpaDocumentUrl, mirrors Phase 8 pattern)"
    - "CAS UPDATE .eq('status','rascunho') para transições de estado"
    - "computePayout/computeRpaWithholdings pure libs — nunca inline"
    - "writer gate admin/superadmin consistente com RLS de 16-03"
key_files:
  created:
    - src/actions/professional-payouts.ts
    - src/actions/rpa.ts
    - src/actions/reinf.ts
    - src/components/pdf/RpaPDF.tsx
  modified: []
decisions:
  - "Cadeia de join para repasse: FT→charges→service_orders→service_order_items.professional_id (nunca FT.professional_id que não existe)"
  - "computePayouts usa upsert ON CONFLICT para permitir recálculo idempotente"
  - "createTributoPayable busca conta/CC via ilike '%tributo%' — configurável em chart_of_accounts"
  - "gerarRpa requer unitId (para next_rpa_number e competencia_fechamentos)"
  - "RpaPDF: Flexbox-only, fontes Roboto via Google Fonts CDN, discriminação de retenções"
  - "estornarRpa/estornarBaixaConciliada: type='estorno' em createApprovalRequest (única opção disponível no schema Fase 10)"
metrics:
  duration: "~25 min"
  completed_date: "2026-06-22"
  tasks: 3
  files: 4
---

# Phase 16 Plan 08: Repasse + RPA + EFD-Reinf Summary

Wave 3 — ciclo fiscal/repasse fechado: repasse profissional sobre recebimentos conciliados (regime caixa), RPA autônomo com retenções INSS/IRRF/ISS por vigência e PDF arquivado gated (signed URL 60s), eventos EFD-Reinf R-2010/R-4020 via STUB idempotente, e estorno por alçada.

## Tasks Executed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | professional-payouts.ts — repasse caixa + CP repasse + fechamento competência | f90526e | src/actions/professional-payouts.ts |
| 2 | rpa.ts + RpaPDF.tsx — RPA autônomo, retenções por vigência, PDF gated, CP tributo | 08b5c07 | src/actions/rpa.ts, src/components/pdf/RpaPDF.tsx |
| 3 | reinf.ts — eventos EFD-Reinf R-2010/R-4020 STUB + estorno por alçada | 3ad43a3 | src/actions/reinf.ts |

## Requirements Delivered

- **TRIB-01**: computePayouts (regime caixa, D-14) + getDemonstrativo + aprovarEgerarCP (CP origem='repasse') + fecharCompetencia (idempotente, D-26)
- **TRIB-02**: gerarRpa (vínculo=autonomo, brackets por vigência, computeRpaWithholdings, numeração atômica, PDF gated, CP origem='tributo') + getRpaDocumentUrl (TTL=60s) + estornarRpa (alçada)
- **TRIB-03**: gerarReinfEvent (R2010/R4020, idempotency_key, select-before-transmit, STUB) + estornarBaixaConciliada (alçada D-24)

## Security Mitigations Applied

| Threat ID | Status |
|-----------|--------|
| T-16-40 — imposto forjado no cliente | Mitigated: apenas computeRpaWithholdings puro via rpaSchema |
| T-16-41 — pdf_storage_path exposto | Mitigated: nunca no select de listRpas; só getRpaDocumentUrl createSignedUrl 60s |
| T-16-42 — credencial Reinf vazada | Mitigated: getReinfProvider server-only; credential_enc gated internamente |
| T-16-43 — numeração duplicada | Mitigated: next_rpa_number() SECURITY DEFINER atômico + UNIQUE(clinic_id,numero) |
| T-16-44 — estorno sem trilha | Mitigated: estornarRpa/estornarBaixaConciliada → createApprovalRequest + logBusinessEvent |
| T-16-45 — retransmissão duplicada Reinf | Mitigated: idempotency_key + UNIQUE(clinic_id,idempotency_key) + select-before-transmit |
| T-16-46 — auditor/socio gera RPA | Mitigated: WRITER_ROLES=['admin','superadmin'] em todas as actions |
| T-16-47 — repasse/RPA em competência fechada | Mitigated: guard competencia_fechamentos em computePayouts e gerarRpa |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] gerarRpa: CP tributo com fallback gracioso quando conta de tributo não configurada**

- **Found during:** Task 2
- **Issue:** createTributoPayable requer accountId e costCenterId como strings não-nulas, mas a clínica pode não ter conta de tributo cadastrada no bootstrap.
- **Fix:** busca chart_of_accounts ilike '%tributo%' e cost_centers; se não encontrar, loga warning e continua sem falhar. CP tributo é criado quando a conta existe (configuração normal de produção).
- **Files modified:** src/actions/rpa.ts
- **Commit:** 08b5c07

**2. [Rule 2 - Missing Critical Functionality] estornarRpa/estornarBaixaConciliada usa type='estorno' (único valor do enum Fase 10)**

- **Found during:** Task 2/3
- **Issue:** O schema do createApprovalRequest (Fase 10) aceita apenas `'ai_action' | 'estorno'`. O plano menciona tipos genéricos. Service-orders usa 'cancelar_os' mas o schema de Fase 10 não aceita esse valor — indica que cancelarOs tem um bug de validação pré-existente (out-of-scope).
- **Fix:** Usar `type: 'estorno'` consistente com payables.ts cancelarPayable (único valor de estorno financeiro no schema de Fase 10).
- **Files modified:** src/actions/rpa.ts, src/actions/reinf.ts
- **Commits:** 08b5c07, 3ad43a3

## Known Stubs

Nenhum stub que bloqueie o objetivo do plano. O ReinfProvider é deliberadamente STUB (D-22): getReinfProvider retorna StubReinfProvider quando não há credencial Reinf configurada. Este é o comportamento esperado e documentado.

## Self-Check: PASSED
