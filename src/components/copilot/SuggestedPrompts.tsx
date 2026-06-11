'use client'
// src/components/copilot/SuggestedPrompts.tsx
// Context-aware suggestion chips shown in empty state only (no messages yet).
// Chips are derived from current pathname per 05-UI-SPEC §Suggested Prompts.
// Clicking a chip immediately submits that text.

import { usePathname } from 'next/navigation'

interface SuggestedPromptsProps {
  /** Called when a chip is clicked — submits the chip text immediately */
  onPick: (text: string) => void
}

/** Prompt sets keyed by pathname pattern */
const PROMPT_SETS: Record<string, [string, string, string]> = {
  '/clinica/agenda': [
    'Quais consultas tenho hoje?',
    'Algum horário livre essa semana?',
    'Como remarco uma consulta?',
  ],
  '/clinica/financeiro': [
    'Qual o total de recebíveis em aberto?',
    'Quais pacientes estão inadimplentes?',
    'Como gero uma cobrança?',
  ],
}

const DEFAULT_PROMPTS: [string, string, string] = [
  'Como cadastro um paciente?',
  'Quais módulos o sistema tem?',
  'Como funciona o odontograma?',
]

function getPrompts(pathname: string): [string, string, string] {
  if (PROMPT_SETS[pathname]) return PROMPT_SETS[pathname]
  // Match any /clinica/financeiro* path
  if (pathname.startsWith('/clinica/financeiro')) return PROMPT_SETS['/clinica/financeiro']!
  return DEFAULT_PROMPTS
}

export function SuggestedPrompts({ onPick }: SuggestedPromptsProps) {
  const pathname = usePathname()
  const prompts = getPrompts(pathname)

  return (
    <div className="px-4 pt-4">
      {/* Visually hidden label for screen readers */}
      <span className="sr-only">Sugestões</span>
      <div className="flex flex-wrap gap-2">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onPick(prompt)}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-muted px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  )
}
