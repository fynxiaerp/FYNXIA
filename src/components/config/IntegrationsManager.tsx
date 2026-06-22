'use client'
/**
 * IntegrationsManager — connector registry, register/edit form (masked credential),
 * health panel, and reprocess action.
 *
 * Phase 9 / INT-01 + INT-03:
 * - Connectors list (type, status, credential_masked — write-only display)
 * - Register/Edit form: RHF + Zod v3, credential as password input (write-only)
 * - Health panel: per-connector status badge, failedCount, lastError, reprocess button
 *
 * Security:
 *   T-09-20: Only credential_masked is rendered — the ciphertext column never reaches the client.
 *   T-09-22: Server-side assertNotReadOnly() + role gate are the source of truth;
 *            client disables buttons for UX only — server gate is authoritative.
 *
 * Design tokens: bg-background, border-border, text-foreground, text-muted-foreground.
 * No raw slate-/gray-/text-white/bg-white classes.
 *
 * @base-ui: NOT used here — shadcn/ui covers all needed primitives (Select, Card, etc.).
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
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'

import { createConnector, updateConnector } from '@/actions/integration-connectors'
import { reprocessConnector } from '@/actions/integration-events'
import type { ConnectorPublic } from '@/actions/integration-connectors'
import type { ConnectorHealthView } from '@/actions/integration-events'

// ─── Form schema (client-side Zod v3 — no .default()) ────────────────────────

const connectorClientSchema = z.object({
  type: z.enum(['asaas', 'whatsapp', 'email', 'nfse', 'banco', 'tiss', 'reinf', 'open_finance']),
  credential: z.string().min(1, 'Credencial obrigatória').max(2000, 'Credencial muito longa'),
  status: z.enum(['enabled', 'disabled']),
})

const connectorUpdateClientSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['asaas', 'whatsapp', 'email', 'nfse', 'banco', 'tiss', 'reinf', 'open_finance']),
  credential: z.string().max(2000, 'Credencial muito longa').optional(),
  status: z.enum(['enabled', 'disabled']),
})

type ConnectorCreateInput = z.infer<typeof connectorClientSchema>
type ConnectorUpdateInput = z.infer<typeof connectorUpdateClientSchema>

// ─── Labels ───────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  asaas: 'Asaas (Pagamentos)',
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  nfse: 'NFS-e',
  banco: 'Banco / Open Finance',
  tiss: 'TISS / Convênio',
}

const HEALTH_LABELS: Record<string, string> = {
  ok: 'OK',
  degraded: 'Degradado',
  failed: 'Falha',
  unknown: 'Desconhecido',
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface IntegrationsManagerProps {
  connectors: ConnectorPublic[]
  health: ConnectorHealthView[]
}

// ─── Helper: health badge variant ────────────────────────────────────────────

function healthBadgeVariant(
  health: ConnectorHealthView['health']
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (health) {
    case 'ok':       return 'default'
    case 'degraded': return 'outline'
    case 'failed':   return 'destructive'
    default:         return 'secondary'
  }
}

// ─── Register form (new connector) ───────────────────────────────────────────

function RegisterConnectorForm({
  onSuccess,
}: {
  onSuccess: (connector: ConnectorPublic) => void
}) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const form = useForm<ConnectorCreateInput>({
    resolver: zodResolver(connectorClientSchema),
    defaultValues: { type: 'asaas', credential: '', status: 'disabled' },
  })

  function onSubmit(data: ConnectorCreateInput) {
    setServerError(null)
    startTransition(async () => {
      const formData = new FormData()
      formData.set('type', data.type)
      formData.set('credential', data.credential)
      formData.set('status', data.status)

      const result = await createConnector(formData)
      if (result.success && result.connector) {
        onSuccess(result.connector)
        form.reset()
      } else {
        setServerError(result.error ?? 'Erro ao registrar conector.')
      }
    })
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-foreground">Registrar Conector</CardTitle>
        <CardDescription className="text-muted-foreground">
          A credencial é cifrada no servidor — nunca armazenada em texto claro.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {serverError && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Type */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Conector *</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value}
                      onValueChange={(val) => { if (val) field.onChange(val) }}
                    >
                      <SelectTrigger className="w-full bg-background border-border text-foreground">
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TYPE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Credential (write-only password input — masked entry) */}
            <FormField
              control={form.control}
              name="credential"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Credencial (API Key / Token) *</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Cole a credencial do conector"
                      autoComplete="off"
                      className="bg-background border-border text-foreground"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Status */}
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value}
                      onValueChange={(val) => { if (val) field.onChange(val) }}
                    >
                      <SelectTrigger className="w-full bg-background border-border text-foreground">
                        <SelectValue placeholder="Selecione o status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="disabled">Desabilitado</SelectItem>
                        <SelectItem value="enabled">Habilitado</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isPending}>
              {isPending ? 'Registrando...' : 'Registrar Conector'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

// ─── Edit form (existing connector) ──────────────────────────────────────────

function EditConnectorForm({
  connector,
  onSuccess,
  onCancel,
}: {
  connector: ConnectorPublic
  onSuccess: (connector: ConnectorPublic) => void
  onCancel: () => void
}) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const form = useForm<ConnectorUpdateInput>({
    resolver: zodResolver(connectorUpdateClientSchema),
    defaultValues: {
      id: connector.id,
      type: connector.type,
      credential: '',
      status: connector.status,
    },
  })

  function onSubmit(data: ConnectorUpdateInput) {
    setServerError(null)
    startTransition(async () => {
      const formData = new FormData()
      formData.set('id', data.id)
      formData.set('type', data.type)
      if (data.credential && data.credential.length > 0) {
        formData.set('credential', data.credential)
      }
      formData.set('status', data.status)

      const result = await updateConnector(formData)
      if (result.success && result.connector) {
        onSuccess(result.connector)
      } else {
        setServerError(result.error ?? 'Erro ao atualizar conector.')
      }
    })
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base text-foreground">
            Editar: {TYPE_LABELS[connector.type] ?? connector.type}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
        <CardDescription className="text-muted-foreground">
          Credencial atual:{' '}
          <span className="font-mono text-foreground">
            {connector.credential_masked ?? '—'}
          </span>
          {' '}— deixe o campo vazio para manter a credencial atual.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {serverError && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Type */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Conector *</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value}
                      onValueChange={(val) => { if (val) field.onChange(val) }}
                    >
                      <SelectTrigger className="w-full bg-background border-border text-foreground">
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TYPE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* New credential (optional on edit — password input, write-only) */}
            <FormField
              control={form.control}
              name="credential"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nova Credencial (deixe vazio para manter a atual)</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Nova API Key / Token (opcional)"
                      autoComplete="off"
                      className="bg-background border-border text-foreground"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Status */}
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value}
                      onValueChange={(val) => { if (val) field.onChange(val) }}
                    >
                      <SelectTrigger className="w-full bg-background border-border text-foreground">
                        <SelectValue placeholder="Selecione o status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="disabled">Desabilitado</SelectItem>
                        <SelectItem value="enabled">Habilitado</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isPending}>
              {isPending ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

// ─── Main IntegrationsManager component ───────────────────────────────────────

export function IntegrationsManager({ connectors, health }: IntegrationsManagerProps) {
  const router = useRouter()
  const [localConnectors, setLocalConnectors] = useState<ConnectorPublic[]>(connectors)
  const [editingConnector, setEditingConnector] = useState<ConnectorPublic | null>(null)
  const [reprocessResults, setReprocessResults] = useState<Record<string, string>>({})
  const [reprocessErrors, setReprocessErrors] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()

  function handleCreateSuccess(connector: ConnectorPublic) {
    setLocalConnectors((prev) => [connector, ...prev])
    router.refresh()
  }

  function handleUpdateSuccess(connector: ConnectorPublic) {
    setLocalConnectors((prev) =>
      prev.map((c) => (c.id === connector.id ? connector : c))
    )
    setEditingConnector(null)
    router.refresh()
  }

  function handleReprocess(connectorId: string | null) {
    if (!connectorId) return
    setReprocessErrors((prev) => { const n = { ...prev }; delete n[connectorId]; return n })
    setReprocessResults((prev) => { const n = { ...prev }; delete n[connectorId]; return n })

    startTransition(async () => {
      const result = await reprocessConnector(connectorId)
      if (result.success) {
        setReprocessResults((prev) => ({
          ...prev,
          [connectorId]: `${result.requeued ?? 0} evento(s) reenfileirado(s)`,
        }))
        router.refresh()
      } else {
        setReprocessErrors((prev) => ({
          ...prev,
          [connectorId]: result.error ?? 'Erro ao reprocessar.',
        }))
      }
    })
  }

  return (
    <div className="space-y-8">
      {/* ── Connectors list ──────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-foreground mb-3">
          Conectores Registrados
        </h2>

        {localConnectors.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum conector registrado ainda. Use o formulário abaixo para adicionar.
          </p>
        ) : (
          <div className="space-y-3">
            {localConnectors.map((connector) => (
              <Card key={connector.id} className="bg-card border-border">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {TYPE_LABELS[connector.type] ?? connector.type}
                        </span>
                        <Badge
                          variant={connector.status === 'enabled' ? 'default' : 'secondary'}
                        >
                          {connector.status === 'enabled' ? 'Habilitado' : 'Desabilitado'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">
                        Credencial:{' '}
                        <span className="text-foreground">
                          {connector.credential_masked ?? '—'}
                        </span>
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingConnector(connector)}
                    >
                      Editar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── Edit form (shown when a connector is being edited) ──────────────── */}
      {editingConnector && (
        <>
          <Separator />
          <EditConnectorForm
            connector={editingConnector}
            onSuccess={handleUpdateSuccess}
            onCancel={() => setEditingConnector(null)}
          />
        </>
      )}

      {/* ── Register form (always visible when not editing) ─────────────────── */}
      {!editingConnector && (
        <>
          <Separator />
          <RegisterConnectorForm onSuccess={handleCreateSuccess} />
        </>
      )}

      {/* ── Health panel ─────────────────────────────────────────────────────── */}
      <section>
        <Separator className="mb-6" />
        <h2 className="text-sm font-semibold text-foreground mb-3">
          Painel de Saúde dos Conectores
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          Saúde derivada dos eventos das últimas 24 horas. Use "Reprocessar" para
          reenfileirar eventos com falha para o worker automático.
        </p>

        {health.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum dado de saúde disponível. Registre um conector para começar.
          </p>
        ) : (
          <div className="space-y-3">
            {health.map((view, idx) => (
              <Card
                key={view.connectorId ?? idx}
                className="bg-card border-border"
              >
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {TYPE_LABELS[view.type] ?? view.type}
                        </span>
                        <Badge variant={healthBadgeVariant(view.health)}>
                          {HEALTH_LABELS[view.health] ?? view.health}
                        </Badge>
                        <Badge
                          variant={view.status === 'enabled' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {view.status === 'enabled' ? 'Habilitado' : 'Desabilitado'}
                        </Badge>
                      </div>

                      {view.failedCount > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {view.failedCount} evento(s) com falha nas últimas 24h
                        </p>
                      )}

                      {view.lastError && (
                        <p
                          className="text-xs text-destructive truncate"
                          title={view.lastError}
                        >
                          Último erro: {view.lastError}
                        </p>
                      )}

                      {/* Reprocess feedback */}
                      {view.connectorId && reprocessResults[view.connectorId] && (
                        <p className="text-xs text-foreground">
                          {reprocessResults[view.connectorId]}
                        </p>
                      )}
                      {view.connectorId && reprocessErrors[view.connectorId] && (
                        <p className="text-xs text-destructive">
                          {reprocessErrors[view.connectorId]}
                        </p>
                      )}
                    </div>

                    {view.failedCount > 0 && view.connectorId && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleReprocess(view.connectorId)}
                      >
                        {isPending ? 'Processando...' : 'Reprocessar'}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
