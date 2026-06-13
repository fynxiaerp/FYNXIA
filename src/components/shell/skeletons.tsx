// skeletons.tsx — Reusable skeleton building blocks for loading.tsx files.
// Uses shadcn Skeleton (animate-pulse bg-muted rounded-md).
// Containers carry aria-busy="true" aria-label="Carregando…" (06-UI-SPEC line 841).
// Wave-3 loading.tsx files compose these building blocks.
import { Skeleton } from '@/components/ui/skeleton'

// ─── PageHeader Skeleton ──────────────────────────────────────────────────────
// Mimics the h-16 PageHeader with a title bar and optional breadcrumb line.
export function PageHeaderSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Carregando…"
      className="h-16 px-6 border-b border-border bg-background flex flex-col justify-center gap-1.5 shrink-0"
    >
      {/* Breadcrumb line */}
      <Skeleton className="h-3 w-32" />
      {/* Title line */}
      <Skeleton className="h-5 w-48" />
    </div>
  )
}

// ─── TotalsCards Skeleton ─────────────────────────────────────────────────────
// Mimics 3 CashFlowTotals cards (min-h-[72px] from 06-UI-SPEC spacing exceptions).
export function TotalsCardsSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Carregando…"
      className="grid grid-cols-1 sm:grid-cols-3 gap-4"
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border bg-card p-4 min-h-[72px] flex flex-col gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-32" />
        </div>
      ))}
    </div>
  )
}

// ─── CardGrid Skeleton ────────────────────────────────────────────────────────
// Generic card grid. Default count=3, default height h-28.
// Used for /clinica hub (3 quick-stats cards) and /clinica/financeiro (4 sub-module cards).
interface CardGridSkeletonProps {
  count?: number
  columns?: number
}
// Explicit static map — Tailwind requires full class names at build time (no interpolation).
const COLS_CLASS: Record<number, string> = {
  1: 'sm:grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-4',
}

export function CardGridSkeleton({ count = 3, columns = 3 }: CardGridSkeletonProps) {
  return (
    <div
      aria-busy="true"
      aria-label="Carregando…"
      className={`grid grid-cols-1 gap-4 ${COLS_CLASS[columns] ?? 'sm:grid-cols-3'}`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border bg-card p-4 h-28 flex flex-col gap-3">
          <Skeleton className="h-5 w-5 rounded-md" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  )
}

// ─── TableRows Skeleton ───────────────────────────────────────────────────────
// Mimics a table with N row skeletons.
// Column widths follow the per-page table structure.
interface TableRowsSkeletonProps {
  rows?: number
  /** Optional column width ratios (fractions, must sum ≤ 1) */
  columns?: number[]
}
export function TableRowsSkeleton({ rows = 5, columns = [0.4, 0.15, 0.15, 0.3] }: TableRowsSkeletonProps) {
  return (
    <div
      aria-busy="true"
      aria-label="Carregando…"
      className="rounded-lg border border-border bg-card overflow-hidden"
    >
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/40">
        {columns.map((w, i) => (
          <Skeleton key={i} className="h-3" style={{ flex: w }} />
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0"
        >
          {columns.map((w, colIdx) => (
            <Skeleton key={colIdx} className="h-4" style={{ flex: w }} />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── FilterBar Skeleton ───────────────────────────────────────────────────────
// Mimics a filter bar with a search input + 1-2 filter controls.
export function FilterBarSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Carregando…"
      className="flex items-center gap-3"
    >
      <Skeleton className="h-8 flex-1 max-w-sm" />
      <Skeleton className="h-8 w-28" />
    </div>
  )
}

// ─── CalendarGrid Skeleton ────────────────────────────────────────────────────
// Mimics FullCalendar week grid: alternating row lines.
export function CalendarGridSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Carregando…"
      className="flex flex-col gap-0 h-[calc(100vh-128px)] overflow-hidden rounded-lg border border-border bg-card"
    >
      {/* Day headers */}
      <div className="flex items-center gap-0 border-b border-border px-2 py-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <Skeleton className="h-3 w-6" />
            <Skeleton className="h-6 w-6 rounded-full" />
          </div>
        ))}
      </div>
      {/* Time rows */}
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="flex items-center gap-0 border-b border-border last:border-0 py-3 px-2">
          <Skeleton className="h-3 w-10 mr-2 shrink-0" />
          <div className="flex-1 h-8 rounded" />
        </div>
      ))}
    </div>
  )
}
