'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, Trash2 } from 'lucide-react'
import type { AvailabilityWindowInput, AvailabilityExceptionInput } from '@/lib/validators/professional'

// ─── Weekday labels (pt-BR) ───────────────────────────────────────────────────

const WEEKDAYS = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
]

// ─── Props ────────────────────────────────────────────────────────────────────

export interface AvailabilityGridValue {
  windows: AvailabilityWindowInput[]
  exceptions: AvailabilityExceptionInput[]
}

interface AvailabilityGridProps {
  value: AvailabilityGridValue
  onChange: (value: AvailabilityGridValue) => void
}

// ─── AvailabilityGrid ─────────────────────────────────────────────────────────

export function AvailabilityGrid({ value, onChange }: AvailabilityGridProps) {
  const { windows, exceptions } = value

  // ── Window helpers ──────────────────────────────────────────────────────────

  function addWindow(weekday: number) {
    const newWindow: AvailabilityWindowInput = {
      weekday,
      start_time: '08:00',
      end_time: '18:00',
    }
    onChange({ ...value, windows: [...windows, newWindow] })
  }

  function removeWindow(index: number) {
    onChange({ ...value, windows: windows.filter((_, i) => i !== index) })
  }

  function updateWindow(index: number, field: keyof AvailabilityWindowInput, val: string | number) {
    const updated = windows.map((w, i) =>
      i === index ? { ...w, [field]: val } : w
    )
    onChange({ ...value, windows: updated })
  }

  // ── Exception helpers ───────────────────────────────────────────────────────

  function addException() {
    const newExc: AvailabilityExceptionInput = {
      exception_date: new Date().toISOString().slice(0, 10),
      exception_type: 'folga',
      start_time: null,
      end_time: null,
      reason: null,
    }
    onChange({ ...value, exceptions: [...exceptions, newExc] })
  }

  function removeException(index: number) {
    onChange({ ...value, exceptions: exceptions.filter((_, i) => i !== index) })
  }

  function updateException(
    index: number,
    field: keyof AvailabilityExceptionInput,
    val: string | null
  ) {
    const updated = exceptions.map((e, i) =>
      i === index ? { ...e, [field]: val } : e
    )
    onChange({ ...value, exceptions: updated })
  }

  return (
    <div className="space-y-6">
      {/* ── Grade semanal ──────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Grade semanal</h3>
        <div className="space-y-3">
          {WEEKDAYS.map((day) => {
            const dayWindows = windows
              .map((w, originalIndex) => ({ window: w, originalIndex }))
              .filter(({ window }) => window.weekday === day.value)

            return (
              <div
                key={day.value}
                className="rounded-lg border border-border bg-card p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">{day.label}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => addWindow(day.value)}
                    aria-label={`Adicionar horário para ${day.label}`}
                  >
                    <Plus />
                  </Button>
                </div>

                {dayWindows.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sem horários definidos</p>
                ) : (
                  <div className="space-y-2">
                    {dayWindows.map(({ window: w, originalIndex }) => (
                      <div
                        key={originalIndex}
                        className="flex items-center gap-2"
                      >
                        <label className="sr-only">Início</label>
                        <input
                          type="time"
                          value={w.start_time}
                          onChange={(e) =>
                            updateWindow(originalIndex, 'start_time', e.target.value)
                          }
                          className="h-7 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
                        />
                        <span className="text-xs text-muted-foreground">até</span>
                        <label className="sr-only">Fim</label>
                        <input
                          type="time"
                          value={w.end_time}
                          onChange={(e) =>
                            updateWindow(originalIndex, 'end_time', e.target.value)
                          }
                          className="h-7 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeWindow(originalIndex)}
                          aria-label="Remover horário"
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Exceções ──────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Exceções de disponibilidade</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addException}
          >
            <Plus />
            Adicionar exceção
          </Button>
        </div>

        {exceptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma exceção cadastrada. Use exceções para folgas e horários extras.
          </p>
        ) : (
          <div className="space-y-3">
            {exceptions.map((exc, index) => (
              <div
                key={index}
                className="rounded-lg border border-border bg-card p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap gap-2 flex-1">
                    {/* Data */}
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground">Data</label>
                      <input
                        type="date"
                        value={exc.exception_date}
                        onChange={(e) =>
                          updateException(index, 'exception_date', e.target.value)
                        }
                        className="h-7 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
                      />
                    </div>

                    {/* Tipo */}
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground">Tipo</label>
                      <select
                        value={exc.exception_type}
                        onChange={(e) =>
                          updateException(index, 'exception_type', e.target.value)
                        }
                        className="h-7 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
                      >
                        <option value="folga">Folga</option>
                        <option value="extra">Horário extra</option>
                      </select>
                    </div>

                    {/* Horários (apenas para tipo extra) */}
                    {exc.exception_type === 'extra' && (
                      <>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-muted-foreground">Início</label>
                          <input
                            type="time"
                            value={exc.start_time ?? ''}
                            onChange={(e) =>
                              updateException(index, 'start_time', e.target.value || null)
                            }
                            className="h-7 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-muted-foreground">Fim</label>
                          <input
                            type="time"
                            value={exc.end_time ?? ''}
                            onChange={(e) =>
                              updateException(index, 'end_time', e.target.value || null)
                            }
                            className="h-7 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
                          />
                        </div>
                      </>
                    )}

                    {/* Motivo */}
                    <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
                      <label className="text-xs text-muted-foreground">Motivo (opcional)</label>
                      <input
                        type="text"
                        value={exc.reason ?? ''}
                        onChange={(e) =>
                          updateException(index, 'reason', e.target.value || null)
                        }
                        placeholder="Ex: Feriado, viagem..."
                        className="h-7 rounded-md border border-input bg-background px-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
                      />
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeException(index)}
                    aria-label="Remover exceção"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
