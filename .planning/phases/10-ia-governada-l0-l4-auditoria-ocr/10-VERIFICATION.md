---
phase: 10-ia-governada-l0-l4-auditoria-ocr
verified: 2026-06-14T17:45:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
gaps: []
human_verification:
  - test: "Configurar agent level L2 para um agente (ex: collection) e disparar uma ação 'sensitive' — verificar que a tentativa é bloqueada e um row aparece em ai_decision_log com decision='pending_approval'"
    expected: "Row em ai_decision_log com decision='pending_approval', agent_key='collection', clinic_id real (não null); nenhuma ação executada; approval_requests row criado"
    why_human: "Requer execução real de agent loop com DB vivo; não testável via grep ou tsc"
  - test: "Abrir /conformidade/aprovacoes como admin, ver a fila pending, clicar Aprovar em um item com required_role='admin'"
    expected: "approval_requests.status atualiza para 'approved', executed_at preenchido, logBusinessEvent gravado; tentativa de duplo-clique retorna 'Já executado por outro aprovador'"
    why_human: "Requer sessão auth real, banco vivo, interação de UI; idempotência só verificável com clique duplo real"
  - test: "Abrir /conformidade/auditoria como auditor/dpo, aplicar filtros (table_name='patients', período), expandir um registro"
    expected: "Linhas retornadas; filtros refletidos na URL (nuqs); cada entrada exibe JSON de old_values e new_values lado a lado"
    why_human: "Comportamento de filtro URL-persisted + renderização de diff só verificável em browser com sessão real"
  - test: "Na tela de auditoria, iniciar um estorno em um registro como admin (motivo obrigatório); aprovar o estorno como admin"
    expected: "approval_requests row tipo='estorno' criado; após aprovação, logBusinessEvent 'estorno.executed' gravado; idempotencyKey impede duplicata"
    why_human: "Fluxo multi-step com banco vivo; verificar campo motivo + alçada + trail em sequência requer UI real"
  - test: "Upload de uma foto de RG/CPF na tela /conformidade/ocr; campo CPF com confidence < 0.80"
    expected: "Badge 'Revisar (XX%)' aparece no campo CPF; extração salva em ocr_extractions com status='pending_review'; log servidor não expõe CPF bruto (apenas maskedCPF)"
    why_human: "Requer modelo de visão real via AI Gateway + documento real para ativar threshold; comportamento de maskCPF nos logs só verificável em servidor real"
  - test: "Confirmar ou rejeitar uma extração OCR pendente; confirmar deve criar paciente novo via createPatient"
    expected: "ocr_extractions.status='committed', target_id preenchido com ID do paciente criado; rejeição seta status='rejected'; RLS impede acesso cross-tenant"
    why_human: "Requer sessão auth + banco vivo + fluxo completo UI→action→DB"
---

# Phase 10: IA Governada (L0–L4), Auditoria & OCR — Verification Report

**Phase Goal:** Agentes de IA operam dentro de limites invioláveis com aprovação humana em ações sensíveis; auditores consultam trilha completa com estornos controlados; usuários fazem OCR de documentos com revisão de extrações incertas.
**Verified:** 2026-06-14T17:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Agente bloqueado ao ultrapassar teto de ação; tentativa registrada no log | ✓ VERIFIED | `withAgentPolicy` em `policy.ts` computa decisão via L0–L4 matrix e insere em `ai_decision_log` via `createAdminClient` (best-effort try/catch). Agentes `collection` e `confirmation` wrapped PER-ROW com `clinicId = receivable.tenant_id`. |
| 2 | Ação sensível pausa e exige aprovação humana antes de executar | ✓ VERIFIED | `computePolicyDecision(L2/L3, 'sensitive') → 'pending_approval'`. `withAgentPolicy` retorna sentinel `{ _policy: 'pending_approval' }`; caller cria row em `approval_requests`. `approveRequest` exige idempotency (`WHERE status='pending' AND executed_at IS NULL`). |
| 3 | Auditor/DPO acessa tela dedicada com filtros por entidade/usuário/período; diff antes/depois | ✓ VERIFIED | `/conformidade/auditoria/page.tsx` é RSC (sem `'use client'`); chama `queryAuditLogs` com `createAdminClient` após gate `AUDIT_PERMITTED_ROLES`; `AuditTrail.tsx` usa nuqs para filtros URL-persisted; renderiza `old_values`/`new_values` via `DiffBlock`. |
| 4 | Estorno requer motivo e aprovação por alçada; fluxo registrado na trilha | ✓ VERIFIED | `createEstorno` exige `reason` (Zod min 5 chars), chama `createApprovalRequest(type='estorno', requiredRole)` com `idempotencyKey='estorno:{table}:{record}'`. `approveRequest` checa `canApprove(actor.role, required_role)` server-side. `logBusinessEvent` em `estorno.requested` + `estorno.executed`. |
| 5 | Upload de documento; IA extrai campos; extrações abaixo do threshold ficam em fila de revisão antes de gravar | ✓ VERIFIED | `/api/ocr/route.ts`: `generateObject + FilePart + zeroDataRetention:true`; `needsReview(object)` do `ocr-confidence.ts` gatea status → `pending_review`; `OcrUploadReview.tsx` exibe badges de confiança e chama `confirmOcrExtraction`/`rejectOcrExtraction`. |

**Score:** 5/5 truths verified (implementação automaticamente verificável)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260616000100_ai_decision_log.sql` | Tabela imutável + RLS SELECT | ✓ VERIFIED | `CREATE TABLE public.ai_decision_log`, `decision IN ('execute','suggest','block','pending_approval')`, `idx_ai_decision_log_clinic`, SELECT policy, **sem** FOR INSERT/UPDATE/DELETE |
| `supabase/migrations/20260616000200_approval_requests.sql` | Fila unificada + idempotência + RLS | ✓ VERIFIED | `type IN ('ai_action','estorno')`, `idempotency_key`, `uq_approval_requests_idempotency WHERE idempotency_key IS NOT NULL`, `executed_at`, USING+WITH CHECK |
| `supabase/migrations/20260616000300_ocr_extractions.sql` | Fila de revisão + soft-delete LGPD | ✓ VERIFIED | `status IN ('pending_review','approved','committed','rejected')`, `deleted_at`, `min_confidence NUMERIC(4,3)`, `target_table`, RLS FOR ALL |
| `supabase/migrations/20260616000400_audit_logs_indexes.sql` | Indexes + partições defensivas | ✓ VERIFIED | `idx_audit_logs_table_name`, `idx_audit_logs_record_id` (ambos `IF NOT EXISTS`), partições 2026-10/11 `IF NOT EXISTS` |
| `src/types/database.types.ts` | Tipos regenerados com as 3 novas tabelas | ✓ VERIFIED | `ai_decision_log` (linha 187), `approval_requests` (linha 373), `ocr_extractions` (linha 1837) — 4 migrações aplicadas via `supabase db push` |
| `src/lib/ai/policy-types.ts` | computePolicyDecision puro + canApprove | ✓ VERIFIED | Sem `server-only`; `computePolicyDecision` com matrix L0→suggest, L1+safe→execute, L2/L3+sensitive→pending_approval, L4→execute, unknown→block; `canApprove` com `APPROVER_RANK` |
| `src/lib/ai/policy.ts` | withAgentPolicy + logging ai_decision_log | ✓ VERIFIED | `import 'server-only'` (linha 11); lê `ai_agent_config`; insere em `ai_decision_log` via `createAdminClient` (best-effort); retorna sentinel em não-execute |
| `src/actions/approval-actions.ts` | createApprovalRequest + approveRequest + rejectRequest | ✓ VERIFIED | `assertNotReadOnly` + `canApprove` alçada + `WHERE status='pending' AND executed_at IS NULL` + `logBusinessEvent`; idempotência em conflito 23505 |
| `src/actions/audit-actions.ts` | queryAuditLogs + createEstorno + executeEstornoPayload | ✓ VERIFIED | `AUDIT_PERMITTED_ROLES` gate antes de `createAdminClient`; `.eq('tenant_id', actor.tenant_id)` mandatório; `createEstorno` com `assertNotReadOnly + Zod + idempotencyKey` |
| `src/lib/ai/ocr-confidence.ts` | needsReview + minConfidence puros | ✓ VERIFIED | `OCR_CONFIDENCE_THRESHOLD = 0.80`; `needsReview` retorna true se QUALQUER campo < threshold; sem imports de servidor |
| `src/app/api/ocr/route.ts` | POST /api/ocr nodejs + ZDR + FilePart + maskCPF | ✓ VERIFIED | `export const runtime = 'nodejs'`; `generateObject`; `{ type: 'file', data: base64, mediaType: mimeType }`; `zeroDataRetention: true`; `maskCPF` antes de qualquer log |
| `src/actions/ocr-actions.ts` | confirmOcrExtraction + rejectOcrExtraction | ✓ VERIFIED | `assertNotReadOnly`; reusa `createPatient()`; guarda status, reviewed_by, reviewed_at; `logBusinessEvent` sem CPF bruto |
| `src/proxy.ts` | conformidade ModuleKey + ROUTE_MODULE_MAP + permissões | ✓ VERIFIED | `conformidade` no union (linha 14); `{ prefix: '/conformidade', module: 'conformidade' }` (linha 47); auditor/dpo `readOnly:true`, admin/superadmin `allowed:true` |
| `src/app/(dashboard)/conformidade/auditoria/page.tsx` | RSC + queryAuditLogs + renderiza antes/depois | ✓ VERIFIED | Sem `'use client'`; chama `queryAuditLogs`; passa `rows: AuditLogRow[]` serializáveis; `PERMITTED_ROLES` gate |
| `src/components/conformidade/AuditTrail.tsx` | `'use client'` + nuqs + diff + estorno dialog | ✓ VERIFIED | nuqs `useQueryState`; renderiza `old_values`/`new_values`; `EstornoDialog` chama `createEstorno`; `isReadOnly` esconde dialog cosmetically |
| `src/app/(dashboard)/conformidade/aprovacoes/page.tsx` | RSC + fila pending | ✓ VERIFIED | Sem `'use client'`; SELECT `approval_requests WHERE status='pending'`; passa dados serializáveis a `<ApprovalInbox>` |
| `src/components/conformidade/ApprovalInbox.tsx` | `'use client'` + approveRequest + rejectRequest + canApprove | ✓ VERIFIED | Importa `approveRequest`/`rejectRequest` de `approval-actions`; `canApprove` de `policy-types.ts`; desabilita botão cosmetically; enforcement real é server-side |
| `src/app/(dashboard)/conformidade/ocr/page.tsx` | RSC + fila pending_review | ✓ VERIFIED | Auth gate + role gate (admin/superadmin); SELECT `ocr_extractions WHERE status='pending_review'`; props serializáveis |
| `src/components/conformidade/OcrUploadReview.tsx` | `'use client'` + fetch /api/ocr + confirm/reject | ✓ VERIFIED | `fetch('/api/ocr', { method: 'POST', body: formData })`; badges de confiança com threshold; `confirmOcrExtraction`/`rejectOcrExtraction` |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `policy.ts` | `ai_decision_log` | `createAdminClient().from('ai_decision_log').insert` | ✓ WIRED | Linha 85 — best-effort try/catch |
| `policy.ts` | `ai_agent_config` | `.from('ai_agent_config').select('autonomy_level, enabled')` | ✓ WIRED | Lê level + enabled para decisão |
| `collection-agent.ts` | `withAgentPolicy(clinicId=receivable.tenant_id)` | Loop de recebíveis, linha 225 | ✓ WIRED | Per-row; nunca null clinic_id (B2 fix) |
| `confirmation-agent.ts` | `withAgentPolicy(clinicId=tenantId)` | Loop de appointments, linha 142 | ✓ WIRED | `tenantId = appt.tenant_id` per-row |
| `approval-actions.ts` | `executed_at` idempotência | `WHERE status='pending' AND executed_at IS NULL` + affected-row check | ✓ WIRED | Linhas 218-229 |
| `audit-actions.ts queryAuditLogs` | `AUDIT_PERMITTED_ROLES` gate antes de `createAdminClient` | Role check na linha 105, adminClient na 112 | ✓ WIRED | Cross-tenant read prevention |
| `audit-actions.ts queryAuditLogs` | `.eq('tenant_id', actor.tenant_id)` | Tenant SEMPRE do actor, nunca do client | ✓ WIRED | Linha 121 |
| `audit-actions.ts createEstorno` | `approval_requests type='estorno'` | Via `createApprovalRequest({type:'estorno'})` | ✓ WIRED | Idempotency key `estorno:{table}:{record}` |
| `ocr/route.ts` | `zeroDataRetention: true` | `providerOptions.gateway.zeroDataRetention` | ✓ WIRED | Linha 142 — LGPD T-10-20 |
| `ocr/route.ts` | `maskCPF` antes de log | `const maskedCpf = maskCPF(object.cpf.value)` | ✓ WIRED | Linha 187 — T-10-21 |
| `proxy.ts ROUTE_MODULE_MAP` | conformidade module | `prefix: '/conformidade'` | ✓ WIRED | Linha 47 |
| `ApprovalInbox.tsx` | `approveRequest`/`rejectRequest` Server Actions | Import direto de `approval-actions` | ✓ WIRED | canApprove importado de `policy-types.ts` (não de approval-actions — correção do Plan 06) |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `AuditTrail.tsx` | `rows: AuditLogRow[]` | `queryAuditLogs` → `createAdminClient` → `audit_logs` (tabela real) | Sim — query real paginada | ✓ FLOWING |
| `ApprovalInbox.tsx` | `rows: ApprovalRequestRow[]` | RSC page → `supabase.from('approval_requests')` RLS-scoped | Sim — query real | ✓ FLOWING |
| `OcrUploadReview.tsx` | `pendingQueue: OcrExtractionQueueRow[]` | RSC page → `supabase.from('ocr_extractions') WHERE status='pending_review'` | Sim — query real com RLS | ✓ FLOWING |
| `OcrUploadReview.tsx` | campos extraídos após upload | `fetch('/api/ocr')` → `generateObject` → modelo de visão real | Sim — modelo AI real | ✓ FLOWING |
| `policy.ts withAgentPolicy` | decisão L0–L4 | `ai_agent_config` (tabela real, aplied live) | Sim — lê config real do tenant | ✓ FLOWING |

---

## Gates (Automáticos)

| Gate | Comando | Resultado |
|------|---------|-----------|
| TypeScript | `npx tsc --noEmit` | **EXIT 0** — limpo |
| Build Next.js | `npx next build` | **GREEN** — 3 rotas `/conformidade/*` aparecem como `ƒ` (Dynamic) |
| Test suite (geral) | `npx vitest run` | **907/910 passam** — 3 falhas em `estorno.test.ts` (ver abaixo) |
| Testes Phase 10 | Governance + audit + OCR + migrations | **106/109 passam** — 3 falhas de scaffold desatualizado |
| Regression AI tests | `npx vitest run src/__tests__/ai/` | **49/49 GREEN** |
| Regression proxy/rbac | `npx vitest run src/__tests__/proxy/ src/__tests__/rbac/` | **48/48 GREEN** |
| Migrations aplicadas | `supabase db push` (Plan 06) | **4/4 aplicadas live** — types regenerados (2524 linhas) |

### Detalhamento das 3 falhas no estorno.test.ts

**Causa raiz:** O scaffold de Wave 0 (Plan 01) esperava que `canApprove` fosse re-exportado de `approval-actions.ts`. O Plan 06 removeu esse re-export (Turbopack build error: `'use server'` só pode exportar funções async). A função `canApprove` existe e está correta em `policy-types.ts` — é importada de lá por `ApprovalInbox.tsx` e testada em `governance/approvals.test.ts` (19/19 GREEN).

**Classificação:** Scaffold desatualizado (mismatch de import path) — **não é falha de implementação**. A alçada está verificada e funcional via `governance/approvals.test.ts`.

**Ação necessária:** Atualizar `estorno.test.ts` para importar `canApprove` de `src/lib/ai/policy-types.ts` ao invés de `src/actions/approval-actions.ts`. As assertions em si (admin→true, receptionist→false, dentist→false) estão corretas.

---

## Requirements Coverage

| Requirement | Descrição | Status | Evidência |
|-------------|-----------|--------|-----------|
| AIG-01 | Agente opera dentro de limites invioláveis | ✓ SATISFIED | `withAgentPolicy` + L0–L4 matrix + disable=block em `policy.ts`; tools + agents wrapped |
| AIG-02 | Ações sensíveis exigem aprovação humana | ✓ SATISFIED | `decision='pending_approval'` → `approval_requests` row; `approveRequest` idempotente |
| AIG-03 | Toda decisão/ação da IA é registrada | ✓ SATISFIED | `ai_decision_log` INSERT em TODA decisão via `createAdminClient`; tabela imutável (sem política de escrita para clients) |
| AUD-01 | Trilha registra quem/quê/quando/antes-depois | ✓ SATISFIED | `audit_logs` + indexes `table_name`+`record_id`; `queryAuditLogs` com old_values/new_values |
| AUD-02 | Estorno exige motivo + aprovação por alçada | ✓ SATISFIED | `createEstorno(reason min 5) → createApprovalRequest(type='estorno') → approveRequest canApprove(role, required_role)` |
| AUD-03 | Auditor/DPO consulta trilha filtrada em tela dedicada | ✓ SATISFIED | `/conformidade/auditoria` RSC gated; nuqs filters; diff render; RBAC auditor/dpo readOnly em proxy |
| OCR-01 | Upload de documento → IA extrai campos automaticamente | ✓ SATISFIED | `POST /api/ocr` nodejs + `generateObject` + FilePart + ZDR |
| OCR-02 | Extrações abaixo do threshold exigem revisão humana antes de gravar | ✓ SATISFIED | `needsReview(fields, 0.80)` → `status='pending_review'`; `confirmOcrExtraction` commita; badges "Revisar" na UI |

---

## Anti-Patterns Found

| File | Padrão | Severidade | Impacto |
|------|--------|------------|---------|
| `src/__tests__/audit/estorno.test.ts` linhas 79-99 | Importa `canApprove` de `approval-actions.ts` (onde não existe mais) | ⚠️ Warning | 3 testes vermelhos — não bloqueia funcionalidade; scaffold desatualizado pós-Plan 06 build fix |
| `src/actions/approval-actions.ts approveRequest` | Dispatcher de payload apenas loga via `logBusinessEvent`; não executa payload de estorno concreto | ℹ️ Info | Documentado como Extension Point para Fases 14–16; sem impacto na Fase 10 |
| `src/app/(dashboard)/conformidade/ocr/page.tsx` | `PERMITTED_ROLES = ['admin', 'superadmin']` — receptionist excluído | ℹ️ Info | Decisão de design documentada; extensão deferred per plan spec |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| OCR route runtime nodejs | `grep "export const runtime" src/app/api/ocr/route.ts` | `'nodejs'` | ✓ PASS |
| ZDR presente no route | `grep zeroDataRetention src/app/api/ocr/route.ts` | `zeroDataRetention: true` | ✓ PASS |
| ai_decision_log sem política de escrita | `grep "FOR INSERT\|FOR UPDATE\|FOR DELETE" supabase/migrations/20260616000100_ai_decision_log.sql` | (vazio) | ✓ PASS |
| conformidade no ROUTE_MODULE_MAP | `grep "/conformidade" src/proxy.ts` | `prefix: '/conformidade', module: 'conformidade'` | ✓ PASS |
| canApprove existe (path correto) | `grep "export function canApprove" src/lib/ai/policy-types.ts` | match | ✓ PASS |
| maskCPF antes de log no OCR route | `grep "maskCPF" src/app/api/ocr/route.ts` | Linha 187 — antes de `console.log` | ✓ PASS |
| Tipos DB regenerados | `grep "ai_decision_log" src/types/database.types.ts` | Linha 187 | ✓ PASS |

---

## Human Verification Required

Os checks automatizados (source-inspection, tsc, build, unit tests) estão todos verdes para a implementação em si. Os itens abaixo requerem UAT manual por precisarem de sessão auth real, banco vivo, ou modelo AI real.

### 1. Enforcement L0–L4 em Runtime (AIG-01/03)

**Test:** Configurar autonomy_level='L2', enabled=true no ai_agent_config. Disparar o collection agent. Observar ai_decision_log com decision='pending_approval' para ação 'sensitive'.
**Expected:** Row em ai_decision_log com clinic_id real (nunca null), decision correto, e nenhuma ação executada sem aprovação.
**Why human:** Requer agente rodando com configuração real de DB + ciclo de cobrança real.

### 2. Approval Inbox — Aprovar + Idempotência (AIG-02)

**Test:** Abrir /conformidade/aprovacoes como admin, clicar Aprovar. Clicar novamente rapidamente (race condition).
**Expected:** Primeira aprovação: success. Segunda: "Já executado por outro aprovador". executed_at preenchido.
**Why human:** Race condition idempotência só verificável com cliques reais em sessão viva.

### 3. Audit Screen — Filtros + Diff (AUD-01/03)

**Test:** Abrir /conformidade/auditoria como auditor, filtrar por table_name='patients', aplicar range de datas.
**Expected:** URL atualiza com params nuqs; linhas filtradas; expandir entrada mostra JSON before/after.
**Why human:** nuqs URL-persistence + diff rendering requer browser com sessão real.

### 4. Estorno — Fluxo Completo (AUD-02)

**Test:** Iniciar estorno em um registro de audit trail (motivo min 5 chars). Aprovar como admin.
**Expected:** approval_requests type='estorno' criado; aprovado com logBusinessEvent 'estorno.executed'; tentar estorno duplicado no mesmo recordId retorna row existente (idempotência).
**Why human:** Multi-step com banco vivo; idempotência de estorno só verificável com requests reais.

### 5. OCR com Documento Real (OCR-01/02)

**Test:** Upload de foto de RG com CPF parcialmente ilegível na tela /conformidade/ocr.
**Expected:** Badge "Revisar (XX%)" no campo CPF (confidence < 0.80); extração em pending_review; log do servidor mostra cpf=***-***-***-** (mascarado); confirm cria paciente real.
**Why human:** Requer modelo de visão real via AI Gateway (ZDR ativo); documento real para acionar threshold de confiança; comportamento de maskCPF nos logs só verificável em servidor real.

### 6. RBAC Gate no Proxy (AUD-03)

**Test:** Tentar acessar /conformidade/ocr como receptionist ou dentist.
**Expected:** Redirecionado ou Alert "Acesso restrito" (role gate no RSC).
**Why human:** Requer sessão real com role específico para verificar gate RBAC em runtime.

---

## Gaps Summary

Nenhum gap bloqueante identificado. Todos os 5 critérios de sucesso do ROADMAP estão implementados e verificáveis via source-inspection + gates automáticos. A única pendência é o scaffold desatualizado (`estorno.test.ts` 3 testes) que representa mismatch de import path pós-fix de build — não uma ausência de funcionalidade.

**Ação recomendada (não bloqueante):** Atualizar `src/__tests__/audit/estorno.test.ts` para importar `canApprove` de `src/lib/ai/policy-types` ao invés de `src/actions/approval-actions`. Isso restaurará 910/910 testes verdes.

---

_Verified: 2026-06-14T17:45:00Z_
_Verifier: Claude (gsd-verifier)_
