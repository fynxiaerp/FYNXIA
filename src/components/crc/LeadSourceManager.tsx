'use client'

// LeadSourceManager — admin CRUD for the fixed, manageable lead source catalog
// (CRC-01, D-03). List + ativo Switch (admin-gated) + "Nova Origem" add form.
// Deactivate-only — never hard delete (a source may already be referenced by leads).
// Trigger-wrapper convention mirrors ProductFormDialog.tsx: `children` opens the
// Dialog on click, so it can be used as a plain header button trigger.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

import { createLeadSource, toggleLeadSourceActive } from '@/actions/lead-sources'
import type { LeadSourceRow } from '@/actions/lead-sources'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface LeadSourceManagerProps {
  sources: LeadSourceRow[]
  canManage: boolean
  children: React.ReactNode
}

export function LeadSourceManager({ sources, canManage, children }: LeadSourceManagerProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleOpenChange(value: boolean) {
    if (value) {
      setNewName('')
      setError(null)
    }
    setOpen(value)
  }

  async function handleAdd() {
    if (!newName.trim()) return
    setSubmitting(true)
    setError(null)
    const result = await createLeadSource({ name: newName.trim() })
    setSubmitting(false)
    if (result.success) {
      setNewName('')
      router.refresh()
    } else {
      setError(result.error ?? 'Erro ao criar origem')
    }
  }

  async function handleToggle(id: string, ativo: boolean) {
    const result = await toggleLeadSourceActive(id, ativo)
    if (result.success) {
      router.refresh()
    } else {
      setError(result.error ?? 'Erro ao atualizar origem')
    }
  }

  return (
    <>
      <div
        className="contents"
        onClick={() => handleOpenChange(true)}
        onKeyDown={(e) => e.key === 'Enter' && handleOpenChange(true)}
        role="presentation"
      >
        {children}
      </div>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md bg-background text-foreground">
          <DialogHeader>
            <DialogTitle>Gerenciar Origens de Lead</DialogTitle>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {sources.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Nenhuma origem cadastrada.
              </p>
            ) : (
              sources.map((source) => (
                <div
                  key={source.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium truncate">{source.name}</span>
                    {source.is_default && (
                      <Badge variant="outline" className="text-xs shrink-0">
                        Padrão
                      </Badge>
                    )}
                  </div>
                  {canManage ? (
                    <Switch
                      checked={source.ativo}
                      onCheckedChange={(checked) => handleToggle(source.id, checked)}
                      aria-label={`Ativar/desativar origem ${source.name}`}
                    />
                  ) : (
                    <Badge variant={source.ativo ? 'default' : 'secondary'} className="text-xs shrink-0">
                      {source.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                  )}
                </div>
              ))
            )}
          </div>

          {canManage && (
            <div className="space-y-2 border-t border-border pt-3">
              <Label htmlFor="new-lead-source">Nova Origem</Label>
              <div className="flex gap-2">
                <Input
                  id="new-lead-source"
                  placeholder="Ex.: TikTok"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAdd()
                    }
                  }}
                />
                <Button type="button" onClick={handleAdd} disabled={submitting || !newName.trim()}>
                  {submitting && <Loader2 className="size-4 animate-spin" />}
                  Nova Origem
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
