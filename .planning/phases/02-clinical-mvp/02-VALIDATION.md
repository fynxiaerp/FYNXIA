---
phase: 2
slug: clinical-mvp
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-05
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.8 |
| **Config file** | `vitest.config.ts` (raiz do projeto) |
| **Quick run command** | `npx vitest run src/__tests__/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/__tests__/`
- **After every plan wave:** Run `npx vitest run && npx tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite must be green + `next build` sem erros
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | CLINIC-02 | T-2-01 | GIST constraint rejeita double-booking | SQL assertion | `npx vitest run src/__tests__/migrations/clinical.test.ts` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 1 | CLINIC-03/04 | T-2-02 | CPF único por tenant (partial index) | SQL assertion | `npx vitest run src/__tests__/migrations/clinical.test.ts` | ❌ W0 | ⬜ pending |
| 2-01-03 | 01 | 1 | CLINIC-06 | T-2-04 | FDI tooth_number CHECK permite 11-48 | SQL assertion | `npx vitest run src/__tests__/migrations/clinical.test.ts` | ❌ W0 | ⬜ pending |
| 2-01-04 | 01 | 1 | SEC-03 | T-2-05 | audit_table_changes trigger em patients | SQL assertion | `npx vitest run src/__tests__/migrations/clinical.test.ts` | ❌ W0 | ⬜ pending |
| 2-01-05 | 01 | 1 | SEC-04 | T-2-06 | is_anonymized + deleted_at no schema | SQL assertion | `npx vitest run src/__tests__/migrations/clinical.test.ts` | ❌ W0 | ⬜ pending |
| 2-02-01 | 02 | 2 | CLINIC-03/04 | T-2-03 | encrypt/decrypt roundtrip medical_history | Unit | `npx vitest run src/__tests__/actions/patients.test.ts` | ❌ W0 | ⬜ pending |
| 2-02-02 | 02 | 2 | SEC-04 | T-2-06 | Anonimização zera PII, preserva prontuário | Unit | `npx vitest run src/__tests__/actions/patients.test.ts` | ❌ W0 | ⬜ pending |
| 2-02-03 | 02 | 2 | CLINIC-05 | — | medical_records INSERT com dentist_id correto | Unit | `npx vitest run src/__tests__/actions/medical-records.test.ts` | ❌ W0 | ⬜ pending |
| 2-02-04 | 02 | 2 | CLINIC-07 | — | Query retorna todos dentistas em ordem cronológica | Unit | `npx vitest run src/__tests__/actions/medical-records.test.ts` | ❌ W0 | ⬜ pending |
| 2-02-05 | 02 | 2 | CLINIC-01 | T-2-03 | FullCalendar filtra eventos por dentist_id | Unit | `npx vitest run src/__tests__/agenda/calendar.test.ts` | ❌ W0 | ⬜ pending |
| 2-03-01 | 03 | 3 | CLINIC-06 | — | STATUS_COLORS contém os 9 status (D-13) | Unit | `npx vitest run src/__tests__/components/odontogram.test.ts` | ❌ W0 | ⬜ pending |
| 2-03-02 | 03 | 3 | CLINIC-06 | — | FDI numbers corretos no componente | Unit | `npx vitest run src/__tests__/components/odontogram.test.ts` | ❌ W0 | ⬜ pending |
| 2-04-01 | 04 | 4 | CLINIC-08 | T-2-07 | SHA-256 do PNG é determinístico | Unit | `npx vitest run src/__tests__/anamnesis/signature.test.ts` | ❌ W0 | ⬜ pending |
| 2-04-02 | 04 | 4 | CLINIC-08 | T-2-07 | Token anamnese expira e não pode ser reutilizado | Unit | `npx vitest run src/__tests__/anamnesis/signature.test.ts` | ❌ W0 | ⬜ pending |
| 2-04-03 | 04 | 4 | CLINIC-09 | — | /agendar marcado como rota pública no proxy.ts | Source assertion | `npx vitest run src/__tests__/proxy/rbac.test.ts` | ✅ linha 136 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/migrations/clinical.test.ts` — SQL content assertions: btree_gist extension, EXCLUDE USING GIST constraint, tooth_number CHECK (FDI), audit_table_changes triggers, is_anonymized/deleted_at fields
- [ ] `src/__tests__/actions/patients.test.ts` — encrypt/decrypt roundtrip para campos sensíveis, anonymize logic (full_name, cpf, phone, email)
- [ ] `src/__tests__/actions/medical-records.test.ts` — insert com dentist_id correto, query order cronológico multi-dentista
- [ ] `src/__tests__/components/odontogram.test.ts` — STATUS_COLORS com todos os 9 status do D-13, FDI numbers presentes no componente
- [ ] `src/__tests__/anamnesis/signature.test.ts` — SHA-256 determinism (mesmo PNG = mesmo hash), token expiry + single-use enforcement
- [ ] `src/__tests__/agenda/calendar.test.ts` — event filtering por dentistId, tenant isolation na query key do React Query

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| FullCalendar renderiza semanalmente com drag-and-drop | CLINIC-01 | UI interaction — browser required | Abrir /clinica/agenda, selecionar dentista, arrastar evento para novo horário |
| GIST constraint dispara com erro user-friendly | CLINIC-02 | Requer dois POSTs simultâneos ao banco | Criar agendamento, tentar criar segundo no mesmo slot, verificar mensagem de erro |
| Canvas de assinatura funciona em touch/mobile | CLINIC-08 | iOS Safari touch behavior | Testar em iPad/iPhone — assinar com dedo, verificar confirmação da assinatura |
| PDF do prontuário exibe caracteres BR corretamente | CLINIC-05 | Render PDF visual | Baixar PDF com paciente "João Ângelo" — verificar ã, ç, ê sem substituição por "?" |
| Fluxo público de anamnese completo | CLINIC-08 | Fluxo multi-página sem auth | Acessar /anamnese/[patient-id]/[token], preencher CFO, assinar, verificar imutabilidade |
| Agendamento público /agendar bloqueia slot imediatamente | CLINIC-09 | Requer Supabase live | Acessar link público, agendar, verificar slot bloqueado na agenda interna |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
