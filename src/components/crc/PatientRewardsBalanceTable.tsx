'use client'

// PatientRewardsBalanceTable — per-patient referral rewards balance (CRC-05,
// D-19: internal view now, data modeled for the Phase 20 patient portal).
// Fed by listRewardsBalance() (Plan 04) for the aggregate columns; the
// "Ver Extrato" Sheet derives its read-only credit history from the same
// listReferrals() rows already fetched by the indicações page (filtered by
// referrerPatientId + creditedAt not null) — no new server action needed,
// since referral_rewards credit events map 1:1 to a credited referral row.
//
// T-18-34: NO write action is exposed here — no manual balance edit, no
// "uso" (redemption) rows in v1 (RESEARCH Open Question 2). Balance is
// entirely derived server-side.

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { MoreHorizontal } from 'lucide-react'

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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { formatBRL } from '@/lib/format/money'
import type { RewardsBalanceRow, ReferralRow } from '@/actions/referrals'

interface PatientRewardsBalanceTableProps {
  data: RewardsBalanceRow[]
  referrals: ReferralRow[]
}

export function PatientRewardsBalanceTable({
  data,
  referrals,
}: PatientRewardsBalanceTableProps) {
  const [statementPatient, setStatementPatient] = useState<RewardsBalanceRow | null>(null)

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nenhum saldo de recompensas registrado.
      </p>
    )
  }

  const statementRows = statementPatient
    ? referrals.filter(
        (r) => r.referrerPatientId === statementPatient.patientId && r.creditedAt !== null
      )
    : []

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Paciente</TableHead>
              <TableHead className="text-right">Indicações Convertidas</TableHead>
              <TableHead className="text-right">Saldo Total de Crédito</TableHead>
              <TableHead className="text-right">Saldo Utilizado</TableHead>
              <TableHead className="text-right">Saldo Disponível</TableHead>
              <TableHead className="w-10" aria-label="Ações" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.patientId}>
                <TableCell className="font-medium">{row.patientName ?? '—'}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.indicacoesConvertidas}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatBRL(row.saldoTotal)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatBRL(row.saldoUtilizado)}
                </TableCell>
                <TableCell className="text-right tabular-nums font-semibold text-green-700 dark:text-green-400">
                  {formatBRL(row.saldoDisponivel)}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <button
                          type="button"
                          className="flex size-8 items-center justify-center rounded-md hover:bg-accent"
                          aria-label={`Ações para ${row.patientName ?? 'paciente'}`}
                        />
                      }
                    >
                      <MoreHorizontal className="size-4 pointer-events-none" aria-hidden="true" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setStatementPatient(row)}>
                        Ver Extrato
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet
        open={statementPatient !== null}
        onOpenChange={(open) => {
          if (!open) setStatementPatient(null)
        }}
      >
        <SheetContent side="right" className="flex flex-col sm:max-w-md">
          {statementPatient && (
            <>
              <SheetHeader>
                <SheetTitle>{statementPatient.patientName ?? 'Paciente'}</SheetTitle>
                <SheetDescription>
                  Extrato de crédito de indicação — leitura apenas.
                </SheetDescription>
              </SheetHeader>
              <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
                <p className="text-sm text-muted-foreground">
                  Crédito de indicação: {formatBRL(statementPatient.saldoDisponivel)} — disponível
                  para uso em serviços
                </p>

                {statementRows.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum crédito registrado ainda.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {statementRows.map((r) => (
                      <li
                        key={r.id}
                        className="flex items-center justify-between border-b border-border pb-2 text-sm"
                      >
                        <div className="space-y-0.5">
                          <p className="font-medium">Indicação de {r.leadName ?? '—'}</p>
                          <p className="text-xs text-muted-foreground">
                            {r.creditedAt
                              ? format(parseISO(r.creditedAt), 'dd/MM/yyyy', { locale: ptBR })
                              : '—'}
                          </p>
                        </div>
                        <span className="font-semibold tabular-nums text-green-700 dark:text-green-400">
                          {r.rewardAmount !== null ? formatBRL(r.rewardAmount) : '—'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
