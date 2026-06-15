---
phase: 11-profissionais-recursos
verified: 2026-06-14T22:30:00Z
status: human_needed
score: 6/6 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Painel TV ao vivo — abrir /painel/[clinic-slug] em uma tela e disparar markArrived/callPatient no agendamento de outra sessão"
    expected: "A fila atualiza em até 15s (polling) com iniciais corretas e contador de minutos de espera crescente; nenhum nome completo/CPF aparece no DOM"
    why_human: "Realtime/polling ao vivo e ausência de PII no DOM só são confirmáveis com runtime + DB real e duas sessões simultâneas"
  - test: "Drag-to-reschedule na agenda FullCalendar para slot fora da disponibilidade do profissional e para slot com recurso em manutenção"
    expected: "Reschedule é rejeitado com mensagem 'Horário fora da disponibilidade...' / 'Recurso em manutenção...'; agendamento válido é aceito"
    why_human: "UX de drag-and-drop do FullCalendar e o feedback visual de erro não são verificáveis estaticamente"
  - test: "Cadastro de profissional (tabs CRO+UF, especialidades, vínculo, AvailabilityGrid, regras de comissão) e de recurso (status manutenção)"
    expected: "Formulários salvam; grade de disponibilidade passa a gerar horários na agenda; recurso em manutenção fica indisponível para reserva"
    why_human: "Renderização visual das abas/grade e fluxo end-to-end de cadastro → agenda exigem inspeção humana"
---

# Phase 11: Profissionais & Recursos Verification Report

**Phase Goal:** Abrir o Bloco B (Clínico) com dois cadastros que alimentam a agenda — (1) cadastro rico de Profissionais (CRO+UF, especialidades, vínculo, regras de comissão ARMAZENADAS, grade de disponibilidade semanal que governa a agenda) e (2) Recursos físicos (sala/cadeira/equipamento, status; manutenção bloqueia agendamento) + painel TV de sala de espera em tempo real com tempo de espera — tudo ESTENDENDO a agenda v1 sem quebrar o EXCLUDE GIST sagrado de appointments.

**Verified:** 2026-06-14T22:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                          | Status     | Evidence |
| --- | ---------------------------------------------------------------------------------------------- | ---------- | -------- |
| 1   | Admin cadastra profissional com CRO+UF, especialidades, vínculo e grade de disponibilidade     | ✓ VERIFIED | `professionals` migration + `professionalSchema` (cro/cro_uf/especialidades/vinculo) `professional.ts:108-124`; `ProfessionalForm.tsx` (540 ln) + `AvailabilityGrid.tsx` (279 ln); rota `/clinica/profissionais` no build |
| 2   | Grade de disponibilidade governa a agenda (interna + link público)                             | ✓ VERIFIED | `isSlotWithinAvailability` wired em `appointments.ts:94,262` (create/update) e `public-booking.ts:183,327` com early-return em falha |
| 3   | Regra de comissão (% por profissional/serviço) ARMAZENADA (sem cálculo — Phase 16)             | ✓ VERIFIED | `commission_rules` JSONB na migration; `commissionRulesSchema` discriminated union `professional.ts:31-43`; gravado em `professionals.ts:108,228`; nenhum cálculo presente |
| 4   | Recurso físico cadastrado (sala/cadeira/equipamento, patrimônio/série, status)                 | ✓ VERIFIED | `resources` migration; `resourceSchema` `resource.ts:18-33`; `ResourceForm.tsx` (300 ln); rota `/clinica/recursos` no build |
| 5   | Recurso em 'manutencao' bloqueia agendamento                                                   | ✓ VERIFIED | `isResourceAvailable` (só 'ativo' ⇒ true) `resources.ts:22-24`; guarda em `appointments.ts:114,285` + overlap app-level `appointments.ts:121-132` |
| 6   | Painel TV público de sala de espera em tempo real com tempo de espera                          | ✓ VERIFIED | `/painel/[clinic-slug]/page.tsx` (público, nodejs, iniciais server-side); `WaitingPanel.tsx` Realtime channel + polling 15s fallback; `waitingMinutes` `waiting.ts:36-45` |

**Score:** 6/6 truths verified (wiring presente; UX/runtime ao vivo → human_needed)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `supabase/migrations/20260617000100_professionals.sql` | professionals + availability(+exceptions) + RLS + backfill dentist | ✓ VERIFIED | user_id NULLABLE, CRO+UF, especialidades[], vinculo CHECK, commission_rules JSONB, soft delete, partial unique idx, backfill role='dentist' ON CONFLICT DO NOTHING |
| `supabase/migrations/20260617000300_resources.sql` | resources table | ✓ VERIFIED | tipo/status CHECK, patrimonio/numero_serie, manutencao_prevista, deleted_at, índices clinic_id/unit_id |
| `supabase/migrations/20260617000500_appointment_resource_checkin.sql` | resource_id + presence_status (SEPARADA) + 4 timestamps | ✓ VERIFIED | presence_status NÃO foi fundido em status; colunas nullable, sem backfill; nenhum DDL toca no_overlap/status (apenas comentário) |
| `supabase/migrations/20260617000600_appointments_realtime.sql` | publicação Realtime | ✓ VERIFIED | `ALTER PUBLICATION supabase_realtime ADD TABLE appointments` |
| `src/types/database.types.ts` | reflete novas tabelas/colunas | ✓ VERIFIED | professionals:, professional_availability:, resources:, appointments.presence_status/resource_id presentes (linhas 303-304, 2082, 2164, 2321) |
| `src/lib/scheduling/availability.ts` | isSlotWithinAvailability puro | ✓ VERIFIED | 155 ln, módulo puro |
| `src/lib/scheduling/resources.ts` | isResourceAvailable puro | ✓ VERIFIED | `status === 'ativo'`; manutencao/inativo/null ⇒ false |
| `src/lib/scheduling/waiting.ts` | waitingMinutes + PRESENCE_FLOW + transições | ✓ VERIFIED | 66 ln, máquina de estados one-step-forward |
| `src/lib/scheduling/panel.ts` | PanelRow (sem PII) + toInitials | ✓ VERIFIED | PanelRow sem full_name/cpf; toInitials server-side |
| `src/actions/checkin.ts` | markArrived/callPatient/startTreatment/finishTreatment/getPanelRows | ✓ VERIFIED | 280 ln; cada ação grava presence_status + timestamp; validação de transição |
| `src/actions/professionals.ts` | CRUD professionals (comissão armazenada) | ✓ VERIFIED | create/update/delete; commission_rules gravado |
| `src/actions/resources.ts` | CRUD resources | ✓ VERIFIED | create/update/delete |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `createAppointment` | availability | `isSlotWithinAvailability` | ✓ WIRED | `appointments.ts:94-101`, early-return em falha |
| `updateAppointment` | availability | `isSlotWithinAvailability` | ✓ WIRED | `appointments.ts:262-...` (cobre drag-reschedule) |
| `createPublicAppointment` | availability | `isSlotWithinAvailability` | ✓ WIRED | `public-booking.ts:183`, e gerador de slots públicos `:327` |
| `createAppointment`/`updateAppointment` | resource status | `isResourceAvailable` + overlap query | ✓ WIRED | `appointments.ts:114,285` + overlap app-level `:121-132` |
| `/painel page` | DB (tenant) | admin client por slug, iniciais server-side | ✓ WIRED | `page.tsx:33-100`; full_name nunca chega ao client |
| `WaitingPanel` | live updates | Realtime channel + polling 15s | ✓ WIRED | `WaitingPanel.tsx:71-109`; polling é o driver real sob anon RLS |
| `proxy.ts` | /painel público | `isPublicRoute` startsWith('/painel') | ✓ WIRED | `proxy.ts:138-143,155,170` |
| Sidebar nav | profissionais/recursos | nav-config | ✓ WIRED | `nav-config.ts:37-38` adminOnly |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `WaitingPanel` | `rows` | `getPanelRows` (admin client, query real em appointments+patients) | Sim — query DB tenant-isolada | ✓ FLOWING |
| `/painel page` | `initialRows` | query `appointments` join `patients` por tenant | Sim | ✓ FLOWING |
| `ProfessionalForm` | commission_rules / availability | server actions → DB | Sim — gravação real | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Migrações aplicadas no remoto | `npx supabase migration list --linked` | 20260617000100–000600 presentes em local E remoto | ✓ PASS |
| Typecheck | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Suíte de testes | `npx vitest run` | 62 files / 1040 testes passed | ✓ PASS |
| Testes alvo Phase 11 | `vitest run __tests__/professionals __tests__/resources` | 4 files / 75 passed | ✓ PASS |
| Build | `npx next build` | exit 0; rotas profissionais/recursos/painel emitidas | ✓ PASS |
| GIST/status intactos | grep DROP/ALTER em migrations | só comentários; no_overlap original em 20260605000100 intacto | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| PRO-01 | 11-02/11-06 | professionals (user_id NULLABLE, CRO+UF, especialidades, vínculo, commission jsonb) + backfill dentist | ✓ Full | migration + schema + ProfessionalForm/AvailabilityGrid + backfill ON CONFLICT |
| PRO-02 | 11-02/11-04 | availability(+exceptions); booking valida slot (interna + público) | ✓ Full | `isSlotWithinAvailability` em 4 call-sites (create/update/public/gerador-de-slots) |
| PRO-03 | 11-02/11-06 | regra de comissão ARMAZENADA (sem cálculo — Phase 16) | ✓ Full | commission_rules JSONB + discriminated union; gravado, sem cálculo |
| RES-01 | 11-03/11-07 | resources + cadastro UI | ✓ Full | migration + resourceSchema + ResourceForm |
| RES-02 | 11-03/11-04 | reserva de recurso; 'manutencao' bloqueia | ✓ Full | `isResourceAvailable` + overlap app-level nas ações internas |
| RES-03 | 11-03/11-08 | presence_status (coluna SEPARADA) + timestamps; waitingMinutes; /painel público Realtime; tenant-isolado iniciais-only | ✓ Full | coluna separada + 4 timestamps; check-in actions; /painel público + polling/Realtime; toInitials server-side |

Nenhum requirement órfão: todos os 6 IDs mapeados para Phase 11 em REQUIREMENTS.md aparecem nos plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `WaitingPanel.tsx` | 65-70 | Realtime channel não dispara sob anon RLS no painel público | ℹ️ Info | Mitigado por design: polling 15s é o driver real; canal mantido para views autenticadas. Documentado (WR-01). Não é stub. |
| Plan 11-05 | ROADMAP checkbox `[ ]` | db push marcado incompleto | ℹ️ Info | Bookkeeping desatualizado — `migration list --linked` confirma as 6 migrações aplicadas no remoto e types gerados. Sem impacto funcional. |
| `public-booking.ts` | — | sem guarda `isResourceAvailable` | ℹ️ Info | Intencional: agendamento público não seleciona recurso; reserva de recurso é fluxo interno. RES-02 satisfeito pelas ações internas. |

Nenhum blocker. Nenhum stub. Comissão é armazenada (não calculada) — correto para esta fase.

### Human Verification Required

1. **Painel TV ao vivo** — abrir `/painel/[clinic-slug]` e disparar check-in/chamada de outra sessão.
   - Esperado: fila atualiza em ≤15s, iniciais corretas, contador de minutos crescente, sem PII no DOM.
2. **Drag-to-reschedule** na agenda para slot fora da disponibilidade e para recurso em manutenção.
   - Esperado: reschedule rejeitado com mensagem; slot válido aceito.
3. **Cadastro visual** de profissional (abas + AvailabilityGrid + comissão) e de recurso (status manutenção).
   - Esperado: salva; grade gera horários na agenda; recurso em manutenção indisponível.

### Gaps Summary

Nenhum gap bloqueante. As 6 migrações estão aplicadas no banco remoto (confirmado via `migration list --linked`), os tipos refletem as novas tabelas/colunas, as guardas de disponibilidade e de recurso estão de fato cabeadas em `createAppointment`/`updateAppointment` e `createPublicAppointment`, o `/painel` é público, tenant-isolado e iniciais-only (sem full_name/cpf no client), e o EXCLUDE GIST `no_overlap` + o CHECK de status permanecem intactos (nenhum DDL os toca; apenas comentários de guarda). Os três gates automatizados passam (tsc 0, vitest 1040/1040, next build limpo). Os itens restantes são exclusivamente de UAT humano (Realtime ao vivo, UX de drag-reschedule, renderização dos formulários de cadastro) — aceitáveis conforme as instruções da fase, dado que os gates estão verdes e a fiação está presente.

---

_Verified: 2026-06-14T22:30:00Z_
_Verifier: Claude (gsd-verifier)_
