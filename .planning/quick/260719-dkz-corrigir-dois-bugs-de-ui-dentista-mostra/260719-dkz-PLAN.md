---
phase: quick-260719-dkz
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/agenda/AgendaCalendar.tsx
  - src/components/professionals/ProfessionalForm.tsx
autonomous: true
requirements: [UAT-BUGFIX]
must_haves:
  truths:
    - "No diálogo Novo Agendamento, o Select de dentista mostra o NOME do dentista selecionado (nunca o UUID cru)"
    - "Ao clicar Salvar Alterações em Profissionais com um campo obrigatório inválido em aba oculta, o usuário VÊ o erro (alerta no topo + troca automática para a aba do primeiro erro)"
  artifacts:
    - path: "src/components/agenda/AgendaCalendar.tsx"
      provides: "SelectValue do NewAppointmentDialog com resolução de nome por UUID"
    - path: "src/components/professionals/ProfessionalForm.tsx"
      provides: "Feedback de validação visível independente da aba ativa (Tabs controlado + onInvalid)"
  key_links:
    - from: "NewAppointmentDialog SelectValue"
      to: "dentists.find(d => d.id === selectedDentistId)?.full_name"
      via: "children render do SelectValue"
      pattern: "dentists\\.find\\(d => d\\.id === selectedDentistId\\)"
    - from: "form.handleSubmit(onSubmit, onInvalid)"
      to: "setActiveTab + Alert de erros"
      via: "onInvalid handler mapeando errors → aba"
      pattern: "handleSubmit\\(onSubmit,"
---

<objective>
Corrigir dois bugs de UI independentes encontrados no UAT em produção.

Purpose: (A) o Select de dentista do diálogo Novo Agendamento exibe o UUID cru em vez do nome; (B) em Profissionais, clicar "Salvar Alterações" com um campo obrigatório inválido numa aba oculta falha silenciosamente — nenhum feedback visível e a mudança não é persistida.
Output: dois arquivos corrigidos; ambos os bugs deixam de reproduzir.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@src/components/agenda/AgendaCalendar.tsx
@src/components/professionals/ProfessionalForm.tsx
@src/lib/validators/professional.ts

<interfaces>
<!-- Padrão CORRETO já existente no MESMO arquivo (AgendaCalendar.tsx, filtro de dentista do topo, ~linha 382) -->
```tsx
<SelectValue placeholder="Selecionar dentista...">
  {dentistId && dentistId !== '__all__'
    ? (dentists.find(d => d.id === dentistId)?.full_name ?? 'Selecionar dentista...')
    : null}
</SelectValue>
```

<!-- ProfessionalForm: campos por aba (para mapear erro → aba) -->
Aba "ficha": full_name, cro, cro_uf, vinculo, unit_id, user_id, especialidades
Aba "horarios": AvailabilityGrid (estado fora do RHF — NÃO valida via Zod, nunca gera erro em form.formState.errors)
Aba "comissao": commission_rules

<!-- professionalSchema (Zod v3): full_name/cro/cro_uf obrigatórios; unit_id/user_id opcionais -->
<!-- Tabs atualmente usa defaultValue="ficha" (não-controlado) — precisa virar controlado para trocar de aba programaticamente -->
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Bug A — resolver nome do dentista no SelectValue do NewAppointmentDialog</name>
  <files>src/components/agenda/AgendaCalendar.tsx</files>
  <action>
No componente `NewAppointmentDialog` (dentro de AgendaCalendar.tsx, ~linha 197), o `<SelectValue placeholder="Selecionar dentista..." />` é auto-fechado e por isso o Select renderiza o `value` cru (o UUID) quando um dentista é selecionado.

Aplique o MESMO padrão já usado no Select de filtro do topo do calendário (~linha 382): passe children ao `<SelectValue>` que resolvem o UUID para o nome. Use `selectedDentistId` (estado local do dialog) e a prop `dentists`:

```tsx
<SelectValue placeholder="Selecionar dentista...">
  {selectedDentistId
    ? (dentists.find((d) => d.id === selectedDentistId)?.full_name ?? 'Selecionar dentista...')
    : null}
</SelectValue>
```

Preserve o placeholder quando nada estiver selecionado (children = `null` faz o SelectValue cair no placeholder). Não altere o `<Select>`, os `<SelectItem>`, nem a lógica de `onValueChange`/`handleCreate`.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <done>SelectValue do NewAppointmentDialog exibe o full_name do dentista selecionado; placeholder "Selecionar dentista..." aparece quando nada selecionado; tsc sem erros.</done>
</task>

<task type="auto">
  <name>Task 2: Bug B — tornar erros de validação visíveis independente da aba ativa em ProfessionalForm</name>
  <files>src/components/professionals/ProfessionalForm.tsx</files>
  <action>
Hoje `form.handleSubmit(onSubmit)` bloqueia o submit quando um campo obrigatório (ex.: `full_name` vazio em dado pré-existente) é inválido, mas o `FormMessage` só aparece na aba "Ficha", que fica oculta se o usuário está na aba "Horários". Resultado: clique em Salvar não faz nada visível e a mudança da aba Horários nunca persiste.

Corrija fazendo AS DUAS coisas (troca de aba + alerta):

1. **Tornar as Tabs controladas.** Adicione estado `const [activeTab, setActiveTab] = useState('ficha')` e troque `<Tabs defaultValue="ficha">` por `<Tabs value={activeTab} onValueChange={setActiveTab}>`. NÃO remova/renomeie os valores existentes das abas: 'ficha', 'horarios', 'comissao'.

2. **Adicionar handler onInvalid.** Defina um mapa campo→aba e labels pt-BR:
   ```ts
   const FIELD_TAB: Record<string, string> = {
     full_name: 'ficha', cro: 'ficha', cro_uf: 'ficha', vinculo: 'ficha',
     unit_id: 'ficha', user_id: 'ficha', especialidades: 'ficha',
     commission_rules: 'comissao',
   }
   const FIELD_LABEL: Record<string, string> = {
     full_name: 'Nome completo', cro: 'CRO', cro_uf: 'UF do CRO', vinculo: 'Vínculo',
     unit_id: 'Unidade', user_id: 'Login vinculado', especialidades: 'Especialidades',
     commission_rules: 'Regras de comissão',
   }
   ```
   Adicione um estado `const [validationErrors, setValidationErrors] = useState<string[]>([])`.
   Crie `onInvalid(errors)`: colete as chaves de `errors`, mapeie para labels via FIELD_LABEL (fallback para a própria chave), set em `validationErrors`; determine a aba do PRIMEIRO campo com erro via FIELD_TAB (fallback 'ficha') e chame `setActiveTab(...)`. Ordene pela ordem de aparição no formulário se possível, ou apenas use a primeira chave de `Object.keys(errors)`.

3. **Ligar o onInvalid ao submit:** troque `onSubmit={form.handleSubmit(onSubmit)}` por `onSubmit={form.handleSubmit(onSubmit, onInvalid)}`. Limpe `validationErrors` (set `[]`) no início de `onSubmit` (caminho de sucesso de validação) para não deixar alerta obsoleto.

4. **Renderizar o alerta.** Acima do `<Tabs>` (junto do bloco `serverError` existente, mesmo padrão de `<Alert variant="destructive">`), quando `validationErrors.length > 0`, renderize um Alert listando os campos inválidos, ex.: "Corrija os campos obrigatórios: Nome completo, CRO." Use `role="alert"` como no serverError.

Não altere `onSubmit`/actions, o schema Zod, nem a lógica de `availability` (fora do RHF). Mantenha o padrão @base-ui e design tokens.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <done>Ao submeter com full_name vazio estando na aba Horários: o form troca automaticamente para a aba "Ficha" E exibe um Alert no topo listando "Nome completo"; o FormMessage do campo fica visível. Com todos os campos válidos, o submit chama onSubmit normalmente e nenhum alerta de validação permanece. tsc sem erros.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passa (sem erros de tipo introduzidos).
- `npm run lint` sem novos erros nos dois arquivos (opcional, se rápido).
- Verificação manual sugerida no UAT: (A) abrir Novo Agendamento, selecionar dentista → nome aparece; (B) editar profissional com Nome completo vazio, ir para Horários, adicionar horário, Salvar → troca para Ficha + alerta visível.
</verification>

<success_criteria>
- Bug A: SelectValue do NewAppointmentDialog nunca exibe UUID cru.
- Bug B: qualquer erro de validação do RHF/Zod é visível ao usuário (troca de aba + alerta), independente da aba ativa no clique em Salvar.
- Nenhuma regressão de tipos (tsc limpo).
</success_criteria>

<output>
After completion, create `.planning/quick/260719-dkz-corrigir-dois-bugs-de-ui-dentista-mostra/260719-dkz-SUMMARY.md`
</output>
