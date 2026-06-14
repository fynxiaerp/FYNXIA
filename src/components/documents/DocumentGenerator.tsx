'use client'
/**
 * DocumentGenerator — generate → sign → verify + download document flow.
 *
 * Steps:
 *   1. Pick a template → call generateDocument → creates draft version
 *   2. Sign with ICP-Brasil cert → calls signDocument → stores signature + timestamp
 *   3. Download: link to /api/documentos/[versionId] (nodejs route, signed URL)
 *   4. Verify: calls verifyDocumentSignature → shows valid/invalid badge
 *
 * Read-only roles (auditor/dpo/socio): see version history but mutation buttons disabled.
 * Design: design tokens only, pt-BR, Alert for errors (no sonner — not installed).
 *
 * Phase: 08-documentos-assinatura-icp-brasil (DOC-02/03)
 */
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { DocumentVersionsList } from './DocumentVersionsList'
import {
  generateDocument,
  signDocument,
  verifyDocumentSignature,
  listDocumentVersions,
  type DocumentVersionSummary,
} from '@/actions/documents'
import type { TemplateListItem } from '@/actions/document-templates'

// ─── Props ────────────────────────────────────────────────────────────────────

interface DocumentGeneratorProps {
  templates: TemplateListItem[]
  isReadOnly: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPtBR(isoString: string | null | undefined): string {
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

// ─── Component ────────────────────────────────────────────────────────────────

export function DocumentGenerator({ templates, isReadOnly }: DocumentGeneratorProps) {
  // Template selection
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')

  // Document state
  const [documentId, setDocumentId] = useState<string | null>(null)
  const [versionId, setVersionId] = useState<string | null>(null)
  const [versions, setVersions] = useState<DocumentVersionSummary[]>([])

  // Signing result
  const [signResult, setSignResult] = useState<{
    sha256Hex: string
    signerCn: string
    signedAt: string
    thumbprint: string
  } | null>(null)

  // Verification result
  const [verifyResult, setVerifyResult] = useState<{
    verified: boolean
    signerCn: string | null
    signedAt: string | null
  } | null>(null)

  // Loading states
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSigning, setIsSigning] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)

  // Error
  const [error, setError] = useState<string | null>(null)

  // ── Refresh version list ────────────────────────────────────────────────────
  async function refreshVersions(docId: string) {
    const result = await listDocumentVersions(docId)
    if (result.success && result.data) {
      setVersions(result.data)
    }
  }

  // ── Generate ────────────────────────────────────────────────────────────────
  async function handleGenerate() {
    if (!selectedTemplateId) {
      setError('Selecione um modelo de documento.')
      return
    }
    setError(null)
    setIsGenerating(true)
    setSignResult(null)
    setVerifyResult(null)

    try {
      const result = await generateDocument({
        templateId: selectedTemplateId,
        context: {},
      })

      if (!result.success || !result.documentId || !result.versionId) {
        setError(result.error ?? 'Erro ao gerar documento.')
        return
      }

      setDocumentId(result.documentId)
      setVersionId(result.versionId)
      await refreshVersions(result.documentId)
    } catch {
      setError('Erro inesperado ao gerar documento.')
    } finally {
      setIsGenerating(false)
    }
  }

  // ── Sign ─────────────────────────────────────────────────────────────────────
  async function handleSign() {
    if (!versionId) return
    setError(null)
    setIsSigning(true)
    setVerifyResult(null)

    try {
      const result = await signDocument(versionId)

      if (!result.success) {
        setError(result.error ?? 'Erro ao assinar documento.')
        return
      }

      setSignResult({
        sha256Hex: result.sha256Hex ?? '',
        signerCn: result.signerCn ?? '',
        signedAt: result.signedAt ?? '',
        thumbprint: result.thumbprint ?? '',
      })

      if (documentId) {
        await refreshVersions(documentId)
      }
    } catch {
      setError('Erro inesperado ao assinar documento.')
    } finally {
      setIsSigning(false)
    }
  }

  // ── Verify ───────────────────────────────────────────────────────────────────
  async function handleVerify() {
    if (!versionId) return
    setError(null)
    setIsVerifying(true)

    try {
      const result = await verifyDocumentSignature(versionId)

      if (!result.success) {
        setError(result.error ?? 'Erro ao verificar assinatura.')
        return
      }

      setVerifyResult({
        verified: result.verified ?? false,
        signerCn: result.signerCn ?? null,
        signedAt: result.signedAt ?? null,
      })
    } catch {
      setError('Erro inesperado ao verificar assinatura.')
    } finally {
      setIsVerifying(false)
    }
  }

  // ── Request revision ─────────────────────────────────────────────────────────
  async function handleRequestRevision() {
    if (!documentId || !selectedTemplateId) return
    setError(null)
    setSignResult(null)
    setVerifyResult(null)
    setIsGenerating(true)

    try {
      const result = await generateDocument({
        templateId: selectedTemplateId,
        context: {},
      })

      if (!result.success || !result.documentId || !result.versionId) {
        setError(result.error ?? 'Erro ao criar nova revisão.')
        return
      }

      setDocumentId(result.documentId)
      setVersionId(result.versionId)
      await refreshVersions(result.documentId)
    } catch {
      setError('Erro inesperado ao criar revisão.')
    } finally {
      setIsGenerating(false)
    }
  }

  const isSigned = Boolean(signResult)
  const activeTemplate = templates.find((t) => t.id === selectedTemplateId)

  return (
    <div className="space-y-6">
      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* ── Template picker ────────────────────────────────────────────────── */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-foreground">Gerar Documento</CardTitle>
          <CardDescription className="text-muted-foreground">
            Selecione um modelo e gere um documento com assinatura ICP-Brasil.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {templates.length === 0 ? (
            <Alert>
              <AlertDescription>
                Nenhum modelo de documento disponível. Crie modelos em{' '}
                <a href="/config/documentos" className="underline text-primary">
                  Configurações &rsaquo; Documentos
                </a>
                .
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-2">
              <label
                htmlFor="template-select"
                className="text-sm font-medium text-foreground"
              >
                Modelo de documento
              </label>
              <select
                id="template-select"
                value={selectedTemplateId}
                onChange={(e) => {
                  setSelectedTemplateId(e.target.value)
                  setDocumentId(null)
                  setVersionId(null)
                  setVersions([])
                  setSignResult(null)
                  setVerifyResult(null)
                  setError(null)
                }}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Selecione um modelo…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {t.category}
                  </option>
                ))}
              </select>

              {activeTemplate && (
                <p className="text-xs text-muted-foreground">
                  Variáveis: {activeTemplate.variables.length > 0
                    ? activeTemplate.variables.map((v) => `{{${v}}}`).join(', ')
                    : 'nenhuma'}
                </p>
              )}
            </div>
          )}

          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !selectedTemplateId || isReadOnly}
            size="sm"
          >
            {isGenerating ? 'Gerando…' : 'Gerar Documento'}
          </Button>

          {isReadOnly && (
            <p className="text-xs text-muted-foreground">
              Acesso somente leitura — geração e assinatura desativadas para este papel.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Draft generated — sign + download ─────────────────────────────── */}
      {versionId && !isSigned && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-foreground">Rascunho Gerado</CardTitle>
            <CardDescription className="text-muted-foreground">
              Documento criado como rascunho. Assine com o certificado ICP-Brasil para torná-lo imutável.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-muted-foreground text-xs">
                RASCUNHO
              </Badge>
              <span className="text-xs text-muted-foreground font-mono truncate">
                ID: {versionId}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={handleSign}
                disabled={isSigning || isReadOnly}
                size="sm"
              >
                {isSigning ? 'Assinando…' : 'Assinar com ICP-Brasil'}
              </Button>

              <a
                href={`/api/documentos/${versionId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm">
                  Baixar PDF
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Signed — metadata + verify + download ─────────────────────────── */}
      {isSigned && signResult && versionId && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-foreground">Documento Assinado</CardTitle>
              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                ICP-Brasil
              </Badge>
            </div>
            <CardDescription className="text-muted-foreground">
              Assinatura criptográfica registrada. O documento é agora imutável.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Signature metadata */}
            <div className="grid grid-cols-1 gap-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">Assinante</span>
                <span className="text-foreground font-mono text-xs">{signResult.signerCn || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">Carimbo de tempo</span>
                <span className="text-foreground text-xs">{formatPtBR(signResult.signedAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">Certificado (SHA-1)</span>
                <span className="text-foreground font-mono text-xs truncate max-w-[240px]">
                  {signResult.thumbprint || '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">SHA-256</span>
                <span className="text-foreground font-mono text-xs truncate max-w-[240px]">
                  {signResult.sha256Hex || '—'}
                </span>
              </div>
            </div>

            <Separator />

            {/* Verification result */}
            {verifyResult && (
              <div className="flex items-center gap-2">
                {verifyResult.verified ? (
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                    Assinatura válida
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-xs">
                    Assinatura inválida
                  </Badge>
                )}
                {verifyResult.verified && verifyResult.signedAt && (
                  <span className="text-xs text-muted-foreground">
                    em {formatPtBR(verifyResult.signedAt)}
                  </span>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <a
                href={`/api/documentos/${versionId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="sm">Baixar PDF</Button>
              </a>

              <Button
                variant="outline"
                size="sm"
                onClick={handleVerify}
                disabled={isVerifying}
              >
                {isVerifying ? 'Verificando…' : 'Verificar Assinatura'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Version history ─────────────────────────────────────────────────── */}
      {documentId && versions.length > 0 && (
        <>
          <Separator />
          <DocumentVersionsList
            documentId={documentId}
            versions={versions}
            isReadOnly={isReadOnly}
            onSelectVersion={(vid) => setVersionId(vid)}
            onRequestRevision={handleRequestRevision}
          />
        </>
      )}
    </div>
  )
}
