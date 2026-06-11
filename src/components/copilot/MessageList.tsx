'use client'
// src/components/copilot/MessageList.tsx
// Scrollable message list with auto-scroll, empty state, and typing indicator.
// Uses ScrollArea from shadcn/ui.
// Accessibility: aria-live="polite" for new message announcements.

import { useEffect, useRef } from 'react'
import type { UIMessage } from 'ai'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageBubble } from './MessageBubble'
import { SuggestedPrompts } from './SuggestedPrompts'

interface MessageListProps {
  messages: UIMessage[]
  isLoading: boolean
  error: Error | null
  /** Called when a suggested prompt chip is clicked (submits immediately) */
  onPick: (text: string) => void
}

export function MessageList({ messages, isLoading, error, onPick }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const isEmpty = messages.length === 0

  // Show typing indicator when loading AND last message is from user (awaiting first token)
  const lastMessage = messages[messages.length - 1]
  const showTypingIndicator =
    isLoading && (!lastMessage || lastMessage.role === 'user')

  return (
    <ScrollArea className="flex-1 h-full">
      <div
        aria-live="polite"
        aria-label="Conversa com o copiloto"
        className="flex flex-col px-4 py-3 space-y-3 min-h-full"
      >
        {isEmpty ? (
          /* Empty state */
          <div className="flex flex-col gap-3 pt-4">
            <div className="space-y-1 px-0">
              <p className="text-sm font-semibold text-foreground">Olá, como posso ajudar?</p>
              <p className="text-sm text-muted-foreground">
                Pergunte sobre agenda, pacientes, financeiro ou como usar o sistema.
              </p>
            </div>
            <SuggestedPrompts onPick={onPick} />
          </div>
        ) : (
          <>
            {messages.map((message, i) => {
              const isLastAssistant =
                message.role === 'assistant' && i === messages.length - 1
              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isLastAssistant={isLastAssistant}
                  isLoading={isLoading}
                />
              )
            })}
          </>
        )}

        {/* Error rendered as assistant bubble */}
        {error && (
          <div className="mr-auto max-w-[85%] px-3 py-2 text-sm leading-relaxed text-destructive">
            Não foi possível conectar ao copiloto. Tente novamente em instantes.
          </div>
        )}

        {/* Typing indicator — shown while awaiting first token */}
        {showTypingIndicator && (
          <div
            role="status"
            aria-label="Copiloto digitando…"
            className="mr-auto flex items-center gap-1 px-3 py-2"
          >
            <span
              className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce"
              style={{ animationDelay: '0ms' }}
              aria-hidden="true"
            />
            <span
              className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce"
              style={{ animationDelay: '150ms' }}
              aria-hidden="true"
            />
            <span
              className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce"
              style={{ animationDelay: '300ms' }}
              aria-hidden="true"
            />
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  )
}
