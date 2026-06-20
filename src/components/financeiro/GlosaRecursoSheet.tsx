'use client'

import * as React from 'react'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { formatBRL } from '@/lib/format/money'
import { registrarRecurso } from '@/actions/tiss'
import type { GlosaRow } from './GlosaTable'

interface GlosaRecursoSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  glosa: GlosaRow | null
}

export function GlosaRecursoSheet({ open, onOpenChange, glosa }: GlosaRecursoSheetProps) {
  const [texto, setTexto] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Reset state when sheet opens/closes
  React.useEffect(() => {
    if (open) {
      setTexto('')
      setError(null)
    }
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!glosa || !texto.trim()) return

    setSubmitting(true)
    setError(null)
    const result = await registrarRecurso(glosa.id, texto.trim())
    setSubmitting(false)

    if (result.success) {
      onOpenChange(false)
    } else {
      setError(result.error ?? 'Erro ao enviar recurso.')
    }
  }

  const guiaRef = glosa ? glosa.guide_id.slice(-8) : ''

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[480px] flex flex-col">
        <SheetHeader>
          <SheetTitle>Recurso — Guia #{guiaRef}</SheetTitle>
        </SheetHeader>

        {glosa && (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 gap-6 py-4">
            {/* Preview do item glosado */}
            <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2">
              <p className="text-sm font-semibold">Item glosado</p>
              <p className="text-sm text-muted-foreground">{glosa.description}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-sm font-medium tabular-nums text-destructive">
                  {formatBRL(glosa.valor_glosado)} glosado
                </span>
                {glosa.motivo_codigo && (
                  <Badge variant="outline">
                    {glosa.motivo_codigo}
                    {glosa.motivo_descricao ? ` — ${glosa.motivo_descricao}` : ''}
                  </Badge>
                )}
              </div>
            </div>

            {/* Motivo do recurso */}
            <div className="space-y-1.5 flex-1">
              <Label htmlFor="recurso-texto">Motivo do recurso</Label>
              <Textarea
                id="recurso-texto"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Descreva a justificativa para o recurso desta glosa…"
                className="min-h-[140px] resize-none"
                required
                disabled={submitting}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <SheetFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting || !texto.trim()}>
                {submitting ? 'Enviando…' : 'Enviar recurso'}
              </Button>
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  )
}
