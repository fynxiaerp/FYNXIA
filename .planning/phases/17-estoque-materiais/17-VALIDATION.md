---
phase: 17
slug: estoque-materiais
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-03
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (já configurado no projeto) |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run src/__tests__/estoque/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/__tests__/estoque/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 17-01-01 | 01 | 1 | EST-01 | — | Zod rejeita implante sem numero_anvisa_produto | unit | `npx vitest run src/__tests__/estoque/stock-entries.test.ts` | ❌ Wave 0 | ⬜ pending |
| 17-01-02 | 01 | 1 | EST-01,02,03 | — | Stubs RED: stock-entries, stock-draws, stock-agent, cron-validade | unit | `npx vitest run src/__tests__/estoque/` | ❌ Wave 0 | ⬜ pending |
| 17-02-01 | 02 | 1 | EST-01,02,03 | T-17-01 | RLS clinic_id isola tenants em products/batches/entries/draws | build | `grep -r "get_my_tenant_id" supabase/migrations/ \| grep "17"` | ❌ Wave 0 | ⬜ pending |
| 17-02-02 | 02 | 1 | EST-01,02,03 | — | db push aplicado, database.types.ts atualizado | manual | `supabase db push` — task [BLOCKING] autônoma:não | N/A | ⬜ pending |
| 17-03-01 | 03 | 2 | EST-01 | — | Custo médio móvel correto (divisão por zero, primeiro lote) | unit | `npx vitest run src/__tests__/estoque/stock-entries.test.ts` | ❌ Wave 0 | ⬜ pending |
| 17-04-01 | 04 | 2 | EST-03 | T-17-03 | Agente retorna sentinel quando preferred_supplier_id ausente | unit | `npx vitest run src/__tests__/estoque/stock-agent.test.ts` | ❌ Wave 0 | ⬜ pending |
| 17-04-02 | 04 | 2 | EST-03 | — | Cron validade insere alerta corretamente (idempotente) | unit | `npx vitest run src/__tests__/estoque/cron-validade.test.ts` | ❌ Wave 0 | ⬜ pending |
| 17-05-01 | 05 | 3 | EST-02 | T-17-05 | FIFO seleciona lote mais antigo com saldo > 0 | unit | `npx vitest run src/__tests__/estoque/stock-draws.test.ts` | ❌ Wave 0 | ⬜ pending |
| 17-05-02 | 05 | 3 | EST-02 | T-17-05 | Baixa não bloqueia procedimento (saldo negativo permitido) | unit | `npx vitest run src/__tests__/estoque/stock-draws.test.ts` | ❌ Wave 0 | ⬜ pending |
| 17-06-01 | 06 | 4 | EST-01,03 | — | Build sem erros TypeScript | build | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 17-07-01 | 07 | 4 | EST-01 | — | Build sem erros TypeScript | build | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 17-08-01 | 08 | 4 | EST-03 | — | PDF route usa nodejs runtime, sem Grid | build | `grep -r "Grid" src/app/api/estoque/anvisa/ \| wc -l == 0` | ✅ | ⬜ pending |
| 17-09-01 | 09 | 4 | EST-02 | — | Build sem erros TypeScript | build | `npx tsc --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/estoque/stock-entries.test.ts` — testa custo médio móvel (edge cases: divisão por zero, primeiro lote) + Zod validation por categoria
- [ ] `src/__tests__/estoque/stock-draws.test.ts` — testa FIFO de lotes, saldo negativo, audit trail, hook não-bloqueante
- [ ] `src/__tests__/estoque/stock-agent.test.ts` — testa withAgentPolicy sentinel + criação de CP rascunho quando preferred_supplier_id ausente
- [ ] `src/__tests__/estoque/cron-validade.test.ts` — testa seleção de lotes próximos do vencimento (idempotência)
- [ ] `src/lib/validators/product.ts` — schema Zod v3 para produto + lote + entrada

*Criados em Plan 17-01 (RED) e ficam GREEN nos Plans 17-03/04/05.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dashboard de alertas exibe badges de mínimo/vencimento | EST-03 | UI visual | Navegar para /clinica/estoque com produto abaixo do mínimo |
| Export PDF relatório ANVISA com colunas corretas | EST-01 (rastreabilidade) | Geração de PDF | Criar implante + baixa + exportar PDF, verificar colunas lote/ANVISA/paciente |
| Seção "Materiais utilizados" no prontuário pré-preenchida | EST-02 | Integração UI full-stack | Criar procedimento com template configurado |
| Agente cria rascunho de CP no inbox de aprovações | EST-03 | Depende de dados L2 | Criar produto com preferred_supplier_id, baixar abaixo do mínimo, verificar approval_requests |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
