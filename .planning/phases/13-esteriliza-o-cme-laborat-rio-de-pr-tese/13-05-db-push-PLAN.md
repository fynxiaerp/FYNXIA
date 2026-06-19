---
phase: 13-esteriliza-o-cme-laborat-rio-de-pr-tese
plan: 05
type: execute
wave: 3
depends_on: [02, 03, 04]
files_modified:
  - src/types/database.types.ts
autonomous: false
requirements: [CME-01, CME-02, CME-03, LAB-01, LAB-02]
tags: [database, migration, blocking, gen-types]

must_haves:
  truths:
    - "The four Phase 13 migrations (20260619000100..000400) are applied to the live Supabase project jqjwyqlbbuqnrffdnlpp"
    - "src/types/database.types.ts contains sterilization_cycles, kit_usages, prosthetic_labs, lab_orders types"
    - "lab_orders.financial_transaction_id FK is present on the live DB and RLS is active on all four tables"
    - "tsc stays green after type regeneration (the Plan 04 action files type-check against the new tables once casts can be tightened — at minimum compile)"
  artifacts:
    - path: "src/types/database.types.ts"
      provides: "regenerated Supabase types including the four new Phase 13 tables"
      contains: "sterilization_cycles"
  key_links:
    - from: "supabase/migrations/20260619000100..000400"
      to: "live DB jqjwyqlbbuqnrffdnlpp"
      via: "supabase db push"
      pattern: "sterilization_cycles|kit_usages|prosthetic_labs|lab_orders"
---

<objective>
Apply the four Phase 13 migrations to the live Supabase project and regenerate TypeScript types. This is the SINGLE [BLOCKING] checkpoint of the phase — it requires a human because the Supabase CLI is frequently logged into the wrong account (the nexus-* org) and must be re-authenticated against org `kczvihafddupruvsrrsc` / project `jqjwyqlbbuqnrffdnlpp` before push (MEMORY.md gotcha; a restricted PAT gives 403 on gen types).

Purpose: Make `sterilization_cycles`, `kit_usages`, `prosthetic_labs`, and `lab_orders` (with the `financial_transaction_id` FK + RLS) real on the live DB so the Wave 4 UIs (Plans 06/07) query against typed clients and the Plan 04 actions resolve against the regenerated schema.
Output: Migrations applied; src/types/database.types.ts regenerated with the four new tables.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@supabase/migrations/20260619000100_sterilization_cycles.sql
@supabase/migrations/20260619000200_sterilization_rls.sql
@supabase/migrations/20260619000300_prosthetic_labs.sql
@supabase/migrations/20260619000400_lab_orders_rls.sql
</context>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1: [BLOCKING] Re-auth, supabase db push, regenerate types (truncation guard)</name>
  <files>src/types/database.types.ts</files>
  <read_first>
    - .planning/phases/12-receitu-rio-teleodontologia/12-05-PLAN.md (the exact re-auth + db push + temp-file gen-types guard sequence — mirror it for Phase 13)
    - supabase/migrations/20260619000100_sterilization_cycles.sql ... 20260619000400_lab_orders_rls.sql (the four files being applied)
  </read_first>
  <action>
    Human runs the Supabase re-auth + db push + gen types sequence detailed in how-to-verify below.
    This is a checkpoint:human-action because the Supabase CLI is frequently logged into the wrong
    account; the human MUST confirm project jqjwyqlbbuqnrffdnlpp is active before pushing DDL, then
    apply the four Phase 13 migrations and regenerate src/types/database.types.ts using the temp-file
    truncation guard (write temp → verify size + new tables present → only then overwrite).
  </action>
  <what-built>
    Four migrations written in Plans 02/03 (sterilization_cycles [+kit_usages], sterilization_rls,
    prosthetic_labs [+lab_orders], lab_orders_rls) are ready to apply. They ONLY ADD new tables +
    RLS + indexes + a FK column (lab_orders.financial_transaction_id → financial_transactions). The
    appointments GIST no_overlap constraint, financial_transactions, resources, and the Phase 8/12
    signing engine are all untouched (Plan 01 regression guard backs this).
  </what-built>
  <how-to-verify>
    Run these from the repo root, in order. Stop and report if any step fails.

    1. Confirm the CLI is on the RIGHT account/project (recurring gotcha — MEMORY.md):
         supabase projects list
       The output MUST show project `jqjwyqlbbuqnrffdnlpp` with a ● (linked/active marker).
       If it is NOT shown (CLI logged into a nexus-* account), re-authenticate:
         supabase login
       then re-run `supabase projects list` and confirm jqjwyqlbbuqnrffdnlpp appears with ●.

    2. Apply the migrations to the live DB:
         supabase db push
       Expect the four 20260619000100..000400 migrations to apply with no error.
       (All are additive: new tables + RLS + indexes + the financial_transaction_id FK. No data
       migration on appointments or financial_transactions. Report any error.)

    3. Regenerate the typed schema WITH THE TRUNCATION GUARD (CLAUDE.md):
         supabase gen types typescript --project-id jqjwyqlbbuqnrffdnlpp > src/types/database.types.t
       Then verify the temp file BEFORE overwriting:
         - it has > 1000 lines:           wc -l src/types/database.types.t
         - it contains the new tables:    grep -E "sterilization_cycles|kit_usages|prosthetic_labs|lab_orders" src/types/database.types.t
       ONLY if all checks pass, overwrite atomically:
         mv src/types/database.types.t src/types/database.types.ts
       If any check fails, DELETE the temp file and report — do NOT overwrite the good types file.

    4. Verify types + build:
         npx tsc --noEmit            (must exit 0)
       and confirm src/types/database.types.ts now contains `sterilization_cycles`, `kit_usages`,
       `prosthetic_labs`, and `lab_orders`.
  </how-to-verify>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `supabase projects list` shows jqjwyqlbbuqnrffdnlpp ● before push.
    - db push applies all four migrations with no error.
    - Temp-file guard satisfied (>1000 lines + four new tables present) before mv overwrite.
    - src/types/database.types.ts contains sterilization_cycles, kit_usages, prosthetic_labs, lab_orders.
    - `npx tsc --noEmit` exits 0.
  </acceptance_criteria>
  <resume-signal>Type "approved" once db push succeeded, types regenerated via the guard, and tsc is green. Report any error otherwise.</resume-signal>
  <done>Four migrations applied to jqjwyqlbbuqnrffdnlpp; types include the four new tables; lab_orders.financial_transaction_id FK + RLS active; tsc exits 0.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| local CLI → live DB | db push applies DDL to production; wrong-account push is the primary risk |
| gen types temp write → build | partial type write can break the Vercel build; truncation guard prevents overwrite of good types |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-13-20 | Tampering | db push to wrong project/org | mitigate | Mandatory `supabase projects list` verification of jqjwyqlbbuqnrffdnlpp ● before push; human gate |
| T-13-21 | Denial of Service | partial/truncated gen types breaks build | mitigate | temp-file (.t) → size + table-presence check → atomic mv only on success |
| T-13-22 | Denial of Service | failed/partial migration | accept | Migrations are additive (new tables + RLS + indexes + FK); no data migration on appointments/financial_transactions; re-runnable |
</threat_model>

<verification>
- `supabase projects list` shows jqjwyqlbbuqnrffdnlpp ●
- `supabase db push` applies the four migrations
- temp-file guard passes; `src/types/database.types.ts` regenerated, contains the four tables
- `npx tsc --noEmit` exits 0
</verification>

<success_criteria>
- Live DB has sterilization_cycles, kit_usages, prosthetic_labs, lab_orders with RLS + indexes + the financial_transaction_id FK.
- Types regenerated via the truncation guard; tsc green.
</success_criteria>

<output>
After completion, create `.planning/phases/13-esteriliza-o-cme-laborat-rio-de-pr-tese/13-05-SUMMARY.md`
</output>
