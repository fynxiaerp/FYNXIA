# Phase 11: Profissionais & Recursos - Context

**Gathered:** 2026-06-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Abrir o Bloco B (Clínico) com dois cadastros que alimentam a agenda:
1. **Profissionais (PRO-01..03):** cadastro rico (CRO+UF, especialidades, vínculo, regras de comissão, **grade de disponibilidade**) que **gera/limita os horários** da agenda.
2. **Recursos & Sala de Espera (RES-01..03):** recursos físicos (sala/cadeira/equipamento) agendáveis; **manutenção/indisponível bloqueia o horário**; **painel de chamada (TV) + tempo de espera** em tempo real.

**Fora do escopo:** o cálculo concreto do repasse/comissão (Fase 16 — TRIB consome a regra armazenada aqui); novos fluxos de prontuário (já existem no v1); integração TISS de profissionais.
</domain>

<decisions>
## Implementation Decisions

### Profissionais (D-01)
- Tabela **`professionals`** (clinic_id, **user_id nullable** FK → users): CRO+UF, especialidades (multi), vínculo (CLT/PJ/autônomo), regras de **% comissão** (por profissional/serviço), unit_id (multiunidade Fase 7), ativo/deleted_at.
- **`professional_availability`**: grade semanal recorrente (dia_semana + janela início/fim) + **exceções** (folga/horário extra por data). 
- **Equipe(users)** continua sendo o ACESSO (login/role); **Profissionais** é o cadastro CLÍNICO rico. Dentista com login = professional vinculado ao seu user; colaborador sem login = professional com user_id null.
- **PRO-03 (comissão):** apenas ARMAZENA a regra aqui; o cálculo do repasse é a Fase 16 (TRIB).

### Disponibilidade → Agenda (D-02)
- Grade semanal + exceções; o **agendamento (agenda interna + link público do v1) valida contra a disponibilidade** do profissional — só oferece/aceita horários dentro das janelas. **Reusa** a agenda FullCalendar e o anti-double-booking (EXCLUDE GIST) do v1; adiciona a checagem de disponibilidade (e de recurso, D-03).

### Recursos (D-03)
- Tabela **`resources`** (clinic_id, unit_id, tipo sala/cadeira/equipamento, patrimônio/série, status ativo/manutenção, manutenção_prevista). Appointment ganha **reserva opcional de recurso** (resource_id ou tabela de junção se >1). Recurso em **manutenção/indisponível** é excluído da oferta e **barra o booking** (reusa o padrão anti-conflito da agenda).

### Sala de Espera (D-04)
- **Check-in no appointment:** status de presença (aguardando → chamado → em atendimento → finalizado) com **timestamps** (mede o tempo de espera). Recepção "chama" o paciente.
- **Painel /painel (modo TV):** página que mostra os chamados em **tempo real via Supabase Realtime** (já na stack) — paciente vê na TV. Atualização por evento (invalidate/subscribe).

### Claude's Discretion
- Estrutura/colunas/índices das migrations (sempre indexar clinic_id + unit_id); junção appointment↔resource (coluna única vs N:N); enums de tipo/vínculo/status.
- Formato exato da grade de disponibilidade (jsonb vs linhas); como a checagem de disponibilidade integra ao booking (Server Action de criação de appointment + link público).
- Mecanismo Realtime do painel (canal por clínica/unidade; o que a TV assina); layout do painel TV.
- UI: cadastro de profissional (com abas ficha/horários), cadastro de recursos, check-in na agenda/recepção, painel TV. Design system v1, @base-ui render-prop, tokens, RHF+Zod v3, pt-BR. Módulos no proxy (profissionais/recursos sob `clinica` ou novos) + nav (string-key icons).
- Reaproveitar o máximo da agenda v1; não reescrever o FullCalendar.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spec & roadmap
- `.planning/MODULES-SPEC-v2.md` — Módulo 2 (Profissionais: CRO+UF/Especialidades/Vínculo/% comissão/Disponibilidade→Agenda), Módulo 5 (Recursos e Sala de Espera: Tipo/Patrimônio/Status→bloqueia agenda/Manutenção/Painel TV/tempo de espera).
- `.planning/ROADMAP.md` §"Phase 11" — goal, success criteria.
- `.planning/REQUIREMENTS.md` — PRO-01..03, RES-01..03.

### Código v1/Fase 7 a reutilizar
- `supabase/migrations/20260605000100_clinical_tables.sql` (appointments + EXCLUDE GIST anti-double-booking) + `20260605000200_clinical_rls.sql` + `20260614000700_operational_unit_id.sql` (unit_id em appointments).
- `src/components/agenda/*` + `src/app/(dashboard)/clinica/agenda/*` (FullCalendar timeGridWeek por dentista — reusar, estender com disponibilidade/recurso) + a Server Action de criação de appointment + o link público `/agendar/[slug]` (getBookedSlots).
- `src/app/(dashboard)/clinica/equipe/*` + `public.users` (relação com professionals).
- Multiunidade `get_my_unit_ids()` (Fase 7) + `src/proxy.ts` (module-add pattern) + `src/lib/auth/guards.ts`.
- Supabase Realtime (stack) — padrão Realtime → invalidateQueries do CLAUDE.md (TanStack Query v5).
- Config/UI pattern das Fases 7-10 (PageHeader, tokens, @base-ui, nav-config/nav-icons string-key, RHF+Zod v3, pt-BR).
- `CLAUDE.md` — RLS USING+WITH CHECK; index clinic_id; 'use server' async; nodejs; deploy master+master:main; gen types temp-file guard.

[Sem ADRs dedicados.]
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **appointments + EXCLUDE GIST** (v1) — anti-conflito a reusar para disponibilidade + recurso.
- **Agenda FullCalendar + booking público** (v1) — estender, não reescrever.
- **users/equipe** — relação com professionals (user_id nullable).
- **unit_id + get_my_unit_ids (Fase 7)** — escopo por unidade.
- **Supabase Realtime** — painel TV.
- **Config UI + módulos no proxy (Fases 7-10)** — padrão de tela/gating.

### Established Patterns
- RLS USING+WITH CHECK; index clinic_id (+ unit_id); migrations + [BLOCKING] db push (gotcha re-auth Supabase: org kczvihafddupruvsrrsc / projeto jqjwyqlbbuqnrffdnlpp); gen types temp-file guard.
- 'use server' async-only; createAdminClient server-only; RSC sem funções→client (string-key icons); deploy master+master:main.
- Realtime → invalidateQueries (TanStack Query v5) — CLAUDE.md.

### Integration Points
- Novas tabelas: `professionals`, `professional_availability`, `resources` (+ appointment resource reservation + check-in status/timestamps). RLS/índices.
- Booking (agenda + link público) ganha checagem de disponibilidade + recurso.
- Painel /painel (TV) via Realtime.
- Módulos profissionais/recursos no proxy + nav.
</code_context>

<specifics>
## Specific Ideas

- Profissionais separado de users (cadastro clínico ≠ acesso) — cobre colaboradores sem login e prepara o repasse (Fase 16).
- Disponibilidade real gera a agenda — evita marcar fora do horário do dentista.
- Recurso bloqueia agenda — evita marcar com a cadeira em manutenção.
- Painel TV de chamada em tempo real — experiência de recepção/sala de espera.
</specifics>

<deferred>
## Deferred Ideas

- Cálculo concreto do repasse/comissão (Fase 16 — TRIB).
- Integração TISS/credenciamento de profissionais por convênio.
- Otimização avançada de agenda (sugestão de encaixe por IA).

### Reviewed Todos (not folded)
Nenhum todo pendente casou com a Fase 11.
</deferred>

---

*Phase: 11-profissionais-recursos*
*Context gathered: 2026-06-14*
