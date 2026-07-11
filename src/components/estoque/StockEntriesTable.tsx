'use client'

// StockEntriesTable — histórico de entradas de estoque com filtros nuqs (D-10).
// Pattern: TanStack Table v8 (sem filtragem client-side — os filtros de URL
// disparam um refetch RSC via entradas/page.tsx, que já aplica productId/from/to
// em listStockEntries). Mirrors ProductsTable.tsx / PayablesTable.tsx.

import { useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import { useQueryState } from 'nuqs'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarIcon, PackagePlus } from 'lucide-react'

import { formatBRL } from '@/lib/format/money'
import { cn } from '@/lib/utils'
import type { StockEntryRow } from '@/actions/stock-entries'

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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'

// ─── Types ────────────────────────────────────────────────────────────────────

type ProductOption = {
  id: string
  name: string
  category: 'insumo' | 'medicamento' | 'implante'
  unidade_medida: string
  custo_medio: number
  saldo: number
}

interface StockEntriesTableProps {
  entries: StockEntryRow[]
  products: ProductOption[]
}

// ─── Date filter popover (single date, reused for De / Até) ──────────────────

function DateFilterPopover({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              'flex h-9 items-center rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              !value && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 size-4" />
            {value ? format(new Date(value + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : label}
          </button>
        }
      />
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value ? new Date(value + 'T12:00:00') : undefined}
          onSelect={(date) => {
            if (date) {
              onChange(format(date, 'yyyy-MM-dd'))
              setOpen(false)
            }
          }}
          locale={ptBR}
        />
      </PopoverContent>
    </Popover>
  )
}

// ─── StockEntriesTable ─────────────────────────────────────────────────────────

export function StockEntriesTable({ entries, products }: StockEntriesTableProps) {
  const [produtoFilter, setProdutoFilter] = useQueryState('produto', { defaultValue: '' })
  const [fromFilter, setFromFilter] = useQueryState('from', { defaultValue: '' })
  const [toFilter, setToFilter] = useQueryState('to', { defaultValue: '' })

  const columns: ColumnDef<StockEntryRow>[] = [
    {
      id: 'data',
      header: 'Data',
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">
          {format(parseISO(row.original.created_at), 'dd/MM/yyyy', { locale: ptBR })}
        </span>
      ),
    },
    {
      id: 'produto',
      header: 'Produto',
      cell: ({ row }) => <span className="text-sm font-medium">{row.original.product_name}</span>,
    },
    {
      id: 'lote',
      header: 'Lote',
      cell: ({ row }) => (
        <span className="text-sm">{row.original.numero_lote ?? <span className="text-muted-foreground">—</span>}</span>
      ),
    },
    {
      id: 'validade',
      header: 'Validade',
      cell: ({ row }) => {
        const dv = row.original.data_validade
        return (
          <span className="text-sm tabular-nums">
            {dv ? format(parseISO(dv), 'dd/MM/yyyy', { locale: ptBR }) : <span className="text-muted-foreground">—</span>}
          </span>
        )
      },
    },
    {
      id: 'qtd',
      header: () => <span className="block text-right">Qtd Recebida</span>,
      cell: ({ row }) => {
        const product = products.find((p) => p.id === row.original.product_id)
        return (
          <span className="block text-right text-sm tabular-nums">
            {row.original.qtd} {product?.unidade_medida ?? ''}
          </span>
        )
      },
    },
    {
      id: 'custo_unitario',
      header: () => <span className="block text-right">Custo Unit.</span>,
      cell: ({ row }) => (
        <span className="block text-right text-sm tabular-nums">{formatBRL(row.original.custo_unitario)}</span>
      ),
    },
    {
      id: 'custo_medio_apos',
      header: () => <span className="block text-right">Custo Médio Após</span>,
      cell: ({ row }) => (
        <span className="block text-right text-sm tabular-nums">{formatBRL(row.original.custo_medio_apos)}</span>
      ),
    },
    {
      id: 'fornecedor',
      header: 'Fornecedor',
      cell: ({ row }) => (
        <span className="text-sm">{row.original.supplier_name ?? <span className="text-muted-foreground">—</span>}</span>
      ),
    },
    {
      id: 'registrado_por',
      header: 'Registrado por',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.created_by_name ?? '—'}
        </span>
      ),
    },
  ]

  const table = useReactTable({
    data: entries,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const hasFilters = produtoFilter || fromFilter || toFilter

  return (
    <div className="space-y-4">
      {/* Filtros — nuqs URL state, refetch RSC em entradas/page.tsx */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={produtoFilter || 'todos'}
          onValueChange={(v) => setProdutoFilter(v === 'todos' ? null : v)}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Todos os produtos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os produtos</SelectItem>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DateFilterPopover label="De" value={fromFilter} onChange={(v) => setFromFilter(v)} />
        <DateFilterPopover label="Até" value={toFilter} onChange={(v) => setToFilter(v)} />

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setProdutoFilter(null)
              setFromFilter(null)
              setToFilter(null)
            }}
            className="text-muted-foreground"
          >
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Tabela */}
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
                    <TableCell key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2 py-4">
                    <PackagePlus className="size-6 text-muted-foreground" />
                    Nenhuma entrada encontrada com os filtros aplicados.
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
