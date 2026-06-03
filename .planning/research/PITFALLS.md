# Domain Pitfalls: FYNXIA — Multi-Tenant Dental ERP

**Domain:** Multi-tenant SaaS ERP — Healthcare/Dental, Brazil
**Stack:** Next.js 14 App Router + TypeScript + Supabase + Vercel
**Researched:** 2026-06-02
**Confidence:** HIGH (Supabase/Next.js official docs + GitHub issues + Vercel docs) / MEDIUM (LGPD healthcare, CFO regulations) / LOW (Asaas edge cases — single source official docs only)

---

## CRITICAL PITFALLS — Phase 0 Must-Address

These cause irreversible data leaks, regulatory violations, or complete rewrites. Must be resolved before any feature code ships.

---

### C-1: RLS Self-Reference Infinite Recursion on `users` Table
**Severity:** CRITICAL
**Phase:** Phase 0 — Foundation

**What goes wrong:**
The schema in FYNXIA-ERP.md defines this policy:
```sql
CREATE POLICY "tenant_isolation_users" ON users
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  );
```
This queries the `users` table from within a policy ON the `users` table. PostgreSQL enters infinite recursion. Every authenticated request fails with an error, locking all users out of the application.

**Why it happens:**
RLS policies are evaluated when any query touches the guarded table. A policy on `users` that itself queries `users` creates a recursive loop — the subquery triggers the policy, which triggers the subquery, infinitely.

**Consequences:**
- Complete authentication failure at launch
- All API routes that fetch the current user's tenant context break
- Very difficult to diagnose because the error message ("stack depth limit exceeded") is cryptic

**Prevention:**
Use a `SECURITY DEFINER` function that bypasses RLS for the internal lookup:
```sql
CREATE OR REPLACE FUNCTION get_my_tenant_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT tenant_id FROM users WHERE id = auth.uid()
$$;

-- Policy now calls the function, not the table directly
CREATE POLICY "tenant_isolation_users" ON users
  FOR ALL USING (
    tenant_id = get_my_tenant_id()
  );
```

**Detection:**
- Test immediately: `SELECT * FROM users` as an authenticated user in Supabase SQL Editor with RLS enabled
- GitHub Discussion #1138 documents this exact failure mode

---

### C-2: Service Role Key Exposed in Client Bundle
**Severity:** CRITICAL
**Phase:** Phase 0 — Foundation

**What goes wrong:**
Developer creates an admin Supabase client in a shared utility file, then that file gets imported by a Server Action or Route Handler that also has code touched by client components. Or: the key is accidentally prefixed with `NEXT_PUBLIC_`.

**Why it happens:**
Next.js inlines all `NEXT_PUBLIC_` environment variables into the client bundle at build time. One misplaced prefix or one `import` chain from a `"use client"` file to a server-only utility exposes the service role key to every browser that loads the app.

**Consequences:**
- `service_role` bypasses ALL RLS policies
- Attacker can read all tenants' patient data (prontuários, CPFs, medical history)
- Attacker can modify or delete any row in any table
- Auth schema is accessible — hashed passwords, refresh tokens exposed
- Direct LGPD Article 46 violation; ANPD mandatory breach notification within 2 business days

**Prevention:**
```typescript
// lib/supabase-admin.ts — add this import at top
import 'server-only';

// NEVER name admin env var with NEXT_PUBLIC_ prefix
// CORRECT:   SUPABASE_SERVICE_ROLE_KEY=xxx
// WRONG:     NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=xxx
```
Add `server-only` to every file that imports the service role key. This causes a build-time error if the module is imported in a client component — fail fast, not in production.

**Detection:**
After every build, run: `grep -r "NEXT_PUBLIC_SUPABASE_SERVICE" .next/static/` — should return nothing.

---

### C-3: `unstable_cache` Cross-Tenant Data Leak via Closure
**Severity:** CRITICAL
**Phase:** Phase 0 — Foundation

**What goes wrong:**
FYNXIA-ERP.md defines this caching pattern:
```typescript
export const getCachedPatients = unstable_cache(
  async (tenantId: string) => { /* query */ },
  ['patients'],
  { revalidate: 3600 }
);
```
This is actually correct because `tenantId` is a parameter. The bug happens when a developer closes over a variable instead of passing it as an argument:
```typescript
// WRONG — tenantId is not in the cache key
const tenantId = await getTenantId(); // resolved from context
export const getCachedPatients = unstable_cache(
  async () => { return supabase.from('patients').select('*').eq('tenant_id', tenantId) },
  ['patients'],  // cache key has no tenant distinction!
  { revalidate: 3600 }
);
```
Tenant A's patient list gets cached. Tenant B requests the same route and receives Tenant A's data.

**Why it happens:**
`unstable_cache` derives its cache key from the declared key array and serialized function arguments. Closures are invisible to the key computation. This is a Next.js architecture trap with no compile-time warning.

**Consequences:**
- Cross-tenant data leakage of patient PII (CPF, phone, medical history)
- LGPD Article 6 violation — data processed beyond its intended purpose
- Silent failure: RLS is bypassed because the DB query never runs (cached result is served)

**Prevention:**
- Always pass tenant-scoped values as explicit function arguments, never close over them
- Cache key array must include all dimensions: `['patients', tenantId, dateRange]`
- Audit every `unstable_cache` call as a security review, not just a performance review
- Migrate to `use cache` directive (Next.js 15+) which enforces argument-based keying

**Detection:**
Log cache hits. If two different tenants get a cache HIT on the same key, you have a leak.

---

### C-4: `getSession()` Used for Authorization in Middleware
**Severity:** CRITICAL
**Phase:** Phase 0 — Foundation

**What goes wrong:**
Developer protects routes with:
```typescript
// middleware.ts — INSECURE PATTERN
const { data: { session } } = await supabase.auth.getSession()
if (!session) redirect('/login')
// Uses session.user.id for tenant lookups
```

**Why it happens:**
`getSession()` only reads and validates the JWT format and expiry — it does NOT verify the JWT's authenticity against the Supabase Auth server. A malicious actor can craft a valid-looking JWT with a different `user_id` or modified `app_metadata` (like a different `tenant_id`) and pass the session check.

**Consequences:**
- Tenant impersonation: attacker sets `tenant_id` in forged JWT to access another clinic's data
- Authorization decisions made on unverified data
- RLS may still catch this in some cases, but application-layer logic using `session.user.id` will not

**Prevention:**
```typescript
// middleware.ts — SECURE PATTERN
const { data: { user }, error } = await supabase.auth.getUser()
// getUser() always calls the Supabase Auth server to validate the token
if (!user || error) redirect('/login')
```
Use `getUser()` in middleware and Server Components for any authorization decision. `getSession()` is only appropriate when you need the raw access token (e.g., to pass to a third-party API).

**Source:** Supabase auth-js Issue #898, Supabase official docs

---

### C-5: `tenant_id` Stored in `user_metadata` (Mutable by User)
**Severity:** CRITICAL
**Phase:** Phase 0 — Foundation

**What goes wrong:**
Developer stores the tenant association in `auth.users.user_metadata.tenant_id`. A logged-in user calls `supabase.auth.updateUser({ data: { tenant_id: 'other-clinic-uuid' } })` and is immediately granted access to that clinic's entire dataset.

**Why it happens:**
Supabase Auth has two metadata fields:
- `user_metadata`: writable by the authenticated user via client SDK
- `app_metadata`: writable ONLY by the service role — users cannot modify it

**Consequences:**
- Any authenticated user can access any other tenant's data
- Complete multi-tenancy collapse
- Impossible to detect without security testing

**Prevention:**
- Store `tenant_id` in your own `public.users` table (already planned in schema — good)
- If you must use JWT claims, use `app_metadata` only, set via service role during user provisioning
- Never derive tenant context from `user_metadata`
- RLS policies must look up tenant from `public.users`, not from JWT `user_metadata`

---

### C-6: Connection Pool Exhaustion on Vercel Serverless
**Severity:** CRITICAL
**Phase:** Phase 0 — Foundation

**What goes wrong:**
Every Vercel serverless function invocation creates a new Supabase client, which opens a direct PostgreSQL connection. Under moderate load (50+ concurrent requests), all available Postgres connections are exhausted. New requests fail with `too many connections` or `FATAL: remaining connection slots are reserved`.

**Why it happens:**
Serverless functions are stateless — each invocation is isolated. Without a connection pooler, 100 concurrent API calls = 100 open Postgres connections. Supabase free tier allows 200 max connections. Pro tier allows 500. A busy ERP during clinic hours easily exhausts this.

**Consequences:**
- Complete API failure during peak usage (morning when clinics open)
- Connection refusal cascades across all modules simultaneously
- Difficult to diagnose — looks like random 500 errors

**Prevention:**
```typescript
// ALWAYS use the pooler URL, not the direct connection
// For Next.js API routes / Vercel Functions:
// Use port 6543 (transaction mode pooler) NOT 5432 (direct)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
// The Supabase JS client automatically uses the pooler via the REST API
// For Prisma or raw pg connections: use DATABASE_URL with ?pgbouncer=true
```
Supabase's JavaScript client routes through PostgREST which uses Supavisor (the connection pooler) by default — this is safe. The danger is when using `pg` or `Prisma` directly with the direct connection string. Vercel Fluid Compute (already planned) also reduces this by reusing connections across concurrent invocations on the same instance.

**Source:** Vercel blog "The real serverless compute to database connection problem, solved"

---

## HIGH SEVERITY PITFALLS

---

### H-1: RLS Policy Performance Collapse on Scale
**Severity:** HIGH
**Phase:** Phase 0 (index creation) + Phase 1 (validate with realistic data)

**What goes wrong:**
A policy like:
```sql
CREATE POLICY "isolate_appointments" ON appointments
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );
```
Without proper optimization, this subquery executes for EVERY row in the table. On a table with 50,000 appointments (normal for a multi-clinic deployment), this becomes a sequential scan on every query.

**Why it happens:**
PostgreSQL evaluates the subquery per-row unless the optimizer recognizes it can be cached. Without the `(SELECT auth.uid())` wrapper pattern, the function is called once per row.

**Consequences:**
- Appointment list load: 450ms at 10,000 rows → timeout at 1,000,000 rows
- Dashboard queries aggregating across the entire appointments table: 10-100x slower
- Supabase auto-pause on free tier triggered by excessive compute

**Prevention:**
```sql
-- SLOW: function called per row
USING (tenant_id = auth.uid())

-- FAST: wrapping in SELECT caches the result per statement (10-100x improvement)
USING (tenant_id = (SELECT auth.uid()))

-- Also required: composite indexes matching policy columns
CREATE INDEX idx_appointments_tenant_scheduled
  ON appointments(tenant_id, scheduled_at DESC);
CREATE INDEX idx_patients_tenant_id ON patients(tenant_id);
CREATE INDEX idx_medical_records_tenant_id ON medical_records(tenant_id);
```
The indexes are already planned in the schema — ensure they exist BEFORE RLS is enabled on those tables.

**Source:** Supabase RLS Performance and Best Practices (official docs), GitHub Discussion #14576

---

### H-2: Supabase Realtime Channel Authorization — Public by Default
**Severity:** HIGH
**Phase:** Phase 1

**What goes wrong:**
Developer subscribes to calendar updates:
```typescript
supabase.channel('appointments')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, handler)
  .subscribe()
```
By default, any authenticated user on ANY tenant can subscribe to this channel and receive real-time events for ALL tenants' appointments.

**Why it happens:**
Supabase Realtime channel names are arbitrary strings. Without explicit Realtime authorization policies on `realtime.messages`, the "Allow public access" setting defaults to open. RLS on the `appointments` table does NOT automatically protect Realtime subscriptions.

**Consequences:**
- Real-time leakage of patient appointments across tenant boundaries
- Patients of Clinic A see Clinic B's real-time schedule updates
- LGPD violation for sensitive schedule data

**Prevention:**
```sql
-- Disable public Realtime access in Supabase Dashboard > Realtime > Settings
-- Then add RLS policies to realtime.messages:
CREATE POLICY "tenant_realtime_isolation"
  ON realtime.messages
  FOR SELECT USING (
    (payload->>'tenant_id')::uuid = get_my_tenant_id()
  );
```
Use tenant-scoped channel names: `appointments:${tenantId}` and enforce via Realtime RLS policies.

---

### H-3: Next.js App Router — `use client` Boundary Too High
**Severity:** HIGH
**Phase:** Phase 1

**What goes wrong:**
A large page component like the appointments calendar needs one interactive element (a date picker). Developer adds `"use client"` to the page file. Now the entire page — including patient data, appointment lists, and prontuário summaries — is sent to the browser as a client bundle and hydrated on every navigation.

**Why it happens:**
React Server Components are the default in App Router. Adding `"use client"` to a parent component forces ALL its children into the client bundle, even if they never need interactivity.

**Consequences:**
- Patient PII (CPF, health data) included in JavaScript bundles sent to browser
- Bundle size increases 3-10x, causing slow initial loads on clinic reception desktops
- Server-side data fetching benefits (security, performance) lost
- Sensitive medical data exposed in browser memory

**Prevention:**
```
Page (Server Component) — fetches data server-side
  ├── PatientSummary (Server Component) — renders static data
  ├── AppointmentList (Server Component) — fetches from DB securely
  └── DatePicker (Client Component) — "use client" here only
```
Push `"use client"` to the leaf component that needs interactivity. Data-fetching and display components must remain Server Components.

---

### H-4: JWT Refresh Token Race Condition in Next.js Middleware
**Severity:** HIGH
**Phase:** Phase 0

**What goes wrong:**
User has the app open in multiple browser tabs. All tabs simultaneously detect an expiring JWT. Each tab's middleware tries to refresh the token. The first tab succeeds. The second tab attempts to use the now-invalidated refresh token and receives `AuthApiError: Invalid Refresh Token: Already Used`. The user is logged out mid-session — often while documenting a patient consultation.

**Why it happens:**
Supabase rotates refresh tokens on use. In a Next.js SSR+middleware setup, multiple concurrent requests (from multiple tabs or parallel API calls) can each independently trigger a token refresh, all using the same refresh token, but only one can succeed.

**Consequences:**
- Unexpected session termination for active users (dentists mid-appointment)
- Data loss if user was entering prontuário data
- High support ticket volume ("system logged me out randomly")

**Prevention:**
```typescript
// In middleware.ts — ensure the middleware correctly passes updated cookies back
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options) // CRITICAL: must write back
          )
        }
      }
    }
  )
  await supabase.auth.getUser() // triggers refresh if needed
  return response // response now has updated cookies
}
```
If the middleware refreshes the token but fails to write the updated cookies back to the response, every subsequent request re-triggers a refresh, exhausting the token rotation and logging the user out.

---

### H-5: Asaas Webhook Queue Penalization — Silent Payment Failures
**Severity:** HIGH
**Phase:** Phase 2

**What goes wrong:**
The Asaas webhook handler processes payment events synchronously (queries the database, updates status, sends WhatsApp confirmation). Under load, the handler takes more than ~5 seconds to respond. Asaas marks the delivery as failed. After 15 consecutive failures, Asaas PAUSES the entire webhook queue for that integration.

**Why it happens:**
Asaas requires HTTP 200 within its timeout window. Any response other than 200, or any timeout, is counted as a failure. Webhook queue penalization is a protection mechanism that stops sending events to broken endpoints — but it breaks your payment reconciliation entirely until manually reactivated.

**Consequences:**
- Payment confirmations stop updating in the system silently
- Patients appear as delinquent when they have paid
- Collection agents follow up on settled accounts
- Manual queue reactivation required from Asaas dashboard
- All queued events since pause must be replayed manually

**Prevention:**
```typescript
// POST /api/webhooks/asaas
export async function POST(request: Request) {
  // 1. Verify asaas-access-token header FIRST
  const token = request.headers.get('asaas-access-token')
  if (token !== process.env.ASAAS_WEBHOOK_TOKEN) {
    return new Response('Unauthorized', { status: 401 })
  }

  const body = await request.json()

  // 2. Return 200 IMMEDIATELY
  // 3. Queue for async processing (Upstash Queue, background job, etc.)
  await queue.enqueue('process-asaas-event', { event: body })

  return new Response('OK', { status: 200 }) // Return within milliseconds
}
```
Also implement idempotency: log processed event IDs in a `processed_webhooks` table. Check before processing. Asaas guarantees at-least-once delivery.

**Source:** Asaas official docs: "How does webhook queue penalization work?", "How to implement idempotence in Webhooks"

---

### H-6: LGPD Right to Erasure vs. Immutable Audit Logs — Architectural Conflict
**Severity:** HIGH
**Phase:** Phase 0 (design decision) + Phase 1 (implementation)

**What goes wrong:**
FYNXIA schema defines both:
1. `deleted_at` soft delete on `patients` table (correct)
2. `audit_logs` table with `FOR DELETE USING (FALSE)` (correct — immutable)

But when a patient requests data erasure under LGPD Article 18, the system cannot delete audit log entries that contain their `old_values` and `new_values` (which include CPF, full name, health data). The audit log, designed to be immutable, becomes a LGPD violation vector.

Additionally, Brazil's Lei 13.787/2018 requires dental records retention for 20 YEARS from last treatment. This conflicts with LGPD's right to erasure for non-essential data. The two laws are in direct tension.

**Why it happens:**
Healthcare is a special category under LGPD (Article 5, XI, "dado sensível"). The law itself carves out exceptions for mandatory legal retention (Article 16, II — "cumprimento de obrigação legal"). Most teams implement either "full erasure" or "full retention" without the nuanced split.

**Consequences:**
- Deleting audit logs for LGPD compliance destroys forensic evidence required by CFO
- Keeping audit logs with patient PII in `old_values`/`new_values` violates erasure rights
- Either path risks regulatory fines

**Prevention:**
Implement a two-tier erasure strategy:
1. **Erasure tier (LGPD):** Anonymize patient PII fields (`cpf`, `full_name`, `email`, `phone`, `medical_history`) using one-way hashing. The patient record becomes `CPF: SHA256(cpf)`, `name: "ANONYMIZED"`. Set `deleted_at`.
2. **Retention tier (CFO/Lei 13.787):** Clinical records (`medical_records`, `odontograms`, `treatments`) are retained in anonymized form for 20 years — you keep the clinical facts but not the identity.
3. **Audit log purge:** After anonymization, retroactively update `audit_logs.old_values` and `new_values` to replace PII fields with `"ANONYMIZED"`. Drop the `FOR DELETE USING (FALSE)` constraint — use an UPDATE-based redaction instead.
4. Document the legal basis for retention in a `data_processing_register` table per LGPD Article 37.

---

### H-7: WhatsApp Template Reclassification — Appointment Reminders Treated as Marketing
**Severity:** HIGH
**Phase:** Phase 4

**What goes wrong:**
The team submits a WhatsApp template for appointment reminders:
> "Olá {{1}}, lembramos que sua consulta na {{2}} está agendada para {{3}}. Para confirmar, responda SIM."

Meta approves it as a "utility" template. Six months later, the clinic adds a promotional line ("Aproveite nossa promoção de clareamento dental") to the same template. Meta automatically reclassifies the template as "marketing" without notice (as of April 2025, the 24-hour warning was removed). The cost per message jumps 30-40%.

**Why it happens:**
Meta's automated template classification scans for commercial intent. Any template that mixes utility content with promotional content is reclassified to the more expensive category. Healthcare appointment reminders are utility — adding any promotional content escalates them to marketing.

**Consequences:**
- Per-message costs 30-40% higher than budgeted
- Budget overruns for high-volume clinics (thousands of monthly reminders)
- Template rejection on re-submission if the team tries to fix it

**Prevention:**
- Create separate templates for each use case: appointment confirmation (utility), appointment reminder (utility), payment reminder (utility), promotional campaigns (marketing — budget separately)
- Never combine utility content with promotional links or CTAs in the same template
- Use patient opt-in tracking for marketing templates — LGPD requires explicit consent for promotional WhatsApp messages
- Use official WhatsApp Cloud API (Meta), NOT Evolution API (unofficial) — unofficial API violates WhatsApp ToS and risks permanent number ban in a healthcare context where continuity is critical

---

### H-8: Brazil Multi-Timezone Scheduling — Acre/Amazonas/Fernando de Noronha Edge Cases
**Severity:** HIGH
**Phase:** Phase 1

**What goes wrong:**
Developer stores all appointment timestamps in `TIMESTAMP` (without timezone). The application assumes all users are in `America/Sao_Paulo` (UTC-3). A clinic in Manaus (UTC-4) or Rio Branco/Acre (UTC-5) sees all appointments shifted by 1-2 hours. A patient books a 9:00 AM slot and arrives at 8:00 AM or 10:00 AM.

**Why it happens:**
Brazil has 4 time zones:
- `America/Sao_Paulo` (UTC-3) — Southeast, South, Northeast
- `America/Manaus` (UTC-4) — Amazonas, parts of Mato Grosso do Sul
- `America/Rio_Branco` (UTC-5) — Acre
- `America/Noronha` (UTC-2) — Fernando de Noronha

Brazil abolished DST in 2019, eliminating seasonal ambiguity, but regional time differences remain. The `scheduled_at TIMESTAMP` column in the current schema has no timezone information.

**Consequences:**
- Double bookings at timezone boundaries
- Patients arriving at wrong times
- Automated WhatsApp reminders sent at incorrect times
- Complex debugging: bugs appear only for specific clinics

**Prevention:**
```sql
-- Change column type in migration
ALTER TABLE appointments
  ALTER COLUMN scheduled_at TYPE TIMESTAMPTZ;

-- Store tenant timezone preference
ALTER TABLE tenants
  ADD COLUMN timezone VARCHAR(50) NOT NULL DEFAULT 'America/Sao_Paulo';
```
```typescript
// Always store UTC in DB, convert for display
import { toZonedTime, fromZonedTime } from 'date-fns-tz'

const utcTime = fromZonedTime(localTime, clinic.timezone)
// Store utcTime in DB

const displayTime = toZonedTime(utcFromDB, clinic.timezone)
// Show displayTime to user
```

---

### H-9: Concurrent Appointment Double-Booking
**Severity:** HIGH
**Phase:** Phase 1

**What goes wrong:**
Two receptionists at different workstations both see a 10:00 AM slot as available. Both click "Book" within milliseconds. Both requests pass the availability check (optimistic read). Both insert the appointment. Dentist has two patients booked for 10:00 AM.

**Why it happens:**
Standard read-then-write in application code has a race condition window. Even with `SELECT ... WHERE NOT EXISTS` checks, two concurrent transactions can both pass the check before either commits.

**Consequences:**
- Double-booked dentists
- Patient complaints
- No-show fees disputes
- Operational chaos

**Prevention:**
```sql
-- PostgreSQL advisory lock OR a unique constraint on overlapping ranges
-- Option 1: Unique constraint (simple, good for fixed-duration slots)
CREATE UNIQUE INDEX idx_appointments_no_double_book
  ON appointments(tenant_id, dentist_id, scheduled_at)
  WHERE status NOT IN ('cancelled', 'no_show');

-- Option 2: For variable-duration appointments, use an exclusion constraint
-- Requires btree_gist extension
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE appointments ADD CONSTRAINT no_overlap
  EXCLUDE USING GIST (
    tenant_id WITH =,
    dentist_id WITH =,
    tstzrange(scheduled_at, scheduled_at + (duration_minutes * interval '1 minute')) WITH &&
  ) WHERE (status NOT IN ('cancelled', 'no_show'));
```
The unique/exclusion constraint is enforced at the database level — the second insert simply fails, regardless of application-layer race conditions.

---

## MEDIUM SEVERITY PITFALLS

---

### M-1: Next.js Fetch Caching — Stale Patient Data in Dashboard
**Severity:** MEDIUM
**Phase:** Phase 1

**What goes wrong:**
A Server Component fetches patient counts for the dashboard. Next.js 14 caches the `fetch()` response. An hour later, a new patient is registered, but the dashboard still shows the old count because the cache hasn't been revalidated.

**Note:** Next.js 15+ changed the default — fetches are NOT cached by default. Next.js 14 (planned stack) still caches by default.

**Prevention:**
For ERP data that changes frequently (appointments, patient counts, financial totals):
```typescript
// Option 1: Disable cache for real-time data
const res = await fetch(url, { cache: 'no-store' })

// Option 2: Short revalidation for semi-real-time data
const res = await fetch(url, { next: { revalidate: 60 } })

// Option 3: Tag-based invalidation for precise control
const res = await fetch(url, { next: { tags: [`patients:${tenantId}`] } })
// Then call revalidateTag(`patients:${tenantId}`) on mutations
```
Never use `revalidate: 3600` (1 hour) for appointment or financial data in a live clinic.

---

### M-2: Supabase Storage — Medical Images Not Included in Backup
**Severity:** MEDIUM
**Phase:** Phase 1

**What goes wrong:**
The team enables Supabase automated backups. A data corruption event occurs. Database tables are restored. Radiography images, patient photo attachments, and prontuário documents stored in Supabase Storage are GONE — they are not included in Supabase's native snapshot backups.

**Why it happens:**
Supabase's point-in-time recovery and scheduled backups cover PostgreSQL tables only. Storage buckets (S3-compatible object storage) require separate backup configuration.

**Prevention:**
- Implement a scheduled job (Vercel cron) that exports Storage bucket manifests and copies critical medical documents to an independent S3 bucket (e.g., AWS S3 in São Paulo region `sa-east-1` for LGPD data residency)
- Store document metadata (file path, hash, size) in a PostgreSQL table so restoration can be verified
- For LGPD compliance: medical documents must be retained for 20 years (Lei 13.787/2018) — Supabase Storage is not a compliant long-term archive on its own

---

### M-3: Vercel Function Timeout — Report Generation and Bulk Operations
**Severity:** MEDIUM
**Phase:** Phase 2

**What goes wrong:**
The financial reconciliation module generates a monthly report aggregating all transactions for a clinic. For a clinic with 500 monthly appointments and 200 financial transactions, this query + PDF generation takes ~25 seconds. The Vercel Pro Function timeout is 60 seconds for standard functions (configurable up to 800s with Fluid Compute, but requires explicit config).

**Why it happens:**
Vercel serverless has hard timeouts. Without explicit `maxDuration` configuration, functions default to 10s (Hobby) or 60s (Pro). CPU-intensive operations like PDF generation, large data exports, or AI completions can easily exceed this.

**Prevention:**
```typescript
// vercel.json / vercel.ts
// Already planned in FYNXIA-ERP.md with maxDuration: 60 — good
// But for report generation, use background jobs instead:

// Route handler: accept the request, return a job ID immediately
export async function POST(request: Request) {
  const jobId = await queue.enqueue('generate-report', { tenantId, period })
  return Response.json({ jobId, status: 'processing' })
}

// Client polls job status or receives webhook notification when done
```
File uploads: Vercel has a 4.5MB body size limit by default. Dental radiography images are commonly 2-15MB. Use direct-to-Supabase-Storage uploads from the client (presigned URLs) rather than routing through a Vercel function.

---

### M-4: Missing LGPD Consent Audit Trail
**Severity:** MEDIUM
**Phase:** Phase 0 (schema) + Phase 1 (implementation)

**What goes wrong:**
The system collects patient CPF, health history, and contact data. When asked by ANPD or in a lawsuit: "Show me the consent record for patient X," the team cannot produce a timestamped, immutable record of what the patient consented to, when, and which version of the privacy policy was in effect.

**Why it happens:**
Teams implement a "I accept" checkbox and store a boolean `consent: true`. This is insufficient under LGPD. The law requires demonstrable consent — you must be able to prove what information was presented, when the user consented, and what they consented to.

**Prevention:**
```sql
CREATE TABLE patient_consents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  patient_id      UUID NOT NULL REFERENCES patients(id),
  consent_type    VARCHAR(50) NOT NULL, -- 'data_processing', 'marketing_whatsapp', 'medical_record_sharing'
  policy_version  VARCHAR(20) NOT NULL, -- e.g., '1.2'
  ip_address      INET,
  user_agent      TEXT,
  consented_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  revoked_at      TIMESTAMP,  -- NULL = still active
  UNIQUE(patient_id, consent_type, policy_version)
);
```
LGPD Article 8: consent must be "free, informed, unambiguous, and for a specific purpose." Healthcare data processing can also rely on "vital interest" or "healthcare treatment" legal bases (Article 11, II), but each use must have a documented legal basis.

---

### M-5: Supabase Auth — Missing `user_id` → `tenant_id` Link in `app_metadata`
**Severity:** MEDIUM
**Phase:** Phase 0

**What goes wrong:**
At user sign-up, the application creates a record in `public.users` with `tenant_id`. But the JWT issued by Supabase Auth does not contain the `tenant_id` claim. Every API request that needs to know the tenant must first query `public.users` to look up the `tenant_id`. This adds a round-trip query to every request, and if that query is not cached, it becomes a significant latency overhead.

**Prevention:**
Use a database trigger to embed `tenant_id` into the user's `app_metadata` when the `public.users` record is created:
```sql
CREATE OR REPLACE FUNCTION sync_tenant_to_auth()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data ||
    jsonb_build_object('tenant_id', NEW.tenant_id::text)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_user_created
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION sync_tenant_to_auth();
```
The `tenant_id` is now in the JWT as `app_metadata.tenant_id` — accessible in RLS policies as `(auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid` without a separate query.

---

### M-6: LGPD Dev/Test Environment Data Contamination
**Severity:** MEDIUM
**Phase:** Phase 0

**What goes wrong:**
Developer takes a production database dump to reproduce a bug locally. That dump contains real CPFs, names, phone numbers, and dental health records of real patients. The development database has no RLS, no access controls, and is accessible from the developer's laptop.

**Why it happens:**
The "fastest path to reproduce the bug" instinct overrides security discipline. In healthcare, this is a direct LGPD violation regardless of whether data is ever exfiltrated.

**Prevention:**
- Write a data anonymization script that runs on dumps before they leave production: replaces CPFs with synthetic CPFs, names with `Paciente {N}`, phones with `(00) 00000-{N}`, health history with generic data
- Use Supabase's staging project for QA — never production data in dev environments
- Add to engineering onboarding: "Never use real patient data outside of production" as a written policy (required for LGPD Article 37 compliance documentation)

---

### M-7: OpenAI/Anthropic API — Patient Data in AI Prompts
**Severity:** MEDIUM
**Phase:** Phase 3

**What goes wrong:**
The IA copilot feature constructs prompts including patient health history, treatment plans, and CPF to provide personalized suggestions. This data is transmitted to a US-based AI provider (OpenAI or Anthropic), potentially stored for model training, and subject to US law rather than LGPD.

**Why it happens:**
The most convenient way to build an AI copilot is to pass full context. Teams don't realize this constitutes international data transfer under LGPD Articles 33-36.

**Consequences:**
- LGPD Article 33 requires that international data transfers maintain "equivalent" protection level
- OpenAI's standard API does not sign Data Processing Agreements (DPAs) unless on enterprise tier
- Potential ANPD investigation if a patient complains about health data being processed in the US

**Prevention:**
- Never include CPF, full name, or direct patient identifiers in AI prompts — use internal UUIDs only
- Use patient health codes instead of narrative descriptions where possible
- Obtain explicit patient consent for AI-assisted processing (separate from general data consent)
- Evaluate using Vercel AI Gateway to strip/redact PII before forwarding to AI providers
- Consider Anthropic's Enterprise tier for a BAA/DPA equivalent

---

### M-8: Supabase Realtime Subscriptions — Memory Leak on Component Unmount
**Severity:** MEDIUM
**Phase:** Phase 1

**What goes wrong:**
The appointments calendar subscribes to real-time updates. The user navigates to the financial module. The calendar component unmounts but the Supabase channel subscription is never removed. The user opens 10 different pages, accumulating 10 open WebSocket channels. Memory usage grows, the page becomes sluggish, and sometimes the connection limit on the Supabase free tier (200 concurrent realtime connections) is reached.

**Prevention:**
```typescript
// In every component that subscribes to Supabase Realtime:
useEffect(() => {
  const channel = supabase
    .channel(`appointments:${tenantId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments',
        filter: `tenant_id=eq.${tenantId}` }, handler)
    .subscribe()

  return () => {
    supabase.removeChannel(channel) // CRITICAL: cleanup on unmount
  }
}, [tenantId])
```

---

## PHASE MAPPING

| Pitfall | ID | Phase | Priority |
|---------|----|-------|----------|
| RLS self-reference infinite recursion on users table | C-1 | Phase 0 | BLOCK — do not proceed without fix |
| Service role key exposed in client bundle | C-2 | Phase 0 | BLOCK — security audit before any deploy |
| `unstable_cache` cross-tenant data leak via closure | C-3 | Phase 0 (policy) + Phase 1 (review) | BLOCK — security review every cache usage |
| `getSession()` used for authorization | C-4 | Phase 0 | BLOCK — middleware template must use getUser() |
| `tenant_id` stored in mutable user_metadata | C-5 | Phase 0 | BLOCK — auth design decision |
| Connection pool exhaustion on Vercel serverless | C-6 | Phase 0 | BLOCK — configure pooler before load testing |
| RLS policy performance collapse | H-1 | Phase 0 (indexes) + Phase 1 (validate) | HIGH — create indexes before enabling RLS |
| Realtime channel public by default | H-2 | Phase 1 | HIGH — enforce before shipping calendar feature |
| `use client` boundary too high | H-3 | Phase 1 | HIGH — component architecture review |
| JWT refresh token race condition | H-4 | Phase 0 | HIGH — middleware template must be correct |
| Asaas webhook queue penalization | H-5 | Phase 2 | HIGH — async handler required from day one |
| LGPD erasure vs. audit log conflict | H-6 | Phase 0 (schema design) + Phase 1 (implement) | HIGH — decide before building patients module |
| WhatsApp template reclassification | H-7 | Phase 4 | HIGH — template design review before submission |
| Brazil multi-timezone scheduling | H-8 | Phase 1 | HIGH — TIMESTAMPTZ from first migration |
| Concurrent appointment double-booking | H-9 | Phase 1 | HIGH — exclusion constraint before scheduling goes live |
| Next.js fetch caching stale data | M-1 | Phase 1 | MEDIUM — review per route |
| Supabase Storage not backed up | M-2 | Phase 1 | MEDIUM — backup job before storing real data |
| Vercel function timeout for reports | M-3 | Phase 2 | MEDIUM — async job queue for reports |
| Missing LGPD consent audit trail | M-4 | Phase 0 (schema) + Phase 1 | MEDIUM — schema before patients module |
| tenant_id not in JWT app_metadata | M-5 | Phase 0 | MEDIUM — trigger at user creation |
| Dev/test environment data contamination | M-6 | Phase 0 | MEDIUM — policy + tooling before first real data |
| Patient PII in AI prompts | M-7 | Phase 3 | MEDIUM — prompt design review before AI launch |
| Realtime subscription memory leak | M-8 | Phase 1 | MEDIUM — code review checklist |

---

## PHASE-SPECIFIC WARNINGS

### Phase 0 — Foundation
The highest concentration of critical pitfalls is here. The RLS design, auth architecture, cache key strategy, and LGPD schema decisions made in Phase 0 are the hardest to change later. Do not rush Phase 0.

**Must complete before any feature code:**
1. Validate RLS policies with `SET ROLE authenticated; SET LOCAL request.jwt.claim.sub = 'test-user-uuid'; SELECT * FROM users;` — confirm no infinite recursion
2. Verify service role key is NOT in any `NEXT_PUBLIC_` variable
3. Set middleware to use `getUser()` not `getSession()`
4. Use `TIMESTAMPTZ` in all timestamp columns
5. Add `patient_consents` table to initial migration
6. Configure Supavisor connection pooler URL

### Phase 1 — MVP Clinical
Double-booking is the highest-risk Phase 1 failure. Ship the exclusion constraint to production before allowing any concurrent access to the booking UI. Real-time isolation must be verified in a multi-tenant test (create two test clinics and confirm subscriptions are isolated).

### Phase 2 — MVP Financial
All payment webhooks must be async from day one. Test the Asaas webhook handler by having it deliberately timeout and confirm the queue penalization behavior — understand recovery before it happens in production.

### Phase 3 — AI and Automation
Before the AI copilot goes to any real user, conduct a prompt audit: log 100 sample prompts and verify no CPF, patient full name, or health record content is being sent to OpenAI/Anthropic.

### Phase 4 — Expansion (WhatsApp, CRM)
Prepare WhatsApp templates 2-4 weeks before the feature launch. Template approval can take 7-14 days. Keep utility and marketing templates completely separate. Never launch a WhatsApp integration on Evolution API or other unofficial tooling — a permanent number ban at scale is unrecoverable.

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Supabase RLS pitfalls | HIGH | Supabase official docs, GitHub issues with exact reproduction steps |
| Next.js App Router pitfalls | HIGH | Vercel official blog, Next.js docs, CVE advisories |
| Vercel serverless limits | HIGH | Vercel official documentation (limits, functions/limitations) |
| JWT/Auth race conditions | HIGH | Supabase auth-js GitHub issues with confirmed reproduction |
| Connection pooling | HIGH | Vercel engineering blog, Supabase Supavisor docs |
| LGPD healthcare compliance | MEDIUM | ANPD official sources, Brazilian legal analysis; specific ANPD enforcement precedents for dental ERPs are limited |
| CFO record retention (20 years) | MEDIUM | Lei 13.787/2018 confirmed, older CFO Opinion 125/92 also found; legal counsel recommended for definitive interpretation |
| Asaas webhook pitfalls | MEDIUM | Official Asaas docs confirmed; edge cases around reconciliation failures are inferred from general payment patterns |
| WhatsApp template pitfalls | MEDIUM | Meta official developer docs, 2025 policy changes confirmed |
| Double-booking concurrency | HIGH | Standard PostgreSQL concurrency control, confirmed with exclusion constraint pattern |
| Timezone handling | HIGH | Brazil DST abolition (2019) confirmed, 4 timezone regions confirmed |

---

## Sources

- Supabase RLS Performance and Best Practices: https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv
- Supabase RLS Infinite Recursion: https://github.com/orgs/supabase/discussions/1138
- Supabase auth-js Security Issue (getUser vs getSession): https://github.com/supabase/auth-js/issues/898
- Supabase auth-js Refresh Token Race Condition: https://github.com/supabase/supabase/issues/18981
- Vercel Common Mistakes with Next.js App Router: https://vercel.com/blog/common-mistakes-with-the-next-js-app-router-and-how-to-fix-them
- Vercel Functions Limitations: https://vercel.com/docs/functions/limitations
- Vercel Connection Pooling: https://vercel.com/blog/the-real-serverless-compute-to-database-connection-problem-solved
- Next.js Cache Poisoning CVE-2024-46982: https://github.com/advisories/GHSA-gp8f-8m3g-qvj9
- Asaas Webhook Documentation: https://docs.asaas.com/docs/about-webhooks
- Asaas Idempotency: https://docs.asaas.com/docs/how-to-implement-idempotence-in-webhooks
- Asaas Queue Penalization: https://docs.asaas.com/docs/webhooks-queue-paused
- WhatsApp Business API Rate Limits 2025: https://www.wasenderapi.com/blog/whatsapp-api-rate-limits-explained-how-to-scale-messaging-safely-in-2025
- WhatsApp Messaging Limits (Meta official): https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits
- LGPD Data Protection Laws Brazil 2025-2026: https://iclg.com/practice-areas/data-protection-laws-and-regulations/brazil/
- LGPD Healthcare Compliance: https://medium.com/medical-informatics-review/the-lgpd-brazilian-general-data-protection-law-and-data-protection-in-health-information-systems-76a4b71cc4f3
- Brazil Dental Record Retention (Lei 13.787/2018): https://www.jusbrasil.com.br/artigos/por-quanto-tempo-guardar-o-prontuario-odontologico/1293908995
- Multi-Tenant RLS Failure Patterns: https://medium.com/@instatunnel/multi-tenant-leakage-when-row-level-security-fails-in-saas-da25f40c788c
- Supabase Service Role Key Security: https://vibeappscanner.com/security-issue/supabase-exposed-api-keys
- Brazil Timezone Information: https://dev.to/arthurmde/the-bolsonaro-s-bug-the-end-of-daylight-saving-time-in-brazil-may-affect-your-system-2e38
