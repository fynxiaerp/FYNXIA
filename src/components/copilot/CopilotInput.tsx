'use client'
// src/components/copilot/CopilotInput.tsx
// Input area for the copilot sidebar.
// - Controlled Textarea (Enter submits, Shift+Enter = newline)
// - "Perguntar" send button (disabled when empty or loading)
// - "Limpar conversa" ghost button (read-only clear — D-05, no confirmation dialog)
// All copy pt-BR.

import type { KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'

interface CopilotInputProps {
  input: string
  setInput: (value: string) => void
  onSubmit: (text: string) => void
  onClear: () => void
  isLoading: boolean
}

export function CopilotInput({
  input,
  setInput,
  onSubmit,
  onClear,
  isLoading,
}: CopilotInputProps) {
  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSubmit(input)
    }
  }

  const isDisabled = isLoading || !input.trim()

  return (
    <div className="flex flex-col gap-2 p-4">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="Mensagem para o copiloto"
        placeholder="Faça uma pergunta…"
        disabled={isLoading}
        className={[
          'w-full resize-none rounded-md border border-border bg-background px-3 py-2',
          'text-sm leading-relaxed text-foreground placeholder:text-muted-foreground',
          'min-h-[40px] max-h-[120px]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'transition-colors',
        ].join(' ')}
        rows={1}
        style={{
          // Auto-expand textarea up to max-h
          height: 'auto',
          overflowY: input.split('\n').length > 3 ? 'auto' : 'hidden',
        }}
      />

      {/* Bottom row: Limpar (left) + Perguntar (right) */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          Limpar conversa
        </button>

        <Button
          type="button"
          onClick={() => onSubmit(input)}
          disabled={isDisabled}
          aria-label="Enviar mensagem"
          size="sm"
        >
          Perguntar
        </Button>
      </div>
    </div>
  )
}
