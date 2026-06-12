'use client'

// PdfButton — triggers prontuário PDF download with Loader2 spinner during generation.
// Replaces the plain <a> anchor per 06-UI-SPEC line 652.
import { useState } from 'react'
import { Loader2, FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PdfButtonProps {
  patientId: string
}

export function PdfButton({ patientId }: PdfButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch(`/api/patients/${patientId}/prontuario.pdf`)
      if (!res.ok) throw new Error('Erro ao gerar PDF')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `prontuario-${patientId}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // silently fail — user can retry
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDownload}
      disabled={loading}
      aria-label="Baixar Prontuário PDF"
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <FileDown className="size-4" />
      )}
      {loading ? 'Gerando…' : 'Baixar Prontuário PDF'}
    </Button>
  )
}
