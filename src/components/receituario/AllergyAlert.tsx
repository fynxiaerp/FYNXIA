'use client'
/**
 * AllergyAlert — non-blocking amber warning shown after issueClinicDocument
 * returns allergyAlert.reasons.
 *
 * Design constraint D-02: the alert is INFORMATIVE ONLY. It NEVER disables the
 * submit button or blocks form submission. The dentist confirms with the patient
 * and proceeds at their discretion.
 *
 * Phase: 12-receitu-rio-teleodontologia / Plan 06
 * Requirement: RX-02
 */

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface AllergyAlertProps {
  reasons: string[]
}

export function AllergyAlert({ reasons }: AllergyAlertProps) {
  if (reasons.length === 0) return null

  return (
    <Alert className="border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:border-amber-600 dark:text-amber-200">
      <AlertTitle className="font-semibold">
        Atenção: Possível alergia detectada
      </AlertTitle>
      <AlertDescription>
        <ul className="list-disc pl-4 space-y-1 text-sm mt-1">
          {reasons.map((reason, i) => (
            <li key={i}>{reason}</li>
          ))}
        </ul>
        <p className="mt-2 text-xs opacity-75">
          Confirme com o paciente antes de emitir. A emissão não está bloqueada.
        </p>
      </AlertDescription>
    </Alert>
  )
}
