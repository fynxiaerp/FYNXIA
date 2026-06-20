'use client'
// src/components/financeiro/CostCentersTable.tsx
// FCAD-01: Tabular list of cost_centers with edit + ativo toggle.
// Pattern: shadcn Table + inline Dialog — mirrors UnitsManager.tsx.
// UI-SPEC §"CostCentersTable", §"Copywriting Contract".
// Typography: text-xs text-muted-foreground — SOLE permitted use for unit affiliation subtitle.
// T-14-17: canEdit gate — UI hides actions; real boundary is Server Action admin check.

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'

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
import { Switch } from '@/components/ui/switch'
import { Building2 } from 'lucide-react'

import { updateCostCenter } from '@/actions/cost-centers'
import type { CostCenterRow } from '@/actions/cost-centers'
import { CostCenterFormDialog } from '@/components/financeiro/CostCenterFormDialog'
import { EmptyState } from '@/components/shell/EmptyState'

// ─── Types ────────────────────────────────────────────────────────────────────

interface UnitOption {
  id: string
  name: string
}

interface CostCentersTableProps {
  centers: CostCenterRow[]
  units: UnitOption[]
  canEdit: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CostCentersTable({ centers, units, canEdit }: CostCentersTableProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleAtivo(center: CostCenterRow, newAtivo: boolean) {
    startTransition(async () => {
      await updateCostCenter({ id: center.id, ativo: newAtivo })
      router.refresh()
    })
  }

  if (centers.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="Nenhum centro de custo cadastrado"
        description="Os centros de custo agrupam lançamentos por unidade ou área. Ao menos um por unidade é necessário."
      />
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Unidade</TableHead>
          <TableHead className="w-20">Ativo</TableHead>
          {canEdit && <TableHead className="w-24">Ações</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {centers.map((center) => (
          <TableRow key={center.id}>
            {/* Nome — two-line cell: name + unit affiliation subtitle */}
            <TableCell>
              <div className="text-sm font-normal text-foreground">{center.name}</div>
              {center.unit_name && (
                <div className="text-xs text-muted-foreground">{center.unit_name}</div>
              )}
            </TableCell>

            {/* Unidade */}
            <TableCell className="text-sm text-muted-foreground">
              {center.unit_name ?? '—'}
            </TableCell>

            {/* Ativo badge */}
            <TableCell>
              <Badge variant="outline">
                {center.ativo ? 'Ativo' : 'Inativo'}
              </Badge>
            </TableCell>

            {/* Ações — admin only */}
            {canEdit && (
              <TableCell>
                <div className="flex items-center gap-2">
                  {/* Edit → CostCenterFormDialog */}
                  <CostCenterFormDialog
                    mode="edit"
                    center={center}
                    units={units}
                    trigger={
                      <Button size="sm" variant="outline">
                        Editar
                      </Button>
                    }
                  />

                  {/* Ativo toggle — useTransition */}
                  <Switch
                    checked={center.ativo}
                    onCheckedChange={(val) => handleAtivo(center, val)}
                    disabled={isPending}
                    aria-label={`Ativar/desativar ${center.name}`}
                  />
                </div>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
