'use client'

import { useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type ColumnFiltersState,
} from '@tanstack/react-table'
import { useQueryState } from 'nuqs'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

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
import { formatBRLSigned } from '@/lib/format/money'
import type { TransactionRow } from '@/actions/transactions'

// ─── TransactionList ──────────────────────────────────────────────────────────
// FIN-01: TanStack Table v8 — Data | Descrição | Categoria | Tipo | Valor.
// nuqs ?tipo + ?category client-side filters.

interface TransactionListProps {
  transactions: TransactionRow[]
  categories: { id: string; name: string; type: string | null }[]
}

export function TransactionList({ transactions, categories }: TransactionListProps) {
  const [tipoFilter, setTipoFilter] = useQueryState('tipo', { defaultValue: '' })
  const [categoryFilter, setCategoryFilter] = useQueryState('category', { defaultValue: '' })
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  // Apply nuqs-based filters on data before table
  const filtered = transactions.filter((t) => {
    if (tipoFilter && t.type !== tipoFilter) return false
    if (categoryFilter && t.category_id !== categoryFilter) return false
    return true
  })

  const columns: ColumnDef<TransactionRow>[] = [
    {
      accessorKey: 'transaction_date',
      header: 'Data',
      cell: ({ row }) => {
        const raw = row.getValue<string>('transaction_date')
        try {
          return (
            <span className="text-sm tabular-nums">
              {format(parseISO(raw), 'dd/MM/yyyy', { locale: ptBR })}
            </span>
          )
        } catch {
          return <span className="text-sm">{raw}</span>
        }
      },
    },
    {
      accessorKey: 'description',
      header: 'Descrição',
      cell: ({ row }) => {
        const desc = row.getValue<string | null>('description')
        return (
          <span className="text-sm">{desc ?? <span className="text-muted-foreground">—</span>}</span>
        )
      },
    },
    {
      accessorKey: 'category_name',
      header: 'Categoria',
      cell: ({ row }) => {
        const name = row.getValue<string | null>('category_name')
        return (
          <span className="text-sm text-muted-foreground">
            {name ?? '—'}
          </span>
        )
      },
    },
    {
      accessorKey: 'type',
      header: 'Tipo',
      cell: ({ row }) => {
        const type = row.getValue<string>('type')
        return (
          <span
            className={`text-sm font-medium capitalize ${
              type === 'receita' ? 'text-green-700' : 'text-red-600'
            }`}
          >
            {type === 'receita' ? 'Entrada' : 'Saída'}
          </span>
        )
      },
    },
    {
      accessorKey: 'amount',
      header: () => <span className="block text-right">Valor</span>,
      cell: ({ row }) => {
        const amount = row.getValue<number>('amount')
        const type = row.original.type
        const direction = type === 'receita' ? 'entrada' : 'saida'
        return (
          <span
            className={`block text-right text-sm font-semibold tabular-nums ${
              direction === 'entrada' ? 'text-green-700' : 'text-red-600'
            }`}
          >
            {formatBRLSigned(amount, direction)}
          </span>
        )
      },
    },
  ]

  const table = useReactTable({
    data: filtered,
    columns,
    state: { columnFilters },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select
          value={tipoFilter || 'todos'}
          onValueChange={(v) => setTipoFilter(v === 'todos' ? '' : v)}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Todos os tipos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="receita">Receitas</SelectItem>
            <SelectItem value="despesa">Despesas</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={categoryFilter || 'todas'}
          onValueChange={(v) => setCategoryFilter(v === 'todas' ? '' : v)}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todas as categorias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as categorias</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  Nenhum lançamento encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
