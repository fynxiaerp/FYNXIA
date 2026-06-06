/**
 * Collection Ruler Engine — pure functions (no server-only imports, fully unit-testable)
 *
 * FIN-07 / D-10: Idempotent per (receivable_id + milestone).
 * The milestone string is the idempotency key that maps to collection_log UNIQUE(receivable_id, milestone, channel).
 *
 * Milestones:
 *   'due_date'    — reminder on the due date itself
 *   'overdue_N'  — reminder when N days overdue (N is a positive multiple of overdue_interval_days)
 *
 * No server-only imports — safe to import in Vitest node environment.
 */

import { differenceInCalendarDays } from 'date-fns'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CollectionRule {
  due_date_reminder_enabled: boolean
  overdue_reminder_enabled: boolean
  overdue_interval_days: number
}

export interface ReceivableInput {
  id: string
  due_date: string   // ISO date string 'YYYY-MM-DD'
  status: string     // 'pendente' | 'pago' | 'estornado'
}

export interface ReminderTarget {
  receivableId: string
  /** Stable idempotency key: 'due_date' | 'overdue_7' | 'overdue_14' etc. */
  milestone: string
}

// ─── Core function ─────────────────────────────────────────────────────────────

/**
 * selectReminders — pure function, no side effects.
 *
 * For each unpaid receivable, determines which reminder milestones are due today.
 * Returns an array of (receivableId, milestone) pairs that should trigger a send.
 *
 * The caller is responsible for:
 * 1. Checking collection_log for existing (receivable_id, milestone) rows (idempotency).
 * 2. Sending the email via Resend.
 * 3. Inserting into collection_log to mark as sent.
 *
 * @param rule - The tenant's collection rule config
 * @param receivables - List of receivables to check (already filtered to unpaid, for this tenant)
 * @param today - The reference date (caller passes new Date() so this function stays pure/testable)
 */
export function selectReminders(
  rule: CollectionRule,
  receivables: ReceivableInput[],
  today: Date
): ReminderTarget[] {
  const targets: ReminderTarget[] = []

  // Normalize today to midnight UTC to avoid time-of-day effects in date comparison
  const todayMidnight = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  )

  for (const receivable of receivables) {
    // Skip paid or refunded receivables — no reminders needed
    if (receivable.status === 'pago' || receivable.status === 'estornado') {
      continue
    }

    const dueDate = new Date(receivable.due_date + 'T00:00:00Z')
    const daysOverdue = differenceInCalendarDays(todayMidnight, dueDate)

    // ── Due-date reminder ──────────────────────────────────────────────────────
    // Fires on the exact due date (daysOverdue === 0) when enabled
    if (rule.due_date_reminder_enabled && daysOverdue === 0) {
      targets.push({ receivableId: receivable.id, milestone: 'due_date' })
    }

    // ── Overdue reminder ───────────────────────────────────────────────────────
    // Fires when daysOverdue is a positive multiple of overdue_interval_days
    if (
      rule.overdue_reminder_enabled &&
      daysOverdue > 0 &&
      rule.overdue_interval_days > 0 &&
      daysOverdue % rule.overdue_interval_days === 0
    ) {
      // milestone = 'overdue_7', 'overdue_14', etc. — stable idempotency key
      targets.push({ receivableId: receivable.id, milestone: `overdue_${daysOverdue}` })
    }
  }

  return targets
}
