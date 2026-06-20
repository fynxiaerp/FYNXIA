'use client'
// src/components/financeiro/BankAccountsTable.tsx
// FCAD-01: Tabular list of bank_accounts with edit action.
// Pattern: shadcn Table + inline Dialog — mirrors UnitsManager.tsx.
// UI-SPEC §"BankAccountsTable", §"Copywriting Contract".
// T-14-18: listBankAccounts runs under RLS; canEdit gates UI actions.

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Landmark } from 'lucide-react'

import { formatBRL } from '@/lib/format/money'
import type { BankAccountRow } from '@/actions/bank-accounts'
import { BankAccountFormDialog } from '@/components/financeiro/BankAccountFormDialog'
import { EmptyState } from '@/components/shell/EmptyState'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BankAccountsTableProps {
  accounts: BankAccountRow[]
  canEdit: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BankAccountsTable({ accounts, canEdit }: BankAccountsTableProps) {
  if (accounts.length === 0) {
    return (
      <EmptyState
        icon={Landmark}
        title="Nenhuma conta corrente cadastrada"
        description="Vincule os lançamentos a contas bancárias para facilitar a conciliação futura."
      />
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome / Apelido</TableHead>
          <TableHead>Banco</TableHead>
          <TableHead>Agência / Conta</TableHead>
          <TableHead className="w-[120px] text-right">Saldo Inicial</TableHead>
          {canEdit && <TableHead className="w-20">Ações</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {accounts.map((account) => (
          <TableRow key={account.id}>
            {/* Nome / Apelido */}
            <TableCell className="text-sm font-semibold text-foreground">
              {account.name}
            </TableCell>

            {/* Banco */}
            <TableCell className="text-sm text-muted-foreground">
              {account.banco ?? '—'}
            </TableCell>

            {/* Agência / Conta */}
            <TableCell className="font-mono tabular-nums text-sm text-foreground">
              {account.agencia && account.conta
                ? `${account.agencia} / ${account.conta}`
                : account.agencia ?? account.conta ?? '—'}
            </TableCell>

            {/* Saldo Inicial — right-aligned, semibold, tabular-nums */}
            <TableCell className="text-sm font-semibold tabular-nums text-right text-foreground">
              {formatBRL(account.saldo_inicial)}
            </TableCell>

            {/* Ações — admin only */}
            {canEdit && (
              <TableCell>
                <BankAccountFormDialog
                  mode="edit"
                  account={account}
                  trigger={
                    <Button size="sm" variant="outline">
                      Editar
                    </Button>
                  }
                />
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
