'use client'
/**
 * ClinicalDocumentForm — RHF + Zod v3 form for emitting clinical documents.
 *
 * Supports: receita_simples, receita_controle_especial, atestado, solicitacao_exame.
 * - doc_type select drives conditional field rendering
 * - Medication combobox (filtered from medications prop) + posologia textarea
 * - AllergyAlert rendered non-blocking after issueClinicDocument returns allergyAlert
 * - Allergy alert is INFORMATIVE ONLY — never blocks submit (D-02)
 * - On success: shows draft info + "Assinar (ICP-Brasil)" CTA
 * - On sign success: immutable stamp (signer/timestamp/thumbprint), no edit/sign CTA
 * - Read-only roles: isReadOnly prop hides all mutation CTAs
 *
 * Constraints:
 * - RHF v7 + zodResolver(clinicalDocumentSchema), Zod v3, NO .default() in schema
 * - @base-ui Button (render-prop, NEVER asChild)
 * - pt-BR labels + error messages
 * - Tokens only (no hardcoded colors beyond amber for allergy alert)
 *
 * Phase: 12-receitu-rio-teleodontologia / Plan 06
 * Requirements: RX-01, RX-02, RX-03
 */

import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { clinicalDocumentSchema } from '@/lib/validators/clinical-document'
import type { ClinicalDocumentInput } from '@/lib/validators/clinical-document'
import { issueClinicDocument, signClinicDocument } from '@/actions/clinical-documents'
import { AllergyAlert } from './AllergyAlert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'

// ─── Prop types ───────────────────────────────────────────────────────────────

export interface MedicationOption {
  id: string
  name: string
  generic_name: string | null
  therapeutic_class: string
  requires_special_control: boolean
  common_dosages: string[]
}

export interface PatientOption {
  id: string
  full_name: string
}

/**
 * An already-issued document (draft or signed). When provided, the form renders
 * the read/sign view instead of the issue form — used by the [id] read page.
 */
export interface ExistingDocument {
  id: string
  doc_number: string
  doc_type: string
  status: string
  /** Already-signed stamp (present only when status === 'signed') */
  signer_cn?: string | null
  signed_at?: string | null
  cert_thumbprint?: string | null
  /** Decrypted, display-safe content (server-decrypted before passing in) */
  content?: {
    medications?: { medication_name: string; posologia: string; quantidade?: string }[]
    observacoes?: string
    atestado_motivo?: string
    atestado_dias?: number
    exame_solicitacao?: string
  }
}

interface ClinicalDocumentFormProps {
  medications: MedicationOption[]
  patients: PatientOption[]
  isReadOnly?: boolean
  /** Pre-selected patient (e.g. from patient detail page) */
  defaultPatientId?: string
  /** When set, render the read/sign view for an existing document (RX-03 immutability) */
  existingDocument?: ExistingDocument
}

// ─── Doc type labels ──────────────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<string, string> = {
  receita_simples: 'Receita Simples',
  receita_controle_especial: 'Receita de Controle Especial',
  atestado: 'Atestado',
  solicitacao_exame: 'Solicitação de Exame',
}

// ─── Signed document stamp ────────────────────────────────────────────────────

interface SignedStamp {
  signerCn: string
  signedAt: string
  thumbprint: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ClinicalDocumentForm({
  medications,
  patients,
  isReadOnly = false,
  defaultPatientId,
  existingDocument,
}: ClinicalDocumentFormProps) {
  // Form state
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ClinicalDocumentInput>({
    resolver: zodResolver(clinicalDocumentSchema),
    defaultValues: {
      doc_type: 'receita_simples',
      patient_id: defaultPatientId ?? '',
      portal_visible: false,
      medications: [{ medication_id: '', medication_name: '', posologia: '', quantidade: '' }],
      atestado_motivo: '',
      atestado_dias: undefined,
      exame_solicitacao: '',
      observacoes: '',
    },
  })

  // Medication rows fieldArray
  const { fields, append, remove } = useFieldArray({ control, name: 'medications' })

  // Watched fields for conditional rendering
  const docType = watch('doc_type')
  const isReceita = docType === 'receita_simples' || docType === 'receita_controle_especial'

  // Post-submit state
  const [allergyReasons, setAllergyReasons] = useState<string[]>([])
  const [issuedDocId, setIssuedDocId] = useState<string | null>(null)
  const [issuedDocNumber, setIssuedDocNumber] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSigning, setIsSigning] = useState(false)
  const [signError, setSignError] = useState<string | null>(null)
  const [signedStamp, setSignedStamp] = useState<SignedStamp | null>(null)

  // ── Submit handler ──────────────────────────────────────────────────────────

  async function onSubmit(data: ClinicalDocumentInput) {
    setSubmitError(null)
    setAllergyReasons([])

    const result = await issueClinicDocument(data)

    if (!result.success) {
      setSubmitError(result.error ?? 'Erro ao emitir documento.')
      return
    }

    // Non-blocking allergy alert (D-02): show even on success
    if (result.allergyAlert?.reasons && result.allergyAlert.reasons.length > 0) {
      setAllergyReasons(result.allergyAlert.reasons)
    }

    setIssuedDocId(result.documentId ?? null)
    setIssuedDocNumber(result.docNumber ?? null)
  }

  // ── Sign handler ────────────────────────────────────────────────────────────

  async function handleSign(docId?: string) {
    const targetId = docId ?? issuedDocId
    if (!targetId) return
    setIsSigning(true)
    setSignError(null)

    const result = await signClinicDocument(targetId)

    setIsSigning(false)

    if (!result.success) {
      setSignError(result.error ?? 'Erro ao assinar documento.')
      return
    }

    setSignedStamp({
      signerCn: result.signerCn ?? '',
      signedAt: result.signedAt ?? '',
      thumbprint: result.thumbprint ?? '',
    })
  }

  // ── Medication filter for controle especial ─────────────────────────────────

  const availableMedications =
    docType === 'receita_controle_especial'
      ? medications.filter((m) => m.requires_special_control)
      : medications

  // ── Render: existing document read/sign view (from [id] page) ───────────────
  // RX-03: a signed document is immutable (no sign CTA); a draft offers signing.

  if (existingDocument) {
    const isSigned = existingDocument.status === 'signed' || signedStamp !== null
    const content = existingDocument.content ?? {}
    const stamp: SignedStamp | null = signedStamp ?? (
      existingDocument.status === 'signed'
        ? {
            signerCn: existingDocument.signer_cn ?? '',
            signedAt: existingDocument.signed_at ?? '',
            thumbprint: existingDocument.cert_thumbprint ?? '',
          }
        : null
    )

    return (
      <div className="space-y-4">
        <div className="p-4 border border-border rounded-lg bg-muted/30 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">
              Documento <span className="font-mono">{existingDocument.doc_number}</span>
            </p>
            <span className="text-xs px-2 py-0.5 rounded border border-border text-muted-foreground">
              {DOC_TYPE_LABELS[existingDocument.doc_type] ?? existingDocument.doc_type}
            </span>
          </div>

          {/* Decrypted content (display-safe, server-decrypted) */}
          {content.medications && content.medications.length > 0 && (
            <ul className="text-sm space-y-1.5 text-foreground">
              {content.medications.map((m, i) => (
                <li key={i} className="border-l-2 border-border pl-2">
                  <span className="font-medium">{m.medication_name}</span>
                  {m.quantidade ? ` — ${m.quantidade}` : ''}
                  <br />
                  <span className="text-muted-foreground">{m.posologia}</span>
                </li>
              ))}
            </ul>
          )}
          {content.atestado_motivo && (
            <p className="text-sm text-foreground">
              {content.atestado_motivo}
              {typeof content.atestado_dias === 'number'
                ? ` (${content.atestado_dias} dia(s))`
                : ''}
            </p>
          )}
          {content.exame_solicitacao && (
            <p className="text-sm text-foreground whitespace-pre-wrap">
              {content.exame_solicitacao}
            </p>
          )}
          {content.observacoes && (
            <p className="text-xs text-muted-foreground">Obs.: {content.observacoes}</p>
          )}
        </div>

        {/* Signed stamp (immutable) */}
        {isSigned && stamp ? (
          <div className="space-y-2 p-4 border border-border rounded-lg bg-muted/30">
            <p className="text-sm font-medium text-foreground">Assinado digitalmente</p>
            <dl className="text-sm space-y-1 text-muted-foreground">
              <div>
                <dt className="inline font-medium text-foreground">Assinante: </dt>
                <dd className="inline">{stamp.signerCn}</dd>
              </div>
              <div>
                <dt className="inline font-medium text-foreground">Assinado em: </dt>
                <dd className="inline">
                  {stamp.signedAt ? new Date(stamp.signedAt).toLocaleString('pt-BR') : '—'}
                </dd>
              </div>
              <div>
                <dt className="inline font-medium text-foreground">Impressão digital: </dt>
                <dd className="inline font-mono text-xs break-all">{stamp.thumbprint}</dd>
              </div>
            </dl>
            <p className="text-xs text-muted-foreground">
              Documento imutável — assinado com certificado ICP-Brasil.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Rascunho. Assine com o certificado ICP-Brasil para tornar o documento oficial e
              imutável.
            </p>
            {signError && (
              <Alert variant="destructive">
                <AlertDescription>{signError}</AlertDescription>
              </Alert>
            )}
            {!isReadOnly && (
              <Button
                onClick={() => handleSign(existingDocument.id)}
                disabled={isSigning}
                variant="default"
              >
                {isSigning ? 'Assinando...' : 'Assinar (ICP-Brasil)'}
              </Button>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Render: signed document (immutable) ────────────────────────────────────

  if (signedStamp) {
    return (
      <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/30">
        <p className="text-sm font-medium text-foreground">
          Documento <span className="font-mono">{issuedDocNumber}</span> assinado com sucesso.
        </p>
        <dl className="text-sm space-y-1 text-muted-foreground">
          <div>
            <dt className="inline font-medium text-foreground">Assinante: </dt>
            <dd className="inline">{signedStamp.signerCn}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-foreground">Assinado em: </dt>
            <dd className="inline">{new Date(signedStamp.signedAt).toLocaleString('pt-BR')}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-foreground">Impressão digital: </dt>
            <dd className="inline font-mono text-xs break-all">{signedStamp.thumbprint}</dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">
          Documento imutável — assinado digitalmente com certificado ICP-Brasil.
        </p>
      </div>
    )
  }

  // ── Render: draft issued, awaiting signature ────────────────────────────────

  if (issuedDocId && !signedStamp) {
    return (
      <div className="space-y-4">
        {/* Allergy alert shown non-blocking above result (D-02) */}
        {allergyReasons.length > 0 && <AllergyAlert reasons={allergyReasons} />}

        <div className="p-4 border border-border rounded-lg bg-muted/30 space-y-3">
          <p className="text-sm font-medium text-foreground">
            Documento <span className="font-mono">{issuedDocNumber}</span> criado como rascunho.
          </p>
          <p className="text-xs text-muted-foreground">
            Assine com o certificado ICP-Brasil para tornar o documento oficial e imutável.
          </p>

          {signError && (
            <Alert variant="destructive">
              <AlertDescription>{signError}</AlertDescription>
            </Alert>
          )}

          {!isReadOnly && (
            <Button
              onClick={() => handleSign()}
              disabled={isSigning}
              variant="default"
            >
              {isSigning ? 'Assinando...' : 'Assinar (ICP-Brasil)'}
            </Button>
          )}
        </div>
      </div>
    )
  }

  // ── Render: issue form ──────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Allergy alert shown above form after a previous failed attempt that returned alert */}
      {allergyReasons.length > 0 && <AllergyAlert reasons={allergyReasons} />}

      {/* Error alert */}
      {submitError && (
        <Alert variant="destructive">
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      {/* ── Paciente ── */}
      <div className="space-y-1.5">
        <Label htmlFor="patient_id">Paciente *</Label>
        <select
          id="patient_id"
          className="flex h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          {...register('patient_id')}
        >
          <option value="">Selecione um paciente</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name}
            </option>
          ))}
        </select>
        {errors.patient_id && (
          <p className="text-xs text-destructive">{errors.patient_id.message}</p>
        )}
      </div>

      {/* ── Tipo de documento ── */}
      <div className="space-y-1.5">
        <Label htmlFor="doc_type">Tipo de documento *</Label>
        <Select
          value={docType}
          onValueChange={(val) => {
            if (val) setValue('doc_type', val as ClinicalDocumentInput['doc_type'])
          }}
        >
          <SelectTrigger id="doc_type" className="w-full">
            <SelectValue placeholder="Selecione o tipo" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(DOC_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.doc_type && (
          <p className="text-xs text-destructive">{errors.doc_type.message}</p>
        )}
      </div>

      {/* ── Receita fields ── */}
      {isReceita && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Medicamentos *</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                append({ medication_id: '', medication_name: '', posologia: '', quantidade: '' })
              }
            >
              + Adicionar medicamento
            </Button>
          </div>

          {fields.map((field, index) => {
            const selectedMed = availableMedications.find(
              (m) => m.id === watch(`medications.${index}.medication_id`)
            )

            return (
              <div
                key={field.id}
                className="border border-border rounded-lg p-4 space-y-3 bg-muted/20"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    Medicamento {index + 1}
                  </span>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(index)}
                    >
                      Remover
                    </Button>
                  )}
                </div>

                {/* Medication combobox */}
                <div className="space-y-1.5">
                  <Label htmlFor={`med-select-${index}`}>Medicamento</Label>
                  <select
                    id={`med-select-${index}`}
                    className="flex h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={watch(`medications.${index}.medication_id`) ?? ''}
                    onChange={(e) => {
                      const med = availableMedications.find((m) => m.id === e.target.value)
                      if (med) {
                        setValue(`medications.${index}.medication_id`, med.id)
                        setValue(`medications.${index}.medication_name`, med.name)
                      } else {
                        setValue(`medications.${index}.medication_id`, '')
                        setValue(`medications.${index}.medication_name`, '')
                      }
                    }}
                  >
                    <option value="">Selecione um medicamento</option>
                    {availableMedications.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                        {m.generic_name ? ` (${m.generic_name})` : ''}
                        {m.requires_special_control ? ' — Controle especial' : ''}
                      </option>
                    ))}
                  </select>
                  {errors.medications?.[index]?.medication_id && (
                    <p className="text-xs text-destructive">
                      {errors.medications[index]?.medication_id?.message}
                    </p>
                  )}
                </div>

                {/* Common dosages quick-pick */}
                {selectedMed && selectedMed.common_dosages.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Posologias comuns (clique para preencher):
                    </Label>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedMed.common_dosages.map((dosage, di) => (
                        <button
                          key={di}
                          type="button"
                          className="text-xs px-2 py-0.5 rounded border border-border hover:bg-muted transition-colors"
                          onClick={() => setValue(`medications.${index}.posologia`, dosage)}
                        >
                          {dosage}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Posologia */}
                <div className="space-y-1.5">
                  <Label htmlFor={`posologia-${index}`}>Posologia *</Label>
                  <Textarea
                    id={`posologia-${index}`}
                    rows={2}
                    placeholder="Ex: 1 comprimido de 8/8h por 7 dias"
                    {...register(`medications.${index}.posologia`)}
                  />
                  {errors.medications?.[index]?.posologia && (
                    <p className="text-xs text-destructive">
                      {errors.medications[index]?.posologia?.message}
                    </p>
                  )}
                </div>

                {/* Quantidade */}
                <div className="space-y-1.5">
                  <Label htmlFor={`quantidade-${index}`}>Quantidade (opcional)</Label>
                  <Input
                    id={`quantidade-${index}`}
                    placeholder="Ex: 1 caixa"
                    {...register(`medications.${index}.quantidade`)}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Atestado fields ── */}
      {docType === 'atestado' && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="atestado_motivo">Motivo do atestado *</Label>
            <Textarea
              id="atestado_motivo"
              rows={3}
              placeholder="Descreva o motivo do atestado"
              {...register('atestado_motivo')}
            />
            {errors.atestado_motivo && (
              <p className="text-xs text-destructive">{errors.atestado_motivo.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="atestado_dias">Número de dias (opcional)</Label>
            <Input
              id="atestado_dias"
              type="number"
              min={0}
              placeholder="Ex: 2"
              {...register('atestado_dias', { valueAsNumber: true })}
            />
            {errors.atestado_dias && (
              <p className="text-xs text-destructive">{errors.atestado_dias.message}</p>
            )}
          </div>
        </div>
      )}

      {/* ── Solicitação de exame fields ── */}
      {docType === 'solicitacao_exame' && (
        <div className="space-y-1.5">
          <Label htmlFor="exame_solicitacao">Exames solicitados *</Label>
          <Textarea
            id="exame_solicitacao"
            rows={4}
            placeholder="Descreva os exames solicitados e indicações clínicas"
            {...register('exame_solicitacao')}
          />
          {errors.exame_solicitacao && (
            <p className="text-xs text-destructive">{errors.exame_solicitacao.message}</p>
          )}
        </div>
      )}

      {/* ── Observações (shared) ── */}
      <div className="space-y-1.5">
        <Label htmlFor="observacoes">Observações (opcional)</Label>
        <Textarea
          id="observacoes"
          rows={2}
          placeholder="Observações adicionais"
          {...register('observacoes')}
        />
      </div>

      {/* ── Portal visibility ── */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="portal_visible"
          checked={!!watch('portal_visible')}
          onCheckedChange={(checked) => setValue('portal_visible', !!checked)}
        />
        <Label htmlFor="portal_visible" className="cursor-pointer font-normal">
          Visível no Portal do Paciente
        </Label>
      </div>

      {/* ── Submit ── */}
      {!isReadOnly && (
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Emitindo...' : 'Emitir documento'}
        </Button>
      )}

      {isReadOnly && (
        <p className="text-sm text-muted-foreground">
          Acesso somente leitura. Seu papel não permite emitir documentos clínicos.
        </p>
      )}
    </form>
  )
}
