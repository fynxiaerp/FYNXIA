'use client'

import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { MoreHorizontal } from 'lucide-react'
import { formatBRL } from '@/lib/format/money'

// TISS status badge contract per UI-SPEC
const TISS_STATUS: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  paga: { label: 'Paga', variant: 'default' },
  autorizada: { label: 'Autorizada', variant: 'secondary' },
  em_analise: { label: 'Em análise', variant: 'outline' },
  glosada: { label: 'Glosada', variant: 'destructive' },
  recurso: { label: 'Recurso', variant: 'outline' },
}

export interface TissGuideRow {
  id: string
  numero_guia: string
  status: string
  valor_total: number
  valor_glosado: number
  valor_autorizado: number | null
  protocolo: string | null
  created_at: string
  insurer_name: string | null
  patient_maskedName: string | null
}

interface TissGuidesTableProps {
  guides: TissGuideRow[]
  onVerGuia?: (guide: TissGuideRow) => void
  onRegistrarRecurso?: (guide: TissGuideRow) => void
}

export function TissGuidesTable({ guides, onVerGuia, onRegistrarRecurso }: TissGuidesTableProps) {
  if (guides.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Nenhuma guia TISS emitida
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Guia</TableHead>
          <TableHead>Paciente</TableHead>
          <TableHead>Convênio</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Valor</TableHead>
          <TableHead className="w-[50px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {guides.map((g) => {
          const s = TISS_STATUS[g.status] ?? { label: g.status, variant: 'outline' as const }
          return (
            <TableRow key={g.id}>
              <TableCell className="font-medium tabular-nums">{g.numero_guia}</TableCell>
              <TableCell>{g.patient_maskedName ?? '—'}</TableCell>
              <TableCell className="text-muted-foreground">{g.insurer_name ?? '—'}</TableCell>
              <TableCell>
                <Badge variant={s.variant}>{s.label}</Badge>
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {formatBRL(g.valor_total)}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button variant="ghost" size="icon" className="size-8" aria-label="Ações" />}
                  >
                    <MoreHorizontal className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onVerGuia?.(g)}>
                      Ver guia
                    </DropdownMenuItem>
                    {g.status === 'glosada' && (
                      <DropdownMenuItem onClick={() => onRegistrarRecurso?.(g)}>
                        Registrar recurso
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
