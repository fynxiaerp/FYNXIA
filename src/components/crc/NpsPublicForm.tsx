'use client'

// NpsPublicForm — public single-field NPS form (CRC-04, D-13). Single field
// (0-10 score) + optional comment -> useState only, NO react-hook-form
// (UI-SPEC §Formulários: unnecessary bundle weight on a public route).
//
// T-18-32 (Information Disclosure): the 0-6 range is NEVER color-coded or
// otherwise visually distinguished from 7-10 here — classification
// (promotor/neutro/detrator) is computed server-side only (classifyNps) and
// never surfaces to the patient. Only the primary accent marks "selected",
// identically across the whole 0-10 range.

import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'

import { submitNpsPublic } from '@/actions/nps'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface NpsPublicFormProps {
  patientId: string
  token: string
}

const SCALE = Array.from({ length: 11 }, (_, i) => i)

export function NpsPublicForm({ patientId, token }: NpsPublicFormProps) {
  const [score, setScore] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit() {
    if (score === null) return
    setError(null)
    setIsSubmitting(true)
    const result = await submitNpsPublic({
      patientId,
      token,
      score,
      comment: comment.trim() || undefined,
    })
    setIsSubmitting(false)
    if (result.success) {
      setSubmitted(true)
    } else {
      setError(result.error ?? 'Não foi possível enviar sua avaliação. Tente novamente.')
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <CheckCircle2 className="size-14 text-green-600" />
        <div>
          <h2 className="text-xl font-semibold font-display text-foreground">
            Obrigado pela sua avaliação!
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sua resposta foi registrada. A equipe da clínica agradece o retorno.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap justify-center gap-2">
          {SCALE.map((value) => {
            const isSelected = score === value
            return (
              <button
                key={value}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setScore(value)}
                data-selected={isSelected}
                className="size-10 rounded-full border border-border text-sm font-semibold flex items-center justify-center hover:border-primary data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground data-[selected=true]:border-primary"
              >
                {value}
              </button>
            )
          })}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground px-1">
          <span>Pouco provável</span>
          <span>Muito provável</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="nps-comment" className="text-sm font-semibold text-foreground">
          Comentário (opcional)
        </label>
        <Textarea
          id="nps-comment"
          maxLength={500}
          placeholder="Conte um pouco mais sobre sua experiência (opcional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>

      <Button
        type="button"
        disabled={score === null || isSubmitting}
        onClick={() => void handleSubmit()}
      >
        {isSubmitting ? 'Enviando...' : 'Enviar Avaliação'}
      </Button>
    </div>
  )
}
