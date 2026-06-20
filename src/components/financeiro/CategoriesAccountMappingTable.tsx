'use client'
// src/components/financeiro/CategoriesAccountMappingTable.tsx
// FCAD-02: Category → Conta Contábil mapping table.
// Admin can select leaf accounts per category; non-admin sees read-only account name.
// T-14-21: updateCategoryAccount validates same-tenant + leaf + matching type in Server Action.
// UI-SPEC §"CategoriesAccountMappingTable": Categoria, Tipo, Conta Contábil, Status mapeamento.

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { updateCategoryAccount } from '@/actions/categories'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

// ─── Types ───────────────────────────────────────────────────────────────────

interface CategoryRow {
  id: string
  name: string
  type: string | null
  account_id: string | null
  account_name: string | null
  account_code: string | null
}

interface LeafAccount {
  id: string
  name: string
  code: string
  type: string
}

interface CategoriesAccountMappingTableProps {
  categories: CategoryRow[]
  leafAccounts: LeafAccount[]
  canEdit: boolean
}

// ─── CategoriesAccountMappingTable ───────────────────────────────────────────

export function CategoriesAccountMappingTable({
  categories,
  leafAccounts,
  canEdit,
}: CategoriesAccountMappingTableProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const unmappedCount = categories.filter((c) => !c.account_id).length

  function handleAccountChange(categoryId: string, accountId: string | null) {
    startTransition(async () => {
      const resolved = !accountId || accountId === 'none' ? null : accountId
      await updateCategoryAccount({ categoryId, accountId: resolved })
      router.refresh()
    })
  }

  return (
    <div>
      {/* Amber badge when any categories are unmapped */}
      {unmappedCount > 0 && (
        <div className="px-4 py-3 border-b border-border">
          <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-sm font-medium px-2.5 py-0.5">
            {unmappedCount} {unmappedCount === 1 ? 'categoria sem conta mapeada' : 'categorias sem conta mapeada'}
          </span>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Categoria</TableHead>
            <TableHead className="w-[80px]">Tipo</TableHead>
            <TableHead>Conta Contábil</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="h-24 text-center text-sm text-muted-foreground">
                Nenhuma categoria cadastrada.
              </TableCell>
            </TableRow>
          ) : (
            categories.map((cat) => {
              // Filter leaf accounts to match the category's type
              const compatibleAccounts = leafAccounts.filter(
                (acc) => acc.type === cat.type
              )

              return (
                <TableRow key={cat.id} aria-busy={isPending}>
                  {/* Categoria */}
                  <TableCell className="text-sm font-normal">{cat.name}</TableCell>

                  {/* Tipo badge */}
                  <TableCell>
                    {cat.type === 'receita' ? (
                      <Badge variant="outline" className="text-green-700 dark:text-green-400 border-green-300">
                        Receita
                      </Badge>
                    ) : cat.type === 'despesa' ? (
                      <Badge variant="outline" className="text-red-600 dark:text-red-400 border-red-300">
                        Despesa
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        —
                      </Badge>
                    )}
                  </TableCell>

                  {/* Conta Contábil — Select for admin, static text for non-admin */}
                  <TableCell>
                    {canEdit ? (
                      <Select
                        value={cat.account_id ?? 'none'}
                        onValueChange={(v) => {
                          if (v === null) return
                          handleAccountChange(cat.id, v)
                        }}
                        disabled={isPending}
                      >
                        <SelectTrigger className="w-full max-w-xs">
                          <SelectValue placeholder="Selecione a conta contábil" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sem conta mapeada</SelectItem>
                          {compatibleAccounts.map((acc) => (
                            <SelectItem key={acc.id} value={acc.id}>
                              {acc.code} — {acc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {cat.account_name
                          ? `${cat.account_code ? cat.account_code + ' — ' : ''}${cat.account_name}`
                          : '—'}
                      </span>
                    )}
                  </TableCell>

                  {/* Status mapeamento badge */}
                  <TableCell>
                    {cat.account_id ? (
                      <span className="inline-flex items-center rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs font-medium px-2.5 py-0.5">
                        Mapeada
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-xs font-medium px-2.5 py-0.5">
                        Sem conta
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
