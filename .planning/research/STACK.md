# Technology Stack: FYNXIA Dental ERP SaaS

**Project:** FYNXIA — Multi-Tenant Dental ERP SaaS (Brazil)
**Researched:** 2026-06-02
**Overall Confidence:** HIGH (verified via official docs + multiple sources)

---

## Core Framework Configuration

### Next.js: Stay on 14 or Upgrade to 15?

**Recommendation: Upgrade to Next.js 15 for new work; stabilize on 15.x before first client goes live.**

Next.js 15 became stable and is the current production default. Key reasons to upgrade from 14:

- **Fluid Compute is default on new projects** — requires no configuration
- **`use cache` directive** replaces fragmented `unstable_cache` + `fetch` caching options with a single ergonomic API
- **Turbopack stable in dev** — 5-10x faster HMR (meaningful in large ERP codebases)
- **React 19 support** — required for future compiler optimizations
- **Caching opt-in by default** — Next.js 15 reverses 14's aggressive auto-caching, which caused stale-data bugs in ERP contexts where freshness matters

Migration from 14 to 15 is estimated at 4-8 hours for a medium-sized app and can be done with automated codemods. The caching model change is the most significant break; ERP apps benefit since data must always reflect the current state.

**Version to target:** `next@15` (latest stable, currently 15.x)

### TypeScript Configuration

```json
// tsconfig.json — recommended for strictness in ERP context
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

`noUncheckedIndexedAccess` catches array/record access bugs that surface in data-heavy ERP tables. **Confidence: HIGH**

---

## Database & Auth (Supabase Patterns)

### Package Versions

| Package | Version | Purpose |
|---------|---------|---------|
| `@supabase/supabase-js` | v2 (latest) | Core client |
| `@supabase/ssr` | latest | Next.js SSR auth integration |
| `supabase` CLI | latest | Migrations, local dev, type gen |

**Do NOT use `@supabase/auth-helpers-nextjs`** — deprecated. The `@supabase/ssr` package is the current standard. All official Supabase docs now reference `@supabase/ssr`.

### Client Architecture (Three Clients)

```
utils/supabase/
  server.ts      ← createServerClient()  — Server Components, Server Actions, Route Handlers
  client.ts      ← createBrowserClient() — Client Components only
  middleware.ts  ← createServerClient()  — Session refresh middleware
```

Middleware MUST call `supabase.auth.getUser()` on every request to keep the session cookie fresh. Skipping this causes silent auth expiry bugs in long ERP sessions.

### Multi-Tenant RLS Strategy

**Recommendation: Shared schema with RLS + JWT custom claims.** Do not use separate schemas until you have 50+ large clinic tenants or explicit HIPAA/compliance contractual requirements.

**Why shared schema wins for FYNXIA at launch:**
- Simpler migrations (one schema change, not N tenant schemas)
- Supabase dashboard tooling works cleanly
- RLS enforces isolation at the database level without application filtering
- PostgreSQL RLS is a mature, battle-tested isolation primitive

**Core pattern — every table gets `clinic_id`:**

```sql
-- Every tenant-scoped table
ALTER TABLE patients ADD COLUMN clinic_id UUID NOT NULL 
  REFERENCES clinics(id) ON DELETE CASCADE;

CREATE INDEX idx_patients_clinic_id ON patients(clinic_id);

-- RLS policy pattern
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON patients
  USING (clinic_id = (auth.jwt() ->> 'clinic_id')::uuid)
  WITH CHECK (clinic_id = (auth.jwt() ->> 'clinic_id')::uuid);
```

**JWT Custom Claims via Auth Hook (Edge Function):**

```sql
-- Supabase Auth Hook: add clinic_id to every JWT
CREATE OR REPLACE FUNCTION public.custom_jwt_claims(event jsonb)
RETURNS jsonb AS $$
DECLARE
  claims jsonb;
  user_clinic_id uuid;
BEGIN
  SELECT clinic_id INTO user_clinic_id 
  FROM public.clinic_users WHERE user_id = (event->>'userId')::uuid;
  
  claims := event->'claims';
  claims := jsonb_set(claims, '{clinic_id}', to_jsonb(user_clinic_id));
  RETURN jsonb_set(event, '{claims}', claims);
END;
$$ LANGUAGE plpgsql;
```

**Critical rules:**
1. Index `clinic_id` on every tenant-scoped table — RLS runs on every query, missing indexes kill performance
2. Always use `WITH CHECK` in policies, not just `USING` — prevents cross-tenant inserts
3. Never bypass RLS with the service role key in client-facing code — only use service role in trusted server-side contexts (webhooks, background jobs)
4. Test RLS with a second test account in a different clinic before each deployment

**Confidence: HIGH** (official Supabase docs + makerkit.dev production patterns)

### Supabase Region

**Deploy Supabase project to `sa-east-1` (São Paulo, Brazil).**

Supabase launched the AWS São Paulo region in early 2025. For a Brazil-first dental SaaS, this is mandatory — cross-region latency between your functions and database can add 300-600ms per query, which is fatal for an ERP with 50+ queries per page load.

**Vercel function region must also be set to `gru1` (São Paulo)** in `vercel.json`:

```json
{
  "regions": ["gru1"]
}
```

Mismatched regions (Vercel in `iad1` Washington + Supabase in São Paulo) is the #1 performance mistake for Brazilian SaaS deployments.

---

## UI Component Strategy

### Core UI Stack

| Package | Version | Purpose |
|---------|---------|---------|
| `shadcn/ui` | latest CLI | Component primitives |
| `@radix-ui/*` | latest (pulled by shadcn) | Accessible primitives |
| `tailwindcss` | v4 | Styling |
| `class-variance-authority` | latest | Component variant management |
| `clsx` + `tailwind-merge` | latest | Conditional classname utility |
| `lucide-react` | latest | Icon set |

**Tailwind CSS v4 note:** Tailwind v4 is out and uses a new CSS-first config (`@config` in CSS, not `tailwind.config.js`). shadcn/ui updated its CLI to support v4. If starting fresh in 2026, use v4. If migrating from v3, defer until a dedicated sprint. **Confidence: MEDIUM** (v4 was recently released; check shadcn/ui changelog for latest compatibility notes)

### Data Tables (ERP Core Component)

**Use TanStack Table v8 + shadcn/ui Table primitives.** This is the de facto standard for ERP dashboards in 2025/2026.

Required companion libraries for production ERP tables:

| Library | Purpose |
|---------|---------|
| `@tanstack/react-table` v8 | Headless table logic |
| `nuqs` | URL-based state for filters, sort, pagination |
| `zustand` | Client-side selection state (bulk actions) |

**URL state via `nuqs` is non-negotiable for ERP tables.** Filters, sort direction, and page number MUST live in the URL so:
- Links to filtered views can be shared (e.g., "show unpaid patients this month")
- Browser back/forward works correctly
- Bookmarks work

```typescript
// Pattern: server-side filtering with nuqs
import { createSearchParamsCache, parseAsInteger, parseAsString } from 'nuqs/server'

export const searchParamsCache = createSearchParamsCache({
  page: parseAsInteger.withDefault(1),
  status: parseAsString.withDefault('all'),
  search: parseAsString.withDefault(''),
})
```

`nuqs` is 6kB gzipped and featured at Next.js Conf 2025. **Confidence: HIGH**

### Calendar / Date Picker Components

shadcn/ui's built-in Calendar component was upgraded with React DayPicker and 30+ calendar blocks in June 2025. Use it for:
- Date of birth pickers
- Payment due date selection
- Single/range date filters

For the appointment scheduling calendar (week view, multiple dentist columns), see the Scheduling section below.

---

## State Management

### Recommendation: TanStack Query v5 + Zustand + nuqs

Do NOT use a single state manager for everything. Use the right tool per concern:

| Concern | Solution | Rationale |
|---------|----------|-----------|
| Server data (patients, appointments, billing) | TanStack Query v5 | Cache, deduplication, background sync |
| Realtime Supabase events | Supabase Realtime → `invalidateQueries` | Clean separation |
| URL-persisted filters/pagination | nuqs | Shareable, bookmarkable, RSC-compatible |
| Client-only transient UI state (modals, sidebars, selection) | Zustand | Minimal, no provider boilerplate |
| Form state | React Hook Form | Do not put form state in global stores |

**Why TanStack Query over SWR for FYNXIA:**

1. Supabase Realtime delivers change events, not full snapshots — TanStack Query's `invalidateQueries` is the cleanest bridge
2. `@tanstack/react-query` DevTools are essential for debugging cache behavior in complex ERP workflows
3. Superior TypeScript generics for typed query/mutation patterns
4. `supabase-cache-helpers` library (by psteinroe) explicitly targets TanStack Query + Supabase, providing automatic cache key generation and implicit invalidation — eliminates manual cache management

```typescript
// Pattern: Supabase Realtime → TanStack Query invalidation
useEffect(() => {
  const channel = supabase
    .channel('appointments')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' },
      () => queryClient.invalidateQueries({ queryKey: ['appointments'] })
    )
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}, [queryClient])
```

**`supabase-cache-helpers` package:** Use this to eliminate the above boilerplate entirely. It auto-generates query keys from PostgREST queries and invalidates cache on mutations automatically.

**Confidence: HIGH** (TanStack Query v5 + Supabase integration patterns verified via official Supabase blog + makerkit.dev)

---

## Form & Validation

### Stack: React Hook Form v7 + Zod + @hookform/resolvers v5

| Package | Version | Note |
|---------|---------|------|
| `react-hook-form` | v7 (latest) | Form state management |
| `zod` | v3.x or v4.x | Schema validation |
| `@hookform/resolvers` | v5.2.0+ | Bridge between RHF and Zod |

**Critical Zod v4 Compatibility Warning:**

Zod v4 was released in 2025 with significant internal type changes. `@hookform/resolvers` v5.2.0 added official Zod v4 support, but there are ongoing edge-case issues (branded version mismatches in `v4.3.x`, module resolution errors in some bundler configs). 

**Safest choice for production today:** Use **Zod v3** with `@hookform/resolvers` v5.x — it is fully stable, and the API is identical for 95% of use cases. Migrate to Zod v4 once `@hookform/resolvers` v5.x stabilizes its Zod v4 support (watch the resolvers releases page).

If you choose Zod v4, use the `zod/v4` import path and ensure you are on `@hookform/resolvers` >= 5.2.0.

**Pattern: shared schemas for client + server validation:**

```typescript
// schemas/patient.ts — shared between form and Server Action
export const patientSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  cpf: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, 'CPF inválido'),
  telefone: z.string().min(10, 'Telefone inválido'),
  plano_saude: z.string().optional(),
})

export type PatientInput = z.infer<typeof patientSchema>

// Server Action — re-validate on server with same schema
export async function createPatient(data: PatientInput) {
  const parsed = patientSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.format() }
  // ... persist
}
```

The key benefit: one schema, validated in both browser (instant feedback) and server (security). **Confidence: HIGH**

---

## PDF / Document Generation

### Recommendation: `@react-pdf/renderer` v4.x (NOT Puppeteer)

**Verdict: Never use Puppeteer on Vercel.** The Chromium binary is ~100MB; Vercel's function size limit is 50MB. It cannot be deployed without complex workarounds (`@sparticuz/chromium`) that are brittle, slow (3-5s cold start), and expensive.

`@react-pdf/renderer` v4.5.1 is the current version (860K+ weekly downloads, 15.9K GitHub stars as of 2025). It:
- Runs natively in Node.js serverless functions (< 2MB bundle)
- Generates PDFs in under 500ms
- Uses JSX/React component model — familiar for the team
- Supports custom fonts (embed a Latin Extended font for full Brazilian Portuguese character support)

**What it cannot do (design accordingly):**
- CSS Grid (use Flexbox layouts only)
- Pseudo-selectors
- HTML-to-PDF conversion (it is a PDF authoring library, not an HTML renderer)

```typescript
// Route Handler: /api/documents/receipt/[id]/route.ts
import { renderToBuffer } from '@react-pdf/renderer'
import { ReceiptDocument } from '@/components/pdf/ReceiptDocument'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const data = await fetchReceiptData(params.id)
  const pdf = await renderToBuffer(<ReceiptDocument data={data} />)
  
  return new Response(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="recibo-${params.id}.pdf"`,
    },
  })
}
```

**Font recommendation for Brazilian Portuguese:** Embed `Roboto` or `Noto Sans` (both include full Latin Extended character sets including ã, ç, ê, ó, ú). Register fonts in a shared PDF config module.

**Confidence: HIGH** (Vercel size constraints are documented; @react-pdf/renderer production comparison verified via DEV Community article)

---

## Scheduling / Calendar

### Recommendation: FullCalendar Premium (Scheduler) for appointment views

For the core dental appointment booking view (dentist columns, time slots, drag-drop), **FullCalendar Scheduler** is the strongest choice:

- Resource (dentist/chair) column views — essential for multi-provider dental scheduling
- Drag-and-drop rescheduling
- React integration via `@fullcalendar/react`
- 19K+ GitHub stars, 1M+ weekly npm downloads
- Active development and maintenance

**Licensing:** FullCalendar Premium/Scheduler requires a commercial license for production use (~$500/year per project). This is a hard requirement — the MIT license only covers the non-premium plugins. Budget this in the infrastructure cost estimate.

**Required packages:**

```bash
npm install @fullcalendar/react @fullcalendar/core @fullcalendar/daygrid \
  @fullcalendar/timegrid @fullcalendar/resource-timegrid \
  @fullcalendar/interaction @fullcalendar/list
```

**Alternative if cost is a blocker:** `react-big-calendar` (MIT, free) supports week/day views and drag-drop but lacks true multi-resource column views without custom hacking. Acceptable for MVP if each dentist has their own calendar view; not acceptable if you need a side-by-side multi-dentist view on one screen.

For secondary date/time inputs (appointment creation form), use shadcn/ui's built-in Calendar + `react-day-picker` (already a shadcn dependency).

**Confidence: HIGH** (FullCalendar official docs + licensing page verified)

---

## Payment Integration

### Asaas (Primary — Brazilian Patients)

**Recommendation: REST API directly, not third-party SDKs.**

The unofficial SDKs on GitHub (`asaas-node-sdk`, `asaas-js-sdk`) are community-maintained with limited activity. The official Asaas SDK listed in their docs is thin. For a production ERP where payment reliability is critical, wrap the REST API yourself with typed fetch wrappers.

**Why REST over SDK:**
- Official docs are REST-first; SDK docs are thin
- You control error handling, retry logic, and TypeScript types
- Webhooks require your own endpoint regardless — SDK adds no value there
- Total API surface is manageable (~15-20 endpoints you'll actually use)

**Payment methods supported:**
- PIX (instant, most common in Brazil — 40%+ of online transactions)
- Boleto bancário (PDF boleto, 3-5 business day settlement)
- Cartão de crédito (card, via tokenization)

**Integration architecture:**

```
Client → Server Action → Asaas REST API (create charge)
Asaas → /api/webhooks/asaas → verify token header → update DB
```

**Webhook security:** Asaas sends an `asaas-access-token` header with every webhook. Verify this before processing. Configure the token in the Asaas dashboard and store it in environment variables.

**Idempotency:** Asaas webhooks guarantee "at least once" delivery. Build your webhook handler to be idempotent (check if payment already processed before updating status).

**Sandbox:** Asaas provides a full sandbox environment at `sandbox.asaas.com` — use it throughout development. Keep sandbox/production keys strictly separated via environment variables.

**Confidence: HIGH** (verified via official Asaas developer docs)

### Stripe (International / SaaS Subscription Billing)

**Use Stripe for:** FYNXIA's own subscription billing (clinic pays monthly SaaS fee), not for patient payments.

- PIX via Stripe now available in Brazil (launched via EBANX partnership, 2025) — available for customers with Brazilian Stripe accounts
- `Pix Automático` enables recurring payment mandates (relevant for subscription billing via PIX)
- Use Stripe Billing for subscription management (plans, trials, upgrades, invoices)

```bash
npm install stripe @stripe/stripe-js
```

**Pattern:** Use Stripe Checkout or Stripe Billing Portal for self-serve subscription management. Don't build custom billing UI — Stripe's hosted pages handle locale, PIX QR codes, and compliance.

**Confidence: HIGH** (Stripe Pix docs verified via official Stripe documentation, April 2025 changelog)

---

## Messaging

### WhatsApp: Meta Cloud API (Official)

**Do NOT use Evolution API or Baileys-based unofficial clients in production.**

Evolution API violates WhatsApp's Terms of Service by emulating the WhatsApp Web protocol. For a healthcare SaaS with patient data, number banning by Meta is an existential risk — all appointment reminders stop instantly with no warning.

**Use Meta's official WhatsApp Cloud API:**
- Official Node.js SDK: `@whatsapp/api-js` (or use the REST API directly)
- Per-conversation pricing (utility messages ~€0.03-0.05 for Brazil)
- Template messages required for outbound messages (appointment reminders, payment confirmations)
- No phone number ban risk
- LGPD-compliant data handling path

**Key message templates for dental ERP:**
- Appointment reminder (utility category — lower cost)
- Payment confirmation (utility category)
- Payment due reminder (utility category)
- Appointment confirmation request with quick-reply buttons

**Setup requirement:** Meta Business verification required (~1-2 weeks). Plan this into the launch timeline.

**Confidence: HIGH** (Meta official docs + comparative analysis of Terms of Service risks)

### Email: Resend + React Email

**Use Resend over SendGrid** for FYNXIA.

Reasons:
- SendGrid killed its free tier in mid-2025 (now starts at $19.95/month)
- Resend's free tier: 3,000 emails/month — sufficient for early clinics
- Resend is built for React/Next.js teams: native `react-email` template support
- React Email lets you build email templates as React components with TypeScript — same DX as the rest of the app
- Resend's API is simpler and better documented for developers

```bash
npm install resend react-email @react-email/components
```

**Pattern:**

```typescript
// emails/AppointmentReminder.tsx — React Email template
import { Html, Body, Text, Button } from '@react-email/components'

export function AppointmentReminderEmail({ patientName, date, dentist }) {
  return (
    <Html><Body>
      <Text>Olá {patientName}, sua consulta está marcada para {date} com {dentist}.</Text>
      <Button href="...">Confirmar Consulta</Button>
    </Body></Html>
  )
}

// Server Action / Route Handler
import { Resend } from 'resend'
const resend = new Resend(process.env.RESEND_API_KEY)

await resend.emails.send({
  from: 'noreply@fynxia.com.br',
  to: patient.email,
  subject: 'Lembrete de consulta',
  react: <AppointmentReminderEmail {...data} />,
})
```

**Confidence: HIGH** (SendGrid pricing change confirmed, Resend official docs verified)

---

## Deployment & Infrastructure

### Vercel Configuration

**Function Runtime: Fluid Compute (Node.js), NOT Edge Runtime**

Fluid Compute has been default on new Vercel projects since April 23, 2025. Key reasons to use it over Edge for FYNXIA:

| Concern | Fluid Compute (Node.js) | Edge Runtime |
|---------|------------------------|--------------|
| Database queries (Supabase) | Full Node.js TCP connections | No `net` module — requires HTTP only |
| PDF generation | Full `@react-pdf/renderer` support | Cannot run in Edge |
| Cold starts | Mitigated by bytecode caching (Node 20+) + in-function concurrency | Near-zero but feature-limited |
| Bundle size | No 1MB limit | Hard 1MB limit |
| Brazil latency | `gru1` region, close to Supabase SA | Global distribution but Supabase still in SA |
| Execution time | Up to 800s on Pro | 30s max |

Edge Runtime is appropriate ONLY for: middleware (auth checks, redirects), geolocation routing, A/B testing headers. Nothing with database access or heavy computation.

**`vercel.json` configuration:**

```json
{
  "regions": ["gru1"],
  "fluid": true,
  "functions": {
    "app/api/**": {
      "maxDuration": 30
    },
    "app/api/documents/**": {
      "maxDuration": 60
    }
  }
}
```

**Pricing note:** `gru1` region is available to Pro plan users. Managed Infrastructure in São Paulo requires a Vercel Pro subscription (~$20/month). This is required for a Brazil-first app — do not deploy to Washington (`iad1`) to save money.

### Supabase Configuration

- **Region:** `sa-east-1` (São Paulo) — mandatory for latency
- **Database password:** Rotate immediately after project creation; store in Vercel environment variables, never in code
- **Connection pooling:** Enable Supabase's built-in PgBouncer connection pooler for Vercel serverless (each function invocation creates a new connection — pooler prevents connection exhaustion)
- **Type generation:** Run `supabase gen types typescript` in CI to keep DB types in sync
- **Migrations:** Use `supabase/migrations/` folder + `supabase db push` in CI. Never use the Supabase dashboard for schema changes in production.

### Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # Server-side only, NEVER expose to client

# Asaas
ASAAS_API_KEY=
ASAAS_WEBHOOK_TOKEN=
ASAAS_BASE_URL=              # https://api.asaas.com or https://sandbox.asaas.com

# Stripe
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# Resend
RESEND_API_KEY=

# WhatsApp
META_WHATSAPP_TOKEN=
META_PHONE_NUMBER_ID=
META_WEBHOOK_VERIFY_TOKEN=
```

---

## What NOT to Use (Anti-Patterns)

### Framework & Core

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@supabase/auth-helpers-nextjs` | Deprecated since 2024 | `@supabase/ssr` |
| Pages Router for new features | Dead-end; no Server Components, no Server Actions | App Router exclusively |
| Edge Runtime for DB-touching API routes | No TCP connections; Supabase requires TCP | Fluid Compute / Node.js runtime |
| `getServerSideProps` / `getStaticProps` | Pages Router patterns | Server Components + Server Actions |
| `next/headers` in Client Components | Server-only API; will throw | Use in Server Components/Actions only |

### State Management

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Redux / Redux Toolkit | Massive boilerplate; overkill for SaaS dashboard | TanStack Query + Zustand |
| React Context for server data | Causes prop-drilling to re-emerge, re-render cascades | TanStack Query |
| Storing server data in Zustand | Creates stale data; bypasses cache invalidation | TanStack Query |
| `useState` for URL-persistent filters | Breaks browser history and deep links | nuqs |
| SWR | No DevTools; weaker TypeScript generics; TanStack Query is superior for Supabase | TanStack Query v5 |

### Database & Auth

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Storing auth tokens in `localStorage` | XSS-accessible; session hijacking risk | HTTP-only cookies via `@supabase/ssr` |
| Using service role key client-side | Bypasses ALL RLS; catastrophic data leak | Anon key client-side; service key server-only |
| RLS policies without indexes on `clinic_id` | Table scans on every row for every query; destroys performance | Index every `clinic_id` column |
| Skipping `WITH CHECK` in RLS policies | Users can insert data into other tenants | Always pair `USING` with `WITH CHECK` |
| Separate database per tenant at launch | Operational complexity explosion; no tooling justification until scale | Shared schema with RLS |

### PDF Generation

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Puppeteer / Playwright on Vercel | Chromium binary (~100MB) exceeds Vercel's 50MB function limit | `@react-pdf/renderer` |
| `html2pdf.js` / `jsPDF` client-side | PDFs generated in browser; no server-side generation for archival | `@react-pdf/renderer` on server |
| CSS Grid in `@react-pdf/renderer` layouts | Not supported by the library | Flexbox only |

### Messaging

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Evolution API / Baileys | Violates WhatsApp ToS; risk of permanent number ban in production | Meta WhatsApp Cloud API |
| SendGrid | Killed free tier mid-2025; $19.95/month minimum; no React Email | Resend + react-email |
| Sending WhatsApp messages without approved templates | Meta blocks non-template outbound messages outside 24h windows | Register all templates before launch |

### Payment

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Third-party Asaas SDKs (community) | Low maintenance, limited TypeScript, no official support | Direct REST API with typed wrappers |
| Stripe for patient payments at small clinics | Stripe Brazil requires local entity; Asaas is PIX/Boleto native | Asaas for patient billing |
| Processing webhooks without idempotency | Duplicate payment events create double-credits | Check payment status before updating DB |
| Storing raw card numbers | PCI DSS violation | Asaas/Stripe tokenization only |

### Deployment

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Deploying to `iad1` (Washington) with Supabase in SA | 200-600ms added latency per DB query | `gru1` (São Paulo) for both |
| Vercel Hobby plan for production | No `gru1` region; no SLA; no team access | Pro plan minimum |
| Committing `.env` files | Credential exposure | Vercel environment variables UI |
| Running schema changes via Supabase dashboard in prod | No version control; no rollback | `supabase/migrations/` + CI |

---

## Complete Package Reference

### Production Dependencies

```bash
# Framework
npm install next@15 react@19 react-dom@19

# Supabase
npm install @supabase/supabase-js @supabase/ssr

# UI
npx shadcn@latest init
npm install @tanstack/react-table lucide-react

# State / Data
npm install @tanstack/react-query @tanstack/react-query-devtools
npm install zustand nuqs
npm install @supabase/cache-helpers-postgrest  # (from supabase-cache-helpers)

# Forms & Validation
npm install react-hook-form @hookform/resolvers zod

# PDF Generation
npm install @react-pdf/renderer

# Calendar / Scheduling
npm install @fullcalendar/react @fullcalendar/core @fullcalendar/daygrid \
  @fullcalendar/timegrid @fullcalendar/resource-timegrid \
  @fullcalendar/interaction @fullcalendar/list

# Email
npm install resend react-email @react-email/components

# Payments
npm install stripe @stripe/stripe-js
# Note: No Asaas package — use REST API directly
```

### Dev Dependencies

```bash
npm install -D \
  typescript @types/react @types/node \
  eslint eslint-config-next \
  prettier prettier-plugin-tailwindcss \
  supabase  # CLI for migrations + type generation
```

---

## Confidence Summary

| Area | Confidence | Basis |
|------|------------|-------|
| Next.js 15 + App Router | HIGH | Official docs + makerkit.dev production patterns |
| Supabase SSR patterns | HIGH | Official @supabase/ssr docs |
| Supabase RLS multi-tenant | HIGH | Official Supabase docs + multiple production case studies |
| TanStack Query v5 | HIGH | Official docs + Supabase blog integration guide |
| Zod v4 + RHF compatibility | MEDIUM | Active issues on GitHub; v3 is safer for now |
| @react-pdf/renderer on Vercel | HIGH | Verified size constraints + production comparison article |
| FullCalendar Scheduler licensing | HIGH | Official FullCalendar license page |
| Asaas REST API patterns | HIGH | Official Asaas docs verified |
| Stripe PIX Brazil | HIGH | Official Stripe docs + April 2025 changelog |
| Meta WhatsApp Cloud API | HIGH | Official Meta docs |
| Resend over SendGrid | HIGH | SendGrid free tier removal confirmed |
| Vercel gru1 region | HIGH | Official Vercel regions docs |
| Supabase SA-East-1 | HIGH | Supabase January 2025 changelog |
| Fluid Compute default | HIGH | Official Vercel docs (default since April 23, 2025) |
| Tailwind v4 + shadcn | MEDIUM | Recently released; verify shadcn/ui changelog for current v4 support status |

---

## Sources

- [Next.js App Router Docs](https://nextjs.org/docs/app)
- [Next.js Server Actions Guide](https://nextjs.org/docs/app/guides/forms)
- [Supabase SSR Next.js Setup](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Available Regions](https://supabase.com/docs/guides/platform/regions)
- [Vercel Fluid Compute](https://vercel.com/docs/fluid-compute)
- [Vercel Regions — gru1 São Paulo](https://vercel.com/docs/pricing/regional-pricing/gru1)
- [TanStack Query v5 Docs](https://tanstack.com/query/v5/docs/framework/react/comparison)
- [Using React Query with Next.js App Router and Supabase Cache Helpers](https://supabase.com/blog/react-query-nextjs-app-router-cache-helpers)
- [supabase-cache-helpers GitHub](https://github.com/psteinroe/supabase-cache-helpers)
- [nuqs — Type-safe URL state](https://nuqs.dev/)
- [nuqs at Next.js Conf 2025](https://nextjs.org/conf/session/type-safe-url-state-in-nextjs-with-nuqs)
- [@hookform/resolvers Releases](https://github.com/react-hook-form/resolvers/releases)
- [PDF Generation: Puppeteer vs @react-pdf/renderer](https://dev.to/iurii_rogulia/pdf-generation-on-the-server-puppeteer-vs-react-pdfrenderer-a-production-comparison-44cg)
- [FullCalendar Premium License](https://fullcalendar.io/license)
- [FullCalendar React Docs](https://fullcalendar.io/docs/react)
- [Asaas API Documentation](https://docs.asaas.com/)
- [Asaas Webhook Documentation](https://docs.asaas.com/docs/about-webhooks)
- [Stripe Pix Brazil](https://docs.stripe.com/payments/pix)
- [Stripe Pix in Payment Method Configurations (April 2025)](https://docs.stripe.com/changelog/basil/2025-04-30/add_pix_to_payment_method_configuration)
- [Meta WhatsApp Cloud API Node.js SDK](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/)
- [Resend vs SendGrid 2026](https://nuntly.com/versus/resend-vs-sendgrid)
- [Why Use Next.js for SaaS (makerkit.dev)](https://makerkit.dev/blog/tutorials/why-you-should-use-nextjs-saas)
- [Supabase RLS Best Practices (makerkit.dev)](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)
