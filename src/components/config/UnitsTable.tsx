'use client'
// src/components/config/UnitsTable.tsx
// Tabular list of units with edit dialog + deactivate (soft-delete) action.
// Pattern: mirrors SuppliersTable.tsx / CostCentersTable.tsx exactly.
// T-qji-03: canEdit gate — UI hides actions; real boundary is deactivateUnit admin check.
// T-qji-04: default unit's Excluir button is always disabled (is_default guard).

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Building2 } from 'lucide-react'

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

import { deactivateUnit } from '@/actions/units'
import type { UnitRow } from '@/actions/units'
import { UnitFormDialog } from '@/components/config/UnitFormDialog'
import { EmptyState } from '@/components/shell/EmptyState'

// ─── Types ────────────────────────────────────────────────────────────────────

interface UnitsTableProps {
  units: UnitRow[]
  canEdit: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export function UnitsTable({ units, canEdit }: UnitsTableProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleDeactivate(id: string) {
    startTransition(async () => {
      await deactivateUnit(id)
      router.refresh()
    })
  }

  if (units.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="Nenhuma unidade cadastrada"
        description="Cadastre as unidades (filiais) da sua rede para vinculá-las a centros de custo e lançamentos."
      />
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Slug</TableHead>
          <TableHead>CNPJ</TableHead>
          <TableHead className="w-24">Status</TableHead>
          {canEdit && <TableHead className="w-40">Ações</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {units.map((unit) => (
          <TableRow key={unit.id}>
            {/* Nome — with "Padrão" badge for the default unit */}
            <TableCell>
              <div className="flex items-center gap-2">
                <span className="text-sm font-normal text-foreground">{unit.name}</span>
                {unit.is_default && (
                  <Badge variant="secondary" className="text-xs">
                    Padrão
                  </Badge>
                )}
              </div>
            </TableCell>

            {/* Slug */}
            <TableCell className="text-sm text-muted-foreground">{unit.slug}</TableCell>

            {/* CNPJ */}
            <TableCell className="text-sm text-muted-foreground">
              {unit.cnpj ?? '—'}
            </TableCell>

            {/* Status badge */}
            <TableCell>
              <Badge variant="outline">
                {unit.ativo ? 'Ativa' : 'Inativa'}
              </Badge>
            </TableCell>

            {/* Ações — admin only */}
            {canEdit && (
              <TableCell>
                <div className="flex items-center gap-2">
                  {/* Edit */}
                  <UnitFormDialog
                    mode="edit"
                    unit={unit}
                    trigger={
                      <Button size="sm" variant="outline">
                        Editar
                      </Button>
                    }
                  />

                  {/* Excluir (soft-delete) — disabled for the default unit */}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isPending || unit.is_default}
                    onClick={() => handleDeactivate(unit.id)}
                  >
                    Excluir
                  </Button>
                </div>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
