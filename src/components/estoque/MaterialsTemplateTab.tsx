'use client'

// MaterialsTemplateTab — aba "Materiais" do ServiceForm (/config/servicos) — D-21.
// Lista templates de consumo (service_material_templates) via listServiceMaterials;
// adiciona/remove via inline row expansion (não dialog) — UI-SPEC §5.
//
// Props: serviceId — sempre presente aqui (ServiceForm só renderiza este componente
// quando o serviço já tem id salvo).

import { useEffect, useState, useTransition } from 'react'
import { Plus, X, Loader2 } from 'lucide-react'

import {
  listServiceMaterials,
  addServiceMaterial,
  removeServiceMaterial,
  type TemplateRow,
} from '@/actions/service-material-templates'
import { listProducts } from '@/actions/products'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

// ─── Types ────────────────────────────────────────────────────────────────────

type ProductOption = { id: string; name: string; unidade_medida: string }

interface MaterialsTemplateTabProps {
  serviceId: string
}

// ─── MaterialsTemplateTab ─────────────────────────────────────────────────────

export function MaterialsTemplateTab({ serviceId }: MaterialsTemplateTabProps) {
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [isAdding, setIsAdding] = useState(false)
  const [newProductId, setNewProductId] = useState<string | null>(null)
  const [newQtd, setNewQtd] = useState('1')
  const [addError, setAddError] = useState<string | null>(null)

  const [isPending, startTransition] = useTransition()

  async function loadTemplates() {
    setLoading(true)
    setError(null)
    const result = await listServiceMaterials(serviceId)
    if (result.success) {
      setTemplates(result.data ?? [])
    } else {
      setError(result.error ?? 'Erro ao carregar materiais.')
    }
    setLoading(false)
  }

  useEffect(() => {
    loadTemplates()

    // Carrega produtos ativos para o Select da inline row (uma vez)
    listProducts().then((result) => {
      if (result.success) {
        setProducts(
          (result.data ?? [])
            .filter((p) => p.ativo)
            .map((p) => ({ id: p.id, name: p.name, unidade_medida: p.unidade_medida }))
        )
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId])

  function resetAddRow() {
    setIsAdding(false)
    setNewProductId(null)
    setNewQtd('1')
    setAddError(null)
  }

  function handleConfirmAdd() {
    setAddError(null)

    if (!newProductId) {
      setAddError('Selecione um produto.')
      return
    }
    const qtd = Number(newQtd)
    if (!qtd || qtd <= 0) {
      setAddError('A quantidade deve ser maior que zero.')
      return
    }

    startTransition(async () => {
      const result = await addServiceMaterial({
        service_id: serviceId,
        product_id: newProductId,
        qtd_padrao: qtd,
      })

      if (result.success) {
        resetAddRow()
        await loadTemplates()
      } else {
        setAddError(result.error ?? 'Erro ao adicionar material.')
      }
    })
  }

  function handleRemove(id: string) {
    startTransition(async () => {
      await removeServiceMaterial(id)
      await loadTemplates()
    })
  }

  return (
    <div className="space-y-4 py-2">
      <div>
        <h3 className="text-sm font-semibold font-display">Materiais consumidos neste serviço</h3>
        <p className="text-sm text-muted-foreground">
          Defina os insumos padrão baixados automaticamente ao concluir este serviço.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : templates.length === 0 && !isAdding ? (
        <p className="text-sm text-muted-foreground">
          Nenhum material configurado. Adicione para habilitar a baixa automática.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead className="w-28">Qtd Padrão</TableHead>
              <TableHead className="w-16">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="text-sm">{t.product_name}</TableCell>
                <TableCell className="text-sm tabular-nums">
                  {t.qtd_padrao} {t.unidade_medida}
                </TableCell>
                <TableCell>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={isPending}
                    onClick={() => handleRemove(t.id)}
                    aria-label={`Remover ${t.product_name}`}
                  >
                    <X className="size-4 pointer-events-none" aria-hidden="true" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Inline row expansion — NÃO dialog (UI-SPEC §5) */}
      {isAdding ? (
        <div className="space-y-2 rounded-md border border-border p-3">
          {addError && (
            <Alert variant="destructive">
              <AlertDescription>{addError}</AlertDescription>
            </Alert>
          )}
          <div className="flex items-center gap-2">
            <Select onValueChange={setNewProductId} value={newProductId ?? undefined}>
              <SelectTrigger className="flex-1 bg-background border-border">
                <SelectValue placeholder="Selecione o produto">
                  {products.find((p) => p.id === newProductId)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={0}
              step="0.01"
              className="w-24"
              value={newQtd}
              onChange={(e) => setNewQtd(e.target.value)}
              aria-label="Quantidade padrão"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" size="sm" variant="outline" onClick={resetAddRow} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="button" size="sm" onClick={handleConfirmAdd} disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Confirmar
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setIsAdding(true)}>
          <Plus className="size-4" />
          Adicionar Material
        </Button>
      )}
    </div>
  )
}
