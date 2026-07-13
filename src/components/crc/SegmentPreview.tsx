'use client'

// SegmentPreview — renders the eligible-patient count for a campaign segment
// (D-07). Fed by previewCampaignSegment() inside CampaignFormDialog. Renders
// the "Nenhum paciente neste segmento" empty state per 18-UI-SPEC Copywriting
// Contract when the count is exactly 0.

import { Users } from 'lucide-react'

interface SegmentPreviewProps {
  /** null = not previewed yet. */
  count: number | null
  loading?: boolean
}

export function SegmentPreview({ count, loading }: SegmentPreviewProps) {
  if (loading) {
    return <p className="text-sm text-muted-foreground">Calculando pacientes elegíveis…</p>
  }

  if (count === null) {
    return null
  }

  if (count === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border py-8 text-center">
        <Users className="size-8 text-muted-foreground" />
        <p className="text-sm font-semibold font-display">Nenhum paciente neste segmento</p>
        <p className="text-xs text-muted-foreground max-w-xs">
          Ajuste os filtros (dias de inatividade, faixa etária, unidade) para encontrar pacientes elegíveis.
        </p>
      </div>
    )
  }

  return (
    <p className="text-sm">
      <span className="text-2xl font-semibold font-display tabular-nums text-foreground">{count}</span>{' '}
      <span className="text-muted-foreground">paciente(s) elegível(is)</span>
    </p>
  )
}
