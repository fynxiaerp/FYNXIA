'use client'
/**
 * WaitingPanel — TV waiting-room display (RES-03 stub).
 *
 * STUB: Created by Plan 11-06 deviation Rule 3 to unblock build.
 * Plan 11-08 will implement the full Realtime-subscribed version.
 *
 * LGPD: renders only PanelRow.initials — full_name is NEVER displayed (T-11-29).
 */
import type { PanelRow } from '@/lib/scheduling/panel'

interface WaitingPanelProps {
  clinicId: string
  clinicSlug: string
  clinicName: string
  initialRows: PanelRow[]
  unitId?: string
}

const STATUS_LABELS: Record<string, string> = {
  aguardando: 'Aguardando',
  chamado: 'Chamado',
  em_atendimento: 'Em atendimento',
}

export function WaitingPanel({
  clinicName,
  initialRows,
}: WaitingPanelProps) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="px-8 py-6 border-b border-border">
        <h1 className="text-3xl font-display font-bold">{clinicName}</h1>
        <p className="text-muted-foreground mt-1 text-lg">Painel de Espera</p>
      </header>

      {/* Content */}
      <main className="flex-1 p-8">
        {initialRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-24 text-muted-foreground">
            <p className="text-2xl font-semibold">Nenhum paciente aguardando</p>
          </div>
        ) : (
          <table className="w-full text-xl">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-4 text-left font-semibold text-foreground">Paciente</th>
                <th className="pb-4 text-left font-semibold text-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {initialRows.map((row) => (
                <tr key={row.id} className="border-b border-border">
                  <td className="py-4 text-2xl font-mono font-bold tracking-wider">
                    {row.initials}
                  </td>
                  <td className="py-4 text-muted-foreground">
                    {STATUS_LABELS[row.presence_status] ?? row.presence_status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  )
}
