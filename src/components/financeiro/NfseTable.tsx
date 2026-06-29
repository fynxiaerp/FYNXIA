'use client'

import * as React from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { MoreHorizontal } from 'lucide-react'
import { formatBRL } from '@/lib/format/money'
import { cancelarNfse, getNfseDocumentUrl } from '@/actions/nfse'

export interface NfseRow {
  id: string
  service_order_id: string
  numero: string | null
  serie: string | null
  status: string
  valor_servicos: number
  valor_iss: number
  tomador_nome: string
  emitida_at: string | null
  created_at: string
}

const NFSE_STATUS: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  emitida: { label: 'Emitida', variant: 'default' },
  processando: { label: 'Processando', variant: 'secondary' },
  cancelada: { label: 'Cancelada', variant: 'outline' },
  erro: { label: 'Erro', variant: 'destructive' },
}

interface NfseTableProps {
  rows: NfseRow[]
  onRefresh?: () => void
}

export function NfseTable({ rows, onRefresh }: NfseTableProps) {
  const [cancelMotivo, setCancelMotivo] = React.useState('')
  const [cancelingId, setCancelingId] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleVerNota(nfseId: string) {
    const res = await getNfseDocumentUrl(nfseId, 'pdf')
    if (res.url) {
      window.open(res.url, '_blank', 'noopener,noreferrer')
    } else {
      alert(res.error ?? 'Documento não disponível')
    }
  }

  async function handleCancelar(nfseId: string) {
    if (!cancelMotivo.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await cancelarNfse(nfseId, cancelMotivo.trim())
      if (res.success) {
        setCancelMotivo('')
        setCancelingId(null)
        onRefresh?.()
      } else {
        setError(res.error ?? 'Erro ao cancelar NFS-e')
      }
    } finally {
      setLoading(false)
    }
  }

  const columns: ColumnDef<NfseRow>[] = [
    {
      accessorKey: 'numero',
      header: 'Número',
      cell: ({ row }) => (
        <span className="font-medium tabular-nums">
          {row.original.numero ?? '—'}
          {row.original.serie ? `/${row.original.serie}` : ''}
        </span>
      ),
    },
    {
      accessorKey: 'tomador_nome',
      header: 'Tomador',
      cell: ({ row }) => <span>{row.original.tomador_nome}</span>,
    },
    {
      id: 'servico',
      header: 'Serviço',
      cell: () => (
        <span className="text-muted-foreground">Serviços odontológicos</span>
      ),
    },
    {
      accessorKey: 'emitida_at',
      header: 'Data',
      cell: ({ row }) => {
        const date = row.original.emitida_at ?? row.original.created_at
        return (
          <span className="tabular-nums text-muted-foreground">
            {new Date(date).toLocaleDateString('pt-BR')}
          </span>
        )
      },
    },
    {
      accessorKey: 'valor_servicos',
      header: () => <span className="text-right w-full block">Valor</span>,
      cell: ({ row }) => (
        <span className="text-right font-medium tabular-nums block">
          {formatBRL(row.original.valor_servicos)}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: () => <span className="text-right w-full block">Status</span>,
      cell: ({ row }) => {
        const s = NFSE_STATUS[row.original.status] ?? { label: row.original.status, variant: 'outline' as const }
        return (
          <div className="text-right">
            <Badge variant={s.variant}>{s.label}</Badge>
          </div>
        )
      },
    },
    {
      id: 'acoes',
      header: '',
      cell: ({ row }) => {
        const nfse = row.original
        const canCancel = nfse.status === 'emitida'
        return (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon" aria-label="Ações" />}
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleVerNota(nfse.id)}>
                Ver nota
              </DropdownMenuItem>
              {canCancel && (
                <DropdownMenuItem
                  onClick={() => setCancelingId(nfse.id)}
                  className="text-destructive focus:text-destructive"
                >
                  Cancelar NFS-e
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
      <div className="rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="font-display text-base font-semibold">Histórico de notas</h3>
          <p className="text-sm text-muted-foreground">Notas de serviço emitidas</p>
        </div>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
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
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-12 text-muted-foreground">
                  Nenhuma nota emitida encontrada.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Cancelar NFS-e AlertDialog (opened via dropdown) */}
      <AlertDialog open={!!cancelingId} onOpenChange={(open) => { if (!open) { setCancelingId(null); setCancelMotivo('') } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar NFS-e</AlertDialogTitle>
            <AlertDialogDescription>
              O cancelamento está sujeito ao prazo do município. Informe o motivo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="nfse-cancel-motivo">Motivo</Label>
            <Textarea
              id="nfse-cancel-motivo"
              placeholder="Descreva o motivo do cancelamento…"
              value={cancelMotivo}
              onChange={(e) => setCancelMotivo(e.target.value)}
              rows={3}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelingId && handleCancelar(cancelingId)}
              disabled={loading || !cancelMotivo.trim()}
              className="bg-destructive/10 text-destructive hover:bg-destructive/20"
            >
              Cancelar nota
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
