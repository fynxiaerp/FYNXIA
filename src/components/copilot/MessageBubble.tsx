'use client'
// src/components/copilot/MessageBubble.tsx
// Renders a single chat message (user or assistant).
// D-05: read-only display — no action buttons.
// Uses message.parts (v6 API), NOT message.content string.

import type { UIMessage } from 'ai'

interface MessageBubbleProps {
  message: UIMessage
  isLastAssistant: boolean
  isLoading: boolean
}

export function MessageBubble({ message, isLastAssistant, isLoading }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const isError = (message as UIMessage & { isError?: boolean }).isError === true

  // Extract text parts from message.parts (AI SDK v6)
  const textContent = message.parts
    ? message.parts
        .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
        .map((part) => part.text)
        .join('')
    : ''

  if (isUser) {
    return (
      <div className="ml-auto max-w-[80%] rounded-xl rounded-br-sm bg-muted px-3 py-2 text-sm leading-relaxed text-foreground">
        {textContent}
      </div>
    )
  }

  // Assistant bubble
  return (
    <div
      className={[
        'mr-auto max-w-[85%] px-3 py-2 text-sm leading-relaxed',
        isError ? 'text-destructive' : 'text-foreground',
      ].join(' ')}
    >
      {textContent}
      {/* Streaming cursor — decorative only, hidden from screen readers */}
      {isLastAssistant && isLoading && textContent && (
        <span
          aria-hidden="true"
          className="ml-0.5 inline-block h-[14px] w-[2px] animate-pulse bg-foreground align-middle"
        />
      )}
    </div>
  )
}
