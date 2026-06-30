---
phase: quick-260629-uaz
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/financeiro/PayablesTable.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "CDP elementFromPoint retorna o <button> (não o <circle> do SVG) ao clicar no botão Ações"
    - "Comportamento funcional do dropdown é idêntico ao anterior"
  artifacts:
    - path: src/components/financeiro/PayablesTable.tsx
      provides: "MoreHorizontal com pointer-events-none em ambas as ocorrências"
      contains: 'pointer-events-none'
  key_links:
    - from: "DropdownMenuTrigger render prop <button>"
      to: "<MoreHorizontal> filho"
      via: "pointer-events-none no SVG icon"
      pattern: 'pointer-events-none'
---

<objective>
Adicionar `pointer-events-none` ao `<MoreHorizontal>` em PayablesTable.tsx para que eventos de pointer passem através do SVG e sejam capturados pelo `<button>` pai.

Purpose: CDP/Playwright usa `elementFromPoint` para clicar; sem `pointer-events-none`, o `<circle>` do SVG intercepta o evento e a automação falha ao localizar o botão Ações.

Output: `PayablesTable.tsx` com as 2 ocorrências de `<MoreHorizontal className="size-4" />` alteradas para `<MoreHorizontal className="size-4 pointer-events-none" />`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/components/financeiro/PayablesTable.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Adicionar pointer-events-none ao MoreHorizontal (ambas as ocorrências)</name>
  <files>src/components/financeiro/PayablesTable.tsx</files>
  <action>
    No arquivo `src/components/financeiro/PayablesTable.tsx`, localizar as 2 ocorrências de:

    ```tsx
    <MoreHorizontal className="size-4" />
    ```

    E substituir ambas por:

    ```tsx
    <MoreHorizontal className="size-4 pointer-events-none" />
    ```

    Ocorrência 1 — linha ~228, dentro do branch `if (!canWrite)`:
    ```tsx
    <DropdownMenuTrigger
      render={<button type="button" className="flex size-8 items-center justify-center rounded-md hover:bg-accent" aria-label="Ações" />}
    >
      <MoreHorizontal className="size-4 pointer-events-none" />  {/* ← adicionar pointer-events-none */}
    </DropdownMenuTrigger>
    ```

    Ocorrência 2 — linha ~252, no branch principal do componente `PayableRowActions`:
    ```tsx
    <DropdownMenuTrigger
      render={<button type="button" className="flex size-8 items-center justify-center rounded-md hover:bg-accent" aria-label="Ações" />}
    >
      <MoreHorizontal className="size-4 pointer-events-none" />  {/* ← adicionar pointer-events-none */}
    </DropdownMenuTrigger>
    ```

    Nenhuma outra mudança. Não alterar lógica, estrutura, props ou outros estilos.
  </action>
  <verify>
    Após a edição, confirmar:
    1. `grep -n "MoreHorizontal" src/components/financeiro/PayablesTable.tsx` — todas as linhas devem conter `pointer-events-none`
    2. `npm run build` ou `npx tsc --noEmit` passa sem erros (a mudança é apenas de className string, sem impacto de tipos)
  </verify>
  <done>
    Ambas as ocorrências de `MoreHorizontal` em PayablesTable.tsx têm `className="size-4 pointer-events-none"`. Build/tsc sem erros.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| UI → DOM | Mudança puramente de CSS; sem novos dados, APIs ou fluxos de auth |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-uaz-01 | Tampering | PayablesTable.tsx className | accept | pointer-events-none é atributo CSS decorativo; não altera lógica de acesso ou dados |
</threat_model>

<verification>
Verificar que `grep -c "pointer-events-none" src/components/financeiro/PayablesTable.tsx` retorna 2 (exatamente as duas ocorrências adicionadas).
</verification>

<success_criteria>
- As 2 ocorrências de `<MoreHorizontal>` têm `pointer-events-none` na className
- Build TypeScript limpo (sem erros novos)
- Comportamento visual e funcional do dropdown inalterado
</success_criteria>

<output>
Após conclusão, criar `.planning/quick/260629-uaz-adicionar-pointer-events-none-ao-morehor/260629-uaz-SUMMARY.md` com o que foi alterado e commit efetuado.
</output>
