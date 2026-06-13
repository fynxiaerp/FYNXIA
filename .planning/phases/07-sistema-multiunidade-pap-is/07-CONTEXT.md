# Phase 7: Sistema, Multiunidade & Papéis - Context

**Gathered:** 2026-06-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Estabelecer a **fundação de configuração e acesso** do v2: cadastro da empresa/rede + unidades (filiais), keystore seguro do Certificado ICP-Brasil, **RBAC granular por módulo** com os 6 papéis novos, e o armazenamento da config de **autonomia de IA (L0–L4) por agente**. Habilita o escopo multi-unidade em todo o sistema.

Cobre: SYS-01..05, ROLE-01..02.

**Fora do escopo (outras fases):** o motor de assinatura ICP em si (Fase 8 — Documentos); a aplicação/enforcement dos limites de IA L0–L4 em runtime (Fase 10); o hub de Integrações (Fase 9); telas de cada módulo operacional. Aqui é schema + config + RBAC + cadastro.
</domain>

<decisions>
## Implementation Decisions

### Multiunidade (D-01)
- **`clinics` passa a ser a REDE (tenant)**; cria-se a tabela **`units`** (filiais) com FK `clinic_id` e campos por filial (nome, CNPJ próprio, endereço, telefone, slug, ativo).
- Linhas **operacionais** (appointments, financial_*, futuros estoque/OS) ganham **`unit_id`** (FK `units`). Cadastros de rede (pacientes, profissionais, plano de contas) ficam no nível do tenant (`clinic_id`) e podem ser compartilhados/atribuídos a unidades conforme o módulo.
- **RLS preservada por `clinic_id`** (isolamento de tenant via `get_my_tenant_id()`); adiciona-se filtro **opcional por unidade** via novo helper `get_my_unit_id()` (ou `get_my_unit_ids()` para multi-unidade). SYS-05 (centro de custo / BI por unidade) consome `unit_id`.
- Toda clínica do v1 vira uma rede com **1 unidade default** na migração (zero quebra).

### Keystore do Certificado ICP-Brasil A1 (D-02)
- O arquivo **`.pfx` vai num bucket privado do Supabase Storage** (sem acesso público; políticas restritas a service role).
- A **senha do certificado é cifrada com AES-256** reutilizando o padrão e a `ENCRYPTION_KEY` do v1 (mesma lib usada para `medical_history`/`allergies`).
- **Assinatura roda server-side** (service role) — nunca expõe a chave privada ao cliente. Só **metadados** (titular, CNPJ, validade, thumbprint) ficam legíveis para a UI.
- **Nesta fase:** upload seguro + armazenamento + metadados + validação básica do certificado (validade/ível). O **uso para assinar** documentos é a Fase 8.

### RBAC granular (D-03)
- **Evoluir a matriz `ROLE_ROUTES`** (hoje role→prefixo de rota em `src/proxy.ts`) para uma **matriz role×módulo (allow/deny)**, server-side, mantendo `isPathAllowed()` + checagem por módulo. Mantém perfomance e simplicidade.
- **Adicionar os 6 papéis** ao enum de role: `dpo`, `auditor`, `socio`, `ti`, `implantacao`, `aluno` (além de admin/dentist/receptionist/patient/superadmin do v1).
- Permissões **por ação fina** (ex.: pode estornar vs só ver) ficam para depois, exceto onde um requisito específico já exige (ex.: read-only de Auditor/DPO/Sócio — ver D-04).
- Perfis 100% configuráveis pelo admin via tabela de permissões = **deferido** (avaliar quando houver demanda real; matriz cobre o v2).

### Papéis × Unidade (D-04)
- **Papéis de rede** (admin, superadmin, socio, auditor, dpo, ti) → enxergam **todas as unidades** da rede.
- **Papéis operacionais** (dentist, receptionist, aluno) → **restritos à(s) unidade(s) atribuída(s)** (atribuição via `users.unit_id` ou tabela `user_units` para multi-unidade).
- **auditor, dpo, socio são read-only** nos dados operacionais (sem mutação); gating no RBAC.
- O helper de unidade (`get_my_unit_ids()`) retorna "todas" para papéis de rede e a lista atribuída para operacionais.

### Config de Autonomia IA L0–L4 (D-05) — armazenamento
- Tabela **`ai_agent_config`** no escopo da rede: `(clinic_id, agent_key, autonomy_level L0–L4, enabled, limites jsonb, updated_by)`. Opcionalmente override por `unit_id`.
- **Nesta fase só o armazenamento + UI de configuração** (SYS-04). A **aplicação dos tetos/travas e aprovação humana** é a Fase 10 (AIG).

### Claude's Discretion
- Estrutura exata das migrations (ordem, nomes), nomes de colunas/constraints, índices (sempre indexar `unit_id` e `clinic_id`).
- Forma do helper de unidade (`get_my_unit_id` singular vs `get_my_unit_ids` array) — escolher conforme atribuição single/multi-unidade.
- UI das telas de configuração (empresa, unidades, perfis, certificado, agentes IA) dentro do design system v1 (PageHeader, tokens, @base-ui).
- Validação de CNPJ/regime tributário; máscaras; biblioteca de leitura do .pfx para extrair metadados/validade server-side.
- Se a atribuição usuário↔unidade é coluna única (`users.unit_id`) ou tabela N:N (`user_units`) — preferir N:N se houver caso de usuário em múltiplas filiais.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spec do produto
- `.planning/MODULES-SPEC-v2.md` — Módulo 1 (Configuração do Sistema: CNPJ/regime/ICP/perfil/nível IA), Módulo 21 (Documentos/Assinatura — consumidor do certificado), princípios transversais (multiunidade, IA L0–L4, RBAC).
- `.planning/ROADMAP.md` §"Phase 7" — goal, success criteria, depends-on, v1 reuse.
- `.planning/REQUIREMENTS.md` — SYS-01..05, ROLE-01..02 (texto dos requisitos).

### Código v1 a evoluir
- `src/proxy.ts` — `ROLE_ROUTES` + `isPathAllowed()` (ponto de evolução do RBAC; já corrigido para usar cliente request-scoped do `updateSession`).
- `src/lib/supabase/server.ts` + `src/lib/supabase/middleware.ts` — clientes; service role server-only.
- Migrations v1 de `clinics`/`users` + funções `get_my_tenant_id()` / `get_my_role()` SECURITY DEFINER (em `supabase/migrations/`) — base p/ `get_my_unit_id()` e expansão do enum de role.
- Lib de cripto AES-256 do v1 (`ENCRYPTION_KEY`, usada em dados de saúde) — reutilizar para a senha do .pfx.
- `src/types/database.types.ts` — regenerar após migrations.

[Sem ADRs dedicados — requisitos nas decisões acima + spec.]
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`clinics` + `users`** (Supabase, RLS) — base para virar rede + atribuição de unidade/papel.
- **`get_my_tenant_id()` / `get_my_role()`** SECURITY DEFINER — modelo para `get_my_unit_ids()`; sem Custom Access Token Hook (FREE plan).
- **`ROLE_ROUTES` / `isPathAllowed()`** em `src/proxy.ts` — evoluir para matriz role×módulo + novos papéis.
- **Cripto AES-256** (`ENCRYPTION_KEY`) — reutilizar para senha do certificado.
- **`audit_logs`** imutável — toda mudança de config/papel deve gerar trilha (já existe trigger pattern).
- **Supabase Storage** — bucket privado para o `.pfx`.
- **Design system v1** — PageHeader, tokens dual-theme, @base-ui (render-prop, sem asChild), RHF+Zod v3, nuqs/Zustand — para as telas de configuração.

### Established Patterns
- RLS com `USING` + `WITH CHECK`; indexar `clinic_id` (e agora `unit_id`).
- Clientes privilegiados `server-only`; `service role` nunca no cliente.
- Migrations versionadas em `supabase/migrations/` + `db push` ([BLOCKING] checkpoint — **gotcha de re-auth da CLI Supabase**: logar na org `kczvihafddupruvsrrsc` / projeto `jqjwyqlbbuqnrffdnlpp` antes do push).
- `'use server'` só exporta funções async; rodar `next build` (não só vitest/tsc).
- **Deploy:** push em `master` E `master:main` (Vercel publica produção do `main`).

### Integration Points
- `src/proxy.ts` (RBAC central) — todas as novas rotas de módulo passam por aqui.
- `users` table — ganha atribuição de unidade + suporte aos novos papéis.
- Novas tabelas: `units`, `ai_agent_config`, (provável) `user_units`, `permissions`/matriz, `certificates` (metadados).
- `get_my_unit_ids()` consumido por RLS de linhas operacionais em fases futuras (agenda, financeiro, estoque).
</code_context>

<specifics>
## Specific Ideas

- Multiunidade real (CNPJ por filial) porque o produto mira **redes/franquias** — BI/Dashboard de Franquias (protótipo já existe) depende de `unit_id`.
- Certificado ICP é **A1** (.pfx) — assinatura server-side; metadados expostos, segredo nunca no cliente.
- Autonomia IA **L0 (sugere) → L4 (executa)** por agente, com tetos/travas — config aqui, enforcement na Fase 10.
- Read-only forte para **Auditor/DPO/Sócio** — papéis de governança não mutam dados operacionais.
</specifics>

<deferred>
## Deferred Ideas

- **Tabela de permissões 100% configurável pelo admin** (role×módulo×ação editável na UI) — matriz estendida cobre o v2; promover se houver demanda.
- **Permissões por ação finas** (além de read-only/admin-only) — adicionar pontualmente quando um módulo exigir.
- **Enforcement dos limites de IA L0–L4 + aprovação humana** — Fase 10 (AIG).
- **Motor de assinatura ICP** (gerar/assinar documentos) — Fase 8 (DOC).
- **Hub de credenciais/integrações** — Fase 9 (INT).

### Reviewed Todos (not folded)
Nenhum todo pendente casou com a Fase 7.
</deferred>

---

*Phase: 07-sistema-multiunidade-pap-is*
*Context gathered: 2026-06-12*
