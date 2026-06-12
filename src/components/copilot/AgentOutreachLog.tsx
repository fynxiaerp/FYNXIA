// src/components/copilot/AgentOutreachLog.tsx
// Read-only table of the last 20 agent actions (AI-02 + AI-03).
// Columns: Tipo | Paciente | Status | Data/Hora
// Mounted at /clinica/ia/agentes — NOT inside the copilot sidebar.
// All copy in pt-BR per 05-UI-SPEC §Copywriting Contract.

import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { BrainCircuit } from 'lucide-react'
import type { AgentOutreachRow } from '@/actions/agent-outreach'
import { EmptyState } from '@/components/shell/EmptyState'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'

// ─── Label maps ───────────────────────────────────────────────────────────────

const AGENT_TYPE_LABELS: Record<string, string> = {
  confirmation: 'Confirmação de consulta',
  collection: 'Cobrança automática',
}

const STATUS_LABELS: Record<string, string> = {
  sent: 'Enviado',
  delivered: 'Entregue',
  responded: 'Respondido',
  failed: 'Falhou',
  ambiguous: 'Ambíguo',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  try {
    return format(parseISO(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  } catch {
    return iso
  }
}

// ─── AgentOutreachLog ─────────────────────────────────────────────────────────

interface AgentOutreachLogProps {
  rows: AgentOutreachRow[]
}

export function AgentOutreachLog({ rows }: AgentOutreachLogProps) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={BrainCircuit}
        title="Nenhuma ação registrada ainda"
        description="Os agentes registrarão aqui as confirmações e cobranças enviadas."
      />
    )
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="px-4 text-sm font-semibold">Tipo</TableHead>
            <TableHead className="px-4 text-sm font-semibold">Paciente</TableHead>
            <TableHead className="px-4 text-sm font-semibold">Status</TableHead>
            <TableHead className="px-4 text-sm font-semibold">Data/Hora</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="px-4 text-foreground">
                {AGENT_TYPE_LABELS[row.agent_type] ?? row.agent_type}
              </TableCell>
              <TableCell className="px-4 text-muted-foreground">
                {row.patient_name ?? '—'}
              </TableCell>
              <TableCell className="px-4">
                <StatusBadge status={row.status} />
              </TableCell>
              <TableCell className="px-4 text-muted-foreground">
                {formatDateTime(row.created_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status] ?? status

  const colorClass =
    status === 'sent'
      ? 'text-blue-700 bg-blue-50 border-blue-200'
      : status === 'delivered'
        ? 'text-green-700 bg-green-50 border-green-200'
        : status === 'responded'
          ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
          : status === 'failed'
            ? 'text-red-700 bg-red-50 border-red-200'
            : status === 'ambiguous'
              ? 'text-yellow-700 bg-yellow-50 border-yellow-200'
              : 'text-muted-foreground bg-muted border-border'

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${colorClass}`}
    >
      {label}
    </span>
  )
}
