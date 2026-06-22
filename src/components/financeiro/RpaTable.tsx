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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { MoreHorizontal } from 'lucide-react'
import { formatBRL } from '@/lib/format/money'
import { ReinfStatusBadge } from './ReinfStatusBadge'
import { getRpaDocumentUrl, estornarRpa } from '@/actions/rpa'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RpaRow {
  id: string
  numero: string
  competencia: string
  data_pagamento: string
  valor_bruto: number
  valor_inss: number
  valor_irrf: number
  valor_iss: number
  valor_liquido: number
  status: string
  supplier_id: string | null
  unit_id: string | null
  // resolved from join
  autonomo_nome?: string
  reinf_status?: 'pendente' | 'transmitido' | 'erro'
}

interface RpaTableProps {
  rows: RpaRow[]
  canWrite: boolean
}

// ─── RpaTable ─────────────────────────────────────────────────────────────────

export function RpaTable({ rows, canWrite }: RpaTableProps) {
  const router = useRouter()
  const [cancelTarget, setCancelTarget] = React.useState<RpaRow | null>(null)
  const [motivo, setMotivo] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleVisualizarPdf(rpa: RpaRow) {
    const res = await getRpaDocumentUrl(rpa.id)
    if (res.success && res.url) {
      window.open(res.url, '_blank')
    } else {
      setError(res.error ?? 'PDF não disponível')
    }
  }

  async function handleCancelar() {
    if (!cancelTarget || !motivo.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await estornarRpa(cancelTarget.id, motivo.trim())
      if (res.success) {
        setCancelTarget(null)
        setMotivo('')
        router.refresh()
      } else {
        setError(res.error ?? 'Erro ao solicitar cancelamento')
      }
    } finally {
      setLoading(false)
    }
  }

  const columns: ColumnDef<RpaRow>[] = [
    {
      id: 'numero',
      header: 'Número',
      cell: ({ row }) => (
        <span className="text-sm font-medium tabular-nums">{row.original.numero}</span>
      ),
    },
    {
      id: 'autonomo',
      header: 'Autônomo',
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.autonomo_nome ?? row.original.supplier_id?.slice(0, 8) ?? '—'}
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
      id: 'inss',
      header: () => <span className="block text-right">INSS</span>,
      cell: ({ row }) => (
        <span className="block text-right text-sm tabular-nums">
          {formatBRL(row.original.valor_inss)}
        </span>
      ),
    },
    {
      id: 'irrf',
      header: () => <span className="block text-right">IRRF</span>,
      cell: ({ row }) => (
        <span className="block text-right text-sm tabular-nums">
          {formatBRL(row.original.valor_irrf)}
        </span>
      ),
    },
    {
      id: 'iss',
      header: () => <span className="block text-right">ISS</span>,
      cell: ({ row }) => (
        <span className="block text-right text-sm tabular-nums">
          {formatBRL(row.original.valor_iss)}
        </span>
      ),
    },
    {
      id: 'liquido',
      header: () => <span className="block text-right">Líquido</span>,
      cell: ({ row }) => (
        <span className="block text-right text-sm font-semibold tabular-nums">
          {formatBRL(row.original.valor_liquido)}
        </span>
      ),
    },
    {
      id: 'reinf',
      header: 'EFD-Reinf',
      cell: ({ row }) => (
        <ReinfStatusBadge
          status={row.original.reinf_status ?? 'pendente'}
          isStub
        />
      ),
    },
    {
      id: 'acoes',
      header: 'Ações',
      cell: ({ row }) => {
        const rpa = row.original
        if (!canWrite) return null
        return (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="sm" className="size-8 p-0" aria-label="Ações" />
              }
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleVisualizarPdf(rpa)}>
                Visualizar PDF
              </DropdownMenuItem>
              {rpa.status === 'emitido' && (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => {
                    setCancelTarget(rpa)
                    setMotivo('')
                    setError(null)
                  }}
                >
                  Cancelar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
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
                  Nenhum RPA encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Cancelar RPA AlertDialog — routes through alçada (D-24) */}
      <AlertDialog
        open={!!cancelTarget}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Cancelar RPA {cancelTarget?.numero ?? ''}
            </AlertDialogTitle>
            <AlertDialogDescription>
              O cancelamento do RPA requer aprovação. Informe o motivo abaixo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="cancel-motivo">Motivo</Label>
            <Textarea
              id="cancel-motivo"
              placeholder="Descreva o motivo do cancelamento…"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelar}
              disabled={loading || !motivo.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? 'Solicitando...' : 'Solicitar Cancelamento'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
