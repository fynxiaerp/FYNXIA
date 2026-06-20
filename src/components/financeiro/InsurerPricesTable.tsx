'use client'

import * as React from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { formatBRL } from '@/lib/format/money'
import { upsertInsurerPrice } from '@/actions/services'

export interface ServicePriceRow {
  serviceId: string
  serviceName: string
  valorParticular: number
  valorConvenio: number | null
  priceId: string | null
}

interface InsurerPricesTableProps {
  insurerId: string
  rows: ServicePriceRow[]
}

export function InsurerPricesTable({ insurerId, rows }: InsurerPricesTableProps) {
  // Track per-row editing state: serviceId → edited string value
  const [editing, setEditing] = React.useState<Record<string, string>>({})
  const [saving, setSaving] = React.useState<Record<string, boolean>>({})
  const [saved, setSaved] = React.useState<Record<string, number>>({})

  function startEdit(serviceId: string, current: number | null) {
    setEditing((prev) => ({
      ...prev,
      [serviceId]: current !== null ? String(current) : '',
    }))
  }

  function cancelEdit(serviceId: string) {
    setEditing((prev) => {
      const next = { ...prev }
      delete next[serviceId]
      return next
    })
  }

  async function savePrice(serviceId: string) {
    const rawVal = editing[serviceId]
    if (rawVal === undefined) return
    const valor = parseFloat(rawVal.replace(',', '.'))
    if (isNaN(valor) || valor < 0) return

    setSaving((prev) => ({ ...prev, [serviceId]: true }))
    const result = await upsertInsurerPrice({ insurerId, serviceId, valor })
    setSaving((prev) => ({ ...prev, [serviceId]: false }))

    if (result.success) {
      setSaved((prev) => ({ ...prev, [serviceId]: valor }))
      setEditing((prev) => {
        const next = { ...prev }
        delete next[serviceId]
        return next
      })
    }
  }

  if (rows.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Nenhum serviço cadastrado para esta clínica.
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Serviço</TableHead>
          <TableHead className="text-right">Valor particular</TableHead>
          <TableHead className="text-right">Valor convênio</TableHead>
          <TableHead className="w-[120px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const isEditing = row.serviceId in editing
          const isSaving = saving[row.serviceId] ?? false
          // Optimistic: show saved value if we just updated it
          const displayConvenio = saved[row.serviceId] !== undefined
            ? saved[row.serviceId]!
            : row.valorConvenio

          return (
            <TableRow key={row.serviceId}>
              <TableCell className="font-medium">{row.serviceName}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {formatBRL(row.valorParticular)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {isEditing ? (
                  <Input
                    className="w-28 text-right ml-auto"
                    value={editing[row.serviceId]}
                    onChange={(e) =>
                      setEditing((prev) => ({ ...prev, [row.serviceId]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') savePrice(row.serviceId)
                      if (e.key === 'Escape') cancelEdit(row.serviceId)
                    }}
                    autoFocus
                    disabled={isSaving}
                    placeholder="0,00"
                  />
                ) : (
                  <button
                    className="text-right w-full tabular-nums hover:underline focus:underline outline-none"
                    onClick={() => startEdit(row.serviceId, displayConvenio)}
                    title="Clique para editar"
                  >
                    {displayConvenio !== null ? formatBRL(displayConvenio) : '—'}
                  </button>
                )}
              </TableCell>
              <TableCell>
                {isEditing ? (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      onClick={() => savePrice(row.serviceId)}
                      disabled={isSaving}
                    >
                      {isSaving ? '…' : 'Salvar'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => cancelEdit(row.serviceId)}
                      disabled={isSaving}
                    >
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => startEdit(row.serviceId, displayConvenio)}
                  >
                    Editar
                  </Button>
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
