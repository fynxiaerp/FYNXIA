---
phase: quick-260719-kjy
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/actions/team.ts
  - src/components/team/EditMemberDialog.tsx
  - src/app/(dashboard)/clinica/equipe/page.tsx
autonomous: true
requirements: [QUICK-260719-kjy]
must_haves:
  truths:
    - "Admin vê a lista de membros ATIVOS (usuários já aceitos) da clínica em /clinica/equipe"
    - "Admin consegue abrir um diálogo e editar o full_name de um membro"
    - "Após salvar, a lista reflete o novo nome (sem reload manual)"
    - "Um admin NUNCA consegue editar um usuário de outro tenant (WR-02)"
  artifacts:
    - path: "src/actions/team.ts"
      provides: "Server Action updateTeamMemberName com role-gate + tenant-check + audit"
      contains: "updateTeamMemberName"
    - path: "src/components/team/EditMemberDialog.tsx"
      provides: "Client Component de edição de nome via Dialog"
      contains: "updateTeamMemberName"
    - path: "src/app/(dashboard)/clinica/equipe/page.tsx"
      provides: "Seção 'Membros da Equipe' com tabela + botão Editar (admin)"
      contains: "Membros da Equipe"
  key_links:
    - from: "src/components/team/EditMemberDialog.tsx"
      to: "src/actions/team.ts"
      via: "chamada updateTeamMemberName(userId, fullName)"
      pattern: "updateTeamMemberName\\("
    - from: "src/app/(dashboard)/clinica/equipe/page.tsx"
      to: "users (tenant-scoped)"
      via: "query .from('users').eq('tenant_id', tenantId)"
      pattern: "from\\('users'\\)"
---

<objective>
Adicionar à página `/clinica/equipe` uma listagem dos membros ATIVOS da equipe (usuários
já aceitos, não só convites pendentes) com capacidade de editar o `full_name`.

Purpose: Gap confirmado em produção — a página só mostra convite + convites pendentes, sem
nenhuma UI para ver ou corrigir usuários já ativos. Isso deixou 2 dentistas de teste com
`full_name` vazio, causando nomes em branco em vários Selects já corrigidos nesta sessão.

Output:
- `src/actions/team.ts` (novo) — Server Action `updateTeamMemberName`
- `src/components/team/EditMemberDialog.tsx` (novo Client Component)
- `src/app/(dashboard)/clinica/equipe/page.tsx` (editado) — nova seção "Membros da Equipe"

Escopo estrito: edição de `full_name` APENAS. NÃO adicionar edição de role, desativação de
usuário, nem qualquer outro campo.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md

# Arquivos-alvo e padrões a espelhar
@src/app/(dashboard)/clinica/equipe/page.tsx
@src/actions/invitations.ts
@src/actions/appointments.ts

<interfaces>
<!-- Padrões e contratos que o executor deve usar diretamente — sem explorar o codebase. -->

getActor local (copiar para team.ts — mesmo padrão de appointments.ts, NÃO importar):
```typescript
type Actor = { id: string; tenant_id: string; role: string }

async function getActor(): Promise<{ actor: Actor } | { error: string }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Não autenticado' }
  const { data: actor, error: actorError } = await supabase
    .from('users').select('id, tenant_id, role').eq('id', user.id).single()
  if (actorError || !actor) return { error: 'Usuário não encontrado' }
  return { actor }
}
```

logBusinessEvent (de @/lib/audit — 'server-only', não lança):
```typescript
logBusinessEvent(params: {
  tenantId: string
  actorId: string | null
  action: string
  details: Record<string, unknown>
}): Promise<void>
```

Dialog (base-ui via shadcn) — padrão controlado usado em AgendaCalendar.tsx:
```tsx
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
// <Dialog open={open} onOpenChange={setOpen}> ... <DialogContent> ... </DialogContent>
// erro: <Alert variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert>
```

Já EXISTE no page.tsx (reutilizar, não recriar):
- const `ROLE_LABELS: Record<string,string>` (admin/dentist/receptionist/patient/superadmin)
- const `isAdmin = userRole === 'admin' || userRole === 'superadmin'`
- componentes Table/TableHeader/TableBody/TableRow/TableHead/TableCell já importados
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Criar Server Action updateTeamMemberName</name>
  <files>src/actions/team.ts</files>
  <action>
Criar arquivo NOVO `src/actions/team.ts` com `'use server'` no topo. Imports:
`createClient` de `@/lib/supabase/server` e `logBusinessEvent` de `@/lib/audit`.

Copiar LOCALMENTE o helper `getActor` + type `Actor` (padrão de appointments.ts — NÃO
importar de outro arquivo; duplicação já aceita no projeto).

Exportar UMA única Server Action:
`export async function updateTeamMemberName(userId: string, fullName: string): Promise<{ success: boolean; error?: string }>`

Lógica, nesta ordem:
1. Resolver actor via getActor(). Se retornar `{ error }`, retornar `{ success: false, error }`.
2. Gate de role: `const allowedRoles = ['admin', 'superadmin']`. Se `!allowedRoles.includes(actor.role)`,
   retornar `{ success: false, error: 'Apenas administradores podem editar membros da equipe' }`.
3. Validar fullName: `const trimmed = (fullName ?? '').trim()`. Se `trimmed.length < 2`,
   retornar `{ success: false, error: 'Nome deve ter pelo menos 2 caracteres' }`.
   (Zod inline opcional — checagem simples é suficiente.)
4. WR-02 CRÍTICO — UPDATE com filtro por tenant_id, usando `.select('id')` para detectar
   linhas afetadas:
   ```typescript
   const supabase = await createClient()
   const { data: updated, error: updateError } = await supabase
     .from('users')
     .update({ full_name: trimmed })
     .eq('id', userId)
     .eq('tenant_id', actor.tenant_id) // WR-02: nunca confiar no id cru sem tenant check
     .select('id')
   if (updateError) return { success: false, error: updateError.message }
   if (!updated || updated.length === 0) {
     return { success: false, error: 'Membro não encontrado nesta clínica' }
   }
   ```
   (Nota: `.eq('id',...)` + `.eq('tenant_id',...)` juntos garantem que 0 linhas voltam se o
   usuário pertence a outro tenant — o filtro tenant_id no UPDATE é a defesa WR-02, não a RLS.)
5. `await logBusinessEvent({ tenantId: actor.tenant_id, actorId: actor.id, action: 'team_member.updated', details: { user_id: userId } })`.
6. Retornar `{ success: true }`.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <done>team.ts compila; updateTeamMemberName aplica role-gate, validação de nome, UPDATE filtrado por id AND tenant_id com detecção de 0 linhas, e chama logBusinessEvent com action 'team_member.updated'.</done>
</task>

<task type="auto">
  <name>Task 2: Criar EditMemberDialog (Client Component)</name>
  <files>src/components/team/EditMemberDialog.tsx</files>
  <action>
Criar arquivo NOVO `src/components/team/EditMemberDialog.tsx` com `'use client'` no topo.

Imports:
- `useState` de 'react'
- `useRouter` de 'next/navigation'
- `Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle` de '@/components/ui/dialog'
- `Button` de '@/components/ui/button'
- `Input` de '@/components/ui/input'
- `Alert, AlertDescription` de '@/components/ui/alert'
- `updateTeamMemberName` de '@/actions/team'

Props: `{ userId: string; currentName: string }`.

Estado local: `open` (boolean), `name` (string, init com `currentName`), `error` (string|null),
`isSubmitting` (boolean). `const router = useRouter()`.

Renderizar `<Dialog open={open} onOpenChange={setOpen}>`:
- `<DialogTrigger>` envolvendo/renderizando um `<Button variant="outline" size="sm">Editar</Button>`.
  IMPORTANTE: o Button do projeto é `@base-ui/react` e NÃO tem prop `asChild` — usar o padrão
  render-prop do DialogTrigger (D-222). Se der conflito de tipos, colocar o `<Button>` como child
  direto do `<DialogTrigger>` (base-ui aceita child interativo). Espelhar como AgendaCalendar.tsx
  usa triggers/botões; NÃO usar `asChild`.
- `<DialogContent>` com `<DialogHeader><DialogTitle>Editar membro</DialogTitle></DialogHeader>`,
  depois um bloco `space-y-4 py-2`:
  - Se `error`: `<Alert variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert>`
  - Um `<label>` "Nome completo" + `<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" />`
  - Um `<Button>` "Salvar" (disabled quando isSubmitting) com texto "Salvando…" quando isSubmitting.

Handler de salvar (async):
```typescript
setIsSubmitting(true); setError(null)
try {
  const result = await updateTeamMemberName(userId, name)
  if (result.success) { setOpen(false); router.refresh() }
  else { setError(result.error ?? 'Erro ao salvar') }
} finally { setIsSubmitting(false) }
```

Ao reabrir o dialog (open vira true) resetar `name` para `currentName` e `error` para null
(pode ser feito no onOpenChange: quando abre, resetar estado).
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <done>EditMemberDialog compila; botão Editar abre Dialog com Input pré-preenchido; Salvar chama updateTeamMemberName, fecha + router.refresh() em sucesso, mostra Alert destructive em erro, com estado Salvando….</done>
</task>

<task type="auto">
  <name>Task 3: Adicionar seção "Membros da Equipe" em equipe/page.tsx</name>
  <files>src/app/(dashboard)/clinica/equipe/page.tsx</files>
  <action>
Editar `src/app/(dashboard)/clinica/equipe/page.tsx`.

1. Import do novo componente no topo:
   `import { EditMemberDialog } from '@/components/team/EditMemberDialog'`

2. Resolver o tenant_id do actor autenticado (o header só dá o role, não o tenant). Após o
   `const supabase = await createClient()` já existente, adicionar:
   ```typescript
   const { data: { user } } = await supabase.auth.getUser()
   const { data: actor } = await supabase
     .from('users').select('tenant_id').eq('id', user?.id ?? '').single()
   const tenantId = actor?.tenant_id ?? null
   ```
   (Mesmo padrão de resolução de actor usado no domínio; guard para user ausente.)

3. Nova query de membros ativos (só se tenantId existir):
   ```typescript
   const { data: members } = tenantId
     ? await supabase
         .from('users')
         .select('id, full_name, email, role')
         .eq('tenant_id', tenantId)
         .order('full_name', { ascending: true })
     : { data: [] }
   ```

4. Adicionar uma nova `<section>` "Membros da Equipe" (ANTES da seção de "Convites pendentes"),
   espelhando EXATAMENTE o estilo visual da section existente: `bg-card rounded-xl border
   border-border`, header com `<h2 className="text-xl font-semibold font-display">Membros da
   Equipe</h2>` + subtítulo `<p className="text-sm text-muted-foreground mt-0.5">Usuários ativos
   desta clínica</p>`.
   - Se `!members || members.length === 0`: usar `<EmptyState icon={Users} title="Nenhum membro ativo" description="Convide membros para começar." />` no mesmo wrapper `px-6 py-8`.
   - Senão, `<Table>` com colunas: Nome, E-mail, Perfil e (só quando `isAdmin`) Ações. Espelhar
     as classes `px-6 text-sm font-semibold` nos `<TableHead>` e `px-6` nas células, igual à
     tabela de convites pendentes.
     - Nome: `member.full_name || '—'` (dado pode estar vazio — exatamente o caso que motivou este task).
     - E-mail: `member.email`.
     - Perfil: `ROLE_LABELS[member.role] ?? member.role`.
     - Ações (renderizar `<TableHead>` e `<TableCell>` desta coluna SOMENTE quando `isAdmin`):
       `<EditMemberDialog userId={member.id} currentName={member.full_name ?? ''} />`.

Manter a seção "Convites pendentes" intacta. NÃO alterar a InviteForm nem qualquer lógica de convite.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npx next build --no-lint 2>/dev/null || npx tsc --noEmit</automated>
  </verify>
  <done>Página compila; nova seção "Membros da Equipe" lista usuários ativos do tenant ordenados por nome; coluna Ações com botão Editar aparece só para admin; convites pendentes permanecem inalterados.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client → Server Action | userId/fullName vêm do cliente; não confiáveis |
| Server Action → DB (users) | UPDATE cross-tenant deve ser impossível |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-kjy-01 | Tampering/Elevation | updateTeamMemberName (userId cru) | mitigate | UPDATE filtrado por `.eq('tenant_id', actor.tenant_id)` (WR-02); 0 linhas afetadas → erro "Membro não encontrado nesta clínica" |
| T-kjy-02 | Elevation | updateTeamMemberName role-gate | mitigate | `allowedRoles = ['admin','superadmin']` checado antes de qualquer write |
| T-kjy-03 | Repudiation | edição de nome sem rastro | mitigate | logBusinessEvent action 'team_member.updated' com actorId + user_id |
| T-kjy-04 | Tampering | fullName inválido/vazio | mitigate | validação trim + mínimo 2 caracteres antes do UPDATE |
| T-kjy-05 | Information Disclosure | lista de membros de outro tenant | accept | query filtrada por tenantId resolvido do actor + RLS tenant-scoped em users |
</threat_model>

<verification>
- `npx tsc --noEmit` limpo após cada task.
- Build de produção limpo (page.tsx é Server Component; EditMemberDialog é 'use client').
- Confirmar que a section "Convites pendentes" e a InviteForm continuam funcionando.
- Confirmar (leitura de código) que o UPDATE em team.ts inclui `.eq('tenant_id', actor.tenant_id)` — WR-02 não-negociável.
</verification>

<success_criteria>
- Admin em /clinica/equipe vê a nova seção "Membros da Equipe" com Nome, E-mail, Perfil.
- Botão "Editar" (visível só para admin) abre Dialog com o nome atual pré-preenchido.
- Salvar um novo nome atualiza a lista sem reload manual (router.refresh()).
- Nome vazio (< 2 chars) é rejeitado com mensagem amigável.
- UPDATE nunca afeta usuário de outro tenant (filtro tenant_id no WHERE).
- Evento 'team_member.updated' registrado na trilha de auditoria.
- Escopo respeitado: nenhuma edição de role/desativação/outros campos.
</success_criteria>

<output>
After completion, create `.planning/quick/260719-kjy-adicionar-listagem-de-membros-ativos-da-/260719-kjy-SUMMARY.md`
</output>
