'use client'
// src/components/financeiro/SuppliersTable.tsx
// Tabular list of suppliers with edit dialog + deactivate action.
// Pattern: shadcn Table + inline Dialog — mirrors CostCentersTable.tsx.
// T-ivj-01: canEdit gate — UI hides actions; real boundary is Server Action admin check.

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Truck } from 'lucide-react'

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

import { deactivateSupplier } from '@/actions/suppliers'
import { SupplierFormDialog } from '@/components/financeiro/SupplierFormDialog'
import type { SupplierRow } from '@/components/financeiro/SupplierFormDialog'
import { EmptyState } from '@/components/shell/EmptyState'

// ─── Label maps ──────────────────────────────────────────────────────────────

const TIPO_LABELS: Record<string, string> = {
  laboratorio: 'Laboratório',
  material: 'Material/Insumo',
  servico: 'Serviço',
  autonomo: 'Autônomo',
  pj: 'Pessoa Jurídica (PJ)',
  outro: 'Outro',
}

const VINCULO_LABELS: Record<string, string> = {
  clt: 'CLT',
  pj: 'PJ',
  autonomo: 'Autônomo',
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SuppliersTableProps {
  suppliers: SupplierRow[]
  canEdit: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SuppliersTable({ suppliers, canEdit }: SuppliersTableProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleDeactivate(id: string) {
    startTransition(async () => {
      await deactivateSupplier(id)
      router.refresh()
    })
  }

  if (suppliers.length === 0) {
    return (
      <EmptyState
        icon={Truck}
        title="Nenhum fornecedor cadastrado"
        description="Cadastre fornecedores para vinculá-los às contas a pagar da clínica."
      />
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>CNPJ / CPF</TableHead>
          <TableHead>Vínculo</TableHead>
          <TableHead className="w-20">Status</TableHead>
          {canEdit && <TableHead className="w-32">Ações</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {suppliers.map((supplier) => (
          <TableRow key={supplier.id}>
            {/* Nome */}
            <TableCell>
              <div className="text-sm font-normal text-foreground">{supplier.name}</div>
            </TableCell>

            {/* Tipo */}
            <TableCell className="text-sm text-muted-foreground">
              {TIPO_LABELS[supplier.tipo] ?? supplier.tipo}
            </TableCell>

            {/* CNPJ/CPF */}
            <TableCell className="text-sm text-muted-foreground">
              {supplier.cnpj_cpf ?? '—'}
            </TableCell>

            {/* Vínculo */}
            <TableCell className="text-sm text-muted-foreground">
              {supplier.vinculo ? (VINCULO_LABELS[supplier.vinculo] ?? supplier.vinculo) : '—'}
            </TableCell>

            {/* Status badge */}
            <TableCell>
              <Badge variant="outline">
                {supplier.ativo ? 'Ativo' : 'Inativo'}
              </Badge>
            </TableCell>

            {/* Ações — admin only */}
            {canEdit && (
              <TableCell>
                <div className="flex items-center gap-2">
                  {/* Edit → SupplierFormDialog */}
                  <SupplierFormDialog
                    mode="edit"
                    supplier={supplier}
                    trigger={
                      <Button size="sm" variant="outline">
                        Editar
                      </Button>
                    }
                  />

                  {/* Desativar — only for active suppliers */}
                  {supplier.ativo === true && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeactivate(supplier.id)}
                      disabled={isPending}
                    >
                      Desativar
                    </Button>
                  )}
                </div>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
