---
phase: 17
slug: estoque-materiais
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-11
---

# Phase 17 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Verified from artifacts (State B) by gsd-security-auditor — 25/25 threats closed, no high-severity gaps.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| authenticated client → tabelas de estoque | RLS isola por `clinic_id`; escrita restrita por role (`admin`/`superadmin`) | Produtos, lotes, entradas, templates (tenant data) |
| cron/agent (service role) → stock_draws / stock_alerts | Sem política de escrita para `authenticated`; escrita só via `createAdminClient` server-side | Baixas de estoque, alertas |
| Vercel Cron → /api/cron/estoque-validade | `Authorization: Bearer CRON_SECRET`, constant-time, fail-closed | — (trigger) |
| agente L2 (service role) → payables / approval_requests | Cria rascunho de CP + approval_request; nunca efetiva sem aprovação humana | Contas a pagar, pedidos de aprovação |
| client → /api/estoque/anvisa-pdf | Autenticação obrigatória (`getUser`); dados só da clínica do usuário sob RLS | Rastreabilidade ANVISA (lote + paciente) |
| client (ProntuarioForm) → listServices / listServiceMaterials / listProducts | `serviceId` escolhido no cliente; RLS tenant-scope filtra resultado | Catálogo de serviços, templates de material |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-17-01 | Tampering | productSchema | mitigate | `productSchema.superRefine` rejeita `implante` sem `numero_anvisa_produto` (`src/lib/validators/product.ts:78`) | closed |
| T-17-02 | Tampering | stockDrawSchema | mitigate | `motivo` = `z.enum(DRAW_MOTIVOS)`; valores fora da lista rejeitados no parse (`product.ts:176`) | closed |
| T-17-03 | Information Disclosure | leitura cross-tenant | mitigate | RLS `USING (clinic_id = get_my_tenant_id())` nas 6 tabelas (`20260703000300_estoque_rls.sql`) | closed |
| T-17-04 | Elevation of Privilege | escrita direta em stock_draws | mitigate | Sem política INSERT/UPDATE para `authenticated`; escrita só via `createAdminClient` (`stock-draws.ts:5,317,397`) | closed |
| T-17-05 | Tampering | payables.origem inválida | accept | CHECK de lista fechada incl. `estoque_agente` (`20260703000200_estoque_alters.sql:23`) | closed |
| T-17-06 | Elevation of Privilege | createProduct/createStockEntry por não-admin | mitigate | Gate `WRITER_ROLES=['admin','superadmin']` + RLS `admin_write` (`products.ts:45,90`; `stock-entries.ts:44,79`) | closed |
| T-17-07 | Injection | numero_lote / numero_anvisa | mitigate | Zod `.max()` + queries parametrizadas Supabase (sem concatenação SQL) | closed |
| T-17-08 | Tampering | drift de custo médio | mitigate | Guard `saldoAtual <= 0` + `toFixed(4)`; coluna `NUMERIC(12,4)` (`custo-medio.ts:20`) | closed |
| T-17-09 | Elevation of Privilege | agente cria CP sem aprovação | mitigate | `withAgentPolicy` L2 → `approval_requests` (`status:'pending'`) antes de efetivar; nunca auto-aprova (`stock-agent.ts:137`) | closed |
| T-17-10 | Spoofing | cron sem autorização | mitigate | `isCronAuthorized` fail-closed + `timingSafeEqual` antes de qualquer query (`cron-auth.ts:21`; route `:30`) | closed |
| T-17-11 | Tampering | ai_decision_log.clinic_id null | mitigate | `withAgentPolicy` per-row com `clinicId` real (`stock-agent.ts:135,139`) | closed |
| T-17-12 | Tampering | race condition FIFO de lotes | mitigate | CAS exato `.eq('saldo_disponivel', valorLido)` + re-seleção FIFO (`stock-draws.ts:120`); DB é o backstop atômico | closed |
| T-17-13 | Repudiation | baixa manual sem trilha | mitigate | `createManualDraw` grava `logBusinessEvent` com `motivo` (`stock-draws.ts:349`) | closed |
| T-17-14 | Denial of Service | falha de estoque bloqueia atendimento | mitigate | try/catch isola `drawMaterialsForProcedures` (D-09) (`appointments.ts:364`; `stock-draws.ts:220`) | closed |
| T-17-15 | Elevation of Privilege | botão de escrita visível a dentista/recep | mitigate | CTA condicionado a `canWrite` na UI; gate real `WRITER_ROLES` no Server Action (`produtos/page.tsx:24,86`; `ProductsTable.tsx:125`) | closed |
| T-17-16 | Information Disclosure | saldo de outra unidade | accept | `listProducts` filtra por `unit_id` do contexto; RLS por `clinic_id` (`products.ts:243`) | closed |
| T-17-17 | Repudiation | baixa manual sem confirmação | mitigate | Aviso de irreversibilidade + `logBusinessEvent` (`ManualDrawDialog.tsx:150`; `stock-draws.ts:349`) | closed |
| T-17-18 | Tampering | custo unitário mal formatado | mitigate | Máscara BRL string→number no submit; `NUMERIC(12,4)` (`StockEntryFormDialog.tsx:150`) | closed |
| T-17-19 | Information Disclosure | PDF vaza dados cross-tenant | mitigate | Rota autentica `getUser` (401 em falha) + `listAnvisaTraceability` sob RLS (`anvisa-pdf/route.ts:56`; `stock-draws.ts:503`) | closed |
| T-17-20 | Denial of Service | @react-pdf/renderer em Edge | mitigate | `export const runtime = 'nodejs'` explícito (`anvisa-pdf/route.ts:23`) | closed |
| T-17-21 | Elevation of Privilege | não-admin edita templates | mitigate | Gate `WRITER_ROLES` em `addServiceMaterial`/`removeServiceMaterial` (`service-material-templates.ts:54,124,170`) | closed |
| T-17-22 | Tampering | custo estimado manipulado no client | accept | Valor informativo (D-22); baixa real usa `custo_unitario_snapshot` server-side (`stock-draws.ts:236`) | closed |
| T-17-30 | Tampering | serviceId escolhido no cliente → listServiceMaterials | mitigate | RLS `service_material_templates` tenant-scope → serviceId cross-tenant retorna 0 linhas (`rls.sql:100`; `ProntuarioForm.tsx:64,195`) | closed |
| T-17-31 | Information Disclosure | lista de serviços no seletor | accept | `listServices` roda sob RLS tenant-scope; nomes de serviço não são PII (`services.ts:32,52`) | closed |
| T-17-32 | Tampering/Repudiation | custo de insumos exibido no prontuário | accept | Informativo apenas; baixa real server-side em `appointments.ts → drawMaterialsForProcedures`; sem write path novo | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-17-01 | T-17-05 | `payables.origem` é `TEXT` com CHECK de lista fechada (`manual,recorrente,lab,repasse,tributo,estoque_agente`); valor inválido é rejeitado pelo banco | Planner (17-02) | 2026-07-11 |
| AR-17-02 | T-17-16 | Saldo por unidade só é calculado quando `unitId` é fornecido; RLS por `clinic_id` impede leitura cross-tenant. Saldo intra-tenant entre unidades é aceitável no modelo atual | Planner (17-06) | 2026-07-11 |
| AR-17-03 | T-17-22 | Custo estimado no cliente é meramente informativo (D-22); a baixa real usa snapshot de custo calculado server-side a partir de `product_batches`/`products.custo_medio` | Planner (17-09) | 2026-07-11 |
| AR-17-04 | T-17-31 | `listServices` roda sob RLS tenant-scope de `services`; nomes de serviço não constituem PII | Planner (17-10) | 2026-07-11 |
| AR-17-05 | T-17-32 | Exibição de custo no prontuário é informativa; nenhum write path de estoque parte desta UI — a baixa ocorre server-side na conclusão do procedimento | Planner (17-10) | 2026-07-11 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-11 | 25 | 25 | 0 | gsd-security-auditor (ASVS L1, block_on: high) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-11
