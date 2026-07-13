'use client'

// ConversionByOriginTable — aggregated conversion table fed by
// listConversionByOrigin() (CRC-01/02, D-06). Sorted by Taxa de Conversão
// desc (default, no interactive re-sort needed per UI-SPEC §2b). No chart
// library installed for this phase — table only.

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ConversionByOriginRow } from '@/actions/leads'

interface ConversionByOriginTableProps {
  data: ConversionByOriginRow[]
}

export function ConversionByOriginTable({ data }: ConversionByOriginTableProps) {
  const overallAvg =
    data.length > 0 ? data.reduce((sum, row) => sum + row.conversionRate, 0) / data.length : 0

  const sorted = [...data].sort((a, b) => b.conversionRate - a.conversionRate)

  if (sorted.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nenhum dado de conversão disponível ainda.
      </p>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Origem</TableHead>
            <TableHead className="text-right">Total de Leads</TableHead>
            <TableHead className="text-right">Convertidos</TableHead>
            <TableHead className="text-right">Taxa de Conversão</TableHead>
            <TableHead className="text-right">Perdidos</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row) => {
            const pct = Math.round(row.conversionRate * 1000) / 10
            const isAboveAvg = row.total > 0 && row.conversionRate >= overallAvg
            return (
              <TableRow key={row.sourceId}>
                <TableCell>
                  <Badge variant="outline">{row.sourceName}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.total}</TableCell>
                <TableCell className="text-right tabular-nums">{row.converted}</TableCell>
                <TableCell
                  className={cn(
                    'text-right tabular-nums font-medium',
                    isAboveAvg ? 'text-green-700 dark:text-green-400' : 'text-foreground'
                  )}
                >
                  {pct}%
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.lost}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
