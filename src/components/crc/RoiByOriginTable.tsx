'use client'

// RoiByOriginTable — Conversão e ROI por Origem (CRC-02, D-06 second
// requirement). Fed by getRoiByOrigin() (src/actions/roi.ts). No chart
// library installed for this phase — table only, mirrors
// ConversionByOriginTable.tsx. custoAtribuido/CPL/CAC render '—' when the
// source has no campaign-linked cost.

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatBRL } from '@/lib/format/money'
import type { RoiOriginRow } from '@/actions/roi'

interface RoiByOriginTableProps {
  data: RoiOriginRow[]
}

export function RoiByOriginTable({ data }: RoiByOriginTableProps) {
  const sorted = [...data].sort((a, b) => b.taxaConversao - a.taxaConversao)

  if (sorted.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nenhum dado de conversão por origem disponível ainda.
      </p>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Origem</TableHead>
            <TableHead className="text-right">Leads</TableHead>
            <TableHead className="text-right">Convertidos</TableHead>
            <TableHead className="text-right">Taxa de Conversão</TableHead>
            <TableHead className="text-right">Custo Atribuído</TableHead>
            <TableHead className="text-right">CPL</TableHead>
            <TableHead className="text-right">CAC</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row) => {
            const pct = Math.round(row.taxaConversao * 1000) / 10
            return (
              <TableRow key={row.sourceId}>
                <TableCell className="font-medium">{row.sourceName}</TableCell>
                <TableCell className="text-right tabular-nums">{row.leads}</TableCell>
                <TableCell className="text-right tabular-nums">{row.convertidos}</TableCell>
                <TableCell className="text-right tabular-nums">{pct}%</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.custoAtribuido !== null ? formatBRL(row.custoAtribuido) : '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.cpl !== null ? formatBRL(row.cpl) : '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.cac !== null ? formatBRL(row.cac) : '—'}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
