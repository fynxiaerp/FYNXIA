<!-- GSD:project-start source:PROJECT.md -->
## Project

**FYNXIA ERP Odontológico**

FYNXIA é um ERP SaaS multi-tenant para clínicas odontológicas que unifica gestão clínica (agenda, prontuário, odontograma), gestão financeira (fluxo de caixa, faturamento, conciliação) e automação por IA (copiloto contextual e agentes autônomos). Destinado a dentistas, recepcionistas e administradores de clínicas e redes de franquias no Brasil.

**Core Value:** Um dentista deve conseguir ver a agenda do dia, registrar atendimento e fechar o caixa — tudo em menos de 3 cliques por etapa, com dados protegidos por LGPD.

### Constraints

- **Tech Stack**: Next.js 14 + TypeScript + Supabase + Vercel — decisão tomada, não renegociar
- **Segurança**: LGPD obrigatório — RLS, soft delete, audit trail, mascaramento de dados sensíveis
- **Performance**: Latência < 200ms, 1.000+ usuários simultâneos
- **Pagamentos**: Asaas (primário, BR) + Stripe (secundário) — ambos necessários
- **Comunicação**: WhatsApp Business API + SendGrid/Resend (e-mail)
- **Disponibilidade**: 99,9% uptime — Supabase + Vercel garantem
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Core Framework Configuration
### Next.js: Stay on 14 or Upgrade to 15?
- **Fluid Compute is default on new projects** — requires no configuration
- **`use cache` directive** replaces fragmented `unstable_cache` + `fetch` caching options with a single ergonomic API
- **Turbopack stable in dev** — 5-10x faster HMR (meaningful in large ERP codebases)
- **React 19 support** — required for future compiler optimizations
- **Caching opt-in by default** — Next.js 15 reverses 14's aggressive auto-caching, which caused stale-data bugs in ERP contexts where freshness matters
### TypeScript Configuration
## Database & Auth (Supabase Patterns)
### Package Versions
| Package | Version | Purpose |
|---------|---------|---------|
| `@supabase/supabase-js` | v2 (latest) | Core client |
| `@supabase/ssr` | latest | Next.js SSR auth integration |
| `supabase` CLI | latest | Migrations, local dev, type gen |
### Client Architecture (Three Clients)
### Multi-Tenant RLS Strategy
- Simpler migrations (one schema change, not N tenant schemas)
- Supabase dashboard tooling works cleanly
- RLS enforces isolation at the database level without application filtering
- PostgreSQL RLS is a mature, battle-tested isolation primitive
### Supabase Region
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
### Data Tables (ERP Core Component)
| Library | Purpose |
|---------|---------|
| `@tanstack/react-table` v8 | Headless table logic |
| `nuqs` | URL-based state for filters, sort, pagination |
| `zustand` | Client-side selection state (bulk actions) |
- Links to filtered views can be shared (e.g., "show unpaid patients this month")
- Browser back/forward works correctly
- Bookmarks work
### Calendar / Date Picker Components
- Date of birth pickers
- Payment due date selection
- Single/range date filters
## State Management
### Recommendation: TanStack Query v5 + Zustand + nuqs
| Concern | Solution | Rationale |
|---------|----------|-----------|
| Server data (patients, appointments, billing) | TanStack Query v5 | Cache, deduplication, background sync |
| Realtime Supabase events | Supabase Realtime → `invalidateQueries` | Clean separation |
| URL-persisted filters/pagination | nuqs | Shareable, bookmarkable, RSC-compatible |
| Client-only transient UI state (modals, sidebars, selection) | Zustand | Minimal, no provider boilerplate |
| Form state | React Hook Form | Do not put form state in global stores |
## Form & Validation
### Stack: React Hook Form v7 + Zod + @hookform/resolvers v5
| Package | Version | Note |
|---------|---------|------|
| `react-hook-form` | v7 (latest) | Form state management |
| `zod` | v3.x or v4.x | Schema validation |
| `@hookform/resolvers` | v5.2.0+ | Bridge between RHF and Zod |
## PDF / Document Generation
### Recommendation: `@react-pdf/renderer` v4.x (NOT Puppeteer)
- Runs natively in Node.js serverless functions (< 2MB bundle)
- Generates PDFs in under 500ms
- Uses JSX/React component model — familiar for the team
- Supports custom fonts (embed a Latin Extended font for full Brazilian Portuguese character support)
- CSS Grid (use Flexbox layouts only)
- Pseudo-selectors
- HTML-to-PDF conversion (it is a PDF authoring library, not an HTML renderer)
## Scheduling / Calendar
### Recommendation: FullCalendar Premium (Scheduler) for appointment views
- Resource (dentist/chair) column views — essential for multi-provider dental scheduling
- Drag-and-drop rescheduling
- React integration via `@fullcalendar/react`
- 19K+ GitHub stars, 1M+ weekly npm downloads
- Active development and maintenance
## Payment Integration
### Asaas (Primary — Brazilian Patients)
- Official docs are REST-first; SDK docs are thin
- You control error handling, retry logic, and TypeScript types
- Webhooks require your own endpoint regardless — SDK adds no value there
- Total API surface is manageable (~15-20 endpoints you'll actually use)
- PIX (instant, most common in Brazil — 40%+ of online transactions)
- Boleto bancário (PDF boleto, 3-5 business day settlement)
- Cartão de crédito (card, via tokenization)
### Stripe (International / SaaS Subscription Billing)
- PIX via Stripe now available in Brazil (launched via EBANX partnership, 2025) — available for customers with Brazilian Stripe accounts
- `Pix Automático` enables recurring payment mandates (relevant for subscription billing via PIX)
- Use Stripe Billing for subscription management (plans, trials, upgrades, invoices)
## Messaging
### WhatsApp: Meta Cloud API (Official)
- Official Node.js SDK: `@whatsapp/api-js` (or use the REST API directly)
- Per-conversation pricing (utility messages ~€0.03-0.05 for Brazil)
- Template messages required for outbound messages (appointment reminders, payment confirmations)
- No phone number ban risk
- LGPD-compliant data handling path
- Appointment reminder (utility category — lower cost)
- Payment confirmation (utility category)
- Payment due reminder (utility category)
- Appointment confirmation request with quick-reply buttons
### Email: Resend + React Email
- SendGrid killed its free tier in mid-2025 (now starts at $19.95/month)
- Resend's free tier: 3,000 emails/month — sufficient for early clinics
- Resend is built for React/Next.js teams: native `react-email` template support
- React Email lets you build email templates as React components with TypeScript — same DX as the rest of the app
- Resend's API is simpler and better documented for developers
## Deployment & Infrastructure
### Vercel Configuration
| Concern | Fluid Compute (Node.js) | Edge Runtime |
|---------|------------------------|--------------|
| Database queries (Supabase) | Full Node.js TCP connections | No `net` module — requires HTTP only |
| PDF generation | Full `@react-pdf/renderer` support | Cannot run in Edge |
| Cold starts | Mitigated by bytecode caching (Node 20+) + in-function concurrency | Near-zero but feature-limited |
| Bundle size | No 1MB limit | Hard 1MB limit |
| Brazil latency | `gru1` region, close to Supabase SA | Global distribution but Supabase still in SA |
| Execution time | Up to 800s on Pro | 30s max |
### Supabase Configuration
- **Region:** `sa-east-1` (São Paulo) — mandatory for latency
- **Database password:** Rotate immediately after project creation; store in Vercel environment variables, never in code
- **Connection pooling:** Enable Supabase's built-in PgBouncer connection pooler for Vercel serverless (each function invocation creates a new connection — pooler prevents connection exhaustion)
- **Type generation:** Run `supabase gen types typescript` in CI to keep DB types in sync
- **Migrations:** Use `supabase/migrations/` folder + `supabase db push` in CI. Never use the Supabase dashboard for schema changes in production.
### Environment Variables
# Supabase
# Asaas
# Stripe
# Resend
# WhatsApp
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
## Complete Package Reference
### Production Dependencies
# Framework
# Supabase
# UI
# State / Data
# Forms & Validation
# PDF Generation
# Calendar / Scheduling
# Email
# Payments
# Note: No Asaas package — use REST API directly
### Dev Dependencies
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
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

### UI Component Primitives

Two component primitive libraries are in use. This is a deliberate choice — canonical usage is:

| Library | Canonical use |
|---------|--------------|
| `@base-ui/react` | Behavioural primitives where shadcn/ui does not yet provide a component (e.g. `Button` base, future `Select`, `Dialog` if shadcn version is not available) |
| `@radix-ui/*` (via shadcn/ui) | All other interactive primitives pulled in automatically by `shadcn add <component>` |

**Rule:** prefer `shadcn add <component>` first. Only reach for `@base-ui/react` directly when shadcn has no equivalent. Document any new `@base-ui/react` usage in this table.

Currently using `@base-ui/react`:
- `src/components/ui/button.tsx` — `Button` primitive from `@base-ui/react/button`
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
