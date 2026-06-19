# Phase 13: Esterilização/CME & Laboratório de Prótese - Context

**Gathered:** 2026-06-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Fechar o Bloco B (Clínico) com dois controles operacionais:
1. **Esterilização/CME (CME-01..03):** registrar ciclos de esterilização (autoclave, parâmetros, indicador biológico, validade), com rastreabilidade **kit↔lote↔paciente** e **bloqueio de kit reprovado/vencido** no momento do uso.
2. **Laboratório de Prótese (LAB-01..02):** abrir **ordens de serviço protéticas** (tipo, laboratório, prazo, etapas de prova, status Enviado→prova→concluído) cujo **custo gera um lançamento financeiro** (despesa a pagar) vinculado à OS.

**Fora do escopo:** gestão completa de Contas a Pagar/conciliação/baixa (Fase 16 — aqui só o lançamento da despesa); rastreabilidade por kit individual (etiqueta/QR por unidade); integração com órgãos sanitários (ANVISA além do registro interno).
</domain>

<decisions>
## Implementation Decisions

### Modelo de esterilização (D-01) — CME-01
- **Autoclave REUSA a tabela `resources`** (Fase 11, tipo equipamento) — sem tabela de autoclave dedicada.
- Nova tabela **`sterilization_cycles`**: clinic_id (+ unit_id), `autoclave_id` FK→`resources`, parâmetros (temperatura, tempo, pressão), **indicador biológico** (resultado: pendente/aprovado/reprovado), data do ciclo, **validade** (data de expiração do material esterilizado), `status` (aprovado/reprovado/vencido), operador, deleted_at.

### Rastreabilidade & bloqueio do kit (D-02) — CME-02/03
- **Granularidade por LOTE: o ciclo É o lote.** Não há etiqueta/QR por kit individual.
- Registrar **uso de kit** vincula `sterilization_cycle` → appointment/paciente (rastreabilidade por lote — CME-03). Tabela de uso (ex: `kit_usages` ou coluna de vínculo) referenciando ciclo + appointment + patient.
- **Bloqueio (CME-02):** uma **Server Action de uso** REJEITA o vínculo se o ciclo não está `aprovado` OU está `vencido` (validade < hoje). Guard app-level (como o anti-conflito da agenda); o ciclo reprovado/vencido nunca pode ser usado.

### OS protética (D-03) — LAB-01
- Cadastro **`prosthetic_labs`** (laboratório fornecedor reutilizável: nome, contato, etc.).
- Tabela **`lab_orders`**: clinic_id (+ unit_id), `lab_id` FK→`prosthetic_labs`, patient_id, appointment_id?, tipo de prótese, prazo (data prevista), **etapas de prova**, `status` (enviado→prova→concluído), custo, deleted_at.

### Custo do lab → financeiro (D-04) — LAB-02
- Ao definir o custo da OS, **criar um lançamento em `financial_transactions`** (Fase 3) tipo **despesa / a pagar**, referenciando a `lab_order` (e o fornecedor/lab).
- Entrega LAB-02 de verdade agora; a **Fase 16** evolui a gestão (conciliação/baixa/contas a pagar completo) sobre esse lançamento.

### Claude's Discretion
- Estrutura/colunas/índices das migrations (indexar clinic_id + unit_id); enums de status (ciclo, OS); formato dos parâmetros (colunas vs jsonb); modelagem exata do vínculo de uso de kit (tabela própria vs coluna em appointment).
- Como o lançamento financeiro referencia a OS (FK/origin_type) e qual categoria financeira usar (reusar `financial_categories`).
- Layout das telas (registro de ciclo + indicador biológico, lista de lotes/validade, uso de kit no atendimento, cadastro de lab, OS protética com etapas/status), seguindo design system v1, @base-ui render-prop, tokens, RHF+Zod v3, pt-BR. Módulos no proxy (esterilizacao/protese sob `clinica` ou novos) + nav string-key.
- Reaproveitar `resources` (Fase 11), `financial_transactions`/`financial_categories` (Fase 3), audit trail (Fase 10) e o vínculo appointment/patient (Fase 2).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spec & roadmap
- `.planning/MODULES-SPEC-v2.md` — Módulo de Esterilização/CME (ciclo/parâmetros/indicador biológico/rastreabilidade/bloqueio) e Laboratório de Prótese (OS/etapas/status/custo→financeiro).
- `.planning/ROADMAP.md` §"Phase 13" — goal, success criteria, dependências.
- `.planning/REQUIREMENTS.md` — CME-01, CME-02, CME-03, LAB-01, LAB-02.

### Recursos / equipamento (Fase 11 — REUSAR)
- `supabase/migrations/20260617000300_resources.sql` — tabela `resources` (autoclave = tipo equipamento).
- `src/lib/scheduling/resources.ts` + `src/actions/resources.ts` — padrões de status/guards de recurso.

### Financeiro (Fase 3 — alvo do LAB-02)
- `supabase/migrations/20260606000100_financial_tables.sql` — `financial_transactions` + `financial_categories` (lançamento da despesa do lab).

### Prontuário / atendimento (Fase 2)
- `supabase/migrations/20260605000100_clinical_tables.sql` — `appointments` (vínculo kit↔paciente↔atendimento; GIST sagrado, NÃO tocar).
- `src/app/(dashboard)/clinica/pacientes/[id]/prontuario/*` — destino do registro de uso.

### Audit / rastreabilidade (Fase 10)
- `src/lib/audit.ts` (`logBusinessEvent`) — trilha de auditoria do uso de kit/ciclo.

### Convenções
- `CLAUDE.md` — RLS USING+WITH CHECK; index clinic_id; 'use server' async-only; nodejs; gen types temp-file guard; deploy master+master:main.
- Gotchas de deploy: re-login Supabase OAuth na conta FYNXIA (`jqjwyqlbbuqnrffdnlpp`) antes do db push (PAT restrito dá 403 no gen types).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`resources` (Fase 11)** — autoclave como equipamento agendável/cadastrável.
- **`financial_transactions`/`financial_categories` (Fase 3)** — lançamento da despesa do lab (LAB-02).
- **`appointments`/`patients` (Fase 2)** — vínculo kit↔paciente↔atendimento (CME-03).
- **audit trail (Fase 10)** — rastreabilidade de ciclo/uso.
- **Padrão de módulo no proxy + nav string-key (Fases 7-12)** — registrar esterilização/prótese.
- **Padrão de guard app-level (Fase 11 booking/recurso)** — reusar para o bloqueio de kit reprovado/vencido.

### Established Patterns
- RLS USING+WITH CHECK; index clinic_id (+ unit_id); migrations + [BLOCKING] db push único + gen types temp-file guard; 'use server' async-only; createAdminClient server-only; RSC string-key icons; deploy master+master:main.

### Integration Points
- Novas tabelas: `sterilization_cycles`, vínculo de uso de kit, `prosthetic_labs`, `lab_orders`. RLS/índices.
- Uso de kit ganha guard de bloqueio (ciclo aprovado + dentro da validade).
- OS protética cria lançamento em `financial_transactions` ao definir custo.
- Módulos esterilização/prótese no proxy + nav.
</code_context>

<specifics>
## Specific Ideas

- O ciclo é o lote — rastreabilidade por lote sem etiquetar kit a kit (atende o requisito com menos cadastro).
- Bloqueio de kit reprovado/vencido é guard server-side no momento do uso (segurança do paciente).
- Autoclave reusa `resources` — evita cadastro duplicado de equipamento.
- LAB-02 entrega de verdade lançando `financial_transactions` agora; Fase 16 evolui a gestão.

</specifics>

<deferred>
## Deferred Ideas

- Gestão completa de **Contas a Pagar / conciliação / baixa** (Fase 16) sobre o lançamento criado aqui.
- Rastreabilidade **por kit individual** (etiqueta/QR por unidade).
- Integração com órgãos sanitários / relatórios ANVISA além do registro interno.

### Reviewed Todos (not folded)
Nenhum todo pendente casou com a Fase 13.
</deferred>

---

*Phase: 13-esteriliza-o-cme-laborat-rio-de-pr-tese*
*Context gathered: 2026-06-19*
