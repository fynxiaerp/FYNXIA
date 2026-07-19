---
phase: quick-260719-goi
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/actions/appointments.ts
  - src/actions/public-booking.ts
autonomous: false
requirements: [BUGFIX-appointments-unit_id]
must_haves:
  truths:
    - "Criar consulta pelo fluxo interno autenticado (createAppointment) grava a linha sem erro NOT NULL em unit_id"
    - "Criar consulta pelo agendamento público (createPublicAppointment) grava a linha sem erro NOT NULL em unit_id"
    - "O unit_id gravado é o da unidade do profissional quando ela existe; senão a unidade padrão da clínica (is_default DESC)"
    - "Se a clínica não tiver nenhuma unidade cadastrada, o insert é evitado e retorna erro amigável (não erro cru de banco)"
  artifacts:
    - path: "src/actions/appointments.ts"
      provides: "createAppointment resolve e insere unit_id"
      contains: "unit_id"
    - path: "src/actions/public-booking.ts"
      provides: "createPublicAppointment resolve e insere unit_id"
      contains: "unit_id"
  key_links:
    - from: "src/actions/appointments.ts createAppointment"
      to: "appointments.insert"
      via: "campo unit_id: resolvedUnitId derivado de professional.unit_id ou unidade padrão"
      pattern: "unit_id"
    - from: "src/actions/public-booking.ts createPublicAppointment"
      to: "appointments.insert (admin client)"
      via: "campo unit_id: resolvedUnitId derivado de professional.unit_id ou unidade padrão"
      pattern: "unit_id"
---

<objective>
Corrigir bug CRÍTICO em produção: criar QUALQUER consulta falha com
`null value in column "unit_id" of relation "appointments" violates not-null constraint`.
Isso bloqueia 100% da criação de consultas (fluxo interno + agendamento público),
quebrando o core value da aplicação.

Root cause: `appointments.unit_id` virou NOT NULL na Fase 7 (SYS-05), mas os dois
únicos INSERTs em `appointments` (`createAppointment` e `createPublicAppointment`)
nunca passaram a preencher esse campo.

Fix: replicar o padrão já resolvido em `src/actions/leads.ts` (D-246,
`resolveDefaultUnitId`), com a melhoria de preferir a unidade do PROFISSIONAL
quando disponível (mais preciso que "unidade padrão da clínica"), caindo para a
unidade padrão só quando não houver professional ou `professional.unit_id` for null.

Purpose: desbloquear a criação de consultas em produção — item de maior severidade.
Output: dois arquivos corrigidos; um insert de consulta que efetivamente grava no banco.
</objective>

<context>
@.planning/STATE.md
@./CLAUDE.md

<interfaces>
<!-- Padrão de referência JÁ EXISTENTE em src/actions/leads.ts (linhas 65-84) -->
<!-- D-246: leads.unit_id NOT NULL sem selector client-facing → resolver unidade padrão -->

```typescript
async function resolveDefaultUnitId(
  supabase: SupabaseClient,
  clinicId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('units')
    .select('id')
    .eq('clinic_id', clinicId)
    .is('deleted_at', null)
    .order('is_default', { ascending: false })
    .order('name')
    .limit(1)
    .maybeSingle()

  return data?.id ?? null
}
```

<!-- appointments.ts createAppointment: já resolve `actor.tenant_id` (= clinic_id)     -->
<!-- e já faz query em `professionals` (linha ~72) SELECT 'id' WHERE user_id=dentist_id  -->
<!-- + clinic_id=actor.tenant_id. Insert em linha ~136-148 (usa createClient / RLS).     -->

<!-- public-booking.ts createPublicAppointment: resolve `clinic.id` por slug;            -->
<!-- já faz query em `professionals` (linha ~162) SELECT 'id' WHERE user_id=dentist_id   -->
<!-- + clinic_id=clinic.id. Insert em linha ~205-216 (usa createAdminClient / service).  -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Resolver e inserir unit_id em createAppointment (fluxo interno)</name>
  <files>src/actions/appointments.ts</files>
  <action>
Em `src/actions/appointments.ts`, dentro de `createAppointment`:

1. Na query existente de `professional` (linha ~72-78), trocar `.select('id')`
   por `.select('id, unit_id')`.

2. Adicionar um helper local `resolveAppointmentUnitId(supabase, clinicId, professionalUnitId)`
   (perto do topo do arquivo, ou logo antes de `createAppointment`) que:
   - Se `professionalUnitId` (string) existe → retorna ele diretamente.
   - Senão → executa a MESMA query de `resolveDefaultUnitId` de leads.ts:
     `.from('units').select('id').eq('clinic_id', clinicId).is('deleted_at', null)
      .order('is_default', { ascending: false }).order('name').limit(1).maybeSingle()`
     e retorna `data?.id ?? null`.
   Assinatura: `(supabase, clinicId: string, professionalUnitId: string | null): Promise<string | null>`.
   Tipar o `supabase` client localmente (ex.: `type SupabaseClient = Awaited<ReturnType<typeof createClient>>`)
   como feito em leads.ts — NÃO criar arquivo compartilhado novo (CLAUDE.md: evitar abstrações além do necessário).

3. Após a resolução do professional e ANTES do bloco de insert (linha ~136), chamar:
   `const resolvedUnitId = await resolveAppointmentUnitId(supabase, actor.tenant_id, professional?.unit_id ?? null)`.
   (o `professional` pode ser undefined quando não há linha — usar `professional?.unit_id ?? null`).

4. Guard: se `resolvedUnitId` for `null` (nenhuma unidade cadastrada — cenário anômalo),
   retornar `{ success: false, error: 'Nenhuma unidade cadastrada para esta clínica.' }`
   ANTES do insert (evita repetir o erro cru de banco).

5. No `.insert({...})` (linha ~136-148), adicionar o campo `unit_id: resolvedUnitId`.

NÃO tocar em `updateAppointment` (só faz `.update()`), nem no schema Zod `appointmentSchema`
(`unit_id` é resolvido no servidor, não vem do client).
  </action>
  <verify>
    <automated>cd "c:/Users/ReinaldoLima/Desktop/Cowork/FYNXIA" && npx tsc --noEmit</automated>
  </verify>
  <done>
tsc limpo. `createAppointment` seleciona `professional.unit_id`, resolve
`resolvedUnitId` (professional.unit_id → senão unidade padrão da clínica), guarda
contra `null` com mensagem amigável, e inclui `unit_id: resolvedUnitId` no insert.
  </done>
</task>

<task type="auto">
  <name>Task 2: Resolver e inserir unit_id em createPublicAppointment (agendamento público)</name>
  <files>src/actions/public-booking.ts</files>
  <action>
Em `src/actions/public-booking.ts`, dentro de `createPublicAppointment`, aplicar o
MESMO padrão da Task 1, usando o `admin` client (createAdminClient / service role):

1. Na query existente de `professional` (linha ~162-168), trocar `.select('id')`
   por `.select('id, unit_id')`.

2. Adicionar um helper local `resolveAppointmentUnitId(admin, clinicId, professionalUnitId)`
   neste arquivo (cópia local aceitável — mesmo padrão que leads.ts já faz sua própria cópia;
   NÃO criar arquivo compartilhado). Tipar o client como
   `type AdminClient = ReturnType<typeof createAdminClient>`. Lógica idêntica:
   professionalUnitId presente → retorna; senão query em `units`
   (`clinic_id`, `deleted_at IS NULL`, `is_default DESC`, `name ASC`, limit 1, maybeSingle) → `data?.id ?? null`.

3. Após o bloco do professional e ANTES do insert (linha ~205), chamar:
   `const resolvedUnitId = await resolveAppointmentUnitId(admin, clinic.id, professional?.unit_id ?? null)`.

4. Guard: se `resolvedUnitId` for `null`, retornar
   `{ success: false, error: 'Nenhuma unidade cadastrada para esta clínica.' }` antes do insert.

5. No `.insert({...})` (linha ~207-216), adicionar `unit_id: resolvedUnitId`.

NÃO modificar o schema Zod `publicBookingSchema`.
  </action>
  <verify>
    <automated>cd "c:/Users/ReinaldoLima/Desktop/Cowork/FYNXIA" && npx tsc --noEmit && npx next build 2>&1 | tail -20</automated>
  </verify>
  <done>
tsc + build limpos. `createPublicAppointment` seleciona `professional.unit_id`,
resolve `resolvedUnitId` via admin client, guarda contra `null`, e inclui
`unit_id: resolvedUnitId` no insert.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
Ambos os pontos de INSERT em `appointments` (fluxo interno autenticado e
agendamento público) agora resolvem e preenchem `unit_id`, corrigindo o erro
NOT NULL que bloqueava 100% da criação de consultas.
  </what-built>
  <how-to-verify>
CRÍTICO — este bug foi confirmado AO VIVO em produção; a verificação DEVE
confirmar que um insert de consulta EFETIVAMENTE grava no banco (não basta tsc/build):

1. Deploy/local rodando com a mesma base de dados (Supabase sa-east-1).
2. Fluxo interno: logar como staff, abrir /clinica/agenda, "Nova Consulta",
   escolher dentista + paciente + um horário DENTRO da disponibilidade cadastrada
   do profissional, salvar.
   - Esperado: consulta criada com sucesso (evento aparece no calendário).
   - NÃO deve aparecer o erro `null value in column "unit_id" ...`.
3. Confirmar no banco que a linha gravou com unit_id preenchido:
   `select id, unit_id, source from appointments order by created_at desc limit 1;`
   → `unit_id` NÃO deve ser null; `source='interno'`.
4. Fluxo público: abrir /agendar/[slug] da clínica, escolher dentista + slot
   disponível + preencher nome/telefone, confirmar.
   - Esperado: agendamento confirmado; nova linha com `source='publico'` e `unit_id` preenchido.
5. (Opcional, cenário do guard) Se houver forma de testar uma clínica sem unidade
   cadastrada, confirmar que retorna "Nenhuma unidade cadastrada para esta clínica."
   em vez do erro cru de banco.
  </how-to-verify>
  <resume-signal>Digite "aprovado" após confirmar que uma consulta interna E uma pública gravaram com unit_id não-null, ou descreva o problema encontrado.</resume-signal>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` limpo.
- `npx next build` limpo (Task 2 já falhou build antes por outros motivos — garantir verde aqui).
- Insert real de consulta (interno E público) grava linha com `unit_id` não-null (checkpoint).
- Query de professional passou a selecionar `unit_id` em ambos os arquivos.
- Nenhuma alteração em `updateAppointment` nem nos schemas Zod.
</verification>

<success_criteria>
- Criar consulta pelo fluxo interno grava sem erro NOT NULL em unit_id.
- Criar consulta pelo agendamento público grava sem erro NOT NULL em unit_id.
- unit_id gravado = unidade do profissional quando existe, senão unidade padrão da clínica.
- Clínica sem nenhuma unidade → erro amigável antes do insert.
</success_criteria>

<output>
Após conclusão, criar `.planning/quick/260719-goi-corrigir-bug-critico-createappointment-e/260719-goi-SUMMARY.md`
</output>
