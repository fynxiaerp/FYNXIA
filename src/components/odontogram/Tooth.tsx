'use client'
import type { KeyboardEvent } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * ToothStatus — 9 status per D-13 (CLINIC-06)
 * Used as dental_records.status CHECK constraint values.
 */
export type ToothStatus =
  | 'higido'
  | 'cariado'
  | 'extraido'
  | 'em_tratamento'
  | 'implante'
  | 'coroa'
  | 'selante'
  | 'fraturado'
  | 'restaurado'

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * STATUS_COLORS — hex colors per status per 02-UI-SPEC Odontogram Status Colors contract.
 * Hardcoded values; never use shadcn tokens here (odontogram is SVG, not Tailwind context).
 */
export const STATUS_COLORS: Record<ToothStatus, string> = {
  higido: '#4ade80',        // green-400
  cariado: '#ef4444',       // red-500
  extraido: '#6b7280',      // gray-500 (+ X stroke)
  em_tratamento: '#f59e0b', // amber-400
  implante: '#3b82f6',      // blue-500
  coroa: '#a855f7',         // purple-500
  selante: '#06b6d4',       // cyan-500
  fraturado: '#f97316',     // orange-500
  restaurado: '#84cc16',    // lime-500
}

/**
 * FDI_TEETH — 32 teeth in FDI (Fédération Dentaire Internationale) numbering.
 * Upper right: 11-18, Upper left: 21-28
 * Lower left:  31-38, Lower right: 41-48
 * Ordered for display purposes: upper arch left-to-right (18..11, 21..28),
 * lower arch left-to-right (48..41, 31..38).
 */
export const FDI_TEETH: number[] = [
  // Upper right (patient's right = displayed on left side of chart)
  11, 12, 13, 14, 15, 16, 17, 18,
  // Upper left
  21, 22, 23, 24, 25, 26, 27, 28,
  // Lower left
  31, 32, 33, 34, 35, 36, 37, 38,
  // Lower right
  41, 42, 43, 44, 45, 46, 47, 48,
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Minimal shape of a dental_records row needed for status mapping.
 */
export interface DentalRecordSnapshot {
  tooth_number: number
  status: string
  created_at: string
}

/**
 * mapDentalRecordsToToothStatus — given an array of dental_records snapshots,
 * returns the most recent status for each tooth_number.
 * Teeth not present in records default to 'higido'.
 *
 * D-14: dental_records stores a snapshot per atendimento; most recent wins.
 */
export function mapDentalRecordsToToothStatus(
  records: DentalRecordSnapshot[]
): Record<number, ToothStatus> {
  const statusMap: Record<number, { status: string; created_at: string }> = {}

  for (const record of records) {
    const existing = statusMap[record.tooth_number]
    if (!existing || record.created_at > existing.created_at) {
      statusMap[record.tooth_number] = {
        status: record.status,
        created_at: record.created_at,
      }
    }
  }

  const result: Record<number, ToothStatus> = {}
  for (const num of FDI_TEETH) {
    result[num] = (statusMap[num]?.status as ToothStatus) ?? 'higido'
  }

  return result
}

// ─── Tooth Component ──────────────────────────────────────────────────────────

interface ToothProps {
  /** FDI tooth number (11-18, 21-28, 31-38, 41-48) */
  number: number
  status: ToothStatus
  onClick: (number: number) => void
  /** When true: cursor=default, onClick is no-op, keyboard handler is not attached (D-15) */
  readonly?: boolean
}

/**
 * Tooth — single SVG tooth element.
 * Rendered inside an <svg> by the Odontogram container.
 * Uses a <g> element; position is controlled by the parent via <g transform="translate(x,y)">.
 */
export function Tooth({ number, status, onClick, readonly = false }: ToothProps) {
  function handleKeyDown(e: KeyboardEvent<SVGGElement>) {
    if (readonly) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick(number)
    }
  }

  return (
    <g
      onClick={() => !readonly && onClick(number)}
      onKeyDown={handleKeyDown}
      role={readonly ? undefined : 'button'}
      tabIndex={readonly ? undefined : 0}
      aria-label={`Dente ${number}: ${status}`}
      style={{ cursor: readonly ? 'default' : 'pointer' }}
    >
      {/* Tooth body */}
      <rect
        width={30}
        height={35}
        rx={4}
        fill={STATUS_COLORS[status]}
        stroke="#374151"
        strokeWidth={1}
      />

      {/* X stroke for extraido status */}
      {status === 'extraido' && (
        <>
          <line x1={5} y1={5} x2={25} y2={30} stroke="#111827" strokeWidth={2} />
          <line x1={25} y1={5} x2={5} y2={30} stroke="#111827" strokeWidth={2} />
        </>
      )}

      {/* FDI number label below tooth */}
      <text
        x={15}
        y={48}
        textAnchor="middle"
        fontSize={10}
        fill="#374151"
        style={{ userSelect: 'none' }}
      >
        {number}
      </text>
    </g>
  )
}
