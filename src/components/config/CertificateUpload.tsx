'use client'
/**
 * CertificateUpload — SYS-02 / Plan 07-06
 *
 * Upload form for ICP-Brasil A1 .pfx certificate.
 * On success: shows extracted metadata card (titular/CNPJ/validade/thumbprint).
 * On error: shows Alert with message (incl. "Certificado expirado" / "inválido").
 *
 * Design system: design tokens only (bg-background, border-border, text-foreground, etc.)
 * No raw slate-/gray-/text-white/bg-white classes.
 *
 * @base-ui is NOT used here — shadcn/ui covers all needed primitives.
 */
import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { uploadCertificate, type CertificatePublic } from '@/actions/certificate'
import { MAX_CERT_SIZE_BYTES } from '@/lib/validators/certificate'

// ─── Form schema (client-side, file-object-level) ──────────────────────────────
// We do not use the server certificateSchema here (it takes extracted fields).
// This schema validates the form field shapes before we call uploadCertificate.

const uploadFormSchema = z.object({
  password: z.string().min(1, 'A senha do certificado é obrigatória'),
})

type UploadFormValues = z.infer<typeof uploadFormSchema>

// ─── Props ────────────────────────────────────────────────────────────────────

interface CertificateUploadProps {
  current?: CertificatePublic
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function isCertExpired(notAfter: string): boolean {
  return new Date(notAfter) < new Date()
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CertificateUpload({ current }: CertificateUploadProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeCert, setActiveCert] = useState<CertificatePublic | undefined>(current)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const form = useForm<UploadFormValues>({
    resolver: zodResolver(uploadFormSchema),
    defaultValues: { password: '' },
  })

  function validateFile(file: File | null): string | null {
    if (!file) return 'Selecione um arquivo .pfx ou .p12'
    const name = file.name.toLowerCase()
    if (!name.endsWith('.pfx') && !name.endsWith('.p12')) {
      return 'Somente arquivos .pfx ou .p12 são aceitos'
    }
    if (file.size > MAX_CERT_SIZE_BYTES) {
      return 'O arquivo deve ter no máximo 5 MB'
    }
    return null
  }

  async function onSubmit(data: UploadFormValues) {
    setServerError(null)
    setFileError(null)

    const file = fileRef.current?.files?.[0] ?? null
    const err = validateFile(file)
    if (err) {
      setFileError(err)
      return
    }

    setIsSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('file', file!)
      formData.append('password', data.password)

      const result = await uploadCertificate(formData)
      if (result.success && result.certificate) {
        setActiveCert(result.certificate)
        form.reset()
        if (fileRef.current) fileRef.current.value = ''
      } else {
        setServerError(result.error ?? 'Erro ao enviar certificado.')
      }
    } catch {
      setServerError('Ocorreu um erro inesperado. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const expired = activeCert ? isCertExpired(activeCert.not_after) : false

  return (
    <div className="space-y-6">
      {/* ── Current certificate metadata ─────────────────────────────────────── */}
      {activeCert && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-foreground">
                Certificado Atual
              </CardTitle>
              {expired ? (
                <Badge variant="destructive">Expirado</Badge>
              ) : (
                <Badge className="bg-primary text-primary-foreground">Ativo</Badge>
              )}
            </div>
            <CardDescription className="text-muted-foreground">
              Metadados extraídos do certificado (bytes e senha armazenados com segurança)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <span className="text-muted-foreground">Titular</span>
              <span className="text-foreground font-medium">{activeCert.subject_cn}</span>

              {activeCert.cnpj && (
                <>
                  <span className="text-muted-foreground">CNPJ</span>
                  <span className="text-foreground">{activeCert.cnpj}</span>
                </>
              )}
              {activeCert.cpf && (
                <>
                  <span className="text-muted-foreground">CPF</span>
                  <span className="text-foreground">{activeCert.cpf}</span>
                </>
              )}

              <span className="text-muted-foreground">Emissor</span>
              <span className="text-foreground">{activeCert.issuer_cn ?? '—'}</span>

              <span className="text-muted-foreground">Válido de</span>
              <span className="text-foreground">{formatDate(activeCert.not_before)}</span>

              <span className="text-muted-foreground">Válido até</span>
              <span className={expired ? 'text-destructive font-medium' : 'text-foreground'}>
                {formatDate(activeCert.not_after)}
              </span>

              <span className="text-muted-foreground">Thumbprint (SHA-1)</span>
              <span className="text-foreground font-mono text-xs break-all">
                {activeCert.thumbprint_sha1}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* ── Upload form ───────────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">
          {activeCert ? 'Substituir Certificado' : 'Enviar Certificado'}
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Selecione o arquivo .pfx e informe a senha. O arquivo é processado
          exclusivamente no servidor — a senha não é armazenada em texto claro.
        </p>

        {/* File validation error (outside RHF, since File inputs are tricky) */}
        {fileError && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{fileError}</AlertDescription>
          </Alert>
        )}

        {serverError && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* File input */}
            <div className="space-y-2">
              <label
                htmlFor="cert-file"
                className="text-sm font-medium text-foreground"
              >
                Arquivo do Certificado (.pfx ou .p12) *
              </label>
              <input
                id="cert-file"
                type="file"
                accept=".pfx,.p12,application/x-pkcs12,application/pkcs12"
                ref={fileRef}
                onChange={() => setFileError(null)}
                className="block w-full text-sm text-foreground file:mr-4 file:py-1.5 file:px-3 file:rounded file:border file:border-border file:text-sm file:bg-background file:text-foreground hover:file:bg-accent cursor-pointer"
              />
            </div>

            {/* Password field */}
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha do Certificado *</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Senha do arquivo .pfx"
                      autoComplete="off"
                      className="bg-background border-border text-foreground"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Enviando...' : 'Enviar Certificado'}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  )
}
