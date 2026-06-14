'use client'
/**
 * DocumentTemplatesManager — list, create, edit and soft-delete document templates.
 *
 * Phase 8 / DOC-01:
 * - Table of templates (name, category, variable count, ativo badge)
 * - "Novo Modelo" button opens create Dialog
 * - "Editar" per-row opens edit Dialog pre-filled via DocumentTemplateForm
 * - "Excluir" per-row: confirm then soft-delete via deleteTemplate action
 * - Optimistic local state update on success
 *
 * Design tokens: bg-background, text-foreground, border-border, text-muted-foreground.
 * No raw slate/gray/white Tailwind classes.
 *
 * @base-ui is NOT used here — shadcn/ui covers all needed primitives.
 */
import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DocumentTemplateForm } from './DocumentTemplateForm'
import { deleteTemplate, type TemplateListItem } from '@/actions/document-templates'

// ─── Category labels (pt-BR) ──────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  declaracao: 'Declaração',
  contrato: 'Contrato',
  autorizacao: 'Autorização',
  outro: 'Outro',
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface DocumentTemplatesManagerProps {
  initial: TemplateListItem[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DocumentTemplatesManager({ initial }: DocumentTemplatesManagerProps) {
  const [templates, setTemplates] = useState<TemplateListItem[]>(initial)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<TemplateListItem | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function openCreate() {
    setEditingTemplate(null)
    setDialogOpen(true)
  }

  function openEdit(template: TemplateListItem) {
    setEditingTemplate(template)
    setDialogOpen(true)
  }

  function handleFormSuccess(template: TemplateListItem) {
    if (editingTemplate) {
      // Update existing entry in local state
      setTemplates((prev) =>
        prev.map((t) => (t.id === template.id ? template : t))
      )
    } else {
      // Prepend new template
      setTemplates((prev) => [template, ...prev])
    }
    setDialogOpen(false)
  }

  function requestDelete(id: string) {
    setDeleteError(null)
    setConfirmDeleteId(id)
  }

  function cancelDelete() {
    setConfirmDeleteId(null)
    setDeleteError(null)
  }

  function confirmDelete(id: string) {
    setDeleteError(null)
    startTransition(async () => {
      const result = await deleteTemplate(id)
      if (result.success) {
        setTemplates((prev) => prev.filter((t) => t.id !== id))
        setConfirmDeleteId(null)
      } else {
        setDeleteError(result.error ?? 'Erro ao excluir modelo.')
        setConfirmDeleteId(null)
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Modelos de Documento</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Crie modelos reutilizáveis com variáveis <code className="text-foreground text-xs">{'{{nome}}'}</code> preenchidas automaticamente.
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          Novo Modelo
        </Button>
      </div>

      {/* ── Global delete error ─────────────────────────────────────────────── */}
      {deleteError && (
        <Alert variant="destructive">
          <AlertDescription>{deleteError}</AlertDescription>
        </Alert>
      )}

      {/* ── Templates Table ─────────────────────────────────────────────────── */}
      {templates.length === 0 ? (
        <div className="rounded-lg border border-border bg-background p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhum modelo cadastrado. Clique em &ldquo;Novo Modelo&rdquo; para começar.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-background overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-center">Variáveis</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium text-foreground">
                    {template.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {CATEGORY_LABELS[template.category] ?? template.category}
                  </TableCell>
                  <TableCell className="text-center text-sm text-muted-foreground">
                    {template.variables?.length ?? 0}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={template.is_active ? 'default' : 'outline'}>
                      {template.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 justify-end">
                      {confirmDeleteId === template.id ? (
                        <>
                          <span className="text-xs text-destructive">Confirmar exclusão?</span>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={isPending}
                            onClick={() => confirmDelete(template.id)}
                          >
                            Sim
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={cancelDelete}
                          >
                            Não
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEdit(template)}
                          >
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                            onClick={() => requestDelete(template.id)}
                          >
                            Excluir
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Create / Edit Dialog ────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl bg-background text-foreground max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Editar Modelo' : 'Novo Modelo de Documento'}
            </DialogTitle>
          </DialogHeader>
          <DocumentTemplateForm
            editing={editingTemplate ?? undefined}
            onSuccess={handleFormSuccess}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
