'use client'

// ProductsTable — catálogo de produtos com filtros nuqs + status semântico (EST-01).
// Pattern: TanStack Table v8 + nuqs URL filters — mirrors PayablesTable.tsx.
// DropdownMenu de ações usa render-prop (@base-ui) + pointer-events-none no ícone
// (bug fix da Fase 16, quick task 260629-uaz — obrigatório em todo novo dropdown).

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import { useQueryState } from 'nuqs'
import { MoreHorizontal } from 'lucide-react'

import { formatBRL } from '@/lib/format/money'
import { ProductFormDialog, type ProductOption } from '@/components/estoque/ProductFormDialog'

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
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProductStatus = 'normal' | 'baixo' | 'critico' | 'negativo' | 'vencido'

export type ProductRow = ProductOption & {
  custo_medio: number
  ativo: boolean
  saldo: number
  status: ProductStatus
}

type SupplierOption = { id: string; name: string }

interface ProductsTableProps {
  products: ProductRow[]
  suppliers: SupplierOption[]
  canWrite: boolean
}

// ─── Category / status label + color helpers ─────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  insumo: 'Insumo',
  medicamento: 'Medicamento',
  implante: 'Implante',
}

const STATUS_LABELS: Record<ProductStatus, string> = {
  normal: 'Normal',
  baixo: 'Estoque Baixo',
  critico: 'Estoque Crítico',
  negativo: 'Saldo Negativo',
  vencido: 'Vencido',
}

// 17-UI-SPEC.md §Color — cores semânticas de status de produto
function statusBadgeClass(status: ProductStatus): string {
  switch (status) {
    case 'baixo':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    case 'critico':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
    case 'negativo':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    case 'vencido':
      return 'bg-muted text-muted-foreground'
    case 'normal':
    default:
      return ''
  }
}

// ─── ProductRowActions ────────────────────────────────────────────────────────

function ProductRowActions({
  product,
  suppliers,
  canWrite,
}: {
  product: ProductRow
  suppliers: SupplierOption[]
  canWrite: boolean
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-md hover:bg-accent"
            aria-label={`Ações para ${product.name}`}
          />
        }
      >
        <MoreHorizontal className="size-4 pointer-events-none" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canWrite && (
          <ProductFormDialog mode="edit" product={product} suppliers={suppliers}>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>Editar</DropdownMenuItem>
          </ProductFormDialog>
        )}
        {canWrite && (
          <DropdownMenuItem render={<Link href={`/clinica/estoque/entradas?produto=${product.id}`} />}>
            Registrar Entrada
          </DropdownMenuItem>
        )}
        {canWrite && (
          <DropdownMenuItem
            render={<Link href={`/clinica/estoque/entradas?produto=${product.id}&acao=baixa`} />}
          >
            Baixa Manual
          </DropdownMenuItem>
        )}
        <DropdownMenuItem render={<Link href={`/clinica/estoque/entradas?produto=${product.id}`} />}>
          Histórico
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── ProductsTable ─────────────────────────────────────────────────────────────

export function ProductsTable({ products, suppliers, canWrite }: ProductsTableProps) {
  const [categoriaFilter, setCategoriaFilter] = useQueryState('categoria', { defaultValue: '' })
  const [statusFilter, setStatusFilter] = useQueryState('status', { defaultValue: '' })
  const [qFilter, setQFilter] = useQueryState('q', { defaultValue: '' })

  // Debounced search input (300ms) — UI-SPEC §Filtros
  const [qInput, setQInput] = useState(qFilter)
  useEffect(() => {
    const handle = setTimeout(() => {
      if (qInput !== qFilter) setQFilter(qInput || null)
    }, 300)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qInput])

  const filtered = products.filter((p) => {
    if (categoriaFilter && categoriaFilter !== 'todas' && p.category !== categoriaFilter) {
      return false
    }
    if (statusFilter && statusFilter !== 'todos' && p.status !== statusFilter) {
      return false
    }
    if (qFilter) {
      const term = qFilter.toLowerCase()
      const matchesName = p.name.toLowerCase().includes(term)
      const matchesSku = (p.sku ?? '').toLowerCase().includes(term)
      if (!matchesName && !matchesSku) return false
    }
    return true
  })

  const columns: ColumnDef<ProductRow>[] = [
    {
      id: 'produto',
      header: 'Produto',
      cell: ({ row }) => (
        <div>
          <p className="text-sm font-medium">{row.original.name}</p>
          {row.original.sku && (
            <p className="text-xs text-muted-foreground">{row.original.sku}</p>
          )}
        </div>
      ),
    },
    {
      id: 'categoria',
      header: 'Categoria',
      cell: ({ row }) => (
        <Badge variant="outline">{CATEGORY_LABELS[row.original.category] ?? row.original.category}</Badge>
      ),
    },
    {
      id: 'saldo',
      header: () => <span className="block text-right">Saldo Atual</span>,
      cell: ({ row }) => (
        <span
          className={`block text-right text-sm tabular-nums ${row.original.saldo < 0 ? 'text-red-600 font-semibold' : ''}`}
        >
          {row.original.saldo} {row.original.unidade_medida}
        </span>
      ),
    },
    {
      id: 'custo_medio',
      header: () => <span className="block text-right">Custo Médio</span>,
      cell: ({ row }) => (
        <span className="block text-right text-sm tabular-nums">{formatBRL(row.original.custo_medio)}</span>
      ),
    },
    {
      id: 'estoque_minimo',
      header: () => <span className="block text-right">Est. Mínimo</span>,
      cell: ({ row }) => (
        <span className="block text-right text-sm tabular-nums">
          {row.original.estoque_minimo} {row.original.unidade_medida}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status
        return status === 'normal' ? (
          <Badge variant="secondary">{STATUS_LABELS[status]}</Badge>
        ) : (
          <Badge className={statusBadgeClass(status)}>{STATUS_LABELS[status]}</Badge>
        )
      },
    },
    {
      id: 'acoes',
      header: 'Ações',
      cell: ({ row }) => (
        <ProductRowActions product={row.original} suppliers={suppliers} canWrite={canWrite} />
      ),
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
      {/* Filtros — nuqs URL state */}
      <div className="flex flex-wrap gap-3">
        <Select
          value={categoriaFilter || 'todas'}
          onValueChange={(v) => setCategoriaFilter(v === 'todas' ? null : v)}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Todas as categorias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as categorias</SelectItem>
            <SelectItem value="insumo">Insumo</SelectItem>
            <SelectItem value="medicamento">Medicamento</SelectItem>
            <SelectItem value="implante">Implante</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={statusFilter || 'todos'}
          onValueChange={(v) => setStatusFilter(v === 'todos' ? null : v)}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="baixo">Estoque Baixo</SelectItem>
            <SelectItem value="critico">Estoque Crítico</SelectItem>
            <SelectItem value="negativo">Saldo Negativo</SelectItem>
            <SelectItem value="vencido">Vencido</SelectItem>
          </SelectContent>
        </Select>

        <Input
          placeholder="Buscar por nome ou SKU"
          className="w-64"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
        />

        {(categoriaFilter || statusFilter || qFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setCategoriaFilter(null)
              setStatusFilter(null)
              setQFilter(null)
              setQInput('')
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
                  Nenhum produto encontrado com os filtros aplicados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
