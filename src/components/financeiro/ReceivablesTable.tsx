'use client'

import { useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import { useQueryState } from 'nuqs'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'

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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatBRL, deriveReceivableStatus } from '@/lib/format/money'
import type { ReceivableRow } from '@/actions/receivables'

// ─── Status badge helpers ─────────────────────────────────────────────────────
// UI-SPEC §Financial Status Badge Colors
// pendente: amber, pago: green, vencido: red (derived), estornado: muted

type DisplayStatus = 'pendente' | 'pago' | 'vencido' | 'estornado'

function statusBadgeClass(status: DisplayStatus): string {
  switch (status) {
    case 'pago':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'vencido':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'pendente':
      return 'bg-amber-100 text-amber-800 border-amber-200'
    case 'estornado':
    default:
      return 'bg-muted text-muted-foreground border-muted'
  }
}

// ─── Installment group ────────────────────────────────────────────────────────
// Groups receivables by charge_id for accordion rendering (FIN-06).

interface ChargeGroup {
  charge_id: string
  patient_name: string | null
  description: string | null
  installment_count: number
  parcels: ReceivableRow[]
  billing_type: string | null
}

// ─── ReceivablesTable ─────────────────────────────────────────────────────────
// FIN-03: TanStack Table v8, status badges with deriveReceivableStatus (D-04).
// FIN-06: installment charges grouped with shadcn Accordion.
// D-04: 'vencido' is NEVER read from DB — derived here via deriveReceivableStatus.
// Phase 2 lesson: Button uses @base-ui/react — NO asChild. Use render-prop pattern.

interface ReceivablesTableProps {
  receivables: ReceivableRow[]
}

export function ReceivablesTable({ receivables }: ReceivablesTableProps) {
  const [statusFilter, setStatusFilter] = useQueryState('status', { defaultValue: '' })

  // Group by charge_id
  const groups = useMemo<ChargeGroup[]>(() => {
    const map = new Map<string, ChargeGroup>()
    for (const row of receivables) {
      const existing = map.get(row.charge_id)
      if (existing) {
        existing.parcels.push(row)
      } else {
        map.set(row.charge_id, {
          charge_id: row.charge_id,
          patient_name: row.patient_name,
          description: row.description,
          installment_count: row.installment_count,
          parcels: [row],
          billing_type: row.billing_type,
        })
      }
    }
    return Array.from(map.values())
  }, [receivables])

  // Apply status filter — 'vencido' filter must be derived client-side (D-04)
  const filteredGroups = useMemo<ChargeGroup[]>(() => {
    if (!statusFilter) return groups
    return groups
      .map((group) => ({
        ...group,
        parcels: group.parcels.filter((p) => {
          const derived = deriveReceivableStatus(p.status, p.due_date)
          return derived === statusFilter
        }),
      }))
      .filter((g) => g.parcels.length > 0)
  }, [groups, statusFilter])

  const singleParcelGroups = filteredGroups.filter((g) => g.installment_count <= 1)
  const installmentGroups = filteredGroups.filter((g) => g.installment_count > 1)

  // TanStack Table for single-parcel rows
  type FlatRow = {
    charge_id: string
    parcel: ReceivableRow
    patient_name: string | null
    description: string | null
  }

  const flatRows: FlatRow[] = singleParcelGroups.flatMap((g) =>
    g.parcels.map((p) => ({
      charge_id: g.charge_id,
      parcel: p,
      patient_name: g.patient_name,
      description: g.description,
    }))
  )

  const columns: ColumnDef<FlatRow>[] = [
    {
      id: 'patient',
      header: 'Paciente',
      cell: ({ row }) => (
        <span className="text-sm font-medium">
          {row.original.patient_name ?? <span className="text-muted-foreground">—</span>}
        </span>
      ),
    },
    {
      id: 'description',
      header: 'Descrição',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.description ?? '—'}
        </span>
      ),
    },
    {
      id: 'parcelas',
      header: 'Parcelas',
      cell: () => <span className="text-sm text-muted-foreground">—</span>,
    },
    {
      id: 'vencimento',
      header: 'Vencimento',
      cell: ({ row }) => {
        const due = row.original.parcel.due_date
        try {
          return (
            <span className="text-sm tabular-nums">
              {format(parseISO(due), 'dd/MM/yyyy', { locale: ptBR })}
            </span>
          )
        } catch {
          return <span className="text-sm">{due}</span>
        }
      },
    },
    {
      id: 'valor',
      header: () => <span className="block text-right">Valor</span>,
      cell: ({ row }) => (
        <span className="block text-right text-sm font-semibold tabular-nums">
          {formatBRL(row.original.parcel.value)}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => {
        // D-04: derive display status client-side — never read 'vencido' from DB
        const derived = deriveReceivableStatus(
          row.original.parcel.status,
          row.original.parcel.due_date
        ) as DisplayStatus
        return (
          <Badge
            className={`border text-xs ${statusBadgeClass(derived)}`}
            aria-label={`Status: ${derived}`}
          >
            {derived}
          </Badge>
        )
      },
    },
    {
      id: 'acoes',
      header: 'Ações',
      cell: ({ row }) => {
        const derived = deriveReceivableStatus(
          row.original.parcel.status,
          row.original.parcel.due_date
        )
        if (derived !== 'pago') return null
        // @base-ui/react Button: render-prop pattern (no asChild)
        return (
          <Button variant="ghost" size="sm">
            <Link href={`/api/financeiro/charges/${row.original.charge_id}/recibo.pdf`}>
              Recibo
            </Link>
          </Button>
        )
      },
    },
  ]

  const table = useReactTable({
    data: flatRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const hasResults = filteredGroups.length > 0

  return (
    <div className="space-y-4">
      {/* Status filter */}
      <div className="flex flex-wrap gap-3">
        <Select
          value={statusFilter || 'todos'}
          onValueChange={(v) => setStatusFilter(v === 'todos' ? '' : v)}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="pago">Pago</SelectItem>
            <SelectItem value="vencido">Vencido</SelectItem>
            <SelectItem value="estornado">Estornado</SelectItem>
          </SelectContent>
        </Select>

        {statusFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStatusFilter('')}
            className="text-muted-foreground"
          >
            Limpar filtros
          </Button>
        )}
      </div>

      {!hasResults && (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm font-medium text-muted-foreground">Nenhum resultado</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Nenhum recebível encontrado com os filtros aplicados.
          </p>
        </div>
      )}

      {/* Installment groups — Accordion (FIN-06) */}
      {installmentGroups.length > 0 && (
        <div className="rounded-md border">
          {/* @base-ui/react Accordion uses multiple prop (not type="multiple") */}
          <Accordion multiple>
            {installmentGroups.map((group) => {
              const paidCount = group.parcels.filter(
                (p) => deriveReceivableStatus(p.status, p.due_date) === 'pago'
              ).length
              const totalCount = group.installment_count

              return (
                <AccordionItem key={group.charge_id} value={group.charge_id}>
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <div className="flex flex-1 items-center justify-between pr-4 text-left">
                      <div>
                        <span className="text-sm font-medium">
                          {group.patient_name ?? '—'}
                        </span>
                        <span className="ml-2 text-sm text-muted-foreground">
                          {group.description ?? ''}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {paidCount} de {totalCount} pagas
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="px-4 pb-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Parcela</TableHead>
                            <TableHead>Vencimento</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.parcels.map((parcel) => {
                            // D-04: derive display status — no stored 'vencido'
                            const derived = deriveReceivableStatus(
                              parcel.status,
                              parcel.due_date
                            ) as DisplayStatus
                            return (
                              <TableRow key={parcel.id}>
                                <TableCell className="text-sm">
                                  Parc. {parcel.installment_number}
                                </TableCell>
                                <TableCell className="text-sm tabular-nums">
                                  {format(parseISO(parcel.due_date), 'dd/MM/yyyy', {
                                    locale: ptBR,
                                  })}
                                </TableCell>
                                <TableCell className="text-right text-sm font-semibold tabular-nums">
                                  {formatBRL(parcel.value)}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    className={`border text-xs ${statusBadgeClass(derived)}`}
                                    aria-label={`Status: ${derived}`}
                                  >
                                    {derived}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {derived === 'pago' && (
                                    // @base-ui/react Button: render-prop (no asChild)
                                    <Button variant="ghost" size="sm">
                                      <Link
                                        href={`/api/financeiro/charges/${group.charge_id}/recibo.pdf`}
                                      >
                                        Recibo
                                      </Link>
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )
            })}
          </Accordion>
        </div>
      )}

      {/* Single-parcel rows — flat TanStack Table */}
      {flatRows.length > 0 && (
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
                    Nenhum recebível encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
