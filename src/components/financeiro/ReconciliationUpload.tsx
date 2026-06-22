'use client'

// ReconciliationUpload — OFX file upload dialog.
// POSTs to /api/financeiro/ofx (NEVER calls importOFX server action directly —
// importOFX takes a Node Buffer which cannot cross the client→server boundary).
// Pattern: Dialog + file drop zone — mirrors NfseEmitForm.tsx upload zone.

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

// ─── Types ────────────────────────────────────────────────────────────────────

type BankAccountOption = { id: string; name: string; ativo: boolean }

interface ReconciliationUploadProps {
  bankAccounts: BankAccountOption[]
  defaultBankAccountId?: string
  trigger: React.ReactNode
}

// ─── ReconciliationUpload ─────────────────────────────────────────────────────

export function ReconciliationUpload({
  bankAccounts,
  defaultBankAccountId,
  trigger,
}: ReconciliationUploadProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [bankAccountId, setBankAccountId] = useState(defaultBankAccountId ?? '')
  const [isUploading, setIsUploading] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleOpen(value: boolean) {
    if (value) {
      setSelectedFile(null)
      setBankAccountId(defaultBankAccountId ?? '')
      setSuccessMsg(null)
      setErrorMsg(null)
    }
    setOpen(value)
  }

  function handleFileChange(file: File | null) {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.ofx')) {
      setErrorMsg('Formato inválido. Apenas arquivos .ofx são aceitos.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Arquivo muito grande. O limite é 5 MB.')
      return
    }
    setErrorMsg(null)
    setSelectedFile(file)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0] ?? null
    handleFileChange(file)
  }

  async function handleSubmit() {
    if (!selectedFile) {
      setErrorMsg('Selecione um arquivo OFX.')
      return
    }
    if (!bankAccountId) {
      setErrorMsg('Selecione a conta corrente.')
      return
    }

    setIsUploading(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      // D-05: NEVER call importOFX server action directly — Buffer cannot cross client→server.
      // Use the /api/financeiro/ofx route (16-07) via fetch + FormData multipart.
      const fd = new FormData()
      fd.append('file', selectedFile)
      fd.append('bankAccountId', bankAccountId)

      const res = await fetch('/api/financeiro/ofx', {
        method: 'POST',
        body: fd,
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        setErrorMsg(
          json.error ??
            'Não foi possível importar o arquivo. Verifique se é um OFX válido (máx. 5 MB) e tente novamente.'
        )
        return
      }

      // Success — copy verbatim from UI-SPEC copywriting contract
      const { imported = 0, skipped = 0, warnings } = json
      const baseMsg = `${imported} transações importadas, ${skipped} já existiam (ignoradas).`
      const warningNote =
        warnings && warnings.length > 0 ? ` ${warnings.join(' ')}` : ''
      setSuccessMsg(baseMsg + warningNote)
      router.refresh()
    } catch {
      setErrorMsg(
        'Não foi possível importar o arquivo. Verifique se é um OFX válido (máx. 5 MB) e tente novamente.'
      )
    } finally {
      setIsUploading(false)
    }
  }

  const activeAccounts = bankAccounts.filter((ba) => ba.ativo)

  return (
    <>
      <div
        className="contents"
        onClick={() => handleOpen(true)}
        onKeyDown={(e) => e.key === 'Enter' && handleOpen(true)}
        role="presentation"
      >
        {trigger}
      </div>

      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="sm:max-w-md bg-background text-foreground">
          <DialogHeader>
            <DialogTitle>Importar OFX</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {errorMsg && (
              <Alert variant="destructive">
                <AlertDescription>{errorMsg}</AlertDescription>
              </Alert>
            )}

            {successMsg && (
              <Alert>
                <AlertDescription>{successMsg}</AlertDescription>
              </Alert>
            )}

            {/* Drop zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragging
                  ? 'border-primary bg-accent/20'
                  : 'border-border hover:border-primary hover:bg-accent/10'
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
              aria-label="Área de upload de arquivo OFX"
            >
              <p className="text-sm font-medium text-foreground">
                {selectedFile
                  ? selectedFile.name
                  : 'Arraste o arquivo OFX ou clique para selecionar'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Formatos: OFX (SGML ou XML) — máx. 5 MB
              </p>
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".ofx"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />

            {/* Conta Corrente */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Conta Corrente *</label>
              <Select value={bankAccountId || 'none'} onValueChange={(v) => setBankAccountId((v ?? '') === 'none' ? '' : (v ?? ''))}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Selecione a conta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione a conta…</SelectItem>
                  {activeAccounts.map((ba) => (
                    <SelectItem key={ba.id} value={ba.id}>
                      {ba.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpen(false)}
              disabled={isUploading}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isUploading || !selectedFile || !bankAccountId}
            >
              {isUploading ? 'Importando...' : 'Importar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
