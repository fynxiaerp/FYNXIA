'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import { useQueryState } from 'nuqs'
import { format, parseISO, isPast } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { MoreHorizontal } from 'lucide-react'

import { cancelarPayable } from '@/actions/payables'
import { formatBRL } from '@/lib/format/money'
import { PayableFormDialog } from '@/components/financeiro/PayableFormDialog'
import { BaixaDialog } from '@/components/financeiro/BaixaDialog'

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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

// ─── Types ────────────────────────────────────────────────────────────────────

type PayableRow = {
  id: string
  descricao: string
  valor_total: number
  status: string
  origem: string
  competencia: string | null
  created_at: string
  supplier_id: string | null
  supplier_name: string | null
  unit_id: string | null
  installments: { id: string; numero: number; valor: number; due_date: string; status: string; valor_pago: number | null }[]
}

type SupplierOption = {
  id: string
  name: string
  tipo: string
  cnpj_cpf: string | null
  vinculo: string | null
  professional_id: string | null
  lab_id: string | null
  ativo: boolean | null
}

type LeafAccount = { id: string; name: string; code: string; type: string }
type CostCenterOption = { id: string; name: string; ativo: boolean; is_default?: boolean }
type UnitOption = { id: string; name: string }
type BankAccountOption = { id: string; name: string; ativo: boolean }

interface PayablesTableProps {
  payables: PayableRow[]
  suppliers: SupplierOption[]
  bankAccounts: BankAccountOption[]
  leafAccounts: LeafAccount[]
  costCenters: CostCenterOption[]
  units: UnitOption[]
  canWrite: boolean
  role: string
}

// ─── Status badge helpers (mirrors statusBadgeClass from ReceivablesTable) ────

type PayableDisplayStatus = 'pendente' | 'parcial' | 'pago' | 'vencido' | 'cancelado'

function statusBadgeClass(status: PayableDisplayStatus): string {
  switch (status) {
    case 'pago':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'vencido':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'pendente':
    case 'parcial':
      return 'bg-amber-100 text-amber-800 border-amber-200'
    case 'cancelado':
    default:
      return 'bg-muted text-muted-foreground border-muted'
  }
}

// D-04 pattern: 'vencido' derived at read-time
function derivePayableStatus(payable: PayableRow): PayableDisplayStatus {
  if (payable.status === 'cancelado') return 'cancelado'
  if (payable.status === 'pago') return 'pago'
  if (payable.status === 'parcial') return 'parcial'

  // Check if any non-cancelled, non-paid installment is past due
  const hasOverdue = (payable.installments ?? []).some((inst) => {
    if (inst.status === 'pago' || inst.status === 'cancelado') return false
    return isPast(parseISO(inst.due_date))
  })
  if (hasOverdue) return 'vencido'
  return 'pendente'
}

// ─── Cancel dialog item ───────────────────────────────────────────────────────

function CancelPayableDialog({ payableId, canWrite }: { payableId: string; canWrite: boolean }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  async function handleCancel() {
    setError(null)
    const result = await cancelarPayable(payableId, 'Cancelado pelo usuário')
    if (result.success) {
      router.refresh()
    } else {
      setError(result.error ?? 'Erro ao cancelar')
    }
  }

  if (!canWrite) return null

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={(e) => e.preventDefault()}
          />
        }
      >
        Cancelar
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar Conta a Pagar</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação não pode ser desfeita. A conta a pagar será marcada como cancelada.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Manter</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={handleCancel}
          >
            Cancelar CP
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ─── PayablesTable ─────────────────────────────────────────────────────────────
// FOP-01: TanStack Table v8 with status badges (D-04) and role-gated Ações column.

export function PayablesTable({
  payables,
  suppliers,
  bankAccounts,
  leafAccounts,
  costCenters,
  units,
  canWrite,
}: PayablesTableProps) {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useQueryState('status', { defaultValue: '' })
  const [supplierFilter, setSupplierFilter] = useQueryState('supplier', { defaultValue: '' })

  // Client-side filter application
  const filtered = payables.filter((p) => {
    if (statusFilter && statusFilter !== 'todos') {
      const derived = derivePayableStatus(p)
      if (derived !== statusFilter) return false
    }
    if (supplierFilter && supplierFilter !== 'todos') {
      if (p.supplier_id !== supplierFilter) return false
    }
    return true
  })

  const columns: ColumnDef<PayableRow>[] = [
    {
      id: 'vencimento',
      header: 'Vencimento',
      cell: ({ row }) => {
        const firstInst = row.original.installments?.[0]
        if (!firstInst) return <span className="text-muted-foreground">—</span>
        try {
          return (
            <span className="text-sm tabular-nums">
              {format(parseISO(firstInst.due_date), 'dd/MM/yyyy', { locale: ptBR })}
            </span>
          )
        } catch {
          return <span className="text-sm">{firstInst.due_date}</span>
        }
      },
    },
    {
      id: 'fornecedor',
      header: 'Fornecedor',
      cell: ({ row }) => (
        <span className="text-sm font-medium">
          {row.original.supplier_name ?? <span className="text-muted-foreground">—</span>}
        </span>
      ),
    },
    {
      id: 'descricao',
      header: 'Descrição',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground max-w-[200px] truncate block">
          {row.original.descricao}
        </span>
      ),
    },
    {
      id: 'valor',
      header: () => <span className="block text-right">Valor</span>,
      cell: ({ row }) => (
        <span className="block text-right text-sm font-semibold tabular-nums">
          {formatBRL(row.original.valor_total)}
        </span>
      ),
    },
    {
      id: 'pago',
      header: () => <span className="block text-right">Pago</span>,
      cell: ({ row }) => {
        const totalPago = (row.original.installments ?? []).reduce(
          (sum, inst) => sum + (inst.valor_pago ?? 0),
          0
        )
        return (
          <span className="block text-right text-sm tabular-nums text-green-700">
            {formatBRL(totalPago)}
          </span>
        )
      },
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const derived = derivePayableStatus(row.original)
        const label =
          derived === 'pendente'
            ? 'Pendente'
            : derived === 'parcial'
              ? 'Parcial'
              : derived === 'pago'
                ? 'Pago'
                : derived === 'vencido'
                  ? 'Vencido'
                  : 'Cancelado'
        return (
          <Badge className={`border text-xs ${statusBadgeClass(derived)}`}>
            {label}
          </Badge>
        )
      },
    },
    {
      id: 'acoes',
      header: 'Ações',
      cell: ({ row }) => {
        const payable = row.original
        const firstPendingInst = (payable.installments ?? []).find(
          (i) => i.status === 'pendente' || i.status === 'parcial'
        )

        if (!canWrite) {
          return (
            <DropdownMenu>
              <DropdownMenuTrigger
          render={<button type="button" className="flex size-8 items-center justify-center rounded-md hover:bg-accent" aria-label="Ações" />}
        >
                  <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Ver Detalhes</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        }

        return (
          <DropdownMenu>
            <DropdownMenuTrigger
          render={<button type="button" className="flex size-8 items-center justify-center rounded-md hover:bg-accent" aria-label="Ações" />}
        >
                <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {firstPendingInst && (
                <BaixaDialog
                  installmentId={firstPendingInst.id}
                  saldoPendente={firstPendingInst.valor - (firstPendingInst.valor_pago ?? 0)}
                  bankAccounts={bankAccounts}
                  trigger={
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      Baixar
                    </DropdownMenuItem>
                  }
                />
              )}
              <PayableFormDialog
                mode="edit"
                payable={payable}
                suppliers={suppliers}
                leafAccounts={leafAccounts}
                costCenters={costCenters}
                units={units}
              >
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  Editar
                </DropdownMenuItem>
              </PayableFormDialog>
              <CancelPayableDialog payableId={payable.id} canWrite={canWrite} />
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  const table = useReactTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div className="space-y-4">
      {/* Filter bar — nuqs URL state */}
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
            <SelectItem value="parcial">Parcial</SelectItem>
            <SelectItem value="pago">Pago</SelectItem>
            <SelectItem value="vencido">Vencido</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>

        {suppliers.length > 0 && (
          <Select
            value={supplierFilter || 'todos'}
            onValueChange={(v) => setSupplierFilter(v === 'todos' ? '' : v)}
          >
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Todos os fornecedores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os fornecedores</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {(statusFilter || supplierFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter('')
              setSupplierFilter('')
              router.refresh()
            }}
            className="text-muted-foreground"
          >
            Limpar filtros
          </Button>
        )}
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
                    <TableCell key={cell.id} className="px-4 py-3">
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
                  Nenhuma conta encontrada com os filtros aplicados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
