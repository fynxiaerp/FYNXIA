'use client'

import * as React from 'react'
import { useQueryState } from 'nuqs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { GlosaTable, type GlosaRow } from '@/components/financeiro/GlosaTable'
import { GlosaRecursoSheet } from '@/components/financeiro/GlosaRecursoSheet'

interface InsurerOption {
  id: string
  name: string
}

interface GlosaListClientProps {
  initialGlosas: GlosaRow[]
  insurers: InsurerOption[]
  initialOperadora: string
  initialStatus: string
  initialMonth: string
}

export function GlosaListClient({
  initialGlosas,
  insurers,
  initialOperadora,
  initialStatus,
  initialMonth,
}: GlosaListClientProps) {
  const [operadora, setOperadora] = useQueryState('operadora', { defaultValue: initialOperadora })
  const [status, setStatus] = useQueryState('status', { defaultValue: initialStatus })
  const [month, setMonth] = useQueryState('month', { defaultValue: initialMonth })

  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [selectedGlosa, setSelectedGlosa] = React.useState<GlosaRow | null>(null)

  function handleRegistrarRecurso(row: GlosaRow) {
    setSelectedGlosa(row)
    setSheetOpen(true)
  }

  // Client-side filter from initial server data
  const filtered = initialGlosas.filter((g) => {
    if (operadora && operadora !== 'all') {
      const ins = insurers.find((i) => i.id === operadora)
      if (ins && g.insurer_name !== ins.name) return false
    }
    if (status && status !== 'all' && g.glosa_status !== status) return false
    return true
  })

  const currentMonth = new Date().toISOString().slice(0, 7)

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Operadora:</span>
          <Select
            value={operadora || 'all'}
            onValueChange={(v) => setOperadora(v === 'all' ? '' : v)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todas">
                {operadora && operadora !== '' && operadora !== 'all'
                  ? (insurers.find(i => i.id === operadora)?.name ?? 'Todas')
                  : 'Todas'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {insurers.map((i) => (
                <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Status:</span>
          <Select
            value={status || 'all'}
            onValueChange={(v) => setStatus(v === 'all' ? '' : v)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="glosada">Glosada</SelectItem>
              <SelectItem value="em_recurso">Em recurso</SelectItem>
              <SelectItem value="em_analise">Em análise</SelectItem>
              <SelectItem value="paga">Paga</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Mês:</span>
          <input
            type="month"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring tabular-nums"
            value={month || currentMonth}
            onChange={(e) => setMonth(e.target.value || '')}
          />
        </div>
      </div>

      {/* Glosa table */}
      <div className="rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden">
        <GlosaTable rows={filtered} onRegistrarRecurso={handleRegistrarRecurso} />
      </div>

      {/* Recurso Sheet */}
      <GlosaRecursoSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        glosa={selectedGlosa}
      />
    </div>
  )
}
