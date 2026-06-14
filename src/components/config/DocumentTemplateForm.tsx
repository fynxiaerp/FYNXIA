'use client'
/**
 * DocumentTemplateForm — create / edit a document template.
 *
 * Phase 8 / DOC-01:
 * - react-hook-form + zodResolver(documentTemplateSchema)
 * - Fields: name, category (select from DEFAULT_DOCUMENT_CATEGORIES + free 'outro'),
 *   content (textarea with {{variables}} help), is_active (create only: always true)
 * - Live detected variables shown below the content textarea
 * - On submit: calls createTemplate or updateTemplate Server Action
 * - Error feedback via in-form Alert (no sonner — not installed)
 *
 * Design tokens: bg-background, text-foreground, border-border, text-muted-foreground.
 * No raw slate/gray/white Tailwind classes.
 *
 * @base-ui is NOT used here — shadcn/ui covers all needed primitives.
 */
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { documentTemplateSchema, type DocumentTemplateInput } from '@/lib/validators/document-template'
import { DEFAULT_DOCUMENT_CATEGORIES } from '@/lib/documents/document-types'
import { detectVariables } from '@/lib/documents/template-engine'
import {
  createTemplate,
  updateTemplate,
  type TemplateListItem,
} from '@/actions/document-templates'

// ─── Category labels (pt-BR) ──────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  declaracao: 'Declaração',
  contrato: 'Contrato',
  autorizacao: 'Autorização',
  outro: 'Outro',
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface DocumentTemplateFormProps {
  /** When provided, form is in edit mode; otherwise create mode. */
  editing?: TemplateListItem
  onSuccess: (template: TemplateListItem) => void
  onCancel: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DocumentTemplateForm({
  editing,
  onSuccess,
  onCancel,
}: DocumentTemplateFormProps) {
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<DocumentTemplateInput>({
    resolver: zodResolver(documentTemplateSchema),
    defaultValues: {
      name: editing?.name ?? '',
      category: editing?.category ?? 'outro',
      content: editing?.content ?? '',
      is_active: editing?.is_active ?? true,
    },
  })

  // Live variable detection from current content value
  const contentValue = form.watch('content')
  const detectedVars = detectVariables(contentValue ?? '')

  async function onSubmit(data: DocumentTemplateInput) {
    setServerError(null)

    if (editing) {
      // Edit mode
      const result = await updateTemplate({
        id: editing.id,
        name: data.name,
        category: data.category,
        content: data.content,
        is_active: data.is_active,
      })

      if (!result.success) {
        setServerError(result.error ?? 'Erro ao atualizar modelo.')
        return
      }

      // Return updated item with local state (real updated_at from server not available,
      // but the list will refresh on next open)
      onSuccess({
        ...editing,
        name: data.name,
        category: data.category,
        content: data.content,
        is_active: data.is_active,
        variables: detectVariables(data.content),
        updated_at: new Date().toISOString(),
      })
    } else {
      // Create mode
      const result = await createTemplate({
        name: data.name,
        category: data.category,
        content: data.content,
      })

      if (!result.success || !result.id) {
        setServerError(result.error ?? 'Erro ao criar modelo.')
        return
      }

      const newTemplate: TemplateListItem = {
        id: result.id,
        name: data.name,
        category: data.category,
        content: data.content,
        variables: detectVariables(data.content),
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      onSuccess(newTemplate)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {serverError && (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        {/* Nome */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome do Modelo *</FormLabel>
              <FormControl>
                <Input
                  placeholder="Ex.: Declaração de Tratamento"
                  className="bg-background border-border text-foreground"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Categoria */}
        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Categoria *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-background border-border text-foreground">
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="bg-background border-border">
                  {DEFAULT_DOCUMENT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat} className="text-foreground">
                      {CATEGORY_LABELS[cat] ?? cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Conteúdo */}
        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Conteúdo *</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Digite o conteúdo do modelo. Use {{nome_variavel}} para inserir variáveis. Ex.: {{nome_paciente}}, {{data_documento}}, {{nome_clinica}}"
                  rows={10}
                  className="bg-background border-border text-foreground font-mono text-sm resize-y"
                  {...field}
                />
              </FormControl>
              <p className="text-xs text-muted-foreground mt-1">
                Variáveis disponíveis: <code className="text-foreground">{'{{nome_paciente}}'}</code>,{' '}
                <code className="text-foreground">{'{{data_documento}}'}</code>,{' '}
                <code className="text-foreground">{'{{nome_clinica}}'}</code>,{' '}
                <code className="text-foreground">{'{{nome_profissional}}'}</code>, entre outras.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Detected variables live preview */}
        {detectedVars.length > 0 && (
          <div className="rounded-md border border-border bg-background p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Variáveis detectadas ({detectedVars.length}):
            </p>
            <div className="flex flex-wrap gap-1.5">
              {detectedVars.map((v) => (
                <Badge key={v} variant="secondary" className="font-mono text-xs">
                  {`{{${v}}}`}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting
              ? 'Salvando...'
              : editing
              ? 'Salvar Alterações'
              : 'Criar Modelo'}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </form>
    </Form>
  )
}
