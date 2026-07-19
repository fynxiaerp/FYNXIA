---
phase: quick-260719-lgc
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [src/lib/crc/nps-scan.ts]
autonomous: true
requirements: [CRC-04]
must_haves:
  truths:
    - "runNpsInviteScan fetches concluded appointments WITHOUT the nested PostgREST embed filter (patients!inner + dot-notation)"
    - "Eligible patients are fetched via a second, separate query with DIRECT filters on the patients table (deleted_at IS NULL, is_anonymized=false)"
    - "The existing invite loop body (nps_responses insert, outbox enqueue, logBusinessEvent, 23505 dedup) is UNCHANGED"
    - "Function signature runNpsInviteScan(admin?): Promise<{invited, skipped}> is unchanged"
    - "Self-healing behavior preserved: no date window, no already-invited pre-check — UNIQUE(appointment_id) + 23505 remains the only dedup guard"
  artifacts:
    - path: "src/lib/crc/nps-scan.ts"
      provides: "Rewritten two-query fetch feeding the unchanged invite loop"
      contains: "runNpsInviteScan"
  key_links:
    - from: "src/lib/crc/nps-scan.ts appointments fetch"
      to: "patients fetch via .in('id', patientIds)"
      via: "distinct non-null patient_id array + Map<id, PatientRel> join in application code"
      pattern: "\\.in\\('id', patientIds\\)"
---

<objective>
Fix `src/lib/crc/nps-scan.ts` so the nightly NPS cron actually creates invites in production.

Root cause (investigated live in production, not hypothetical): `runNpsInviteScan`
fetches concluded appointments using a nested PostgREST embed filter —
`patients!inner(...)` combined with dot-notation predicates
`.is('patients.deleted_at', null)` / `.eq('patients.is_anonymized', false)`.
This pattern returns zero rows in production even though a direct equivalent SQL
query (JOIN appointments→patients with the same predicates) returns 1 clearly
eligible row ("Angelica Teste", `status='concluido'`, not deleted/anonymized).
Because `fetchError` is only `console.error`'d (never propagated/audited), the bug
is invisible: `nps_responses`, `message_outbox`, and `audit_logs` are all empty.

Purpose: Restore CRC-04 (self-healing NPS invite scan) to working state in production.
Output: A rewritten fetch section that uses two simple sequential queries instead of
the nested embed filter, feeding the EXISTING (unchanged) invite loop.
</objective>

<context>
@.planning/STATE.md
@./CLAUDE.md
@src/lib/crc/nps-scan.ts
@src/app/api/cron/nps-scan/route.ts

<interfaces>
<!-- The loop body already expects each element of `appointments` to be shaped like: -->
<!--   { id, tenant_id, unit_id, patient_id, patients: PatientRel } -->
<!-- where PatientRel = { id, full_name, phone: string|null, email: string|null } -->
<!-- The rewrite must produce that exact shape so the loop body (lines ~94+) is untouched. -->
<!-- Note: the current PatientRel type does NOT include deleted_at/is_anonymized (those are -->
<!-- filter-only columns). Keep PatientRel as-is; the second query may select the extra -->
<!-- columns for the WHERE, but the objects put into the Map only need to satisfy PatientRel. -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace nested embed fetch with two sequential queries</name>
  <files>src/lib/crc/nps-scan.ts</files>
  <action>
Rewrite ONLY the appointments-fetching section (current lines ~62-90, from the
"Query concluded appointments + patient join" comment through the
`if (!appointments || appointments.length === 0)` guard). Do NOT touch anything
from `const queue = getOutboxQueue(admin)` onward — the entire `for (const appt of
appointments)` loop body (nps_responses insert, 23505 dedup, outbox enqueue,
logBusinessEvent) stays byte-for-byte identical.

Replace the single embed query with two sequential queries, following the exact
pattern below:

a. Fetch all concluded appointments (NO embed):
```typescript
const { data: apptRows, error: apptError } = await admin
  .from('appointments')
  .select('id, tenant_id, unit_id, patient_id')
  .eq('status', 'concluido')

if (apptError) {
  console.error('[nps-scan] Failed to fetch concluded appointments:', apptError.message)
  return { invited: 0, skipped: 0 }
}
if (!apptRows || apptRows.length === 0) {
  return { invited: 0, skipped: 0 }
}
```

b. Collect distinct non-null patient_ids; bail early if empty (avoids invalid `.in('id', [])`):
```typescript
const patientIds = Array.from(
  new Set(apptRows.map((a) => a.patient_id).filter((id): id is string => Boolean(id))),
)
if (patientIds.length === 0) {
  return { invited: 0, skipped: 0 }
}
```

c. Fetch eligible patients with DIRECT filters on the patients table (WR-06 / LGPD —
same predicates, now NOT dot-notation over an embed):
```typescript
const { data: patientRows, error: patientError } = await admin
  .from('patients')
  .select('id, full_name, phone, email, deleted_at, is_anonymized')
  .in('id', patientIds)
  .is('deleted_at', null)
  .eq('is_anonymized', false)

if (patientError) {
  console.error('[nps-scan] Failed to fetch eligible patients:', patientError.message)
  return { invited: 0, skipped: 0 }
}
```

d. Build a `Map<string, PatientRel>` keyed by patient id, then build the
`appointments` array (same variable name the loop already consumes) by filtering
apptRows to those whose patient_id is present in the map and attaching the patient
object under the `patients` key:
```typescript
const patientMap = new Map<string, PatientRel>()
for (const p of patientRows ?? []) {
  patientMap.set(p.id, { id: p.id, full_name: p.full_name, phone: p.phone, email: p.email })
}

const appointments = apptRows
  .filter((a) => a.patient_id && patientMap.has(a.patient_id))
  .map((a) => ({ ...a, patients: patientMap.get(a.patient_id as string) as PatientRel }))

if (appointments.length === 0) {
  return { invited: 0, skipped: 0 }
}
```

Keep the loop body's existing `const patient = appt.patients as unknown as PatientRel`
line working — the shape above satisfies it.

Also update the function's header comment block (the "Query concluded appointments"
section comment) to explain: self-healing preserved (no date window, no pre-check —
UNIQUE(appointment_id)+23505 is the sole dedup guard); rewrite reason: the previous
nested PostgREST embed filter (`patients!inner` + dot-notation predicates) returned
zero rows in production despite a direct SQL join confirming eligible data existed,
so the fetch now uses two simple queries joined in application code.

Do NOT change: the function signature, imports (PatientRel type stays as-is), the
SITE_URL/TOKEN_TTL_MS constants, or the caller route.ts.
  </action>
  <verify>
    <automated>cd "c:/Users/ReinaldoLima/Desktop/Cowork/FYNXIA" && npx tsc --noEmit && npm run build</automated>
  </verify>
  <done>
- `npx tsc --noEmit` passes (no type errors — the Map/filter/map shape satisfies the loop's PatientRel expectation).
- `npm run build` succeeds.
- Grep confirms `patients!inner` and `.is('patients.deleted_at'` / `.eq('patients.is_anonymized'` no longer appear in the file.
- The invite loop body (from `const queue = getOutboxQueue(admin)` onward) is unchanged.
- Function signature `runNpsInviteScan(admin?): Promise<{invited, skipped}>` unchanged; route.ts untouched.
  </done>
</task>

</tasks>

<verification>
Automated (this task): `npx tsc --noEmit` + `npm run build` both pass; the nested
embed filter strings are gone from the file.

Manual follow-up (NOT automatable in this quick task — the real end-to-end proof):
After deploy, re-trigger the cron in production and confirm an invite row is actually
created:
1. Deploy to Vercel (per the repo's CLI-only deploy flow — see MEMORY / DEPLOY-HANDOFF).
2. Re-trigger: `npx vercel crons run /api/cron/nps-scan` (or the authenticated
   Bearer CRON_SECRET GET against the deployed endpoint).
3. Verify via `supabase db query --linked` (or SQL Editor) that `nps_responses` now
   has a row for the eligible "Angelica Teste" appointment, and that `message_outbox`
   received the enqueued invite(s). Note: `nps_responses` has no audit trigger, so
   `audit_logs` will only show a `crc.nps.invited` business event if a channel was
   actually sent (patient needs a normalizable phone or an email) — check the return
   JSON `{ invited, skipped, drained, failed }` from the endpoint as the primary signal.

This DB re-check is the definitive confirmation the production bug is fixed; the
code-level verify above cannot prove PostgREST runtime behavior.
</verification>

<success_criteria>
- `runNpsInviteScan` no longer uses `patients!inner(...)` with dot-notation embed filters.
- Eligible patients fetched via a separate query with direct `.is('deleted_at', null)` / `.eq('is_anonymized', false)` filters on the patients table.
- Invite loop body, function signature, and route.ts caller all unchanged.
- Self-healing semantics unchanged (no date window; UNIQUE(appointment_id)+23505 sole dedup).
- `npx tsc --noEmit` and `npm run build` pass.
</success_criteria>

<output>
After completion, create `.planning/quick/260719-lgc-corrigir-nps-scan-ts-substituir-filtro-p/260719-lgc-SUMMARY.md`
</output>
