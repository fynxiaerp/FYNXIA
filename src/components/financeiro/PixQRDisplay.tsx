'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

// ─── PixQRDisplay ─────────────────────────────────────────────────────────────
// FIN-04: renders Asaas PIX QR code as inline base64 data URL + copia-e-cola string.
// UI-SPEC §Nova Cobrança Page: 200×200 QR image + "Copiar código Pix" button.
// Accessibility: aria-label on img and copy button per UI-SPEC.

interface PixQRDisplayProps {
  encodedImage: string   // Asaas base64-encoded PNG from getPixQrCode
  payload: string        // PIX copia-e-cola string (EMV payload)
  patientName?: string   // For alt text accessibility
}

export function PixQRDisplay({ encodedImage, payload, patientName }: PixQRDisplayProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(payload)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select text — clipboard API may fail in some contexts
    }
  }

  const altText = patientName
    ? `Código QR para pagamento via Pix do paciente ${patientName}`
    : 'Código QR para pagamento via Pix'

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        {/* 200×200 QR code — Asaas base64 PNG as inline data URL (data:image/png;base64) */}
        <div className="shrink-0 rounded-lg border border-border p-2">
          <img
            src={`data:image/png;base64,${encodedImage}`}
            alt={altText}
            width={200}
            height={200}
            className="block"
          />
        </div>

        <div className="flex flex-1 flex-col gap-3">
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Pix Copia e Cola</p>
            <p className="mt-1 break-all rounded-md bg-muted p-2 font-mono text-xs leading-relaxed">
              {payload}
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            aria-label="Copiar código Pix"
            className="w-fit"
          >
            {copied ? 'Copiado!' : 'Copiar código Pix'}
          </Button>
        </div>
      </div>
    </div>
  )
}
