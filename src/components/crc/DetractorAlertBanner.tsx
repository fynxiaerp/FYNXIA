// DetractorAlertBanner — D-15: surfaces untreated detractors above the fold
// so recepção/gestão can close the loop. Copy is literal per UI-SPEC
// Copywriting Contract ("avaliação(ões)"/"detratora(s)" cover singular and
// plural in one string — not dynamic pluralization).

import { AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface DetractorAlertBannerProps {
  count: number
}

export function DetractorAlertBanner({ count }: DetractorAlertBannerProps) {
  if (count <= 0) return null

  return (
    <Alert variant="destructive">
      <AlertTriangle />
      <AlertDescription>
        {count} avaliação(ões) detratora(s) aguardando retorno da equipe.
      </AlertDescription>
    </Alert>
  )
}
