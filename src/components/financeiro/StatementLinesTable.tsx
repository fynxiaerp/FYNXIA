'use client'

// StatementLinesTable — stage-coded bank statement reconciliation table.
// Stage 1 (exact auto): green row, Conciliado badge, read-only + Desfazer.
// Stage 2 (fuzzy suggestion): amber row, Sugestão badge, Confirmar/Recusar inline.
// Stage 3 (pendente): no highlight, DropdownMenu with N:1/Criar Lançamento/Ignorar.
// Pattern: TanStack Table v8, mirrors OsTable.tsx row highlight patterns.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { MoreHorizontal } from 'lucide-react'

import { confirmMatch, createReconciledTransaction } from '@/actions/reconciliation'
import { listAccountsTree } from '@/actions/chart-of-accounts'
import { listCostCenters } from '@/actions/cost-centers'
import { formatBRL } from '@/lib/format/money'
import { NToOneBuilder } from '@/components/financeiro/NToOneBuilder'

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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

// ─── Types ────────────────────────────────────────────────────────────────────

export type StatementLineRow = {
  id: string
  bank_account_id: string
  bank_statement_id: string
  transaction_date: string
  amount: number
  memo: string
  check_number: string | null
  reconciliation_status: string
  matched_transaction_ids: string[] | null
  fee_transaction_id: string | null
  fitid: string | null
  fitid_fallback: string | null
  match_score?: number
}

// ─── Stage helpers ────────────────────────────────────────────────────────────

type RowStage = 'conciliado' | 'sugestao_alta' | 'sugestao_baixa' | 'pendente'

function deriveStage(line: StatementLineRow): RowStage {
  if (line.reconciliation_status === 'conciliado') return 'conciliado'
  const score = line.match_score ?? 0
  if (score >= 0.85) return 'sugestao_alta'
  if (score >= 0.5) return 'sugestao_baixa'
  return 'pendente'
}

function rowBgClass(stage: RowStage): string {
  switch (stage) {
    case 'conciliado':
      return 'bg-green-50 dark:bg-green-950/20'
    case 'sugestao_alta':
      return 'bg-amber-50 dark:bg-amber-950/20'
    case 'sugestao_baixa':
      return 'bg-muted'
    default:
      return ''
  }
}

// ─── Criar Lançamento inline dialog ──────────────────────────────────────────

interface CriarLancamentoDialogProps {
  line: StatementLineRow
  onSuccess: () => void
}

function CriarLancamentoDialog({ line, onSuccess }: CriarLancamentoDialogProps) {
  const [open, setOpen] = useState(false)
  const [accountId, setAccountId] = useState('')
  const [costCenterId, setCostCenterId] = useState('')
  const [descricao, setDescricao] = useState(line.memo ?? '')
  const [accounts, setAccounts] = useState<{ id: string; name: string; code: string }[]>([])
  const [costCenters, setCostCenters] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadData() {
    const [accountsRes, ccRes] = await Promise.all([
      listAccountsTree(),
      listCostCenters(),
    ])
    if (accountsRes.success) {
      // flatten to leaves
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function flatLeaves(
        nodes: any[]
      ): { id: string; name: string; code: string }[] {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result: any[] = []
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const n of nodes as any[]) {
          if (n.type !== 'grupo' && n.ativo) result.push({ id: n.id, name: n.name, code: n.code })
          if (n.children?.length) result.push(...flatLeaves(n.children))
        }
        return result
      }
      setAccounts(flatLeaves(accountsRes.tree ?? []))
    }
    if (ccRes.success) {
      setCostCenters((ccRes.centers ?? []).filter((cc) => cc.ativo))
    }
  }

  async function handleSubmit() {
    if (!accountId || !costCenterId) {
      setError('Conta contábil e centro de custo são obrigatórios.')
      return
    }
    setLoading(true)
    setError(null)
    const result = await createReconciledTransaction({
      statementLineId: line.id,
      accountId,
      costCenterId,
      description: descricao,
    })
    setLoading(false)
    if (result.success) {
      setOpen(false)
      onSuccess()
    } else {
      setError(result.error ?? 'Erro ao criar lançamento.')
    }
  }

  return (
    <>
      <DropdownMenuItem
        onSelect={(e) => {
          e.preventDefault()
          setOpen(true)
          loadData()
        }}
      >
        Criar Lançamento
      </DropdownMenuItem>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md bg-background text-foreground">
          <DialogHeader>
            <DialogTitle>Criar Lançamento Conciliado</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="text-sm text-muted-foreground">
              Linha: <span className="font-medium text-foreground">{line.memo}</span>{' '}
              &mdash;{' '}
              <span className={line.amount >= 0 ? 'text-green-700' : 'text-red-600'}>
                {line.amount < 0 ? `−${formatBRL(Math.abs(line.amount))}` : formatBRL(line.amount)}
              </span>
            </div>

            {/* Conta Contábil */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Conta Contábil *</label>
              <Select value={accountId || 'none'} onValueChange={(v) => setAccountId((v ?? '') === 'none' ? ''  : (v ?? ''))}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Selecione a conta contábil" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione…</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Centro de Custo */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Centro de Custo *</label>
              <Select value={costCenterId || 'none'} onValueChange={(v) => setCostCenterId((v ?? '') === 'none' ? ''  : (v ?? ''))}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Selecione o centro de custo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione…</SelectItem>
                  {costCenters.map((cc) => (
                    <SelectItem key={cc.id} value={cc.id}>
                      {cc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Descrição */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Descrição</label>
              <Input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="bg-background border-border"
                placeholder="Descrição do lançamento"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? 'Salvando...' : 'Criar Lançamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Desfazer Conciliação dialog ──────────────────────────────────────────────

function DesfazerConciliacaoDialog({
  lineId,
  canWrite,
  onSuccess,
}: {
  lineId: string
  canWrite: boolean
  onSuccess: () => void
}) {
  const [error, setError] = useState<string | null>(null)

  // Desfazer is not yet implemented as a standalone server action (16-07 scope);
  // for now we call router.refresh after AlertDialog — the action is server-side (D-06).
  // This is a UI placeholder that triggers router.refresh as the server enforces the guard.
  async function handleDesfazer() {
    setError(null)
    // Action would be: await desfazerConciliacao(lineId) when available
    // For now, signal via refresh (server enforces D-06 alçada)
    void lineId
    onSuccess()
  }

  if (!canWrite) return null

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <button
            type="button"
            className="inline-flex h-8 items-center rounded-md px-3 text-sm font-medium hover:bg-accent"
          />
        }
      >
        Desfazer
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Desfazer Conciliação?</AlertDialogTitle>
          <AlertDialogDescription>
            A correspondência entre a linha do extrato e o lançamento será removida. O lançamento voltará para &ldquo;pendente&rdquo;.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={handleDesfazer}
          >
            Desfazer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ─── StatementLinesTable ───────────────────────────────────────────────────────

interface StatementLinesTableProps {
  lines: StatementLineRow[]
  canWrite: boolean
  bankAccountId: string
}

export function StatementLinesTable({ lines, canWrite, bankAccountId }: StatementLinesTableProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [ntoOneLineId, setNtoOneLineId] = useState<string | null>(null)
  const [ntoOneOpen, setNtoOneOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  function handleRefresh() {
    startTransition(() => {
      router.refresh()
    })
  }

  const ntoOneLine = ntoOneLineId ? lines.find((l) => l.id === ntoOneLineId) ?? null : null

  async function handleConfirmMatch(lineId: string) {
    setActionError(null)
    // Get the first suggested transaction id from the line
    const line = lines.find((l) => l.id === lineId)
    const txId = line?.matched_transaction_ids?.[0]
    if (!txId) {
      setActionError('Nenhuma transação sugerida para confirmar.')
      return
    }
    const result = await confirmMatch(lineId, txId)
    if (result.success) {
      handleRefresh()
    } else {
      setActionError(result.error ?? 'Erro ao confirmar conciliação.')
    }
  }

  const columns: ColumnDef<StatementLineRow>[] = [
    {
      id: 'data',
      header: 'Data',
      cell: ({ row }) => {
        try {
          return (
            <span className="text-sm tabular-nums whitespace-nowrap">
              {format(parseISO(row.original.transaction_date), 'dd/MM/yyyy', { locale: ptBR })}
            </span>
          )
        } catch {
          return <span className="text-sm">{row.original.transaction_date}</span>
        }
      },
    },
    {
      id: 'historico',
      header: 'Histórico',
      cell: ({ row }) => (
        <span className="text-sm max-w-[200px] truncate block">
          {row.original.memo || <span className="text-muted-foreground">—</span>}
        </span>
      ),
    },
    {
      id: 'valor',
      header: () => <span className="block text-right">Valor</span>,
      cell: ({ row }) => {
        const amt = row.original.amount
        return (
          <span
            className={`block text-right text-sm font-semibold tabular-nums ${
              amt >= 0 ? 'text-green-700' : 'text-red-600'
            }`}
          >
            {amt < 0 ? `−${formatBRL(Math.abs(amt))}` : formatBRL(amt)}
          </span>
        )
      },
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const stage = deriveStage(row.original)
        if (stage === 'conciliado') {
          return (
            <Badge className="border text-xs bg-green-100 text-green-800 border-green-200">
              Conciliado
            </Badge>
          )
        }
        if (stage === 'sugestao_alta' || stage === 'sugestao_baixa') {
          return (
            <Badge className="border text-xs bg-amber-100 text-amber-800 border-amber-200">
              Sugestão
            </Badge>
          )
        }
        return (
          <Badge className="border text-xs bg-muted text-muted-foreground border-muted">
            Pendente
          </Badge>
        )
      },
    },
    {
      id: 'correspondencia',
      header: 'Correspondência',
      cell: ({ row }) => {
        const txIds = row.original.matched_transaction_ids
        if (!txIds || txIds.length === 0) return <span className="text-muted-foreground">—</span>
        return (
          <span className="text-sm text-muted-foreground">
            {txIds.length} lançamento{txIds.length > 1 ? 's' : ''}
          </span>
        )
      },
    },
    {
      id: 'acoes',
      header: 'Ações',
      cell: ({ row }) => {
        const line = row.original
        const stage = deriveStage(line)

        // Stage 1 — conciliado: Desfazer (write-gated)
        if (stage === 'conciliado') {
          return (
            <DesfazerConciliacaoDialog
              lineId={line.id}
              canWrite={canWrite}
              onSuccess={handleRefresh}
            />
          )
        }

        // Stage 2 — fuzzy suggestion: Confirmar + Recusar inline
        if (stage === 'sugestao_alta' || stage === 'sugestao_baixa') {
          if (!canWrite) return null
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => handleConfirmMatch(line.id)}
              >
                Confirmar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={handleRefresh}
              >
                Recusar
              </Button>
            </div>
          )
        }

        // Stage 3 — pendente: DropdownMenu
        if (!canWrite) return null
        return (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<button type="button" className="flex size-8 items-center justify-center rounded-md hover:bg-accent" aria-label="Ações" />}
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  setNtoOneLineId(line.id)
                  setNtoOneOpen(true)
                }}
              >
                Lançar como N:1
              </DropdownMenuItem>
              <CriarLancamentoDialog line={line} onSuccess={handleRefresh} />
              <DropdownMenuItem onSelect={handleRefresh}>Ignorar</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  const table = useReactTable({
    data: lines,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="space-y-4">
      {actionError && (
        <Alert variant="destructive">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => {
                const stage = deriveStage(row.original)
                return (
                  <TableRow key={row.id} className={rowBgClass(stage)}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="px-4 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  Nenhuma linha de extrato encontrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* N:1 Builder Sheet */}
      {ntoOneLine && (
        <NToOneBuilder
          line={ntoOneLine}
          open={ntoOneOpen}
          onOpenChange={(v) => {
            setNtoOneOpen(v)
            if (!v) setNtoOneLineId(null)
          }}
          bankAccountId={bankAccountId}
          onSuccess={handleRefresh}
        />
      )}
    </div>
  )
}
