'use client'
import { useState, useTransition } from 'react'
import { SignatureCanvas } from './SignatureCanvas'
import { CFO_QUESTIONS, type CfoResponses } from '@/lib/validators/anamnesis'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

// ─── AnamnesisForm ────────────────────────────────────────────────────────────
// Renders the CFO questionnaire with boolean checkboxes, the SignatureCanvas,
// and the "Assinar e Enviar" submit button.
//
// D-19: "Assinar e Enviar" is disabled until signature is confirmed.
// Touch targets: all interactive elements are min 44px height (WCAG 2.5.5).

type SubmitAction = (
  patientId: string,
  token: string,
  responses: CfoResponses,
  signatureDataUrl: string
) => Promise<{ success: boolean; error?: string }>

type PresencialSubmitAction = (
  patientId: string,
  responses: CfoResponses,
  signatureDataUrl: string
) => Promise<{ success: boolean; error?: string }>

interface AnamnesisFormPublicProps {
  mode: 'public'
  patientId: string
  token: string
  submitAction: SubmitAction
}

interface AnamnesisFormPresencialProps {
  mode: 'presencial'
  patientId: string
  submitAction: PresencialSubmitAction
}

type AnamnesisFormProps = AnamnesisFormPublicProps | AnamnesisFormPresencialProps

// Build initial responses (all false)
function buildInitialResponses(): CfoResponses {
  return {
    alergia_medicamento: false,
    alergia_anestesia: false,
    hipertensao: false,
    diabetes: false,
    problema_cardiaco: false,
    gravidez: false,
    uso_medicamento_continuo: false,
    problema_coagulacao: false,
    problema_renal: false,
    problema_respiratorio: false,
    cirurgia_recente: false,
    hepatite_ou_aids: false,
  }
}

export function AnamnesisForm(props: AnamnesisFormProps) {
  const [responses, setResponses] = useState<CfoResponses>(buildInitialResponses())
  const [signature, setSignature] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleCheckChange(key: string, checked: boolean) {
    setResponses((prev) => ({ ...prev, [key]: checked }))
  }

  function handleSign(dataUrl: string) {
    setSignature(dataUrl)
    setError(null)
  }

  function handleClear() {
    setSignature(null)
  }

  function handleSubmit() {
    if (!signature) {
      setError('A assinatura é obrigatória para enviar o formulário.')
      return
    }

    startTransition(async () => {
      let result: { success: boolean; error?: string }

      if (props.mode === 'public') {
        result = await props.submitAction(props.patientId, props.token, responses, signature)
      } else {
        result = await props.submitAction(props.patientId, responses, signature)
      }

      if (result.success) {
        setSuccess(true)
        setError(null)
      } else {
        setError(result.error ?? 'Ocorreu um erro ao enviar. Tente novamente.')
      }
    })
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-6 py-12 text-center">
        <CheckCircle2 className="size-16 text-green-500" />
        <div>
          <h2 className="text-xl font-semibold text-foreground">Anamnese enviada com sucesso!</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Suas respostas e assinatura foram registradas com segurança.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* CFO Questionnaire */}
      <section aria-labelledby="cfo-section-title">
        <h2 id="cfo-section-title" className="mb-4 text-base font-semibold text-foreground">
          Questionário de Saúde
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Responda com sinceridade. As informações são confidenciais e necessárias para seu atendimento.
        </p>
        <div className="flex flex-col gap-3">
          {CFO_QUESTIONS.map((q) => (
            <label
              key={q.key}
              className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md border border-input bg-card p-3 hover:bg-accent/50"
            >
              <input
                type="checkbox"
                className="size-4 shrink-0 rounded border-input accent-primary"
                checked={responses[q.key as keyof CfoResponses] as boolean}
                onChange={(e) => handleCheckChange(q.key, e.target.checked)}
              />
              <span className="text-sm text-foreground">{q.label}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Observações */}
      <section>
        <label htmlFor="observacoes" className="block text-sm font-medium text-foreground mb-1">
          Observações adicionais (opcional)
        </label>
        <textarea
          id="observacoes"
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          placeholder="Informe aqui outras condições de saúde relevantes..."
          onChange={(e) => setResponses((prev) => ({ ...prev, observacoes: e.target.value }))}
        />
      </section>

      {/* Signature */}
      <section aria-labelledby="signature-section-title">
        <h2 id="signature-section-title" className="mb-2 text-base font-semibold text-foreground">
          Assinatura
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Ao assinar, você declara que as informações fornecidas são verdadeiras.
        </p>
        <SignatureCanvas onSign={handleSign} onClear={handleClear} />
        {signature && (
          <p className="mt-2 text-xs text-green-600 font-medium">
            Assinatura confirmada. Clique em &quot;Assinar e Enviar&quot; para finalizar.
          </p>
        )}
      </section>

      {/* Error alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Submit — D-19: disabled until signature is confirmed */}
      <button
        type="button"
        disabled={!signature || isPending}
        onClick={handleSubmit}
        className="w-full min-h-[44px] rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? 'Enviando...' : 'Assinar e Enviar'}
      </button>
    </div>
  )
}
