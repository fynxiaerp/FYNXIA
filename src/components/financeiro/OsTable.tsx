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
import { MoreHorizontal } from 'lucide-react'
import { formatBRL } from '@/lib/format/money'

export interface OsRow {
  id: string
  numero: string
  status: string
  pagador: string
  total: number
  created_at: string
  patient_maskedName: string | null
}

const OS_STATUS: Record<string, { label: string; variant: 'outline' | 'default' | 'destructive' }> = {
  rascunho: { label: 'Rascunho', variant: 'outline' },
  faturada: { label: 'Faturada', variant: 'default' },
  cancelada: { label: 'Cancelada', variant: 'destructive' },
}

const PAGADOR_LABEL: Record<string, string> = {
  particular: 'Particular',
  convenio: 'Convênio',
}

interface OsTableProps {
  rows: OsRow[]
  onViewDetails: (row: OsRow) => void
  onFaturar: (row: OsRow) => void
  onCancelar: (row: OsRow) => void
}

export function OsTable({ rows, onViewDetails, onFaturar, onCancelar }: OsTableProps) {
  const columns: ColumnDef<OsRow>[] = [
    {
      accessorKey: 'numero',
      header: 'Número',
      cell: ({ row }) => (
        <span className="font-medium tabular-nums">{row.original.numero}</span>
      ),
    },
    {
      accessorKey: 'patient_maskedName',
      header: 'Paciente',
      cell: ({ row }) => (
        <span>{row.original.patient_maskedName ?? '—'}</span>
      ),
    },
    {
      accessorKey: 'pagador',
      header: 'Pagador',
      cell: ({ row }) => (
        <Badge variant="outline">
          {PAGADOR_LABEL[row.original.pagador] ?? row.original.pagador}
        </Badge>
      ),
    },
    {
      accessorKey: 'total',
      header: () => <span className="text-right w-full block">Total</span>,
      cell: ({ row }) => (
        <span className="text-right font-medium tabular-nums block">
          {formatBRL(row.original.total)}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const s = OS_STATUS[row.original.status] ?? { label: row.original.status, variant: 'outline' as const }
        return <Badge variant={s.variant}>{s.label}</Badge>
      },
    },
    {
      id: 'acoes',
      header: '',
      cell: ({ row }) => {
        const os = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon" aria-label="Ações" />}
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onViewDetails(os)}>
                Ver detalhes
              </DropdownMenuItem>
              {os.status === 'rascunho' && (
                <DropdownMenuItem onClick={() => onFaturar(os)}>
                  Faturar
                </DropdownMenuItem>
              )}
              {(os.status === 'rascunho' || os.status === 'faturada') && (
                <DropdownMenuItem
                  onClick={() => onCancelar(os)}
                  className="text-destructive focus:text-destructive"
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
    <div className="rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="font-display text-base font-semibold">Ordens de Serviço</h3>
        <p className="text-sm text-muted-foreground">Lista de OS da clínica</p>
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
                Nenhuma ordem de serviço encontrada.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer"
                onClick={() => onViewDetails(row.original)}
              >
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
  )
}
