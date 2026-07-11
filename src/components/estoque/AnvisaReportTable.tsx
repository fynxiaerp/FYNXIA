'use client'

// AnvisaReportTable — relatório de rastreabilidade ANVISA de implantes com
// filtros nuqs (EST-03 / D-12/D-13). Pattern: TanStack Table v8 + nuqs URL
// state — mirrors ProductsTable.tsx / StockEntriesTable.tsx.
//
// Filtragem 100% client-side sobre o dataset completo retornado por
// listAnvisaTraceability() (já filtrado para category='implante' na própria
// Server Action) — mesmo padrão de ProductsTable.tsx, garante que a tabela
// reage instantaneamente às mudanças de filtro independentemente do modo
// shallow do nuqs (v2 default: shallow=true não dispara refetch RSC).
//
// AnvisaExportButton (também exportado deste arquivo) lê os mesmos filtros
// via useQueryState e monta o href de /api/estoque/anvisa-pdf em tempo real —
// vive como sibling da tabela (compartilham estado via URL, não via props).

import { useEffect, useMemo, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import { useQueryState } from 'nuqs'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarIcon, ClipboardList, FileDown } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { AnvisaRow } from '@/actions/stock-draws'
import { EmptyState } from '@/components/shell/EmptyState'

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
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

// ─── Date filter popover (single date, reused for De / Até) ──────────────────
// Verbatim pattern from StockEntriesTable.tsx.

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

// ─── Shared filter-key constants ───────────────────────────────────────────
// AnvisaReportTable e AnvisaExportButton leem as mesmas 5 chaves de URL —
// mantidas como useQueryState independentes (nuqs sincroniza via URL, não via
// props) para que o botão de export reflita o filtro atual mesmo sendo sibling.

function useAnvisaFilters() {
  const [produtoFilter, setProdutoFilter] = useQueryState('produto', { defaultValue: '' })
  const [loteFilter, setLoteFilter] = useQueryState('lote', { defaultValue: '' })
  const [pacienteFilter, setPacienteFilter] = useQueryState('paciente', { defaultValue: '' })
  const [fromFilter, setFromFilter] = useQueryState('from', { defaultValue: '' })
  const [toFilter, setToFilter] = useQueryState('to', { defaultValue: '' })

  return {
    produtoFilter,
    setProdutoFilter,
    loteFilter,
    setLoteFilter,
    pacienteFilter,
    setPacienteFilter,
    fromFilter,
    setFromFilter,
    toFilter,
    setToFilter,
  }
}

// ─── AnvisaExportButton ─────────────────────────────────────────────────────
// Botão secundário "Exportar PDF" — link para /api/estoque/anvisa-pdf com os
// filtros atuais (lidos via useQueryState, reativo a cada mudança de filtro).

export function AnvisaExportButton() {
  const { produtoFilter, loteFilter, pacienteFilter, fromFilter, toFilter } = useAnvisaFilters()

  const query = new URLSearchParams()
  if (produtoFilter) query.set('produto', produtoFilter)
  if (loteFilter) query.set('lote', loteFilter)
  if (pacienteFilter) query.set('paciente', pacienteFilter)
  if (fromFilter) query.set('from', fromFilter)
  if (toFilter) query.set('to', toFilter)

  const href = `/api/estoque/anvisa-pdf${query.toString() ? `?${query.toString()}` : ''}`

  return (
    <Button
      variant="outline"
      size="sm"
      render={<a href={href} target="_blank" rel="noopener noreferrer" />}
    >
      <FileDown className="size-4" />
      Exportar PDF
    </Button>
  )
}

// ─── AnvisaReportTable ───────────────────────────────────────────────────────

interface AnvisaReportTableProps {
  rows: AnvisaRow[]
}

export function AnvisaReportTable({ rows }: AnvisaReportTableProps) {
  const {
    produtoFilter,
    setProdutoFilter,
    loteFilter,
    setLoteFilter,
    pacienteFilter,
    setPacienteFilter,
    fromFilter,
    setFromFilter,
    toFilter,
    setToFilter,
  } = useAnvisaFilters()

  // Inputs de texto debounced (300ms) — UI-SPEC §Filtros, mirrors ProductsTable.tsx
  const [loteInput, setLoteInput] = useState(loteFilter)
  const [pacienteInput, setPacienteInput] = useState(pacienteFilter)

  useEffect(() => {
    const handle = setTimeout(() => {
      if (loteInput !== loteFilter) setLoteFilter(loteInput || null)
    }, 300)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loteInput])

  useEffect(() => {
    const handle = setTimeout(() => {
      if (pacienteInput !== pacienteFilter) setPacienteFilter(pacienteInput || null)
    }, 300)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteInput])

  // Opções de produto derivadas do próprio dataset — listAnvisaTraceability já
  // filtra category='implante' na Server Action (D-12), então não é preciso
  // uma segunda chamada a listProducts para popular o Select.
  const produtoOptions = useMemo(() => {
    const names = new Set(rows.map((r) => r.produto).filter(Boolean))
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [rows])

  const filtered = rows.filter((r) => {
    if (produtoFilter && produtoFilter !== 'todos' && r.produto !== produtoFilter) return false
    if (loteFilter && !(r.numero_lote ?? '').toLowerCase().includes(loteFilter.toLowerCase())) return false
    if (pacienteFilter && !r.paciente.toLowerCase().includes(pacienteFilter.toLowerCase())) return false
    if (fromFilter && new Date(r.data) < new Date(`${fromFilter}T00:00:00`)) return false
    if (toFilter && new Date(r.data) > new Date(`${toFilter}T23:59:59`)) return false
    return true
  })

  const columns: ColumnDef<AnvisaRow>[] = [
    {
      id: 'data',
      header: 'Data Procedimento',
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">
          {format(parseISO(row.original.data), 'dd/MM/yyyy', { locale: ptBR })}
        </span>
      ),
    },
    {
      id: 'paciente',
      header: 'Paciente',
      cell: ({ row }) => <span className="text-sm">{row.original.paciente || '—'}</span>,
    },
    {
      id: 'profissional',
      header: 'Profissional',
      cell: ({ row }) => <span className="text-sm">{row.original.profissional || '—'}</span>,
    },
    {
      id: 'procedimento',
      header: 'Procedimento',
      cell: ({ row }) => <span className="text-sm">{row.original.procedimento || '—'}</span>,
    },
    {
      id: 'produto',
      header: 'Produto (Implante)',
      cell: ({ row }) => <span className="text-sm font-medium">{row.original.produto}</span>,
    },
    {
      id: 'numero_lote',
      header: 'Nº Lote',
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.numero_lote ?? <span className="text-muted-foreground">—</span>}
        </span>
      ),
    },
    {
      id: 'numero_anvisa',
      header: 'Nº ANVISA',
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.numero_anvisa ?? <span className="text-muted-foreground">—</span>}
        </span>
      ),
    },
    {
      id: 'data_validade',
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
      header: () => <span className="block text-right">Qtd</span>,
      cell: ({ row }) => (
        <span className="block text-right text-sm tabular-nums">{row.original.qtd}</span>
      ),
    },
  ]

  const table = useReactTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const hasFilters = produtoFilter || loteFilter || pacienteFilter || fromFilter || toFilter

  return (
    <div className="space-y-4">
      {/* Filtros — nuqs URL state, filtragem client-side sobre o dataset completo */}
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
            {produtoOptions.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          placeholder="Nº de lote"
          className="w-40"
          value={loteInput}
          onChange={(e) => setLoteInput(e.target.value)}
        />

        <Input
          placeholder="Buscar por paciente"
          className="w-56"
          value={pacienteInput}
          onChange={(e) => setPacienteInput(e.target.value)}
        />

        <DateFilterPopover label="De" value={fromFilter} onChange={(v) => setFromFilter(v)} />
        <DateFilterPopover label="Até" value={toFilter} onChange={(v) => setToFilter(v)} />

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setProdutoFilter(null)
              setLoteFilter(null)
              setPacienteFilter(null)
              setFromFilter(null)
              setToFilter(null)
              setLoteInput('')
              setPacienteInput('')
            }}
            className="text-muted-foreground"
          >
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Tabela / empty state */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nenhum implante rastreado no período"
          description="Registre implantes nas entradas de estoque para gerar rastreabilidade ANVISA."
        />
      ) : (
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
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
