'use client'

import * as React from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { formatBRL } from '@/lib/format/money'
import { getDemonstrativo } from '@/actions/professional-payouts'
import { getRpaDocumentUrl } from '@/actions/rpa'
import type { PayoutRow } from './PayoutTable'

// ─── PayoutDemonstrativoSheet ─────────────────────────────────────────────────
// Shows per-professional payout breakdown: deductions accordion, summary box,
// line items table, and PDF export via signed URL (T-16-50).

interface DemonstrativoItem {
  id: string
  descricao: string
  valor_recebido: number
  valor_base_item: number
  percentual_item: number
  valor_repasse_item: number
  service_order_id: string | null
  statement_line_id: string | null
}

interface PayoutDetail {
  id: string
  competencia: string
  valor_bruto: number
  deducoes: Record<string, number> | null
  valor_base: number
  percentual: number
  valor_repasse: number
  status: string
}

interface PayoutDemonstrativoSheetProps {
  payout: PayoutRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  canWrite: boolean
}

function statusBadgeVariant(status: string): 'outline' | 'default' | 'destructive' {
  if (status === 'rascunho') return 'outline'
  if (status === 'cancelado') return 'destructive'
  return 'default'
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    rascunho: 'Rascunho',
    aprovado: 'Aprovado',
    pago: 'Pago',
    cancelado: 'Cancelado',
  }
  return map[status] ?? status
}

export function PayoutDemonstrativoSheet({
  payout,
  open,
  onOpenChange,
  canWrite,
}: PayoutDemonstrativoSheetProps) {
  const [detail, setDetail] = React.useState<PayoutDetail | null>(null)
  const [items, setItems] = React.useState<DemonstrativoItem[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = React.useState(false)

  React.useEffect(() => {
    if (open && payout?.id) {
      setDetail(null)
      setItems([])
      setError(null)
      setLoading(true)
      getDemonstrativo(payout.id).then((res) => {
        if (res.success && res.payout) {
          setDetail(res.payout as PayoutDetail)
          setItems((res.items ?? []) as DemonstrativoItem[])
        } else {
          setError(res.error ?? 'Erro ao carregar demonstrativo')
        }
        setLoading(false)
      })
    }
  }, [open, payout?.id])

  async function handleExportPdf() {
    if (!payout?.id) return
    setPdfLoading(true)
    try {
      // Use getRpaDocumentUrl for RPA; for payout we use the same signed URL pattern
      // Demonstrativo PDF is served via the same documents bucket
      const res = await getRpaDocumentUrl(payout.id)
      if (res.success && res.url) {
        window.open(res.url, '_blank')
      } else {
        setError(res.error ?? 'PDF não disponível')
      }
    } finally {
      setPdfLoading(false)
    }
  }

  const deducoes = detail?.deducoes ?? {}
  const deducaoLab = (deducoes as Record<string, number>)['lab'] ?? 0
  const deducaoMateriais = (deducoes as Record<string, number>)['materiais'] ?? 0
  const deducaoCartao = (deducoes as Record<string, number>)['taxa_cartao'] ?? 0
  const deducaoImpostos = (deducoes as Record<string, number>)['impostos_retidos'] ?? 0

  const profNome = payout?.profissional_nome ?? 'Profissional'
  const competencia = payout?.competencia ?? ''

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            Demonstrativo — {profNome} — {competencia}
          </SheetTitle>
          {payout && (
            <div className="mt-1">
              <Badge variant={statusBadgeVariant(payout.status)}>
                {statusLabel(payout.status)}
              </Badge>
            </div>
          )}
        </SheetHeader>

        {error && (
          <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading && (
          <div className="mt-6 text-sm text-muted-foreground">Carregando demonstrativo...</div>
        )}

        {detail && (
          <div className="mt-6 space-y-6">
            {/* Summary box */}
            <div className="rounded-lg border border-border bg-muted p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor Bruto Recebido</span>
                <span className="tabular-nums font-medium">{formatBRL(detail.valor_bruto)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>(−) Deduções</span>
                <span className="tabular-nums">{formatBRL(detail.valor_bruto - detail.valor_base)}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">= Base de Cálculo</span>
                <span className="tabular-nums font-medium">{formatBRL(detail.valor_base)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">× Percentual</span>
                <span className="tabular-nums">{(detail.percentual * 100).toFixed(0)}%</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="font-semibold">= Valor do Repasse</span>
                <span className="tabular-nums font-semibold text-primary">
                  {formatBRL(detail.valor_repasse)}
                </span>
              </div>
            </div>

            {/* Deduções accordion */}
            <div>
              <p className="text-sm font-semibold mb-2">Deduções</p>
              <Accordion className="rounded-lg border border-border">
                <AccordionItem value="lab" className="border-0">
                  <AccordionTrigger className="px-4 hover:no-underline text-sm">
                    Lab
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3 text-sm text-muted-foreground">
                    {formatBRL(deducaoLab)}
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="materiais" className="border-0 border-t">
                  <AccordionTrigger className="px-4 hover:no-underline text-sm">
                    Materiais
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3 text-sm text-muted-foreground">
                    {formatBRL(deducaoMateriais)}
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="cartao" className="border-0 border-t">
                  <AccordionTrigger className="px-4 hover:no-underline text-sm">
                    Taxa de Cartão
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3 text-sm text-muted-foreground">
                    {formatBRL(deducaoCartao)}
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="impostos" className="border-0 border-t">
                  <AccordionTrigger className="px-4 hover:no-underline text-sm">
                    Impostos Retidos
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3 text-sm text-muted-foreground">
                    {formatBRL(deducaoImpostos)}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            {/* Itens do Repasse table */}
            {items.length > 0 && (
              <div>
                <p className="text-sm font-semibold mb-2">Itens do Repasse</p>
                <div className="rounded-lg border border-border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">Procedimento</th>
                        <th className="px-3 py-2 text-right font-semibold">Valor Recebido</th>
                        <th className="px-3 py-2 text-right font-semibold">Base Item</th>
                        <th className="px-3 py-2 text-right font-semibold">%</th>
                        <th className="px-3 py-2 text-right font-semibold">Repasse Item</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id} className="border-t border-border">
                          <td className="px-3 py-2">{item.descricao}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatBRL(item.valor_recebido)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatBRL(item.valor_base_item)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {(item.percentual_item * 100).toFixed(0)}%
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">
                            {formatBRL(item.valor_repasse_item)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        <Separator className="my-6" />

        {/* Footer */}
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          {canWrite && (
            <Button onClick={handleExportPdf} disabled={pdfLoading}>
              {pdfLoading ? 'Gerando...' : 'Exportar PDF'}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
