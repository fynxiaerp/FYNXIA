# Phase 10: IA Governada (L0–L4) + Auditoria + OCR - Context

**Gathered:** 2026-06-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Fechar o Bloco A (Fundações) com três subsistemas de governança:
1. **IA Governada (AIG-01..03):** enforcement em runtime dos limites de autonomia (L0–L4 configurados na Fase 7), aprovação humana para ações sensíveis, e **log de decisão** de toda ação da IA.
2. **Auditoria & Estornos (AUD-01..03):** tela dedicada sobre o `audit_logs` (do v1) para consultar quem/quando/antes-depois; **estorno** genérico com motivo + **aprovação por alçada**.
3. **OCR (OCR-01..02):** ler documento (imagem/PDF) e preencher cadastros automaticamente, com **revisão humana** quando a confiança for baixa.

**Fora do escopo:** novos agentes de IA de produto (consomem o framework depois); estorno específico de cada módulo financeiro (Fases 14-16 usam o primitivo); OCR ligado a cada formulário específico além do(s) cadastro(s) piloto.
</domain>

<decisions>
## Implementation Decisions

### IA Governada — enforcement (D-01)
- **Camada de política central `withAgentPolicy()`** que embrulha as ações de agentes/tools: antes de cada ação, lê o nível (`ai_agent_config`, Fase 7) + tetos/travas e **decide** executar / só sugerir / bloquear conforme L0–L4; ações **sensíveis** disparam aprovação humana (D-02); **toda decisão é registrada** num log (`ai_decision_log` — AIG-03: agent, ação, nível, decisão, motivo, ator).
- Embrulha o existente `src/lib/ai/tools.ts` (read-only tools) + `src/lib/agents/*` (confirmation/collection) — ponto único de governança; limites invioláveis no servidor.

### Aprovação humana — fila única (D-02)
- Tabela/inbox **genérica `approval_requests`** que serve **ambos** AIG-02 (ação sensível da IA) **e** AUD-02 (estorno por alçada): `type`, `payload jsonb`, `required_level/alçada`, `requested_by`, `approver`, `status` (pending/approved/rejected), `decided_at`, `reason`.
- Uma UI de inbox de aprovações; aprovar/rejeitar registra na trilha de auditoria. Alçada = papel/nível mínimo exigido para aprovar (RBAC da Fase 7).

### OCR (D-03)
- **Vercel AI Gateway multimodal** (modelo de visão) — reusa a infra de IA da Fase 5 (AI Gateway, **ZDR**, masking): upload de imagem/PDF → extração **estruturada** de campos + **confiança por campo**; abaixo do limite → **fila de revisão humana** (`ocr_extractions`) antes de gravar no cadastro. Sem nova dependência/serviço de OCR.
- Pluga em um cadastro piloto (provável: paciente — RG/comprovante). Validação humana confirma antes de persistir.

### Auditoria & Estorno (D-04)
- **Tela dedicada** (Conformidade › Auditoria) que consulta o `audit_logs` existente por **entidade / usuário / período** com **antes/depois** (AUD-01/03).
- **Estorno** = ação **genérica** (motivo obrigatório + aprovação por alçada via a fila única D-02), registrada na trilha (AUD-02). O estorno concreto de cada entidade financeira é ligado nas fases que o consomem.
- Novo módulo RBAC `conformidade`/`auditoria` (auditor/dpo/gestão; read na trilha; estorno exige alçada).

### Claude's Discretion
- Estrutura/colunas/índices das migrations (`ai_decision_log`, `approval_requests`, `ocr_extractions`); RLS USING+WITH CHECK; index clinic_id.
- Forma exata de `withAgentPolicy()` (wrapper de função vs decorator das tools); o que conta como "ação sensível" por nível (regra configurável).
- Modelo multimodal específico via AI Gateway + schema de extração (zod) + threshold de confiança default.
- Qual cadastro piloto do OCR; mapeamento campos→formulário; UI de revisão.
- UI: inbox de aprovações, tela de auditoria (filtros/diff), tela de OCR (upload+revisão) — design system v1, @base-ui render-prop, tokens, pt-BR.
- **Possível split:** fase grande (3 subsistemas, 8 reqs) — o planner pode dividir em sub-fases (ex.: 10a IA+aprovação, 10b Auditoria+estorno, 10c OCR) se exceder o orçamento de plano.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spec & roadmap
- `.planning/MODULES-SPEC-v2.md` — Módulo 22 (IA Copiloto/Agentes: Nível de autonomia, Limite de ação, Log de decisão), Módulo 25 (Auditoria/Logs/Estornos: Evento/Autor/Antes-depois/Estorno por alçada), Módulo 23 (OCR: Documento/Campos extraídos/Confiança/Validação).
- `.planning/ROADMAP.md` §"Phase 10" — goal, success criteria.
- `.planning/REQUIREMENTS.md` — AIG-01..03, AUD-01..03, OCR-01..02.

### Código v1/Fases 5-9 a reutilizar
- `src/lib/ai/tools.ts` (read-only tools) + `src/lib/ai/masking.ts` (PII) + `src/app/api/copilot/route.ts` (AI Gateway streamText + ZDR pattern, Fase 5) — base do OCR e do wrap de tools.
- `src/lib/agents/{confirmation,collection}-agent.ts` — agentes a embrulhar com a política.
- `src/actions/ai-agent-config.ts` + tabela `ai_agent_config` (Fase 7) — fonte do nível L0–L4.
- `src/lib/audit.ts` + `audit_logs` (v1, imutável por RLS) — base da tela de auditoria + registro de estorno/aprovação.
- `src/proxy.ts` (MODULE_PERMISSIONS — add módulo conformidade/auditoria) + `src/lib/auth/guards.ts` (assertNotReadOnly + alçada).
- Padrão de config UI/rota das Fases 7-9 (PageHeader, tokens, @base-ui, RHF+Zod v3, pt-BR); RSC sem funções→client (nav-icons string-key).
- `CLAUDE.md` — AI Gateway (não @ai-sdk/anthropic direto), ZDR/masking p/ LGPD; RLS; 'use server' async; nodejs runtime; deploy push master E master:main; gen types temp-file guard.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **AI Gateway + AI SDK v6** (Fase 5, api/copilot) — multimodal OCR + tool wrapping.
- **lib/ai/tools + masking + lib/agents** — alvos do withAgentPolicy.
- **ai_agent_config (Fase 7)** — níveis L0–L4 já armazenados; esta fase só ENFORÇA.
- **audit_logs + audit.ts (v1)** — trilha existente; expor + registrar estorno/aprovação.
- **approval primitive é novo**, mas RBAC/alçada vem da Fase 7.
- **Config UI + módulos no proxy (Fases 7-9)** — padrão de tela e gating.

### Established Patterns
- RLS USING+WITH CHECK; index clinic_id; migrations + [BLOCKING] db push (gotcha re-auth Supabase: org kczvihafddupruvsrrsc / projeto jqjwyqlbbuqnrffdnlpp); gen types temp-file guard.
- 'use server' async-only; createAdminClient server-only; AI via Gateway (ZDR); masking de PII antes do modelo.
- RSC: sem funções/componentes server→client (string-key icons); deploy master + master:main.

### Integration Points
- Novas tabelas: `ai_decision_log`, `approval_requests`, `ocr_extractions` (+ RLS/índices/audit).
- Wrap em lib/ai/tools + lib/agents (governança); inbox de aprovações; tela de auditoria sobre audit_logs; fluxo OCR (upload→extrai→revisa→grava).
- Módulo `conformidade` no proxy; rotas sob Conformidade (auditoria) + onde o OCR pluga (cadastro piloto).
</code_context>

<specifics>
## Specific Ideas

- Governança de IA **inviolável no servidor** (não confiar no cliente) — diferencial de confiança do produto.
- **Uma fila de aprovação** para IA-sensível e estorno-por-alçada — primitivo reutilizável por todo o ERP.
- OCR **reusa a IA da Fase 5** (sem novo serviço) com revisão humana — reduz erro de digitação na recepção.
- Auditoria = **expor** o que o v1 já registra de forma imutável, com diff antes/depois.
</specifics>

<deferred>
## Deferred Ideas

- Estorno concreto por entidade financeira (Fases 14-16 consomem o primitivo).
- OCR ligado a todos os formulários (começar com 1 cadastro piloto).
- Novos agentes de IA de produto (consomem o framework de governança depois).
- Modelos de aprovação multi-etapa/escalonamento avançado.

### Reviewed Todos (not folded)
Nenhum todo pendente casou com a Fase 10.
</deferred>

---

*Phase: 10-ia-governada-l0-l4-auditoria-ocr*
*Context gathered: 2026-06-14*
