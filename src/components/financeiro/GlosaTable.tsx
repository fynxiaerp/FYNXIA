'use client'

import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatBRL } from '@/lib/format/money'

// TISS status badge contract per UI-SPEC (glosa subset)
const GLOSA_STATUS: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  em_analise: { label: 'Em análise', variant: 'outline' },
  glosada:    { label: 'Glosada',    variant: 'destructive' },
  em_recurso: { label: 'Recurso',    variant: 'outline' },
  paga:       { label: 'Paga',       variant: 'default' },
}

export interface GlosaRow {
  id: string
  guide_id: string
  description: string
  valor_total: number
  valor_glosado: number
  glosa_status: string | null
  recurso_texto: string | null
  motivo_codigo: string | null
  motivo_descricao: string | null
  insurer_name: string | null
  patient_maskedName: string | null
}

interface GlosaTableProps {
  rows: GlosaRow[]
  onRegistrarRecurso?: (row: GlosaRow) => void
}

export function GlosaTable({ rows, onRegistrarRecurso }: GlosaTableProps) {
  if (rows.length === 0) {
    return (
      <div className="py-12 text-center space-y-1">
        <p className="text-sm font-semibold">Nenhuma glosa registrada</p>
        <p className="text-sm text-muted-foreground">
          Glosas recebidas das operadoras aparecem aqui para classificação e recurso.
        </p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Guia</TableHead>
          <TableHead>Paciente</TableHead>
          <TableHead>Operadora</TableHead>
          <TableHead>Procedimento</TableHead>
          <TableHead>Motivo ANS</TableHead>
          <TableHead className="text-right">Valor glosado</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-[140px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const st = GLOSA_STATUS[row.glosa_status ?? ''] ?? { label: row.glosa_status ?? '—', variant: 'outline' as const }
          const canRecurso = row.glosa_status === 'glosada'
          return (
            <TableRow key={row.id}>
              <TableCell className="font-medium tabular-nums">{row.guide_id.slice(-8)}</TableCell>
              <TableCell>{row.patient_maskedName ?? '—'}</TableCell>
              <TableCell className="text-muted-foreground">{row.insurer_name ?? '—'}</TableCell>
              <TableCell className="max-w-[160px] truncate text-muted-foreground">
                {row.description}
              </TableCell>
              <TableCell>
                {row.motivo_codigo ? (
                  <Badge variant="outline" title={row.motivo_descricao ?? undefined}>
                    {row.motivo_codigo}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums text-destructive font-medium">
                {formatBRL(row.valor_glosado)}
              </TableCell>
              <TableCell>
                <Badge variant={st.variant}>{st.label}</Badge>
              </TableCell>
              <TableCell>
                {canRecurso && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onRegistrarRecurso?.(row)}
                  >
                    Registrar recurso
                  </Button>
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
