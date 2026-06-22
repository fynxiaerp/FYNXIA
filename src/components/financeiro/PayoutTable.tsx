'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MoreHorizontal } from 'lucide-react'
import { formatBRL } from '@/lib/format/money'
import { PayoutDemonstrativoSheet } from './PayoutDemonstrativoSheet'
import { aprovarEgerarCP } from '@/actions/professional-payouts'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PayoutRow {
  id: string
  competencia: string
  valor_bruto: number
  deducoes: Record<string, number> | null
  valor_base: number
  percentual: number
  valor_repasse: number
  status: string
  payable_id: string | null
  professionals: {
    id: string
    users: { id: string } | null
  } | null
  // display name resolved from join
  profissional_nome?: string
}

interface PayoutTableProps {
  rows: PayoutRow[]
  canWrite: boolean
  competencia: string
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'aprovado':
      return 'bg-cyan-100 text-cyan-800 border-cyan-200'
    case 'pago':
      return 'bg-green-100 text-green-800 border-green-200'
    default:
      return ''
  }
}

// ─── PayoutTable ──────────────────────────────────────────────────────────────

export function PayoutTable({ rows, canWrite, competencia }: PayoutTableProps) {
  const router = useRouter()
  const [selectedPayout, setSelectedPayout] = React.useState<PayoutRow | null>(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [loadingId, setLoadingId] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  async function handleAprovarEGerarCP(payout: PayoutRow) {
    if (!payout.professionals?.id) return
    setLoadingId(payout.id)
    setError(null)
    try {
      // Due date: last day of current month + 5 days (simplified)
      const parts = payout.competencia.split('-')
      const y = parseInt(parts[0] ?? '2026', 10)
      const m = parseInt(parts[1] ?? '1', 10)
      const lastDay = new Date(y, m, 0)
      lastDay.setDate(lastDay.getDate() + 5)
      const dueDate = lastDay.toISOString().split('T')[0]!
      // supplierId: we use professional id as supplier reference (placeholder — real link via supplier_id)
      const r = await aprovarEgerarCP(payout.id, dueDate, payout.professionals.id)
      if (r.success) {
        router.refresh()
      } else {
        setError(r.error ?? 'Erro ao gerar CP')
      }
    } finally {
      setLoadingId(null)
    }
  }

  function handleVerDemonstrativo(payout: PayoutRow) {
    setSelectedPayout(payout)
    setSheetOpen(true)
  }

  function handleGerarRpa(payout: PayoutRow) {
    router.push(
      `/clinica/financeiro/rpa?competencia=${payout.competencia}&supplier=${payout.professionals?.id ?? ''}`
    )
  }

  const columns: ColumnDef<PayoutRow>[] = [
    {
      id: 'profissional',
      header: 'Profissional',
      cell: ({ row }) => (
        <span className="text-sm font-medium">
          {row.original.profissional_nome ?? row.original.professionals?.id?.slice(0, 8) ?? '—'}
        </span>
      ),
    },
    {
      id: 'competencia',
      header: 'Competência',
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">{row.original.competencia}</span>
      ),
    },
    {
      id: 'bruto',
      header: () => <span className="block text-right">Bruto</span>,
      cell: ({ row }) => (
        <span className="block text-right text-sm tabular-nums">
          {formatBRL(row.original.valor_bruto)}
        </span>
      ),
    },
    {
      id: 'deducoes',
      header: () => <span className="block text-right">Deduções</span>,
      cell: ({ row }) => {
        const deducoes = row.original.deducoes ?? {}
        const total = Object.values(deducoes).reduce((a, b) => a + b, 0)
        return (
          <span className="block text-right text-sm tabular-nums">
            {formatBRL(total)}
          </span>
        )
      },
    },
    {
      id: 'base',
      header: () => <span className="block text-right">Base</span>,
      cell: ({ row }) => (
        <span className="block text-right text-sm tabular-nums">
          {formatBRL(row.original.valor_base)}
        </span>
      ),
    },
    {
      id: 'percentual',
      header: '%',
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">
          {(row.original.percentual * 100).toFixed(0)}%
        </span>
      ),
    },
    {
      id: 'repasse',
      header: () => <span className="block text-right">Repasse</span>,
      cell: ({ row }) => (
        <span className="block text-right text-sm font-semibold tabular-nums">
          {formatBRL(row.original.valor_repasse)}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const s = row.original.status
        const label =
          s === 'rascunho' ? 'Rascunho' : s === 'aprovado' ? 'Aprovado' : s === 'pago' ? 'Pago' : s
        if (s === 'rascunho') {
          return <Badge variant="outline">{label}</Badge>
        }
        return (
          <Badge className={`border text-xs ${statusBadgeClass(s)}`}>{label}</Badge>
        )
      },
    },
    ...(canWrite
      ? [
          {
            id: 'acoes',
            header: 'Ações',
            cell: ({ row }: { row: { original: PayoutRow } }) => {
              const payout = row.original
              const isLoading = loadingId === payout.id
              return (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="sm"
                        className="size-8 p-0"
                        disabled={isLoading}
                        aria-label="Ações"
                      />
                    }
                  >
                    <MoreHorizontal className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleVerDemonstrativo(payout)}>
                      Ver Demonstrativo
                    </DropdownMenuItem>
                    {payout.status === 'rascunho' && (
                      <DropdownMenuItem onClick={() => handleAprovarEGerarCP(payout)}>
                        Aprovar
                      </DropdownMenuItem>
                    )}
                    {payout.status === 'aprovado' && !payout.payable_id && (
                      <DropdownMenuItem onClick={() => handleAprovarEGerarCP(payout)}>
                        Gerar CP
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => handleGerarRpa(payout)}>
                      Gerar RPA
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )
            },
          } as ColumnDef<PayoutRow>,
        ]
      : [
          {
            id: 'acoes',
            header: 'Ações',
            cell: ({ row }: { row: { original: PayoutRow } }) => (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleVerDemonstrativo(row.original)}
              >
                Ver Demonstrativo
              </Button>
            ),
          } as ColumnDef<PayoutRow>,
        ]),
  ]

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <>
      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

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
                  Nenhum repasse encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <PayoutDemonstrativoSheet
        payout={selectedPayout}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        canWrite={canWrite}
      />
    </>
  )
}
