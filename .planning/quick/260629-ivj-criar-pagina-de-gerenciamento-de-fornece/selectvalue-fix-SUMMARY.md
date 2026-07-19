# SelectValue UUID Fix — Summary

**Commit:** `70347dc`
**Branch:** `master`
**Date:** 2026-06-29
**Build:** passed (TypeScript clean, 72 pages generated)

## Problema

`<SelectValue placeholder="..." />` sem children explícitos exibia o UUID interno do item selecionado quando os `SelectItem`s eram carregados dinamicamente. Isso ocorre porque o Radix UI `SelectValue` precisa de children explícitos para resolver o label quando o valor é um UUID.

## Fix aplicado

Padrão: passar o label como children explícito do `SelectValue`, fazendo lookup no array de opções pelo `id === field.value` (ou estado equivalente).

## Componentes corrigidos (10)

| # | Arquivo | Campo | Label exibido |
|---|---------|-------|---------------|
| 1 | `src/components/financeiro/BaixaDialog.tsx` | Conta Corrente | `bankAccounts.find(ba => ba.id === field.value)?.name` |
| 2 | `src/components/esterilizacao/KitUsageForm.tsx` | Ciclo | `cycles.find(c => c.id === field.value)?.cycle_number.toString()` |
| 3 | `src/components/esterilizacao/KitUsageForm.tsx` | Paciente | `patients.find(p => p.id === field.value)?.full_name` |
| 4 | `src/components/financeiro/CategoriesAccountMappingTable.tsx` | Conta Contábil | `` `${a.code} — ${a.name}` `` |
| 5 | `src/components/financeiro/ChargeForm.tsx` | Paciente | `` `${p.full_name} — ${p.cpf}` `` |
| 6 | `src/components/financeiro/ContaCorrenteSelector.tsx` | Conta | `bankAccounts.find(ba => ba.id === conta)?.name` (nuqs state) |
| 7 | `src/components/financeiro/CostCenterFormDialog.tsx` | Unidade | `units.find(u => u.id === field.value)?.name` |
| 8 | `src/components/esterilizacao/CycleForm.tsx` | Autoclave | `autoclaves.find(ac => ac.id === field.value)?.nome` |
| 9 | `src/components/resources/ResourceForm.tsx` | Unidade | `units.find(u => u.id === field.value)?.name` |
| 10 | `src/components/agenda/AgendaCalendar.tsx` | Dentista | `dentists.find(d => d.id === dentistId)?.full_name` (nuqs state) |
| 11 | `src/app/(dashboard)/clinica/financeiro/faturamento/glosas/GlosaListClient.tsx` | Operadora | `insurers.find(i => i.id === operadora)?.name` (fallback `'Todas'`) |

> Nota: o item 11 (GlosaListClient) foi incluído na contagem — o enunciado listava "10 componentes" mas fornecia 11 fixes; todos foram aplicados.

## Notas de implementação

- `ContaCorrenteSelector` usa `useQueryState('conta')` em vez de RHF — o fix usa `conta` (string do nuqs) como chave de lookup.
- `AgendaCalendar` usa `useQueryState('dentist')` — o fix usa `dentistId` e trata `'__all__'` como ausência de seleção.
- `GlosaListClient` usa `useQueryState('operadora')` — o fix exibe `'Todas'` quando `operadora` é vazio ou `'all'`.
- `CategoriesAccountMappingTable` usa `cat.account_id` (não `field.value`) pois não é RHF — o fix acessa `cat.account_id` diretamente.
- Build Next.js 16.2.7 (Turbopack) passou sem erros TypeScript após todos os fixes.
