'use client'

// ReferralsTable — indicações list (CRC-05, D-16/D-18) fed by listReferrals()
// (Plan 04). Columns: Indicador, Indicado, Status da Indicação (badge = the
// referred lead's funil stage, reusing the funil color mapping — UI-SPEC §3
// "Estágio" table), Recompensa (formatBRL green+semibold when credited, else
// "Pendente" muted), Data da Indicação.

import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

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
import { formatBRL } from '@/lib/format/money'
import type { ReferralRow } from '@/actions/referrals'
import type { LeadStage } from '@/lib/validators/crc'

const STAGE_LABELS: Record<LeadStage, string> = {
  novo: 'Novo',
  contatado: 'Contatado',
  agendado: 'Agendado',
  convertido: 'Convertido',
  perdido: 'Perdido',
}

// UI-SPEC §Color — reuse the funil stage badge mapping.
const STAGE_BADGE_CLASS: Record<LeadStage, string | undefined> = {
  novo: undefined, // variant="secondary"
  contatado: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  agendado: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  convertido: undefined, // variant="default" (accent)
  perdido: undefined, // variant="destructive"
}

function StageBadge({ stage }: { stage: LeadStage | null }) {
  if (!stage) {
    return <Badge variant="outline">—</Badge>
  }
  if (stage === 'convertido') {
    return <Badge variant="default">{STAGE_LABELS[stage]}</Badge>
  }
  if (stage === 'perdido') {
    return <Badge variant="destructive">{STAGE_LABELS[stage]}</Badge>
  }
  if (stage === 'novo') {
    return <Badge variant="secondary">{STAGE_LABELS[stage]}</Badge>
  }
  return <Badge className={cn(STAGE_BADGE_CLASS[stage])}>{STAGE_LABELS[stage]}</Badge>
}

interface ReferralsTableProps {
  data: ReferralRow[]
}

export function ReferralsTable({ data }: ReferralsTableProps) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nenhuma indicação registrada.
      </p>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Indicador</TableHead>
            <TableHead>Indicado</TableHead>
            <TableHead>Status da Indicação</TableHead>
            <TableHead className="text-right">Recompensa</TableHead>
            <TableHead className="text-right">Data da Indicação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{row.referrerName ?? '—'}</TableCell>
              <TableCell>{row.leadName ?? '—'}</TableCell>
              <TableCell>
                <StageBadge stage={row.leadStage as LeadStage | null} />
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {row.creditedAt && row.rewardAmount !== null ? (
                  <span className="font-semibold text-green-700 dark:text-green-400">
                    {formatBRL(row.rewardAmount)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Pendente</span>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {format(parseISO(row.createdAt), 'dd/MM/yyyy', { locale: ptBR })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
