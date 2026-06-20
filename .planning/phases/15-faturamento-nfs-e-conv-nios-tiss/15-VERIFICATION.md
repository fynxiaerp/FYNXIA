---
phase: 15-faturamento-nfs-e-conv-nios-tiss
verified: 2026-06-20T14:40:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification: false
human_verification:
  - test: "OS screen end-to-end: mark appointment 'concluido' in the UI, navigate to /clinica/financeiro/faturamento/os, confirm the new OS rascunho appears with the patient name (first+last-initial) and correct total"
    expected: "One OS rascunho appears linked to the concluded appointment; row is actionable (Faturar button visible)"
    why_human: "Auto-OS trigger runs inside the appointments Server Action on status change — cannot invoke without a running Next.js server and a live Supabase session"
  - test: "Faturar OS particular: open OsSheet for a rascunho OS, select PIX + 1 parcela, click Faturar, confirm AlertDialog, observe status changes to 'faturada'; check NFS-e tab shows 'processando' then 'emitida' (stub resolves synchronously)"
    expected: "OS status = faturada; NFS-e screen shows one emitida entry; Asaas createCharge is called in stub mode"
    why_human: "Requires browser interaction with AlertDialog, RHF form submission, and a live DB session; stub path is synchronous but cannot be exercised without the running app"
  - test: "Convênio path: create a convênio OS, Faturar it, navigate to /clinica/financeiro/faturamento/convenios, confirm a guia appears with status 'em_analise'"
    expected: "criarGuiaForOs creates the guide; convênios screen shows the guide; no Asaas charge appears in particular receivables"
    why_human: "End-to-end flow with two tables (service_orders + tiss_guides) and role-gated views"
  - test: "Fechar lote: on the Convênios screen, click 'Fechar lote' for an operadora, confirm AlertDialog, verify the returned protocolo appears in the guide"
    expected: "StubTissProvider.sendLote returns a PROTO-* protocolo; tiss_lotes row created; guides linked to lote; protocolo visible on screen"
    why_human: "UI AlertDialog interaction + server action + DB update visible in rendered table"
  - test: "Glosa + recurso: on /clinica/financeiro/faturamento/glosas, click 'Registrar Recurso' on a glosada item, fill the Textarea, submit, confirm guide status updates to 'recurso'"
    expected: "GlosaRecursoSheet submits registrarRecurso; item glosa_status = 'em_recurso'; guide status derived to 'recurso'; badge refreshes after router.refresh()"
    why_human: "Sheet interaction + per-item status derivation must be observed in rendered UI"
  - test: "Operadoras access gate: log in as a 'dentist' role user, attempt to access /clinica/financeiro/faturamento/operadoras — should see an access-denied notice, not the cadastro"
    expected: "Server-side role check blocks dentist; renders access-denied text (not a 500 or empty page)"
    why_human: "Requires two browser sessions with different roles; cannot inspect rendered output without a running server"
---

# Phase 15: Faturamento/NFS-e & Convênios/TISS Verification Report

**Phase Goal:** Atendimentos concluídos viram ordens de serviço automáticas com NFS-e emitida na prefeitura, e o faturamento de convênios gera guia TISS com tratamento de glosas
**Verified:** 2026-06-20T14:40:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Ao concluir atendimento, OS é criada automaticamente com procedimentos; forma de pagamento gera parcelas | VERIFIED | `createOsDraftFromAppointment` called when `status === 'concluido'` in `appointments.ts`; `faturarOs` calls `createCharge` for particular branch; `criarGuiaForOs` for convênio branch |
| 2 | A partir da OS, usuário emite NFS-e; documento retorna com número e fica arquivado | VERIFIED | `emitirNfseForOs` inserts `nfse_records` status=`processando` before `provider.emit()`; `StubFiscalProvider` returns `status: 'emitida'` with `numero`; xml/pdf paths stored; signed URL access only |
| 3 | Usuário cadastra operadora com tabela de preços; gera guia TISS; lote enviado com protocolo por operadora | VERIFIED | `insurers.ts` CRUD exists; `insurer_prices` table with service×operadora pricing; `criarGuiaForOs` → `tiss_guides` em_analise; `fecharLote` → `StubTissProvider.sendLote` → stores `protocolo` |
| 4 | Glosas classificadas por motivo; usuário registra recurso com status atualizado na tela | VERIFIED | `registrarGlosa` updates `tiss_guide_items.motivo_glosa_id + valor_glosado + glosa_status='glosada'`; `registrarRecurso` sets `glosa_status='em_recurso'`; `deriveGuideStatus` re-derives guide status; Glosas screen wired |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260620000100_faturamento_catalog_tables.sql` | 4 tables: services, insurer_prices, unit_fiscal_config, glosa_motivos | VERIFIED | 4 CREATE TABLEs; services.account_id FK to chart_of_accounts ON DELETE SET NULL; regime_emissao CHECK; aliquota_iss NUMERIC(5,4) |
| `supabase/migrations/20260620000200_faturamento_os_tables.sql` | 6 tables + next_os_number + charges ALTER | VERIFIED | 6 CREATE TABLEs; D-27 enums (rascunho/faturada/cancelada, pagador particular/convenio, nfse processando/emitida/cancelada/erro); partial UNIQUE on appointment_id; UNIQUE on idempotency_key; next_os_number SECURITY DEFINER; ALTER TABLE charges ADD service_order_id; deferred FK for insurer_prices |
| `supabase/migrations/20260620000300_faturamento_tiss_tables.sql` | 3 tables: tiss_lotes, tiss_guides, tiss_guide_items | VERIFIED | 3 CREATE TABLEs; D-27 TISS enum both on lotes and guides; motivo_glosa_id FK to glosa_motivos ON DELETE SET NULL; glosa_status item-level enum |
| `supabase/migrations/20260620000400_faturamento_rls.sql` | RLS for all 10+ tables with role-write and WITH CHECK | VERIFIED | 13 ENABLE ROW LEVEL SECURITY; 17 WITH CHECK clauses; glosa_motivos SELECT uses `clinic_id IS NULL OR clinic_id = get_my_tenant_id()`; admin/superadmin write gating |
| `supabase/migrations/20260620000500_faturamento_seed.sql` | ANS glosa motivos (1001–9901) + dental services seed trigger | VERIFIED | 15 glosa motivos including '1001' and '9901'; `seed_faturamento_services` function; `seed_services_on_clinic` AFTER INSERT trigger on clinics; 12 dental services seeded |
| `src/types/database.types.ts` | Regenerated with all 10 new tables + charges.service_order_id | VERIFIED | Contains service_orders, nfse_records, tiss_guides, insurers, appointment_procedures, glosa_motivos; charges has service_order_id FK |
| `src/lib/faturamento/os-math.ts` | computeOsTotal, isValidOsTransition pure exports | VERIFIED | Both functions exported; integer-cent math (Math.round * 100); VALID_OS_TRANSITIONS map with correct state machine |
| `src/lib/validators/service.ts` | serviceSchema, insurerPriceSchema with isMoney2dp, no .default() | VERIFIED | Both schemas exported; isMoney2dp refine; 0 .default() calls |
| `src/lib/validators/insurer.ts` | insurerSchema (CONV-01) with status enum, no .default() | VERIFIED | insurerSchema exported; status z.enum(['ativo','em_negociacao','inativo']); 0 .default() calls |
| `src/lib/validators/service-order.ts` | serviceOrderSchema + faturarOsSchema (21x cap, convenio refine), no .default() | VERIFIED | Both schemas; installmentCount max 21; pagador='convenio' → insurerId required refine; 0 .default() calls |
| `src/lib/fiscal/types.ts` | FiscalProvider, NfseInput, NfseResult interfaces | VERIFIED | All 3 exported; emit/query/cancel methods |
| `src/lib/fiscal/iss.ts` | computeIss, resolveAliquota pure exports | VERIFIED | Integer-cent computeIss (Math.round * aliquota / 100); resolveAliquota uses ?? for zero-safe override |
| `src/lib/fiscal/stub.ts` | StubFiscalProvider returns status='emitida' | VERIFIED | emit() returns { status: 'emitida', numero, provider_ref } synchronously |
| `src/lib/fiscal/index.ts` | getFiscalProvider credential-gated factory | VERIFIED | Queries `integration_connectors` type='nfse'; falls back to StubFiscalProvider; import 'server-only' |
| `src/lib/fiscal/focusnfe.ts` | FocusNfeFiscalProvider REST adapter (gated) | VERIFIED | Uses fetch to api.focusnfe.com.br; no SDK; gated by credentials |
| `src/lib/tiss/types.ts` | TissProvider, GuiaInput, LoteResult interfaces | VERIFIED | All 3 exported; createGuia/sendLote/queryLote methods |
| `src/lib/tiss/glosa-math.ts` | computeGuiaGlosaTotals, deriveGuideStatus pure exports | VERIFIED | Integer-cent sums; deriveGuideStatus priority: em_recurso > glosada > paga > em_analise |
| `src/lib/tiss/stub.ts` | StubTissProvider returns protocolo | VERIFIED | sendLote returns { protocolo: `PROTO-${ts}`, status: 'em_analise' } |
| `src/lib/tiss/index.ts` | getTissProvider credential-gated factory | VERIFIED | Queries `integration_connectors` type='tiss'; falls back to StubTissProvider; import 'server-only' |
| `src/actions/service-orders.ts` | createOs, faturarOs (CAS+idempotency), cancelarOs via alçada | VERIFIED | 'use server' + import 'server-only'; CAS `.eq('status', 'rascunho')` before external calls; idempotency_key set; createCharge in particular branch; criarGuiaForOs in convênio branch; cancelarOs routes faturada through createApprovalRequest |
| `src/actions/appointments.ts` | createOsDraftFromAppointment called on status→concluido | VERIFIED | `if (input.status === 'concluido')` guard; 23505 unique-violation caught and swallowed |
| `src/actions/services.ts` | listServices, createService, listInsurerPrices, upsertInsurerPrice | VERIFIED | 'use server' + import 'server-only'; all exports present |
| `src/actions/nfse.ts` | emitirNfseForOs (regime split, convenio guard), cancelarNfse via alçada, getNfses | VERIFIED | pagador='convenio' guard; regime_emissao='caixa' guard; insert processando BEFORE emit; CAS advance; cancelarNfse imports approval-actions |
| `src/app/api/webhooks/nfse/route.ts` | Fiscal webhook: secret verify, CAS forward-only, logToHub | VERIFIED | export const runtime = 'nodejs'; FISCAL_WEBHOOK_SECRET header check (401 on mismatch); `.eq('status', 'processando')` CAS; logToHub with .catch |
| `src/actions/tiss.ts` | criarGuiaForOs, fecharLote, registrarGlosa, registrarRecurso | VERIFIED | 'use server' + import 'server-only'; em_analise insert; sendLote + protocolo store; per-item motivo_glosa_id + valor_glosado + glosa_status='glosada'; glosa_status='em_recurso' on recurso |
| `src/actions/insurers.ts` | listInsurers, createInsurer, updateInsurer, deactivateInsurer | VERIFIED | 'use server'; all 4 exports present; tenant-scoped |
| `src/app/(dashboard)/clinica/financeiro/page.tsx` | 3 new faturamento nav cards | VERIFIED | ClipboardList/FileText/ShieldPlus icons imported; 3 hrefs to /faturamento/os, /faturamento/nfse, /faturamento/convenios |
| `src/app/(dashboard)/clinica/financeiro/faturamento/os/page.tsx` | OS list RSC with listOs + KPIs | VERIFIED | Calls listOs; renders KPI row + OsTable |
| `src/app/(dashboard)/clinica/financeiro/faturamento/nfse/page.tsx` | NFS-e RSC mirroring prototype | VERIFIED | NfseKpiRow (4 KPIs) + BarChart + NfseEmitForm + NfseTable |
| `src/components/financeiro/NfseEmitForm.tsx` | ISS preview panel with computeIss | VERIFIED | Imports computeIss + computeValorLiquido; shows "ISS retido" + "Valor líquido" labels |
| `src/components/financeiro/NfseTable.tsx` | Status badges, signed URL, masked tomador | VERIFIED | getNfseDocumentUrl (not raw path); cancelarNfse wired; no storage_path rendered |
| `src/components/financeiro/OsSheet.tsx` | faturarOs/cancelarOs via AlertDialog | VERIFIED | faturarOs called on confirm; AlertDialog used (no window.confirm); cancelarOs routes through approval |
| `src/app/(dashboard)/clinica/financeiro/faturamento/convenios/page.tsx` | 5 KPIs + DonutChart + fecharLote | VERIFIED | ConveniosKpiRow; DonutChart from prototipos/charts; fecharLote in FecharLoteButton with AlertDialog |
| `src/app/(dashboard)/clinica/financeiro/faturamento/operadoras/page.tsx` | Operadoras RSC with role gate | VERIFIED | Server-side role check; ALLOWED_ROLES = ['admin','superadmin','financeiro']; InsurerTable + InsurerFormDialog |
| `src/components/financeiro/InsurerFormDialog.tsx` | RHF + zodResolver(insurerSchema) + no .default() | VERIFIED | createInsurer/updateInsurer wired; zodResolver used |
| `src/app/(dashboard)/clinica/financeiro/faturamento/operadoras/[id]/precos/page.tsx` | Insurer price table | VERIFIED | listInsurerPrices + listServices; InsurerPricesTable renders; upsertInsurerPrice wired |
| `src/app/(dashboard)/clinica/financeiro/faturamento/glosas/page.tsx` | Glosas RSC with getGlosas | VERIFIED | 3 KPI cards + filter bar + GlosaTable; getGlosas called |
| `src/components/financeiro/GlosaRecursoSheet.tsx` | registrarRecurso per-item Sheet | VERIFIED | registrarRecurso called with itemId + texto; Sheet component (not Dialog) |
| `src/components/financeiro/GlosaTable.tsx` | Motivo ANS badge, masked patient | VERIFIED | patient_maskedName used; valor glosado visible |
| `src/components/financeiro/ConveniosKpiRow.tsx` | 5 KPIs + 6% glosa threshold | VERIFIED | glosaAvg >= 6 ? 'text-destructive' : 'text-muted-foreground' |
| `src/__tests__/faturamento/migrations-phase15.test.ts` | Source-inspection tests — 80+ lines | VERIFIED | File exists; 127/127 faturamento tests GREEN |
| `src/__tests__/faturamento/service-orders.test.ts` | OS state machine, math, CAS, idempotency | VERIFIED | GREEN (127 total); computeOsTotal, isValidOsTransition, faturarOs paths |
| `src/__tests__/faturamento/nfse.test.ts` | FiscalProvider/Stub/ISS/regime | VERIFIED | GREEN; computeIss(1200,0.05)===60; competência/caixa/convenio guards |
| `src/__tests__/faturamento/tiss.test.ts` | TissProvider/Stub/glosa-math | VERIFIED | GREEN; criarGuia em_analise, fecharLote protocolo, registrarGlosa/Recurso, D-28 sum |
| `src/__tests__/faturamento/regression-guard-phase15.test.ts` | Phase invariants unchanged | VERIFIED | GREEN; 'concluido' enum present; 'nfse'/'tiss' connector types present; financial_tables unchanged |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `appointments.ts` status→concluido | service_orders insert rascunho | `createOsDraftFromAppointment` | WIRED | Guard `=== 'concluido'`; 23505 swallowed |
| `faturarOs` particular | `createCharge` (Asaas) | import from charges; called in particular branch | WIRED | `.eq('status','rascunho')` CAS before call |
| `faturarOs` convênio | `criarGuiaForOs` | dynamic import from tiss | WIRED | Convênio branch does NOT call createCharge |
| `faturarOs` | service_orders CAS update | `.eq('status','rascunho')` | WIRED | idempotency_key set atomically |
| `emitirNfseForOs` | nfse_records insert (processando) then provider.emit | insert-before-emit ordering | WIRED | Pitfall 2 honored: row inserted first, then emit |
| `getFiscalProvider` | integration_connectors type='nfse' | credential gating | WIRED | Falls back to StubFiscalProvider when no credentials |
| NFS-e webhook | nfse_records CAS advance | `.eq('status','processando')` | WIRED | Forward-only; logToHub with .catch |
| `fecharLote` | TissProvider.sendLote → protocolo stored | `provider.sendLote`; `updateLote({protocolo})` | WIRED | logToHub fire-and-forget |
| `registrarGlosa` | tiss_guide_items.motivo_glosa_id + valor_glosado | per-item update | WIRED | deriveGuideStatus re-runs after update |
| services.account_id | chart_of_accounts.id | FK ON DELETE SET NULL | WIRED | Present in migration 000100 |
| seed trigger | clinics AFTER INSERT | `seed_services_on_clinic` AFTER INSERT | WIRED | Trigger present in migration 000500 |
| OsSheet Faturar button | faturarOs action | server action call | WIRED | AlertDialog confirm → faturarOs({osId, billingType, installmentCount}) |
| NfseEmitForm submit | emitirNfse action | server action call | WIRED | RHF submit → emitirNfse |
| InsurerFormDialog submit | createInsurer/updateInsurer | server action | WIRED | zodResolver(insurerSchema) |
| GlosaRecursoSheet submit | registrarRecurso | server action | WIRED | registrarRecurso(glosa.id, texto) |
| Fechar lote button | fecharLote action | AlertDialog → fecharLote | WIRED | FecharLoteButton component |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `os/page.tsx` | `result` from `listOs()` | `service_orders` table (Supabase) | Yes — DB query, clinic-scoped | FLOWING |
| `nfse/page.tsx` | `result` from `getNfses()` | `nfse_records` table | Yes — DB query | FLOWING |
| `convenios/page.tsx` | `getGuias()` results | `tiss_guides` + `insurers` | Yes — DB query with joins | FLOWING |
| `OsSheet.tsx` | `os` prop from OsTable row | Passed from listOs RSC result | Yes — RSC passes real data | FLOWING |
| `NfseEmitForm.tsx` | `computeIss(valor, aliquota)` | Pure function (no DB) | Yes — deterministic math | FLOWING |
| `GlosaTable.tsx` | `glosas` from `getGlosas()` | `tiss_guide_items` + `glosa_motivos` JOIN | Yes — DB query | FLOWING |
| `InsurerPricesTable.tsx` | `rows` from `listInsurerPrices()` | `insurer_prices` table | Yes — DB query per insurerId | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All faturamento tests GREEN | `npx vitest run src/__tests__/faturamento/` | 127/127 passed | PASS |
| Full test suite regression | `npx vitest run` | 1504/1504 passed | PASS |
| Build compiles 7 faturamento routes | `npm run build` | 0 errors; 7 routes built | PASS |
| computeIss(1200, 0.05) === 60 | Asserted in nfse.test.ts | GREEN | PASS |
| Module exports verified | Grep across action/lib files | All exports present | PASS |
| server-only in all 3 action files | `grep "import 'server-only'"` | 1 each in service-orders, nfse, tiss | PASS |

Step 7b: Behavioral spot-checks for runnable entry points passed. Server not started for manual flow testing — those items moved to human verification.

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| OS-01 | Atendimento concluído vira OS automática com procedimentos | SATISFIED | `createOsDraftFromAppointment` called on status='concluido'; partial UNIQUE index prevents duplicates; appointment_procedures feed service_order_items |
| OS-02 | Usuário emite NFS-e na prefeitura a partir da OS | SATISFIED | `emitirNfseForOs` with FiscalProvider abstraction (Stub gated per D-01/D-02); insert-before-emit; regime split (competência/caixa); archival in nfse_records |
| OS-03 | Forma de pagamento gera parcelas a receber | SATISFIED | particular path calls `createCharge` (Asaas, up to 21x via faturarOsSchema); convênio path creates insurer receivable (no Asaas charge) |
| CONV-01 | Usuário cadastra operadoras com tabelas e regras próprias | SATISFIED | `insurers` table + `insurerSchema`; `insurer_prices` table; full CRUD in `insurers.ts` + `services.ts#upsertInsurerPrice`; Operadoras screen with role gate |
| CONV-02 | Sistema gera guia TISS e lote de envio/protocolo por operadora | SATISFIED | `criarGuiaForOs` → tiss_guides em_analise; `fecharLote` → sendLote → protocolo stored on tiss_lotes; StubTissProvider gated per D-13 |
| CONV-03 | Glosas classificadas por motivo; usuário registra recurso | SATISFIED | `registrarGlosa` per item (motivo_glosa_id + valor_glosado + glosa_status='glosada'); `registrarRecurso` per item (glosa_status='em_recurso'); `deriveGuideStatus` re-derives guide; Glosas screen with GlosaRecursoSheet |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/validators/service.ts` | 11 | `/* No .default() */` comment | INFO | Comment explaining D-133 compliance — not a violation |
| All action files | — | No TODO/FIXME/placeholder found | — | Clean |
| All migration files | — | No empty returns, no hardcoded empty arrays | — | Clean |
| `src/actions/tiss.ts` | `fecharLote` test path | `{ protocolo: 'STUB' }` in default deps fallback | INFO | Test injection default — not rendered to users; real path calls getTissProvider |

No blockers or warnings found. The NFS-e/TISS real provider adapters are STUB-gated by design (D-01/D-13) — this is the intended deliverable, not a gap.

### Human Verification Required

#### 1. OS auto-creation end-to-end

**Test:** Log into the app as a dentist, open an existing appointment, change status to "Concluído", navigate to /clinica/financeiro/faturamento/os.
**Expected:** A new OS rascunho appears linked to the appointment, with the patient name as first_name + last_initial, and the unit's sequenced OS number (OS-000001 pattern).
**Why human:** The trigger fires inside a Server Action during appointment status update. Requires a browser session, live DB, and a real or seeded appointment.

#### 2. Faturar OS particular (NFS-e stub path)

**Test:** Open an OS rascunho in OsSheet, select PIX, 1 parcela, click "Faturar OS", confirm the AlertDialog. Then navigate to /clinica/financeiro/faturamento/nfse.
**Expected:** OS status changes to "faturada"; NFS-e Histórico shows a row with status "emitida" (stub resolves synchronously); ISS panel showed a preview before submission.
**Why human:** Requires browser interaction with the AlertDialog, RHF form submission flow, and visual confirmation of badge states.

#### 3. Convênio flow — guia creation and lote

**Test:** Create a convênio OS (set pagador=convênio, select an operadora), Faturar it. Navigate to /clinica/financeiro/faturamento/convenios. Click "Fechar lote" and confirm the AlertDialog.
**Expected:** A tiss_guides row appears with status "em_análise"; after fecharLote, a protocolo (PROTO-xxx) appears; no charge appears in the particular receivables.
**Why human:** Multi-step flow with two DB tables and visual state transitions in the convênios table.

#### 4. Glosa classification and recurso

**Test:** On /clinica/financeiro/faturamento/glosas, if a glosada guide item exists, click "Registrar Recurso", fill the Textarea, submit. Confirm the guide status badge updates to "em recurso" in the convênios screen.
**Expected:** GlosaRecursoSheet submits; item glosa_status = 'em_recurso'; guide status re-derived to 'recurso'; UI badge refreshes.
**Why human:** Requires a glosada item in the DB (seeded or created via registrarGlosa first); Sheet interaction; visual badge verification.

#### 5. Operadoras role gate

**Test:** Log in as a dentist role user. Try to access /clinica/financeiro/faturamento/operadoras.
**Expected:** Server renders an access-denied notice (not a 500 error, not the cadastro screen).
**Why human:** Requires two browser sessions with distinct roles; server-side role check renders conditional JSX that cannot be inspected without a running server.

#### 6. LGPD masking in all tables

**Test:** Across OS, NFS-e histórico, Convênios guias, and Glosas screens, verify that patient names appear as "João S." (first_name + last_initial) and that no CPF digits are fully visible (only masked `***.xxx.xxx-**` format in OsSheet detail).
**Expected:** No full patient names; no unmasked CPFs; no raw storage_path links in NFS-e "Ver nota" (signed URL opens PDF).
**Why human:** Visual inspection of rendered data across multiple screens.

---

## Summary

Phase 15 goal achievement is **automated-verified at 4/4 truths**. All schema objects (10 tables, 5 migrations applied to live DB), domain logic (OS state machine, CAS idempotency, dual billing path, FiscalProvider/TissProvider stubs, ISS/glosa math), action layer (service-orders, nfse, tiss, services, insurers), webhook route, and UI screens (7 routes, 11+ components) exist and are substantively implemented and wired.

Key quality signals:
- 127/127 faturamento tests GREEN; 1504/1504 total GREEN
- Build passes with 0 errors; 7 faturamento routes compiled
- D-27 enums locked verbatim in migrations
- D-30 idempotency: CAS on service_orders + nfse_records; 23505 swallow on appointment OS
- D-01/D-13 STUB gating: real NFS-e/TISS adapters credential-gated; stub is the deliverable
- D-18 RLS: glosa_motivos shared seed SELECT; write gated to admin/superadmin in migrations; financeiro role added in app layer; operadoras page server-side role gate
- D-133: 0 .default() calls in all 3 validators

The 6 human verification items cover visual/behavioral end-to-end flows that cannot be verified programmatically without a running server and live Supabase session.

---

_Verified: 2026-06-20T14:40:00Z_
_Verifier: Claude (gsd-verifier)_
