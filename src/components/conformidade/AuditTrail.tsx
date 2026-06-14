'use client'
/**
 * AuditTrail — client component for the audit screen (AUD-01, AUD-03).
 *
 * nuqs URL state for shareable/bookmarkable filters (tableName, actorId,
 * dateFrom, dateTo, page). Renders a before/after diff table and an estorno
 * trigger dialog (admin/superadmin only — isReadOnly=true hides the button).
 *
 * RSC RULE: receives only serializable props — no functions/server objects
 * across the RSC boundary (T-09-25). Server Actions imported directly in
 * this file (not passed as props).
 *
 * SECURITY: createEstorno enforces assertNotReadOnly + Zod + alçada server-side.
 * The hidden button for read-only roles is cosmetic UX only (T-10-17).
 *
 * Phase: 10-ia-governada-l0-l4-auditoria-ocr / Plan 07
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryState } from 'nuqs'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Separator } from '@/components/ui/separator'

import { createEstorno } from '@/actions/audit-actions'
import type { AuditLogRow } from '@/lib/audit-query-types'

// ─── Estorno form schema (Zod v3) ─────────────────────────────────────────────

const estornoSchema = z.object({
  motivo: z.string().min(5, 'Motivo deve ter ao menos 5 caracteres'),
})

type EstornoFormData = z.infer<typeof estornoSchema>

// ─── Props ────────────────────────────────────────────────────────────────────

interface AuditTrailProps {
  /** Initial rows loaded by the RSC (serializable) */
  initialRows: AuditLogRow[]
  /** True for auditor/dpo — hides estorno trigger (cosmetic UX; server enforces) */
  isReadOnly: boolean
}

// ─── WR-03: PII masking for audit diff display ───────────────────────────────
// Masks known PII field keys in old_values/new_values before rendering.
// Auditors see structure and non-sensitive values; PII fields are redacted.
// This is a client-side display mask only — the server stores unmasked audit data
// for compliance purposes (LGPD Art. 37: DPO must be able to access full records
// via server-side export, not via this UI component).
// Note: masking.ts uses 'server-only' so we define the display mask inline here.

const PII_DISPLAY_FIELDS = new Set([
  'cpf',
  'phone',
  'telefone',
  'email',
  'rg',
  'date_of_birth',
  'data_nascimento',
  'medical_history',
  'historico_medico',
  'allergies',
  'alergias',
  'medications',
  'medicamentos',
  'health_notes',
  'observacoes_saude',
  'password',
  'senha',
])

function maskPiiFields(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj
  return Object.fromEntries(
    Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
      k,
      PII_DISPLAY_FIELDS.has(k.toLowerCase()) ? '***' : v,
    ])
  )
}

// ─── DiffBlock — renders before/after JSON side by side ──────────────────────

function DiffBlock({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">—</span>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <pre className="text-xs bg-muted/50 rounded p-2 overflow-auto max-h-40 whitespace-pre-wrap break-all border border-border">
        {JSON.stringify(maskPiiFields(value), null, 2)}
      </pre>
    </div>
  )
}

// ─── EstornoDialog ────────────────────────────────────────────────────────────

function EstornoDialog({
  row,
  onSuccess,
}: {
  row: AuditLogRow
  onSuccess: (msg: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const form = useForm<EstornoFormData>({
    resolver: zodResolver(estornoSchema),
    defaultValues: { motivo: '' },
  })

  function onSubmit(data: EstornoFormData) {
    setServerError(null)
    startTransition(async () => {
      const result = await createEstorno({
        tableName: row.table_name ?? '',
        recordId: row.record_id ?? '',
        reason: data.motivo,
      })
      if (result.success) {
        setOpen(false)
        form.reset()
        onSuccess('Estorno solicitado — aguardando aprovação')
      } else {
        setServerError(result.error ?? 'Erro ao solicitar estorno.')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            Estornar
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Solicitar Estorno</DialogTitle>
        </DialogHeader>

        <div className="text-sm text-muted-foreground">
          <p>
            Entidade:{' '}
            <span className="font-mono text-foreground">
              {row.table_name ?? '—'}
            </span>
          </p>
          <p>
            Registro:{' '}
            <span className="font-mono text-foreground">
              {row.record_id ? row.record_id.slice(0, 8) + '…' : '—'}
            </span>
          </p>
        </div>

        {serverError && (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="motivo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Descreva o motivo do estorno (mín. 5 caracteres)"
                      className="bg-background border-border text-foreground"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <DialogClose
                render={<Button variant="outline" type="button" />}
              >
                Cancelar
              </DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Solicitando...' : 'Solicitar Estorno'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

// ─── AuditTrail ───────────────────────────────────────────────────────────────

export function AuditTrail({ initialRows, isReadOnly }: AuditTrailProps) {
  const router = useRouter()
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // nuqs — URL-persisted filters (shareable, bookmarkable, browser history-safe)
  const [tableName, setTableName] = useQueryState('tableName', { defaultValue: '' })
  const [actorId, setActorId] = useQueryState('actorId', { defaultValue: '' })
  const [dateFrom, setDateFrom] = useQueryState('dateFrom', { defaultValue: '' })
  const [dateTo, setDateTo] = useQueryState('dateTo', { defaultValue: '' })
  const [_page, setPage] = useQueryState('page', {
    defaultValue: '0',
    parse: (v) => v,
    serialize: (v) => v,
  })

  // Derive current page number for display (the RSC re-fetches on navigation)
  const currentPage = parseInt(_page ?? '0', 10) || 0

  function applyFilters() {
    // Reset to page 0 and trigger RSC re-fetch via router.refresh()
    void setPage('0')
    router.refresh()
  }

  function clearFilters() {
    void setTableName('')
    void setActorId('')
    void setDateFrom('')
    void setDateTo('')
    void setPage('0')
    router.refresh()
  }

  function goToPage(page: number) {
    void setPage(String(page))
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* ── Success feedback ────────────────────────────────────────────────── */}
      {successMsg && (
        <Alert className="border-border bg-muted/50">
          <AlertDescription>{successMsg}</AlertDescription>
        </Alert>
      )}

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground">
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Entidade (tabela)
              </label>
              <Input
                placeholder="ex: patients, appointments"
                value={tableName}
                onChange={(e) => void setTableName(e.target.value)}
                className="bg-background border-border text-foreground text-sm"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                ID do Ator
              </label>
              <Input
                placeholder="UUID do usuário"
                value={actorId}
                onChange={(e) => void setActorId(e.target.value)}
                className="bg-background border-border text-foreground text-sm"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                De (data)
              </label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => void setDateFrom(e.target.value)}
                className="bg-background border-border text-foreground text-sm"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Até (data)
              </label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => void setDateTo(e.target.value)}
                className="bg-background border-border text-foreground text-sm"
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button size="sm" onClick={applyFilters}>
              Aplicar Filtros
            </Button>
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <Separator />

      {initialRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum registro de auditoria encontrado para os filtros selecionados.
        </p>
      ) : (
        <div className="space-y-3">
          {initialRows.map((row) => (
            <Card key={row.id} className="bg-card border-border">
              <CardContent className="pt-4 pb-4">
                {/* ── Row header ──────────────────────────────────────────── */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        {row.action}
                      </Badge>
                      {row.table_name && (
                        <Badge variant="secondary" className="text-xs">
                          {row.table_name}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mt-1">
                      <span>
                        Data:{' '}
                        <span className="font-mono text-foreground">
                          {new Date(row.created_at).toLocaleString('pt-BR')}
                        </span>
                      </span>
                      <span>
                        Registro:{' '}
                        <span className="font-mono text-foreground">
                          {row.record_id ? row.record_id.slice(0, 8) + '…' : '—'}
                        </span>
                      </span>
                      <span>
                        Ator:{' '}
                        <span className="font-mono text-foreground">
                          {row.actor_id ? row.actor_id.slice(0, 8) + '…' : 'sistema'}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Estorno trigger — hidden for auditor/dpo (isReadOnly=true) */}
                  {/* COSMETIC UX: server enforces assertNotReadOnly + alçada (T-10-17) */}
                  {!isReadOnly && row.table_name && row.record_id && (
                    <EstornoDialog
                      row={row}
                      onSuccess={(msg) => setSuccessMsg(msg)}
                    />
                  )}
                </div>

                {/* ── Before/After diff ──────────────────────────────────── */}
                {(row.old_values !== null || row.new_values !== null) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2 pt-4 border-t border-border">
                    {/* old_values — before state (AUD-01 before/after diff) */}
                    <DiffBlock label="Antes (old_values)" value={row.old_values} />
                    {/* new_values — after state (AUD-01 before/after diff) */}
                    <DiffBlock label="Depois (new_values)" value={row.new_values} />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Pagination ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => goToPage(Math.max(0, currentPage - 1))}
          disabled={currentPage === 0}
        >
          Anterior
        </Button>
        <span className="text-xs text-muted-foreground">
          Página {currentPage + 1}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => goToPage(currentPage + 1)}
          disabled={initialRows.length < 50}
        >
          Próxima
        </Button>
      </div>
    </div>
  )
}
