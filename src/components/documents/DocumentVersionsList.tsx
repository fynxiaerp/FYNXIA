'use client'
/**
 * DocumentVersionsList — immutable version history for a document.
 *
 * Renders version_number, status (draft/signed), signed_at, signer for each version.
 * Signed versions show a lock indicator and cannot be edited.
 * Draft versions can trigger a new draft revision (append-only — D-03).
 *
 * Design: design tokens only (no raw Tailwind colors), pt-BR, Alert for errors.
 * Phase: 08-documentos-assinatura-icp-brasil (DOC-03)
 */
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { DocumentVersionSummary } from '@/actions/documents'

interface DocumentVersionsListProps {
  documentId: string
  versions: DocumentVersionSummary[]
  isReadOnly: boolean
  onSelectVersion: (versionId: string) => void
  /** Called when user requests a new draft revision of a signed document */
  onRequestRevision?: () => void
}

function formatPtBR(isoString: string | null): string {
  if (!isoString) return '—'
  try {
    return new Date(isoString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return isoString
  }
}

export function DocumentVersionsList({
  versions,
  isReadOnly,
  onSelectVersion,
  onRequestRevision,
}: DocumentVersionsListProps) {
  const [error, setError] = useState<string | null>(null)

  if (versions.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        Nenhuma versão encontrada para este documento.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        Histórico de Versões
      </div>

      <div className="divide-y divide-border rounded-md border border-border overflow-hidden">
        {versions.map((v) => {
          const isSigned = Boolean(v.signature)
          return (
            <div
              key={v.id}
              className="flex items-center justify-between px-4 py-3 bg-card hover:bg-muted/30 transition-colors"
            >
              {/* Left: version info */}
              <div className="flex items-center gap-3 min-w-0">
                {/* Lock icon for signed versions (CSS-only, no Lucide server→client issue) */}
                <span
                  className={`text-sm font-mono font-semibold ${isSigned ? 'text-primary' : 'text-muted-foreground'}`}
                  aria-label={isSigned ? 'Versão assinada' : 'Rascunho'}
                >
                  v{v.version_number}
                </span>

                <div className="flex items-center gap-2">
                  {isSigned ? (
                    <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                      Assinado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      Rascunho
                    </Badge>
                  )}

                  {isSigned && v.signer_cn && (
                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {v.signer_cn}
                    </span>
                  )}
                </div>
              </div>

              {/* Right: date + actions */}
              <div className="flex items-center gap-3 shrink-0 ml-4">
                <span className="text-xs text-muted-foreground">
                  {isSigned ? formatPtBR(v.signed_at) : formatPtBR(v.created_at)}
                </span>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setError(null)
                    onSelectVersion(v.id)
                  }}
                >
                  Ver
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      {/* New revision button — only for non-read-only roles when last version is signed */}
      {!isReadOnly && versions.length > 0 && Boolean(versions[0]?.signature) && onRequestRevision && (
        <div className="pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setError(null)
              onRequestRevision()
            }}
          >
            Nova Revisão (novo rascunho)
          </Button>
          <p className="text-xs text-muted-foreground mt-1">
            Versões assinadas são imutáveis. Editar cria uma nova versão preservando o histórico.
          </p>
        </div>
      )}
    </div>
  )
}
