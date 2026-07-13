// NpsScoreCard — NPS score anchor card (CRC-04, D-14).
// Numeric/KPI typography role (24px text-2xl / 600 font-semibold) per
// UI-SPEC §Typography — the score is NOT a 5th type-scale size; emphasis
// comes from color (green >= 0 / red < 0) + tabular-nums only.

import { Card } from '@/components/ui/card'

interface NpsScoreCardProps {
  score: number | null
  promotores: number
  neutros: number
  detratores: number
}

export function NpsScoreCard({ score, promotores, neutros, detratores }: NpsScoreCardProps) {
  const total = promotores + neutros + detratores
  const pct = (count: number) => (total > 0 ? Math.round((count / total) * 100) : 0)

  const scoreColor =
    score === null ? 'text-foreground' : score >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600'

  const scoreLabel = score === null ? '—' : `${score >= 0 ? '+' : ''}${score}`

  return (
    <Card className="p-6 flex flex-col items-center text-center gap-2" aria-label={`NPS Score: ${scoreLabel}`}>
      <p className="text-sm font-semibold text-muted-foreground">NPS Score</p>
      <p className={`text-2xl font-semibold font-display tabular-nums ${scoreColor}`}>{scoreLabel}</p>
      <p className="text-xs text-muted-foreground">
        {pct(promotores)}% promotores · {pct(neutros)}% neutros · {pct(detratores)}% detratores
      </p>
    </Card>
  )
}
