'use client'
/**
 * OcrUploadReview — upload + confidence-flagged review + confirm/reject (OCR-01, OCR-02)
 *
 * Flow:
 *   1. User selects an image or PDF (file input).
 *   2. Component POSTs to /api/ocr via multipart FormData.
 *   3. On success: RHF + Zod v3 review form pre-filled with extracted values.
 *      Each field shows its confidence score; fields < OCR_CONFIDENCE_THRESHOLD
 *      receive a "Revisar" badge (token-based warning style — OCR-02).
 *   4. Confirm → confirmOcrExtraction(extractionId, editedFields) → "Paciente cadastrado..."
 *      Reject → rejectOcrExtraction(extractionId, reason?) → extraction closed.
 *   5. pendingQueue prop: list of pending_review extractions from the server; clicking
 *      one loads its extracted_fields into the review form for re-review.
 *
 * Security:
 *   T-10-33: below-threshold fields flagged — commit requires explicit human confirm.
 *   T-10-34: only the 4 pilot fields displayed; no file bytes echoed; CPF shown in
 *            input only (reviewer-visible, not logged).
 *
 * Design tokens: bg-background, border-border, text-foreground, text-muted-foreground.
 * No raw slate-/gray-/text-white/bg-white classes.
 * @base-ui: NOT used here — shadcn/ui covers all needed primitives.
 * pt-BR throughout.
 *
 * Phase: 10-ia-governada-l0-l4-auditoria-ocr / Plan 08 (OCR-01, OCR-02)
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
import { Separator } from '@/components/ui/separator'

import { confirmOcrExtraction, rejectOcrExtraction } from '@/actions/ocr-actions'
import { OCR_CONFIDENCE_THRESHOLD } from '@/lib/ai/ocr-confidence'
import type { OcrExtractionQueueRow } from '@/app/(dashboard)/conformidade/ocr/page'

// ─── API response types ───────────────────────────────────────────────────────

interface OcrField {
  value: string
  confidence: number
}

interface OcrApiResponse {
  extractionId: string
  needsReview: boolean
  fields: {
    full_name: OcrField
    cpf: OcrField
    birth_date: OcrField
    address: OcrField
  }
}

// ─── Form schema (Zod v3 — mirrors confirmedFieldsSchema in ocr-actions.ts) ───

const reviewFormSchema = z.object({
  full_name: z.string().min(2, 'Nome completo deve ter pelo menos 2 caracteres'),
  cpf: z
    .string()
    .regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, 'CPF deve estar no formato 000.000.000-00'),
  birth_date: z
    .string()
    .optional()
    .refine(
      (v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v),
      'Data de nascimento deve ser uma data ISO (YYYY-MM-DD)'
    ),
  address: z.string().optional(),
})

type ReviewFormValues = z.infer<typeof reviewFormSchema>

// ─── Props ────────────────────────────────────────────────────────────────────

interface OcrUploadReviewProps {
  pendingQueue: OcrExtractionQueueRow[]
}

// ─── Confidence badge helper ──────────────────────────────────────────────────

// A field is flagged when its confidence is strictly below the threshold (OCR-02)
function ConfidenceBadge({ confidence }: { confidence: number }) {
  const needsReview = confidence < OCR_CONFIDENCE_THRESHOLD
  const pct = Math.round(confidence * 100)
  return needsReview ? (
    <Badge
      variant="outline"
      className="text-warning border-warning text-xs ml-1"
      title={`Confiança: ${pct}% — abaixo do limite de ${Math.round(OCR_CONFIDENCE_THRESHOLD * 100)}%`}
    >
      Revisar ({pct}%)
    </Badge>
  ) : (
    <Badge
      variant="secondary"
      className="text-xs ml-1"
      title={`Confiança: ${pct}%`}
    >
      {pct}%
    </Badge>
  )
}

// ─── Field label mapping ──────────────────────────────────────────────────────

const FIELD_LABELS: Record<keyof ReviewFormValues, string> = {
  full_name: 'Nome Completo',
  cpf: 'CPF',
  birth_date: 'Data de Nascimento (YYYY-MM-DD)',
  address: 'Endereço',
}

// ─── Main component ───────────────────────────────────────────────────────────

export function OcrUploadReview({ pendingQueue }: OcrUploadReviewProps) {
  const router = useRouter()

  // ── Upload state ────────────────────────────────────────────────────────────
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, startUpload] = useTransition()
  const [uploadError, setUploadError] = useState<string | null>(null)

  // ── Extraction result state ─────────────────────────────────────────────────
  const [extractionId, setExtractionId] = useState<string | null>(null)
  const [fieldMeta, setFieldMeta] = useState<
    Record<string, { confidence: number }> | null
  >(null)
  const [ocrNeedsReview, setOcrNeedsReview] = useState(false)

  // ── Confirm/reject state ────────────────────────────────────────────────────
  const [isConfirming, startConfirm] = useTransition()
  const [isRejecting, startReject] = useTransition()
  const [actionError, setActionError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [newPatientId, setNewPatientId] = useState<string | null>(null)

  // ── Reject reason (optional) ────────────────────────────────────────────────
  const [rejectReason, setRejectReason] = useState('')

  // ── RHF form ────────────────────────────────────────────────────────────────
  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: {
      full_name: '',
      cpf: '',
      birth_date: '',
      address: '',
    },
  })

  // ── Upload → POST /api/ocr ──────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setSelectedFile(file)
    setUploadError(null)
  }

  function handleUpload() {
    if (!selectedFile) return
    setUploadError(null)
    setSuccessMessage(null)
    setActionError(null)
    setExtractionId(null)
    setFieldMeta(null)

    startUpload(async () => {
      const formData = new FormData()
      formData.set('file', selectedFile)

      let res: Response
      try {
        res = await fetch('/api/ocr', { method: 'POST', body: formData })
      } catch {
        setUploadError('Falha de rede. Verifique sua conexão e tente novamente.')
        return
      }

      if (res.status === 503) {
        setUploadError('Gateway de IA não configurado. Contate o administrador do sistema.')
        return
      }
      if (res.status === 415) {
        setUploadError('Formato de arquivo não suportado. Use JPEG, PNG, WebP ou PDF.')
        return
      }
      if (res.status === 413) {
        setUploadError('Arquivo muito grande. O limite é 4 MB. Comprima a imagem ou use um PDF menor.')
        return
      }
      if (res.status === 401) {
        setUploadError('Sessão expirada. Recarregue a página e faça login novamente.')
        return
      }
      if (!res.ok) {
        let errorMsg = 'Erro ao processar o documento.'
        try {
          const body = await res.json() as { error?: string }
          if (body?.error) errorMsg = body.error
        } catch { /* ignore */ }
        setUploadError(errorMsg)
        return
      }

      const data = (await res.json()) as OcrApiResponse
      loadExtractionIntoForm(data.extractionId, data.fields, data.needsReview)
    })
  }

  // ── Load extraction into review form ─────────────────────────────────────────

  function loadExtractionIntoForm(
    id: string,
    fields: OcrApiResponse['fields'],
    needsReview: boolean
  ) {
    setExtractionId(id)
    setOcrNeedsReview(needsReview)
    setFieldMeta({
      full_name: { confidence: fields.full_name.confidence },
      cpf: { confidence: fields.cpf.confidence },
      birth_date: { confidence: fields.birth_date.confidence },
      address: { confidence: fields.address.confidence },
    })
    form.reset({
      full_name: fields.full_name.value,
      cpf: fields.cpf.value,
      birth_date: fields.birth_date.value,
      address: fields.address.value,
    })
    setSuccessMessage(null)
    setActionError(null)
    setNewPatientId(null)
  }

  // ── Load a queued extraction from the pending queue ───────────────────────────

  function loadQueuedExtraction(row: OcrExtractionQueueRow) {
    const f = row.extracted_fields
    const fields: OcrApiResponse['fields'] = {
      full_name: { value: f.full_name?.value ?? '', confidence: f.full_name?.confidence ?? 0 },
      cpf: { value: f.cpf?.value ?? '', confidence: f.cpf?.confidence ?? 0 },
      birth_date: {
        value: f.birth_date?.value ?? '',
        confidence: f.birth_date?.confidence ?? 0,
      },
      address: { value: f.address?.value ?? '', confidence: f.address?.confidence ?? 0 },
    }
    loadExtractionIntoForm(row.id, fields, true)
  }

  // ── Confirm → confirmOcrExtraction ───────────────────────────────────────────

  function handleConfirm(values: ReviewFormValues) {
    if (!extractionId) return
    setActionError(null)

    startConfirm(async () => {
      const result = await confirmOcrExtraction(extractionId, {
        full_name: values.full_name,
        cpf: values.cpf,
        birth_date: values.birth_date || undefined,
        address: values.address || undefined,
      })

      if (result.success && result.patientId) {
        setSuccessMessage('Paciente cadastrado a partir do documento.')
        setNewPatientId(result.patientId)
        setExtractionId(null)
        setFieldMeta(null)
        form.reset()
        router.refresh() // refresh to update pending queue
      } else {
        setActionError(result.error ?? 'Erro ao confirmar extração.')
      }
    })
  }

  // ── Reject → rejectOcrExtraction ─────────────────────────────────────────────

  function handleReject() {
    if (!extractionId) return
    setActionError(null)

    startReject(async () => {
      const result = await rejectOcrExtraction(extractionId, rejectReason || undefined)

      if (result.success) {
        setSuccessMessage('Extração rejeitada.')
        setExtractionId(null)
        setFieldMeta(null)
        form.reset()
        setRejectReason('')
        router.refresh()
      } else {
        setActionError(result.error ?? 'Erro ao rejeitar extração.')
      }
    })
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  const isActionPending = isConfirming || isRejecting

  return (
    <div className="space-y-8">

      {/* ── Upload section ───────────────────────────────────────────────────── */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-foreground">Enviar Documento</CardTitle>
          <CardDescription className="text-muted-foreground">
            Envie uma imagem (JPEG, PNG, WebP) ou PDF com até 4 MB.
            Os campos serão extraídos automaticamente pelo modelo de visão.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {uploadError && (
            <Alert variant="destructive">
              <AlertDescription>{uploadError}</AlertDescription>
            </Alert>
          )}

          {successMessage && (
            <Alert>
              <AlertDescription>
                {successMessage}
                {newPatientId && (
                  <span className="ml-2 text-muted-foreground">
                    (ID do paciente: <span className="font-mono">{newPatientId}</span>)
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col sm:flex-row gap-3 items-start">
            <div className="flex-1">
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                className="block w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:cursor-pointer"
                aria-label="Selecionar documento para OCR"
              />
              {selectedFile && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Selecionado: <span className="font-medium">{selectedFile.name}</span>{' '}
                  ({(selectedFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>

            <Button
              type="button"
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
              className="shrink-0"
            >
              {isUploading ? 'Processando...' : 'Extrair Dados'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Review form (shown after extraction) ─────────────────────────────── */}
      {extractionId && fieldMeta && (
        <>
          <Separator />
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-foreground">
                Revisar Campos Extraídos
                {ocrNeedsReview && (
                  <Badge variant="outline" className="ml-2 text-warning border-warning text-xs">
                    Revisão obrigatória
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Verifique e corrija os campos antes de confirmar. Os campos marcados com{' '}
                <span className="font-medium text-foreground">Revisar</span> têm baixa
                confiança e exigem sua atenção.
                Os valores editados são a fonte de verdade — o modelo é apenas um pré-preenchimento.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {actionError && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>{actionError}</AlertDescription>
                </Alert>
              )}

              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleConfirm)} className="space-y-4">
                  {/* full_name */}
                  <FormField
                    control={form.control}
                    name="full_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center">
                          {FIELD_LABELS.full_name}
                          {fieldMeta.full_name && (
                            <ConfidenceBadge confidence={fieldMeta.full_name.confidence} />
                          )}
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Nome completo do titular"
                            className="bg-background border-border text-foreground"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* cpf */}
                  <FormField
                    control={form.control}
                    name="cpf"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center">
                          {FIELD_LABELS.cpf}
                          {fieldMeta.cpf && (
                            <ConfidenceBadge confidence={fieldMeta.cpf.confidence} />
                          )}
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="000.000.000-00"
                            className="bg-background border-border text-foreground"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* birth_date */}
                  <FormField
                    control={form.control}
                    name="birth_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center">
                          {FIELD_LABELS.birth_date}
                          {fieldMeta.birth_date && (
                            <ConfidenceBadge confidence={fieldMeta.birth_date.confidence} />
                          )}
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ex.: 1990-05-20"
                            className="bg-background border-border text-foreground"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* address */}
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center">
                          {FIELD_LABELS.address}
                          {fieldMeta.address && (
                            <ConfidenceBadge confidence={fieldMeta.address.confidence} />
                          )}
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Logradouro, número, bairro, cidade — UF"
                            className="bg-background border-border text-foreground"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Reject reason */}
                  <div className="space-y-1">
                    <label
                      htmlFor="reject-reason"
                      className="text-sm font-medium text-foreground"
                    >
                      Motivo da Rejeição (opcional)
                    </label>
                    <Input
                      id="reject-reason"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Informe o motivo caso queira rejeitar esta extração"
                      className="bg-background border-border text-foreground"
                    />
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3 pt-2">
                    <Button
                      type="submit"
                      disabled={isActionPending}
                    >
                      {isConfirming ? 'Salvando paciente...' : 'Confirmar e Cadastrar Paciente'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isActionPending}
                      onClick={handleReject}
                    >
                      {isRejecting ? 'Rejeitando...' : 'Rejeitar Extração'}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── Pending-review queue ──────────────────────────────────────────────── */}
      {pendingQueue.length > 0 && (
        <>
          <Separator />
          <section>
            <h2 className="text-sm font-semibold text-foreground mb-3">
              Fila de Revisão Pendente ({pendingQueue.length})
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Extrações anteriores aguardando revisão humana. Clique em uma para carregar os
              campos no formulário acima.
            </p>
            <div className="space-y-3">
              {pendingQueue.map((row) => {
                const minConfPct = Math.round(row.min_confidence * 100)
                const isLoaded = extractionId === row.id
                return (
                  <Card
                    key={row.id}
                    className={`bg-card border-border cursor-pointer hover:border-primary/50 transition-colors ${isLoaded ? 'border-primary' : ''}`}
                    onClick={() => loadQueuedExtraction(row)}
                  >
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-foreground truncate">
                              {row.source_filename ?? 'Arquivo sem nome'}
                            </span>
                            <Badge variant="outline" className="text-warning border-warning text-xs shrink-0">
                              Conf. mín: {minConfPct}%
                            </Badge>
                            {isLoaded && (
                              <Badge variant="default" className="text-xs shrink-0">
                                Carregado
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {new Date(row.created_at).toLocaleString('pt-BR', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            loadQueuedExtraction(row)
                          }}
                        >
                          Revisar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </section>
        </>
      )}

      {pendingQueue.length === 0 && !extractionId && (
        <p className="text-sm text-muted-foreground">
          Nenhuma extração pendente de revisão.
        </p>
      )}
    </div>
  )
}
