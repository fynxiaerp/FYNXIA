'use client'
// src/components/copilot/CopilotSidebar.tsx
// Copilot sidebar — Sheet wrapper hosting AI SDK v6 useChat conversation.
// D-05: Read-only. No mutation buttons anywhere in this panel.
// AI SDK v6 API: sendMessage({text}), status, setMessages — NOT handleSubmit/isLoading.

import { useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { Bot } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { useCopilotStore } from '@/lib/stores/copilot-store'
import { MessageList } from './MessageList'
import { CopilotInput } from './CopilotInput'

// v6 transport: api is configured via DefaultChatTransport, not useChat({api})
const copilotTransport = new DefaultChatTransport({ api: '/api/copilot' })

export function CopilotSidebar() {
  const { open, setOpen } = useCopilotStore()
  const [input, setInput] = useState('')

  const { messages, sendMessage, status, error, setMessages } = useChat({
    transport: copilotTransport,
  })

  // v6: isLoading = submitted or streaming
  const isLoading = status === 'submitted' || status === 'streaming'

  // Submit handler — used by CopilotInput (send button / Enter) and SuggestedPrompts (chip click)
  function submit(text: string) {
    if (!text.trim()) return
    sendMessage({ text })
    setInput('')
  }

  function clearConversation() {
    setMessages([])
    setInput('')
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        // Breakpoints: mobile full / tablet w-80 / desktop w-96
        className="flex w-full flex-col p-0 sm:w-80 lg:w-96"
      >
        {/* Header */}
        <SheetHeader className="flex-shrink-0 border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <Bot size={20} className="text-primary flex-shrink-0" aria-hidden="true" />
            <div>
              <SheetTitle className="text-sm font-semibold leading-snug">
                Copiloto FYNXIA
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground leading-snug">
                Pergunte sobre sua clínica ou peça ajuda
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Message list — flex-1 to fill remaining space */}
        <div className="flex min-h-0 flex-1 flex-col">
          <MessageList
            messages={messages}
            isLoading={isLoading}
            error={error ?? null}
            onPick={submit}
          />
        </div>

        {/* Input area */}
        <div className="flex-shrink-0 border-t">
          <CopilotInput
            input={input}
            setInput={setInput}
            onSubmit={submit}
            onClear={clearConversation}
            isLoading={isLoading}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
