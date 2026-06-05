'use client'
import { useRef, useEffect, useCallback } from 'react'
import SignaturePad from 'signature_pad'

// ─── SignatureCanvas ──────────────────────────────────────────────────────────
// Wrapper around signature_pad v5 (headless).
// Accessibility: aria-label, touch-action:none (prevents scroll during signing).
// Cleanup: pad.off() on unmount (M-8 — RESEARCH Padrão 6).
// Touch target: Limpar/Confirmar buttons meet 44px minimum (WCAG 2.5.5).

interface SignatureCanvasProps {
  onSign: (dataUrl: string) => void
  onClear: () => void
}

export function SignatureCanvas({ onSign, onClear }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePad | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Initialize signature_pad v5
    const pad = new SignaturePad(canvas, { penColor: '#111827' })
    padRef.current = pad

    // Resize canvas to match display resolution (prevents blurry signatures on HiDPI)
    function resizeCanvas() {
      if (!canvas) return
      const ratio = Math.max(window.devicePixelRatio || 1, 1)
      canvas.width = canvas.offsetWidth * ratio
      canvas.height = canvas.offsetHeight * ratio
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.scale(ratio, ratio)
      pad.clear()
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    // Cleanup on unmount (M-8)
    return () => {
      window.removeEventListener('resize', resizeCanvas)
      pad.off()
    }
  }, [])

  const handleClear = useCallback(() => {
    padRef.current?.clear()
    onClear()
  }, [onClear])

  const handleConfirm = useCallback(() => {
    const pad = padRef.current
    if (!pad || pad.isEmpty()) return
    const dataUrl = pad.toDataURL('image/png')
    onSign(dataUrl)
  }, [onSign])

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Desenhe sua assinatura no campo abaixo.
      </p>
      <div className="relative rounded-md border border-input bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          style={{ touchAction: 'none', width: '100%', height: '200px', display: 'block' }}
          aria-label="Área de assinatura"
          className="cursor-crosshair"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleClear}
          className="flex-1 min-h-[44px] rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Limpar
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          className="flex-1 min-h-[44px] rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Confirmar Assinatura
        </button>
      </div>
    </div>
  )
}
