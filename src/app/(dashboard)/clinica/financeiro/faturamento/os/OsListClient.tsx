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
import { OsTable, type OsRow } from '@/components/financeiro/OsTable'
import { OsSheet } from '@/components/financeiro/OsSheet'

interface OsListClientProps {
  initialOrders: OsRow[]
  initialMonth?: string
  initialStatus?: string
  initialPagador?: string
}

export function OsListClient({
  initialOrders,
  initialMonth,
  initialStatus,
  initialPagador,
}: OsListClientProps) {
  const [month, setMonth] = useQueryState('month', { defaultValue: initialMonth ?? '' })
  const [status, setStatus] = useQueryState('status', { defaultValue: initialStatus ?? '' })
  const [pagador, setPagador] = useQueryState('pagador', { defaultValue: initialPagador ?? '' })

  const [selectedOs, setSelectedOs] = React.useState<OsRow | null>(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)

  // Filter client-side from initial server data
  const filtered = initialOrders.filter((o) => {
    if (status && status !== 'all' && o.status !== status) return false
    if (pagador && pagador !== 'all' && o.pagador !== pagador) return false
    return true
  })

  function openSheet(os: OsRow) {
    setSelectedOs(os)
    setSheetOpen(true)
  }

  // Generate current month default
  const currentMonth = new Date().toISOString().slice(0, 7)

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
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
              <SelectItem value="rascunho">Rascunho</SelectItem>
              <SelectItem value="faturada">Faturada</SelectItem>
              <SelectItem value="cancelada">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Pagador:</span>
          <Select
            value={pagador || 'all'}
            onValueChange={(v) => setPagador(v === 'all' ? '' : v)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="particular">Particular</SelectItem>
              <SelectItem value="convenio">Convênio</SelectItem>
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

      {/* Table */}
      <OsTable
        rows={filtered}
        onViewDetails={openSheet}
        onFaturar={openSheet}
        onCancelar={openSheet}
      />

      {/* OS detail sheet */}
      <OsSheet
        os={selectedOs}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  )
}
