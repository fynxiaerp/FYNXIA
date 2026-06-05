'use client'
import { useState, useTransition } from 'react'
import { createAnamnesisToken, type AnamnesisListItem } from '@/actions/anamneses'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle, LinkIcon, ClipboardCopy, Check } from 'lucide-react'

// ─── AnamnesisList ────────────────────────────────────────────────────────────
// CLINIC-08: renders the patient's anamnesis history + "Gerar link de anamnese"
// action. Receives pre-fetched list from the server component (listAnamneses).
//
// Status badges:
//   signed  → green  "Assinada"
//   pending → yellow "Aguardando assinatura"
//   expired → red    "Link expirado"
//
// "Gerar link" calls createAnamnesisToken(patientId) and displays the URL
// for the staff member to copy. Copies to clipboard on button click.

interface AnamnesisBadgeProps {
  status: 'pending' | 'expired' | 'signed'
}

function AnamnesisBadge({ status }: AnamnesisBadgeProps) {
  if (status === 'signed') {
    return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Assinada</Badge>
  }
  if (status === 'pending') {
    return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Aguardando assinatura</Badge>
  }
  return <Badge variant="destructive">Link expirado</Badge>
}

function formatFlow(flow: string): string {
  if (flow === 'presencial') return 'Presencial'
  if (flow === 'link_publico') return 'Link público'
  return flow
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface AnamnesisList_Props {
  patientId: string
  anamneses: AnamnesisListItem[]
}

export function AnamnesisList({ patientId, anamneses }: AnamnesisList_Props) {
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleGenerateLink() {
    setGenerateError(null)
    setGeneratedUrl(null)
    setCopied(false)
    startTransition(async () => {
      const result = await createAnamnesisToken(patientId)
      if (result.success && result.url) {
        setGeneratedUrl(result.url)
      } else {
        setGenerateError(result.error ?? 'Erro ao gerar link de anamnese.')
      }
    })
  }

  async function handleCopy() {
    if (!generatedUrl) return
    try {
      await navigator.clipboard.writeText(generatedUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select the input text
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header + generate link button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Anamneses do Paciente</h3>
        <button
          type="button"
          onClick={handleGenerateLink}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <LinkIcon className="size-3.5" />
          {isPending ? 'Gerando...' : 'Gerar link de anamnese'}
        </button>
      </div>

      {/* Generated URL display */}
      {generatedUrl && (
        <div className="rounded-md border border-input bg-muted p-3">
          <p className="mb-1.5 text-xs font-medium text-foreground">Link gerado — compartilhe com o paciente:</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={generatedUrl}
              className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1 font-mono text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {copied ? <Check className="size-3.5 text-green-600" /> : <ClipboardCopy className="size-3.5" />}
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            O link expira em 72 horas e é de uso único.
          </p>
        </div>
      )}

      {/* Error */}
      {generateError && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>{generateError}</AlertDescription>
        </Alert>
      )}

      {/* Empty state */}
      {anamneses.length === 0 ? (
        <div className="flex min-h-[120px] flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">Nenhuma anamnese registrada.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Gere um link para o paciente preencher digitalmente ou registre presencialmente.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {anamneses.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between rounded-md border border-input bg-card px-4 py-3"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium text-foreground">
                  {formatFlow(item.flow)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {item.status === 'signed' && item.signed_at
                    ? `Assinada em ${formatDate(item.signed_at)}`
                    : `Criada em ${formatDate(item.created_at)}`}
                </span>
              </div>
              <AnamnesisBadge status={item.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
