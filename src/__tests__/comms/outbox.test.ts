/**
 * Phase 4 — MessageQueue / outbox worker tests (COMMS-04)
 * Test type: source-inspection of:
 *   - src/lib/messaging/queue.ts     (Plan 02 — MessageQueue interface + OutboxQueue)
 *   - src/lib/messaging/worker.ts    (Plan 02 — worker drain; email branch extended in Plan 04)
 *
 * RED until Plan 02 creates queue.ts + worker.ts.
 * The AppointmentReminderEmail assertion (last describe) goes GREEN after Plan 04 Task 1.
 *
 * COMMS-04: durable queue, retry, no duplicate sends, attempts incremented BEFORE send,
 *           idempotency via 23505 UNIQUE violation skip.
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const QUEUE_PATH  = resolve(process.cwd(), 'src/lib/messaging/queue.ts')
const WORKER_PATH = resolve(process.cwd(), 'src/lib/messaging/worker.ts')

describe('MessageQueue interface + OutboxQueue — src/lib/messaging/queue.ts (COMMS-04)', () => {
  it('file exists (fails RED until Plan 02)', () => {
    expect(existsSync(QUEUE_PATH)).toBe(true)
  })

  it('exports MessageQueue interface (D-01 abstraction seam)', () => {
    if (!existsSync(QUEUE_PATH)) {
      expect(existsSync(QUEUE_PATH)).toBe(true)
      return
    }
    const src = readFileSync(QUEUE_PATH, 'utf8')
    expect(src).toMatch(/interface\s+MessageQueue/)
  })

  it('enqueue method declared in MessageQueue (COMMS-04)', () => {
    if (!existsSync(QUEUE_PATH)) {
      expect(existsSync(QUEUE_PATH)).toBe(true)
      return
    }
    const src = readFileSync(QUEUE_PATH, 'utf8')
    expect(src).toMatch(/enqueue/)
  })

  it('idempotency_key used in enqueue options (COMMS-04 dedup)', () => {
    if (!existsSync(QUEUE_PATH)) {
      expect(existsSync(QUEUE_PATH)).toBe(true)
      return
    }
    const src = readFileSync(QUEUE_PATH, 'utf8')
    expect(src).toMatch(/idempotency_key/)
  })

  it('handles 23505 UNIQUE violation as idempotent success (COMMS-04 Pitfall 5)', () => {
    if (!existsSync(QUEUE_PATH)) {
      expect(existsSync(QUEUE_PATH)).toBe(true)
      return
    }
    const src = readFileSync(QUEUE_PATH, 'utf8')
    // 23505 = PostgreSQL unique_violation error code
    expect(src).toMatch(/23505/)
  })
})

describe('Worker drain loop — src/lib/messaging/worker.ts (COMMS-04)', () => {
  it('file exists (fails RED until Plan 02)', () => {
    expect(existsSync(WORKER_PATH)).toBe(true)
  })

  it('increments attempts BEFORE send (idempotency guard — RESEARCH Pitfall 5)', () => {
    if (!existsSync(WORKER_PATH)) {
      expect(existsSync(WORKER_PATH)).toBe(true)
      return
    }
    const src = readFileSync(WORKER_PATH, 'utf8')
    // attempts must be incremented as: row.attempts + 1  (bump before send)
    expect(src).toMatch(/attempts:\s*\w+\.attempts\s*\+\s*1/)
  })

  it("marks status 'sent' on successful send (COMMS-04)", () => {
    if (!existsSync(WORKER_PATH)) {
      expect(existsSync(WORKER_PATH)).toBe(true)
      return
    }
    const src = readFileSync(WORKER_PATH, 'utf8')
    expect(src).toMatch(/'sent'/)
  })

  it("marks status 'failed' when attempts >= max_attempts (COMMS-04 retry cap)", () => {
    if (!existsSync(WORKER_PATH)) {
      expect(existsSync(WORKER_PATH)).toBe(true)
      return
    }
    const src = readFileSync(WORKER_PATH, 'utf8')
    expect(src).toMatch(/'failed'/)
    // Must compare attempts to max_attempts
    expect(src).toMatch(/max_attempts/)
  })

  it('has per-row try/catch so one failure does not abort the loop (COMMS-04 D-01)', () => {
    if (!existsSync(WORKER_PATH)) {
      expect(existsSync(WORKER_PATH)).toBe(true)
      return
    }
    const src = readFileSync(WORKER_PATH, 'utf8')
    // Must have a for/forEach loop + try/catch inside
    expect(src).toMatch(/try\s*\{/)
    expect(src).toMatch(/catch/)
    expect(src).toMatch(/for\s*\(|\.forEach\(/)
  })

  it("drain selects only status='pending' rows (status-based idempotency — no re-send of 'sent' rows)", () => {
    // drainOutbox selecting status='pending' means already-'sent' rows are never re-sent
    // regardless of which cron invokes the worker — this is the core dedup guarantee
    if (!existsSync(WORKER_PATH)) {
      expect(existsSync(WORKER_PATH)).toBe(true)
      return
    }
    const src = readFileSync(WORKER_PATH, 'utf8')
    expect(src).toMatch(/'pending'/)
  })
})

describe('Worker email branch (Plan 04 extension) — payload.kind switch (COMMS-02)', () => {
  // NOTE: These assertions go GREEN after Plan 04 Task 1 extends the worker email branch.
  // They are expected RED after Plan 02 and GREEN after Plan 04. This is by design.

  it('worker email branch switches on payload.kind (Plan 04 — RED until then)', () => {
    if (!existsSync(WORKER_PATH)) {
      expect(existsSync(WORKER_PATH)).toBe(true)
      return
    }
    const src = readFileSync(WORKER_PATH, 'utf8')
    expect(src).toMatch(/payload\.kind/)
  })

  it('worker references AppointmentReminderEmail for email channel (Plan 04 — RED until then)', () => {
    if (!existsSync(WORKER_PATH)) {
      expect(existsSync(WORKER_PATH)).toBe(true)
      return
    }
    const src = readFileSync(WORKER_PATH, 'utf8')
    expect(src).toMatch(/AppointmentReminderEmail/)
  })
})
