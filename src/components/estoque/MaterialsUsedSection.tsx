'use client'

// MaterialsUsedSection — seção "Materiais Utilizados" no ProntuárioForm (D-22).
// UI-SPEC §6: pré-preenchida por service_material_templates, qtd editável antes de
// confirmar o procedimento; custo estimado de insumos exibido no rodapé. Auto-oculta
// quando o serviço não tem templates configurados (ou quando serviceId não é fornecido —
// ProntuarioForm hoje não tem seleção de procedimento; ver D-22 nota no Plan 09).
//
// Junta listServiceMaterials (qtd_padrao/nome/UM) + listProducts (custo_medio/status)
// para exibir custo estimado e badges de alerta de estoque (T-17-22: custo é
// informativo — baixa real usa snapshot server-side no momento da conclusão).

import { useEffect, useState } from 'react'

import { listServiceMaterials } from '@/actions/service-material-templates'
import { listProducts } from '@/actions/products'
import { formatBRL } from '@/lib/format/money'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

// ─── Types ────────────────────────────────────────────────────────────────────

type ProductStatus = 'normal' | 'baixo' | 'critico' | 'negativo'

type MaterialLine = {
  product_id: string
  product_name: string
  unidade_medida: string
  qtd_padrao: number
  custo_medio: number
  status: ProductStatus
}

interface MaterialsUsedSectionProps {
  /** Serviço/procedimento selecionado no atendimento — seção só carrega quando presente. */
  serviceId?: string
  /** Após confirmação do procedimento: campos viram read-only (UI-SPEC §6). */
  disabled?: boolean
}

// ─── MaterialsUsedSection ─────────────────────────────────────────────────────

export function MaterialsUsedSection({ serviceId, disabled = false }: MaterialsUsedSectionProps) {
  const [lines, setLines] = useState<MaterialLine[]>([])
  const [qtds, setQtds] = useState<Record<string, number>>({})
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!serviceId) {
      setLines([])
      setQtds({})
      setLoaded(true)
      return
    }

    let cancelled = false
    setLoaded(false)

    async function load() {
      const [templatesResult, productsResult] = await Promise.all([
        listServiceMaterials(serviceId as string),
        listProducts(),
      ])

      if (cancelled) return

      if (!templatesResult.success || !templatesResult.data || templatesResult.data.length === 0) {
        setLines([])
        setQtds({})
        setLoaded(true)
        return
      }

      const productsById = new Map((productsResult.data ?? []).map((p) => [p.id, p]))

      const nextLines: MaterialLine[] = templatesResult.data.map((t) => {
        const product = productsById.get(t.product_id)
        return {
          product_id: t.product_id,
          product_name: t.product_name,
          unidade_medida: t.unidade_medida,
          qtd_padrao: t.qtd_padrao,
          custo_medio: product?.custo_medio ?? 0,
          status: product?.status ?? 'normal',
        }
      })

      const initialQtds: Record<string, number> = {}
      for (const line of nextLines) initialQtds[line.product_id] = line.qtd_padrao

      setLines(nextLines)
      setQtds(initialQtds)
      setLoaded(true)
    }

    load()

    return () => {
      cancelled = true
    }
  }, [serviceId])

  // Ainda carregando ou sem templates configurados — seção não renderiza nada (UI-SPEC §6).
  if (!loaded || lines.length === 0) return null

  const total = lines.reduce(
    (sum, line) => sum + (qtds[line.product_id] ?? line.qtd_padrao) * line.custo_medio,
    0
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold font-display">Materiais Utilizados</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {lines.map((line) => (
          <div key={line.product_id} className="flex items-center gap-3">
            <span className="text-sm flex-1">{line.product_name}</span>

            {(line.status === 'critico' || line.status === 'negativo') && (
              <Badge
                className={
                  line.status === 'negativo'
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                }
              >
                {line.status === 'negativo' ? 'Saldo Negativo' : 'Estoque Baixo'}
              </Badge>
            )}

            <Input
              type="number"
              className="w-20"
              min={0}
              step="0.01"
              disabled={disabled}
              value={qtds[line.product_id] ?? line.qtd_padrao}
              onChange={(e) =>
                setQtds((prev) => ({ ...prev, [line.product_id]: Number(e.target.value) }))
              }
              aria-label={`Quantidade de ${line.product_name}`}
            />
            <span className="text-sm text-muted-foreground">{line.unidade_medida}</span>
          </div>
        ))}

        <p className="text-sm text-muted-foreground pt-2 border-t border-border">
          Custo estimado de insumos:{' '}
          <span className="font-semibold tabular-nums">{formatBRL(total)}</span>
        </p>
      </CardContent>
    </Card>
  )
}
