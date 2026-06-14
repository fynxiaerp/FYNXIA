'use client'
/**
 * ApprovalInbox — client component for the approval inbox (AIG-02, AUD-02).
 *
 * Lists pending approval_requests (ai_action + estorno). Approve/Reject buttons
 * call the approveRequest/rejectRequest Server Actions. Approve/Reject are
 * DISABLED cosmetically when canApprove(actorRole, request.required_role) is
 * false (UX only — server enforces assertNotReadOnly + canApprove regardless).
 *
 * CRITICAL SECURITY NOTE (T-10-29):
 *   The real enforcement gate is server-side: approveRequest/rejectRequest in
 *   src/actions/approval-actions.ts call:
 *     1. await assertNotReadOnly()   — blocks auditor/dpo/socio
 *     2. canApprove(actor.role, request.required_role) — alçada check
 *   The client disable is cosmetic UX only. Never rely on this component's
 *   disable state as the security boundary.
 *
 * PII guard (T-10-30): Only table/record IDs + masked fields from payload are
 * rendered. Raw CPF is never echoed — payloads use IDs from Plans 03/04.
 *
 * RSC RULE: only serializable props received — no functions/server objects.
 *
 * Phase: 10-ia-governada-l0-l4-auditoria-ocr / Plan 07 (AIG-02, AUD-02)
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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
  CardDescription,
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

import { approveRequest, rejectRequest } from '@/actions/approval-actions'
import { canApprove } from '@/lib/ai/policy-types'
import type { ApprovalRequestRow } from '@/app/(dashboard)/conformidade/aprovacoes/page'

// ─── Reject form schema (Zod v3) ──────────────────────────────────────────────

const rejectSchema = z.object({
  reason: z.string().min(5, 'Motivo deve ter ao menos 5 caracteres'),
})

type RejectFormData = z.infer<typeof rejectSchema>

// ─── Props ────────────────────────────────────────────────────────────────────

interface ApprovalInboxProps {
  pendingRequests: ApprovalRequestRow[]
  /** Current actor's role — used for cosmetic canApprove disable (UX only). */
  actorRole: string
}

// ─── Helper: human-readable request summary ──────────────────────────────────
// PII guard: only render IDs, masked fields, action labels — never raw CPF (T-10-30)

function requestSummary(row: ApprovalRequestRow): string {
  const payload = row.payload ?? {}

  if (row.type === 'ai_action') {
    const agentKey = row.agent_key ?? 'desconhecido'
    const action = typeof payload.action === 'string' ? payload.action : 'ação'
    return `Ação de IA: ${agentKey} — ${action}`
  }

  if (row.type === 'estorno') {
    const tableName = typeof payload.tableName === 'string' ? payload.tableName : '—'
    const recordId =
      typeof payload.recordId === 'string'
        ? payload.recordId.slice(0, 8) + '…'
        : '—'
    const reason = typeof payload.reason === 'string' ? payload.reason : '—'
    return `Estorno: ${tableName} / ${recordId} — motivo: ${reason}`
  }

  return `Tipo: ${row.type}`
}

// ─── RejectDialog ─────────────────────────────────────────────────────────────

function RejectDialog({
  row,
  disabled,
  onSuccess,
}: {
  row: ApprovalRequestRow
  disabled: boolean
  onSuccess: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const form = useForm<RejectFormData>({
    resolver: zodResolver(rejectSchema),
    defaultValues: { reason: '' },
  })

  function onSubmit(data: RejectFormData) {
    setServerError(null)
    startTransition(async () => {
      // Server-side: assertNotReadOnly() + canApprove(actor.role, required_role)
      // are enforced before any state change (T-10-29).
      const result = await rejectRequest(row.id, data.reason)
      if (result.success) {
        setOpen(false)
        form.reset()
        onSuccess(row.id)
      } else {
        setServerError(result.error ?? 'Erro ao rejeitar solicitação.')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="destructive" size="sm" disabled={disabled}>
            Rejeitar
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rejeitar Solicitação</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          {requestSummary(row)}
        </p>

        {serverError && (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo da Rejeição *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Descreva o motivo (mín. 5 caracteres)"
                      className="bg-background border-border text-foreground"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>
                Cancelar
              </DialogClose>
              <Button type="submit" variant="destructive" disabled={isPending}>
                {isPending ? 'Rejeitando...' : 'Confirmar Rejeição'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

// ─── RequestCard ──────────────────────────────────────────────────────────────

function RequestCard({
  row,
  actorRole,
  onApproved,
  onRejected,
}: {
  row: ApprovalRequestRow
  actorRole: string
  onApproved: (id: string) => void
  onRejected: (id: string) => void
}) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Cosmetic canApprove disable (UX only — server enforces regardless, T-10-29)
  // assertNotReadOnly() + canApprove(actor.role, request.required_role) run
  // server-side in approval-actions.ts before any mutation.
  const canApproveCosmetic = canApprove(actorRole, row.required_role)

  function handleApprove() {
    setServerError(null)
    startTransition(async () => {
      const result = await approveRequest(row.id)
      if (result.success) {
        onApproved(row.id)
      } else {
        setServerError(result.error ?? 'Erro ao aprovar solicitação.')
      }
    })
  }

  const typeLabel =
    row.type === 'ai_action'
      ? 'Ação de IA'
      : row.type === 'estorno'
        ? 'Estorno'
        : row.type

  const alçadaLabel = row.required_role === 'admin' ? 'Admin' : row.required_role

  const createdAt = new Date(row.created_at).toLocaleString('pt-BR')
  const expiresAt = row.expires_at
    ? new Date(row.expires_at).toLocaleString('pt-BR')
    : null

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {typeLabel}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            Alçada: {alçadaLabel}
          </Badge>
        </div>
        <CardTitle className="text-sm text-foreground mt-1">
          {requestSummary(row)}
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Solicitado em: {createdAt}
          {expiresAt && ` · Expira em: ${expiresAt}`}
          {row.requested_by && (
            <span className="ml-2 font-mono">
              Por: {row.requested_by.slice(0, 8)}…
            </span>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-0">
        {serverError && (
          <Alert variant="destructive" className="mb-3">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        {!canApproveCosmetic && (
          <p className="text-xs text-muted-foreground mb-3">
            Seu papel ({actorRole}) não possui alçada suficiente para esta solicitação.
            O servidor bloqueará a ação mesmo que você tente enviá-la.
          </p>
        )}

        <div className="flex gap-2">
          {/* Approve button — cosmetically disabled when canApprove is false.
              SECURITY: assertNotReadOnly + canApprove enforced server-side (T-10-29) */}
          <Button
            size="sm"
            onClick={handleApprove}
            disabled={isPending || !canApproveCosmetic}
          >
            {isPending ? 'Aprovando...' : 'Aprovar'}
          </Button>

          {/* Reject button — passes reason via dialog, cosmetically disabled when insufficient alçada.
              SECURITY: assertNotReadOnly + canApprove enforced server-side in rejectRequest (T-10-29) */}
          <RejectDialog
            row={row}
            disabled={!canApproveCosmetic}
            onSuccess={onRejected}
          />
        </div>
      </CardContent>
    </Card>
  )
}

// ─── ApprovalInbox ────────────────────────────────────────────────────────────

export function ApprovalInbox({
  pendingRequests,
  actorRole,
}: ApprovalInboxProps) {
  const router = useRouter()
  const [localRequests, setLocalRequests] = useState<ApprovalRequestRow[]>(pendingRequests)
  const [feedback, setFeedback] = useState<{ id: string; msg: string } | null>(null)

  function handleApproved(id: string) {
    setLocalRequests((prev) => prev.filter((r) => r.id !== id))
    setFeedback({ id, msg: 'Solicitação aprovada com sucesso.' })
    router.refresh()
  }

  function handleRejected(id: string) {
    setLocalRequests((prev) => prev.filter((r) => r.id !== id))
    setFeedback({ id, msg: 'Solicitação rejeitada.' })
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {/* Feedback message */}
      {feedback && (
        <Alert className="border-border bg-muted/50">
          <AlertDescription>{feedback.msg}</AlertDescription>
        </Alert>
      )}

      {localRequests.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma solicitação pendente no momento.
        </p>
      ) : (
        <div className="space-y-3">
          {localRequests.map((row) => (
            <RequestCard
              key={row.id}
              row={row}
              actorRole={actorRole}
              onApproved={handleApproved}
              onRejected={handleRejected}
            />
          ))}
        </div>
      )}
    </div>
  )
}
