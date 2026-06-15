'use client'

/**
 * WaitingPanel — TV-optimized real-time waiting-room display (RES-03)
 *
 * CLIENT component. Self-contained QueryClientProvider (standalone public page).
 *
 * Features:
 *   - Shows "chamado" (called) patients prominently with waiting time.
 *   - Shows "aguardando" (waiting) queue with elapsed wait time.
 *   - Subscribes to Supabase Realtime on mount; on postgres_changes event
 *     invalidates TanStack Query → triggers refetch via getPanelRows server action.
 *   - 30s tick re-renders waiting-time counters without a full refetch.
 *   - Channel cleaned up on unmount.
 *
 * LGPD (T-11-29): receives ONLY PanelRow[] (initials + presence metadata).
 *   full_name and cpf are NEVER in the payload — toInitials() ran server-side.
 *
 * Realtime filter: tenant_id=eq.<clinicId> ensures cross-tenant isolation (T-11-30).
 */

import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getPanelRows } from '@/actions/checkin'
import { waitingMinutes } from '@/lib/scheduling/waiting'
import type { PanelRow } from '@/lib/scheduling/panel'

// ─── QueryClient singleton for this standalone public page ───────────────────
const panelQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000, // 10s — panel refreshes via Realtime; no aggressive polling
      refetchOnWindowFocus: false,
    },
  },
})

// ─── Inner component (must be inside QueryClientProvider) ────────────────────

interface WaitingPanelInnerProps {
  clinicId: string
  clinicSlug: string
  clinicName: string
  initialRows: PanelRow[]
  unitId?: string
}

function WaitingPanelInner({
  clinicId,
  clinicSlug,
  clinicName,
  initialRows,
  unitId,
}: WaitingPanelInnerProps) {
  const queryClient = useQueryClient()

  // TanStack Query — server action as fetcher (CLAUDE.md Realtime → invalidateQueries pattern)
  const { data: rows } = useQuery<PanelRow[]>({
    queryKey: ['painel', clinicSlug, unitId],
    queryFn: () => getPanelRows(clinicSlug, unitId),
    initialData: initialRows,
  })

  // 30s tick — forces re-render so waitingMinutes() counters stay live
  const [, setTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(interval)
  }, [])

  // Supabase Realtime subscription — invalidate on any appointments change for this tenant
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('painel:' + clinicId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: 'tenant_id=eq.' + clinicId,
        },
        () => {
          // CLAUDE.md Realtime pattern: Realtime event → invalidateQueries → refetch
          queryClient.invalidateQueries({ queryKey: ['painel', clinicSlug, unitId] })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [clinicId, clinicSlug, unitId, queryClient])

  const now = new Date()

  const chamados = (rows ?? []).filter((r) => r.presence_status === 'chamado')
  const aguardando = (rows ?? []).filter((r) => r.presence_status === 'aguardando')
  const emAtendimento = (rows ?? []).filter((r) => r.presence_status === 'em_atendimento')

  return (
    <div
      className="min-h-screen bg-black text-white flex flex-col select-none"
      style={{ fontFamily: 'var(--font-space-grotesk, sans-serif)' }}
    >
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-10 py-6 border-b border-white/10">
        <h1 className="text-3xl font-bold tracking-tight text-cyan-400">{clinicName}</h1>
        <span className="text-sm text-white/40 uppercase tracking-widest">Sala de Espera</span>
      </header>

      <main className="flex flex-1 gap-0 overflow-hidden">
        {/* ── Left: Chamado (prominent) ── */}
        <section className="flex-1 border-r border-white/10 p-10 flex flex-col gap-6">
          <h2 className="text-xl font-semibold text-white/60 uppercase tracking-widest mb-2">
            Chamado
          </h2>

          {chamados.length === 0 ? (
            <p className="text-white/20 text-lg">Nenhum paciente chamado</p>
          ) : (
            chamados.map((row) => {
              const mins = waitingMinutes(row.arrived_at, row.called_at, now)
              return (
                <div
                  key={row.id}
                  className="rounded-2xl bg-cyan-500/10 border border-cyan-400/30 p-8 flex items-center justify-between"
                >
                  <span className="text-7xl font-bold tracking-wider text-cyan-300">
                    {row.initials}
                  </span>
                  {mins !== null && (
                    <span className="text-2xl text-white/50">
                      {mins} min
                    </span>
                  )}
                </div>
              )
            })
          )}
        </section>

        {/* ── Right: Aguardando queue ── */}
        <section className="w-96 p-10 flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-white/60 uppercase tracking-widest mb-2">
            Aguardando ({aguardando.length})
          </h2>

          {aguardando.length === 0 && emAtendimento.length === 0 ? (
            <p className="text-white/20 text-lg">Fila vazia</p>
          ) : (
            <>
              {aguardando.map((row) => {
                const mins = waitingMinutes(row.arrived_at, null, now)
                return (
                  <div
                    key={row.id}
                    className="rounded-xl bg-white/5 border border-white/10 px-6 py-4 flex items-center justify-between"
                  >
                    <span className="text-3xl font-semibold text-white">{row.initials}</span>
                    {mins !== null && (
                      <span className="text-sm text-white/40">{mins} min</span>
                    )}
                  </div>
                )
              })}

              {emAtendimento.map((row) => (
                <div
                  key={row.id}
                  className="rounded-xl bg-emerald-900/20 border border-emerald-500/20 px-6 py-4 flex items-center justify-between"
                >
                  <span className="text-3xl font-semibold text-emerald-400">{row.initials}</span>
                  <span className="text-xs text-emerald-500/60 uppercase tracking-wide">
                    Em atendimento
                  </span>
                </div>
              ))}
            </>
          )}
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="px-10 py-4 border-t border-white/10 text-xs text-white/20 text-right">
        Atualizado em tempo real · FYNXIA
      </footer>
    </div>
  )
}

// ─── Public export — wraps inner component with its own QueryClientProvider ──

export interface WaitingPanelProps {
  clinicId: string
  clinicSlug: string
  clinicName: string
  initialRows: PanelRow[]
  unitId?: string
}

export function WaitingPanel(props: WaitingPanelProps) {
  return (
    <QueryClientProvider client={panelQueryClient}>
      <WaitingPanelInner {...props} />
    </QueryClientProvider>
  )
}
