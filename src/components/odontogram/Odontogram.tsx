'use client'
import { useState, useTransition } from 'react'
import {
  Tooth,
  FDI_TEETH,
  mapDentalRecordsToToothStatus,
  STATUS_COLORS,
  type ToothStatus,
  type DentalRecordSnapshot,
} from '@/components/odontogram/Tooth'
import { updateDentalRecord } from '@/actions/dental-records'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

// ─── Status labels (pt-BR) ────────────────────────────────────────────────────

const STATUS_LABELS: Record<ToothStatus, string> = {
  higido: 'Hígido',
  cariado: 'Cariado',
  extraido: 'Extraído',
  em_tratamento: 'Em Tratamento',
  implante: 'Implante',
  coroa: 'Coroa',
  selante: 'Selante',
  fraturado: 'Fraturado',
  restaurado: 'Restaurado',
}

// ─── Layout constants ─────────────────────────────────────────────────────────
// FDI display layout — 4 rows of 8 teeth each
// Upper arch: upper-right (18→11) | upper-left (21→28)
// Lower arch: lower-right (48→41) | lower-left (31→38)

const TOOTH_WIDTH = 30
const TOOTH_HEIGHT = 35
const TOOTH_GAP = 6
const ARCH_GAP = 24
const LABEL_HEIGHT = 16
const TOTAL_TOOTH_SLOT = TOOTH_WIDTH + TOOTH_GAP

// Tooth groups in display order (left-to-right from patient's perspective)
const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11]
const UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28]
const LOWER_RIGHT_DISPLAY = [48, 47, 46, 45, 44, 43, 42, 41]
const LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38]

const SVG_WIDTH =
  UPPER_RIGHT.length * TOTAL_TOOTH_SLOT +
  ARCH_GAP +
  UPPER_LEFT.length * TOTAL_TOOTH_SLOT

const UPPER_Y = LABEL_HEIGHT
const LOWER_Y = UPPER_Y + TOOTH_HEIGHT + ARCH_GAP + LABEL_HEIGHT
const SVG_HEIGHT = LOWER_Y + TOOTH_HEIGHT + LABEL_HEIGHT + 8

function slotX(index: number): number {
  return index * TOTAL_TOOTH_SLOT
}

// ─── Odontogram props ─────────────────────────────────────────────────────────

interface OdontogramProps {
  records: DentalRecordSnapshot[]
  /** D-15: true for admin/dentist; false for receptionist/patient (read-only) */
  editable: boolean
  patientId: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Odontogram({ records, editable, patientId }: OdontogramProps) {
  const toothStatus = mapDentalRecordsToToothStatus(records)

  // Hover state — used to show tooltip-like info outside SVG
  const [hoveredTooth, setHoveredTooth] = useState<number | null>(null)

  // Edit dialog state
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null)
  const [newStatus, setNewStatus] = useState<ToothStatus>('higido')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleToothClick(toothNumber: number) {
    if (!editable) return
    setSelectedTooth(toothNumber)
    setNewStatus(toothStatus[toothNumber] ?? 'higido')
    setNotes('')
    setError(null)
  }

  function handleDialogClose() {
    setSelectedTooth(null)
    setError(null)
    setNotes('')
  }

  function handleSave() {
    if (selectedTooth === null) return

    startTransition(async () => {
      const result = await updateDentalRecord({
        patient_id: patientId,
        tooth_number: selectedTooth,
        status: newStatus,
        notes: notes.trim() || undefined,
      })

      if (result.success) {
        handleDialogClose()
        window.location.reload()
      } else {
        setError(result.error ?? 'Erro ao salvar ocorrência')
      }
    })
  }

  // Build tooth <g> elements for a display group
  function renderTeethGroup(
    teeth: number[],
    offsetX: number,
    y: number
  ) {
    return teeth.map((toothNum, index) => {
      const x = offsetX + slotX(index)
      const status = toothStatus[toothNum] ?? 'higido'

      return (
        <g
          key={toothNum}
          transform={`translate(${x},${y})`}
          onMouseEnter={() => setHoveredTooth(toothNum)}
          onMouseLeave={() => setHoveredTooth(null)}
          onFocus={() => setHoveredTooth(toothNum)}
          onBlur={() => setHoveredTooth(null)}
        >
          <Tooth
            number={toothNum}
            status={status}
            onClick={handleToothClick}
            readonly={!editable}
          />
        </g>
      )
    })
  }

  // Check if all teeth are hígido (for empty state)
  const allHealthy = FDI_TEETH.every(
    (n) => (toothStatus[n] ?? 'higido') === 'higido'
  )

  return (
    <div className="space-y-4">
      {/* Empty state — only shown to admin/dentist when no records */}
      {allHealthy && editable && (
        <p className="text-center text-sm text-muted-foreground">
          Odontograma limpo. Clique em um dente para registrar ocorrência.
        </p>
      )}

      {/* Hover tooltip info bar */}
      <div className="min-h-[24px] text-center text-sm text-muted-foreground">
        {hoveredTooth !== null && (
          <span>
            Dente {hoveredTooth}:{' '}
            <strong>{STATUS_LABELS[toothStatus[hoveredTooth] ?? 'higido']}</strong>
            {editable && ' · Clique para editar'}
          </span>
        )}
      </div>

      {/* SVG Odontogram */}
      <div className="overflow-x-auto">
        <svg
          width={SVG_WIDTH}
          height={SVG_HEIGHT}
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          aria-label="Odontograma FDI com 32 dentes"
          className="mx-auto block"
        >
          {/* Upper arch label */}
          <text
            x={SVG_WIDTH / 2}
            y={12}
            textAnchor="middle"
            fontSize={10}
            fill="#6b7280"
          >
            Arcada Superior
          </text>

          {/* Upper right: 18,17,16,15,14,13,12,11 */}
          {renderTeethGroup(UPPER_RIGHT, 0, UPPER_Y)}

          {/* Midline separator */}
          <line
            x1={UPPER_RIGHT.length * TOTAL_TOOTH_SLOT + ARCH_GAP / 2}
            y1={UPPER_Y}
            x2={UPPER_RIGHT.length * TOTAL_TOOTH_SLOT + ARCH_GAP / 2}
            y2={UPPER_Y + TOOTH_HEIGHT}
            stroke="#e5e7eb"
            strokeWidth={1}
            strokeDasharray="4 2"
          />

          {/* Upper left: 21,22,23,24,25,26,27,28 */}
          {renderTeethGroup(
            UPPER_LEFT,
            UPPER_RIGHT.length * TOTAL_TOOTH_SLOT + ARCH_GAP,
            UPPER_Y
          )}

          {/* Lower arch label */}
          <text
            x={SVG_WIDTH / 2}
            y={LOWER_Y - 4}
            textAnchor="middle"
            fontSize={10}
            fill="#6b7280"
          >
            Arcada Inferior
          </text>

          {/* Lower right: 48,47,46,45,44,43,42,41 */}
          {renderTeethGroup(LOWER_RIGHT_DISPLAY, 0, LOWER_Y)}

          {/* Midline separator */}
          <line
            x1={8 * TOTAL_TOOTH_SLOT + ARCH_GAP / 2}
            y1={LOWER_Y}
            x2={8 * TOTAL_TOOTH_SLOT + ARCH_GAP / 2}
            y2={LOWER_Y + TOOTH_HEIGHT}
            stroke="#e5e7eb"
            strokeWidth={1}
            strokeDasharray="4 2"
          />

          {/* Lower left: 31,32,33,34,35,36,37,38 */}
          {renderTeethGroup(
            LOWER_LEFT,
            8 * TOTAL_TOOTH_SLOT + ARCH_GAP,
            LOWER_Y
          )}
        </svg>
      </div>

      {/* Status color legend */}
      <div className="flex flex-wrap justify-center gap-2 text-xs">
        {(Object.entries(STATUS_LABELS) as [ToothStatus, string][]).map(
          ([status, label]) => (
            <span key={status} className="flex items-center gap-1">
              <span
                className="inline-block h-3 w-3 rounded-sm border border-gray-400"
                style={{ backgroundColor: STATUS_COLORS[status] }}
              />
              {label}
            </span>
          )
        )}
      </div>

      {/* Edit dialog — opened when admin/dentist clicks a tooth */}
      {editable && selectedTooth !== null && (
        <Dialog open onOpenChange={handleDialogClose}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dente {selectedTooth}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Status</label>
                <Select
                  value={newStatus}
                  onValueChange={(v) => setNewStatus(v as ToothStatus)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.entries(STATUS_LABELS) as [ToothStatus, string][]
                    ).map(([status, label]) => (
                      <SelectItem key={status} value={status}>
                        <span className="flex items-center gap-2">
                          <span
                            className="inline-block h-3 w-3 rounded-sm border border-gray-300"
                            style={{ backgroundColor: STATUS_COLORS[status] }}
                          />
                          {label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold">
                  Observações (opcional)
                </label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anotações sobre o procedimento ou condição..."
                  rows={3}
                />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleDialogClose}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={isPending}>
                {isPending ? 'Salvando...' : 'Salvar Ocorrência'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
