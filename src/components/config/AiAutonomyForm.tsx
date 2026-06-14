'use client'
/**
 * AiAutonomyForm — SYS-04 / Plan 07-06
 *
 * Per-agent (confirmation, collection) autonomy level Select L0–L4 + enabled Switch.
 * Calls saveAiAgentConfig on change. Shows Alert feedback.
 *
 * NOTE: L0–L4 enforcement (tetos, travas, aprovação humana) arrives in Fase 10 (AIG).
 * This form stores the desired autonomy level; Fase 10 applies it at runtime.
 *
 * Design system: design tokens only — no raw slate-/gray-/text-white/bg-white.
 */
import { useState, useTransition } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { saveAiAgentConfig } from '@/actions/ai-agent-config'
import {
  AUTONOMY_LEVELS,
  type AiAgentConfigRow,
  type AgentKey,
  type AutonomyLevel,
} from '@/lib/ai-agent-config-types'

// ─── Autonomy level labels ─────────────────────────────────────────────────────

const AUTONOMY_LABELS: Record<AutonomyLevel, string> = {
  L0: 'L0 — Sugere (humano decide)',
  L1: 'L1 — Rascunha (humano envia)',
  L2: 'L2 — Executa com confirmação',
  L3: 'L3 — Executa com notificação',
  L4: 'L4 — Executa autonomamente',
}

// ─── Agent display names ───────────────────────────────────────────────────────

const AGENT_NAMES: Record<string, string> = {
  confirmation: 'Agente de Confirmação',
  collection: 'Agente de Cobrança',
}

const AGENT_DESCRIPTIONS: Record<string, string> = {
  confirmation: 'Envia lembretes e confirmações de consultas via WhatsApp.',
  collection: 'Dispara régua de cobrança automatizada para recebíveis em atraso.',
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AiAutonomyFormProps {
  agents: AiAgentConfigRow[]
}

// ─── Single agent card ────────────────────────────────────────────────────────

interface AgentCardProps {
  agentKey: AgentKey
  initialLevel: AutonomyLevel
  initialEnabled: boolean
}

function AgentCard({ agentKey, initialLevel, initialEnabled }: AgentCardProps) {
  const [level, setLevel] = useState<AutonomyLevel>(initialLevel)
  const [enabled, setEnabled] = useState(initialEnabled)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleLevelChange(value: AutonomyLevel | null) {
    if (!value) return
    const newLevel = value
    setLevel(newLevel)
    setError(null)
    setSuccess(false)
    startTransition(async () => {
      const result = await saveAiAgentConfig(agentKey, newLevel, enabled)
      if (result.success) {
        setSuccess(true)
        setTimeout(() => setSuccess(false), 2500)
      } else {
        setError(result.error ?? 'Erro ao salvar configuração.')
        setLevel(initialLevel) // revert optimistic update
      }
    })
  }

  function handleEnabledChange(checked: boolean) {
    setEnabled(checked)
    setError(null)
    setSuccess(false)
    startTransition(async () => {
      const result = await saveAiAgentConfig(agentKey, level, checked)
      if (result.success) {
        setSuccess(true)
        setTimeout(() => setSuccess(false), 2500)
      } else {
        setError(result.error ?? 'Erro ao salvar configuração.')
        setEnabled(!checked) // revert
      }
    })
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-foreground">
          {AGENT_NAMES[agentKey] ?? agentKey}
        </CardTitle>
        <CardDescription className="text-muted-foreground text-xs">
          {AGENT_DESCRIPTIONS[agentKey] ?? ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert>
            <AlertDescription>Configuração salva com sucesso.</AlertDescription>
          </Alert>
        )}

        {/* Enabled toggle */}
        <div className="flex items-center justify-between">
          <Label htmlFor={`enabled-${agentKey}`} className="text-sm text-foreground">
            Agente ativo
          </Label>
          <Switch
            id={`enabled-${agentKey}`}
            checked={enabled}
            onCheckedChange={handleEnabledChange}
            disabled={isPending}
            aria-label={`Ativar agente ${AGENT_NAMES[agentKey]}`}
          />
        </div>

        {/* Autonomy level select */}
        <div className="space-y-1.5">
          <Label htmlFor={`level-${agentKey}`} className="text-sm text-foreground">
            Nível de autonomia
          </Label>
          <Select
            value={level}
            onValueChange={handleLevelChange}
            disabled={isPending || !enabled}
          >
            <SelectTrigger
              id={`level-${agentKey}`}
              className="bg-background border-border text-foreground"
            >
              <SelectValue placeholder="Selecione o nível" />
            </SelectTrigger>
            <SelectContent>
              {AUTONOMY_LEVELS.map((lvl) => (
                <SelectItem key={lvl} value={lvl}>
                  {AUTONOMY_LABELS[lvl]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Enforcement (travas e aprovação humana) chega na Fase 10.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AiAutonomyForm({ agents }: AiAutonomyFormProps) {
  // Build a lookup for current config
  const agentMap: Record<string, AiAgentConfigRow> = {}
  for (const agent of agents) {
    agentMap[agent.agent_key] = agent
  }

  const agentKeys: AgentKey[] = ['confirmation', 'collection']

  return (
    <div className="space-y-4">
      {agentKeys.map((key) => {
        const config = agentMap[key]
        return (
          <AgentCard
            key={key}
            agentKey={key}
            initialLevel={(config?.autonomy_level as AutonomyLevel) ?? 'L0'}
            initialEnabled={config?.enabled ?? false}
          />
        )
      })}
    </div>
  )
}
