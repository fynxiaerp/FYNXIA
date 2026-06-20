'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
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
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { formatBRL } from '@/lib/format/money'
import { faturarOs, cancelarOs, getOs } from '@/actions/service-orders-client'
import type { OsRow } from './OsTable'

const OS_STATUS: Record<string, { label: string; variant: 'outline' | 'default' | 'destructive' }> = {
  rascunho: { label: 'Rascunho', variant: 'outline' },
  faturada: { label: 'Faturada', variant: 'default' },
  cancelada: { label: 'Cancelada', variant: 'destructive' },
}

interface OsSheetProps {
  os: OsRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function OsSheet({ os, open, onOpenChange }: OsSheetProps) {
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [motivo, setMotivo] = React.useState('')
  const [billingType, setBillingType] = React.useState<'PIX' | 'BOLETO' | 'CREDIT_CARD'>('PIX')
  const [installmentCount, setInstallmentCount] = React.useState(1)
  const [detail, setDetail] = React.useState<Awaited<ReturnType<typeof getOs>>['os'] | null>(null)

  // Load full OS detail when sheet opens
  React.useEffect(() => {
    if (open && os?.id) {
      setDetail(null)
      setError(null)
      getOs(os.id).then((res) => {
        if (res.success && res.os) setDetail(res.os)
        else setError(res.error ?? 'Erro ao carregar OS')
      })
    }
  }, [open, os?.id])

  async function handleFaturar() {
    if (!os) return
    setLoading(true)
    setError(null)
    try {
      const res = await faturarOs(os.id, { billingType, installmentCount })
      if (res.success) {
        onOpenChange(false)
        router.refresh()
      } else {
        setError(res.error ?? 'Erro ao faturar OS')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleCancelar() {
    if (!os || !motivo.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await cancelarOs(os.id, motivo.trim())
      if (res.success) {
        onOpenChange(false)
        router.refresh()
      } else {
        setError(res.error ?? 'Erro ao cancelar OS')
      }
    } finally {
      setLoading(false)
    }
  }

  const status = os?.status ?? ''
  const statusMeta = OS_STATUS[status] ?? { label: status, variant: 'outline' as const }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            Revisar OS #{os?.numero ?? ''}
          </SheetTitle>
          {os && (
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
              {os.patient_maskedName && (
                <span className="text-sm text-muted-foreground">{os.patient_maskedName}</span>
              )}
            </div>
          )}
        </SheetHeader>

        {error && (
          <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <Tabs defaultValue="itens" className="mt-6">
          <TabsList className="w-full">
            <TabsTrigger value="itens" className="flex-1">Itens</TabsTrigger>
            <TabsTrigger value="pagamento" className="flex-1">Pagamento</TabsTrigger>
            <TabsTrigger value="historico" className="flex-1">Histórico</TabsTrigger>
          </TabsList>

          {/* Itens tab */}
          <TabsContent value="itens" className="mt-4 space-y-3">
            {detail?.items && detail.items.length > 0 ? (
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Descrição</th>
                      <th className="px-3 py-2 text-right font-semibold">Qtd</th>
                      <th className="px-3 py-2 text-right font-semibold">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((item) => (
                      <tr key={item.id} className="border-t border-border">
                        <td className="px-3 py-2">
                          <div>{item.description}</div>
                          {(item.dente || item.face) && (
                            <div className="text-xs text-muted-foreground">
                              {[item.dente, item.face].filter(Boolean).join(' — ')}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{item.quantity}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatBRL(item.valor_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Carregando itens...</p>
            )}

            {detail && (
              <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1 text-sm">
                {detail.desconto_total > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Desconto</span>
                    <span className="tabular-nums">−{formatBRL(detail.desconto_total)}</span>
                  </div>
                )}
                {detail.acrescimo_total > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Acréscimo</span>
                    <span className="tabular-nums">+{formatBRL(detail.acrescimo_total)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">{formatBRL(detail.total)}</span>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Pagamento tab */}
          <TabsContent value="pagamento" className="mt-4 space-y-4">
            {detail?.patient && (
              <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paciente</span>
                  <span className="font-medium">{detail.patient.maskedName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CPF</span>
                  <span className="font-medium tabular-nums">{detail.patient.maskedCpf}</span>
                </div>
              </div>
            )}
            {status === 'rascunho' && os?.pagador === 'particular' && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="billing-type">Forma de pagamento</Label>
                  <Select
                    value={billingType}
                    onValueChange={(v) => v && setBillingType(v as 'PIX' | 'BOLETO' | 'CREDIT_CARD')}
                  >
                    <SelectTrigger id="billing-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PIX">PIX</SelectItem>
                      <SelectItem value="BOLETO">Boleto</SelectItem>
                      <SelectItem value="CREDIT_CARD">Cartão de Crédito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {billingType === 'CREDIT_CARD' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="installments">Parcelas</Label>
                    <Select
                      value={String(installmentCount)}
                      onValueChange={(v) => v && setInstallmentCount(Number(v))}
                    >
                      <SelectTrigger id="installments">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 10, 12].map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n}x {n === 1 ? '(à vista)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Histórico tab */}
          <TabsContent value="historico" className="mt-4">
            {detail && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Criada em</span>
                  <span className="tabular-nums">
                    {new Date(detail.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                {detail.faturada_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Faturada em</span>
                    <span className="tabular-nums">
                      {new Date(detail.faturada_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                )}
                {detail.notes && (
                  <div className="rounded-lg border border-border bg-muted/40 p-3 text-muted-foreground">
                    {detail.notes}
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Separator className="my-6" />

        {/* Footer actions by OS status */}
        <div className="space-y-2">
          {status === 'rascunho' && (
            <>
              {/* Faturar — AlertDialog confirm */}
              <AlertDialog>
                <AlertDialogTrigger
                  render={<Button className="w-full" disabled={loading} />}
                >
                  Faturar OS
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar faturamento</AlertDialogTitle>
                    <AlertDialogDescription>
                      A OS será faturada e gerará recebível. Esta ação não pode ser desfeita sem estorno.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleFaturar} disabled={loading}>
                      Faturar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* Cancelar rascunho — AlertDialog + motivo */}
              <CancelarDialog motivo={motivo} onMotivoChange={setMotivo} onConfirm={handleCancelar} loading={loading} />
            </>
          )}

          {status === 'faturada' && (
            <CancelarDialog motivo={motivo} onMotivoChange={setMotivo} onConfirm={handleCancelar} loading={loading} fullWidth />
          )}

          {status === 'cancelada' && (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground text-center">
              Esta OS foi cancelada e não pode ser alterada.
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── CancelarDialog ──────────────────────────────────────────────────────────

function CancelarDialog({
  motivo,
  onMotivoChange,
  onConfirm,
  loading,
  fullWidth,
}: {
  motivo: string
  onMotivoChange: (v: string) => void
  onConfirm: () => void
  loading: boolean
  fullWidth?: boolean
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={<Button variant="outline" className={fullWidth ? 'w-full' : ''} disabled={loading} />}
      >
        Cancelar OS
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar OS</AlertDialogTitle>
          <AlertDialogDescription>
            Informe o motivo do cancelamento. O estorno do recebível seguirá o fluxo de aprovação.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="cancel-motivo">Motivo</Label>
          <Textarea
            id="cancel-motivo"
            placeholder="Descreva o motivo do cancelamento…"
            value={motivo}
            onChange={(e) => onMotivoChange(e.target.value)}
            rows={3}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Voltar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={loading || !motivo.trim()}
            className="bg-destructive/10 text-destructive hover:bg-destructive/20"
          >
            Cancelar OS
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
