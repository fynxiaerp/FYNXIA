# Phase 11: Profissionais & Recursos - Research

**Researched:** 2026-06-14
**Domain:** Dental professionals registry, availability scheduling, physical resources, waiting-room check-in, Supabase Realtime TV panel
**Confidence:** HIGH (all findings verified against actual codebase)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Tabela `professionals` (clinic_id, user_id NULLABLE FK → users): CRO+UF, especialidades (multi), vínculo (CLT/PJ/autônomo), regras de % comissão (por profissional/serviço), unit_id (multiunidade Fase 7), ativo/deleted_at. `professional_availability`: grade semanal recorrente (dia_semana + janela início/fim) + exceções (folga/horário extra por data). Equipe(users) continua sendo o ACESSO; Profissionais é o cadastro CLÍNICO rico. PRO-03: apenas ARMAZENA a regra de comissão; cálculo é Fase 16 (TRIB).
- **D-02:** Grade semanal + exceções; o agendamento (agenda interna + link público do v1) valida contra a disponibilidade — só oferece/aceita horários dentro das janelas. Reusa a agenda FullCalendar e o anti-double-booking (EXCLUDE GIST) do v1; adiciona a checagem de disponibilidade (e de recurso, D-03).
- **D-03:** Tabela `resources` (clinic_id, unit_id, tipo sala/cadeira/equipamento, patrimônio/série, status ativo/manutenção, manutenção_prevista). Appointment ganha reserva opcional de recurso (resource_id ou tabela de junção se >1). Recurso em manutenção/indisponível é excluído da oferta e barra o booking (reusa o padrão anti-conflito da agenda).
- **D-04:** Check-in no appointment: status de presença (aguardando → chamado → em_atendimento → finalizado) com timestamps (mede o tempo de espera). Recepção "chama" o paciente. Painel /painel (TV) via Supabase Realtime — atualização por evento (invalidate/subscribe).

### Claude's Discretion
- Estrutura/colunas/índices das migrations; junção appointment↔resource (coluna única vs N:N); enums de tipo/vínculo/status.
- Formato exato da grade de disponibilidade (jsonb vs linhas); como a checagem de disponibilidade integra ao booking (Server Action de criação de appointment + link público).
- Mecanismo Realtime do painel (canal por clínica/unidade; o que a TV assina); layout do painel TV.
- UI: cadastro de profissional (com abas ficha/horários), cadastro de recursos, check-in na agenda/recepção, painel TV. Design system v1, @base-ui render-prop, tokens, RHF+Zod v3, pt-BR. Módulos no proxy (profissionais/recursos sob `clinica` ou novos) + nav (string-key icons).
- Reaproveitar o máximo da agenda v1; não reescrever o FullCalendar.

### Deferred Ideas (OUT OF SCOPE)
- Cálculo concreto do repasse/comissão (Fase 16 — TRIB).
- Integração TISS/credenciamento de profissionais por convênio.
- Otimização avançada de agenda (sugestão de encaixe por IA).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PRO-01 | Admin cadastra profissional com CRO+UF, especialidades, vínculo e grade de disponibilidade | Schema `professionals` + `professional_availability`, migração + RLS, UI cadastro multi-aba |
| PRO-02 | A disponibilidade do profissional gera os horários da agenda | Availability check injected into `createAppointment` + `getBookedSlots`; generateSlots filtered by weekly schedule |
| PRO-03 | Regras de % de comissão por profissional/serviço alimentam o repasse | `commission_rules JSONB` stored in `professionals`; Phase 16 consumes — no calc here |
| RES-01 | Admin cadastra recursos físicos (sala, cadeira, equipamento) com patrimônio/série e status | Schema `resources`, UI cadastro, RLS, status enum |
| RES-02 | Recurso em manutenção/indisponível bloqueia o horário na agenda | Status check in `createAppointment`; single `resource_id` column on appointments + resource-time GIST or server-side check |
| RES-03 | Painel de chamada em tempo real (TV) e medição do tempo de espera por paciente | Presence status + timestamps on appointments; `/painel` page with Supabase Realtime channel subscription; `invalidateQueries` pattern |
</phase_requirements>

---

## Summary

Phase 11 opens Bloco B (Clínico) by adding two foundational clinical registries — `professionals` and `resources` — that gate the scheduling system already built in v1. The core agenda FullCalendar + EXCLUDE GIST anti-double-booking remains untouched; this phase injects two new validation layers into the existing appointment creation path: (1) check that the requested time slot falls within the professional's weekly availability schedule (with exception overrides), and (2) check that any requested resource is active (not in maintenance). A third addition — the waiting-room check-in flow — extends `appointments` with a presence status enum and arrival/call/start/end timestamps, then exposes these in a Supabase Realtime-driven TV panel at `/painel`.

The `professionals` table deliberately separates clinical registration from system access: dentists who have a FYNXIA login get `user_id` set; collaborators without login (e.g. outside contractors) have `user_id = NULL`. This prepares the codebase for Phase 16 commission calculation without duplicating the `users` table. The existing agenda page fetches dentists from `users WHERE role='dentist'` — this must be progressively migrated to join `professionals` so the calendar can show professionals without logins, but the GIST constraint on `appointments.dentist_id` (FK → users.id) constrains the migration path.

The key architectural insight: **availability validation is a pre-insert business rule, not a database constraint.** The EXCLUDE GIST already handles double-booking atomically. Availability checking happens in the Server Action before the insert, wrapped in a soft guard (not a GIST) because availability windows are clinic-configured data, not schema constraints. A race condition between the availability check and the GIST insert is acceptable — if a slot is available but a concurrent booking lands first, the GIST fires 23P01 (already handled). The availability check only needs to prevent the UI from offering unavailable slots in the first place, and the Server Action enforces it as a secondary guard.

**Primary recommendation:** Implement availability as flat rows in `professional_availability` (one row per weekday window), keep the appointments-resources relationship as a single nullable FK `resource_id` on `appointments` (N:N junction deferred — not needed for Phase 11 scope), and use a Supabase Realtime postgres_changes channel scoped to `clinic_id` for the TV panel.

---

## Standard Stack

### Core (all already installed — no new packages needed)
| Library | Version in use | Purpose | Why Standard |
|---------|---------------|---------|--------------|
| `@supabase/supabase-js` | 2.107.0 [VERIFIED: package.json] | Realtime channels + DB client | Already in stack; Realtime is built-in |
| `@fullcalendar/react` + plugins | 6.1.20 [VERIFIED: package.json] | Calendar display, extend with professional filter | Already in use — do not replace |
| `react-hook-form` | 7.77.0 [VERIFIED: package.json] | Professional/resource registration forms | Project standard |
| `zod` | 3.25.76 [VERIFIED: package.json] | Zod v3 ONLY (never v4) | Project constraint — see CLAUDE.md |
| `@hookform/resolvers` | 5.4.0 [VERIFIED: package.json] | RHF + Zod bridge | Project standard |
| `@tanstack/react-query` | 5.101.0 [VERIFIED: package.json] | Data fetching + `invalidateQueries` for Realtime | Project standard; CLAUDE.md Realtime pattern |
| `nuqs` | 2.8.9 [VERIFIED: package.json] | URL state for professional filter in calendar | Already used in AgendaCalendar |
| `date-fns` + `date-fns-tz` | 4.4.0 + 3.2.0 [VERIFIED: package.json] | Day-of-week calculations for availability windows | Already installed |

### No New Packages Required
All libraries needed for Phase 11 are already installed. [VERIFIED: package.json]

Supabase Realtime is part of `@supabase/supabase-js` v2 — the `createBrowserClient()` from `@supabase/ssr` returns a client with `.channel()` support. [VERIFIED: src/lib/supabase/client.ts]

---

## Architecture Patterns

### Recommended Project Structure (new files only)
```
supabase/migrations/
├── 20260617000100_professionals.sql          # professionals + professional_availability
├── 20260617000200_professionals_rls.sql      # RLS policies
├── 20260617000300_resources.sql              # resources table
├── 20260617000400_resources_rls.sql          # RLS policies
├── 20260617000500_appointment_resource.sql   # ADD COLUMN resource_id to appointments
├── 20260617000600_appointment_checkin.sql    # ADD presence_status + timestamps to appointments

src/
├── lib/validators/
│   ├── professional.ts                       # Zod v3 schema for professionals
│   └── resource.ts                           # Zod v3 schema for resources
├── actions/
│   ├── professionals.ts                      # CRUD Server Actions
│   ├── resources.ts                          # CRUD Server Actions
│   └── checkin.ts                            # check-in/call/start/finish Actions
├── components/
│   ├── professionals/
│   │   ├── ProfessionalForm.tsx              # tabbed form: Ficha + Horários + Comissão
│   │   └── AvailabilityGrid.tsx              # weekly schedule editor
│   └── resources/
│       └── ResourceForm.tsx
├── app/(dashboard)/clinica/
│   ├── profissionais/
│   │   ├── page.tsx                          # list
│   │   └── [id]/page.tsx                     # edit
│   └── recursos/
│       ├── page.tsx                          # list
│       └── [id]/page.tsx                     # edit
└── app/
    └── painel/
        └── [clinic-slug]/
            └── page.tsx                      # TV panel — public route
```

### Pattern 1: professionals Table Schema (D-01)
**What:** Separate clinical registry from access. `professionals` is joined to `appointments` for scheduling while `users` remains the auth layer.

```sql
-- Source: verified from migration patterns in 20260605000100_clinical_tables.sql
CREATE TABLE public.professionals (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id         UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id           UUID        REFERENCES public.units(id),  -- nullable: clinic-wide professional
  user_id           UUID        REFERENCES public.users(id),  -- nullable: professionals without login
  full_name         TEXT        NOT NULL,
  cro               TEXT        NOT NULL,                     -- PRO-01: CRO number
  cro_uf            CHAR(2)     NOT NULL,                     -- PRO-01: state of CRO
  especialidades    TEXT[]      NOT NULL DEFAULT '{}',        -- PRO-01: multi-select
  vinculo           TEXT        NOT NULL DEFAULT 'autonomo'
                    CHECK (vinculo IN ('clt', 'pj', 'autonomo')),  -- PRO-01
  commission_rules  JSONB       NOT NULL DEFAULT '[]',        -- PRO-03: [{service_id, pct}]
  ativo             BOOLEAN     NOT NULL DEFAULT true,
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Mandatory indexes (CLAUDE.md)
CREATE INDEX idx_professionals_clinic_id ON public.professionals(clinic_id);
CREATE INDEX idx_professionals_unit_id   ON public.professionals(unit_id);
CREATE INDEX idx_professionals_user_id   ON public.professionals(user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX idx_professionals_clinic_user
  ON public.professionals(clinic_id, user_id) WHERE user_id IS NOT NULL AND deleted_at IS NULL;
```

**GIST constraint migration path:** The current `appointments.dentist_id` FK references `users.id`. When Phase 11 adds `professional_id`, this must be nullable initially (for backward compat). Existing appointments keep `dentist_id`; new appointments created through the Phase 11 UI set both `professional_id` (→ professionals.id) and `dentist_id` (via professional.user_id). A full migration of `dentist_id` to `professional_id` on the GIST constraint happens in a future phase when all professionals have been created.

### Pattern 2: professional_availability — Flat Row Model (D-01 / D-02)
**What:** One row per (professional, weekday, time window). Exceptions are separate rows in a companion table. Chosen over JSONB because individual rows are easier to query for slot generation.

```sql
-- Source: standard availability pattern for scheduling systems [ASSUMED]
CREATE TABLE public.professional_availability (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID        NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  clinic_id       UUID        NOT NULL,   -- denormalized for RLS + index
  -- Recurring weekly schedule
  weekday         SMALLINT    NOT NULL CHECK (weekday BETWEEN 0 AND 6),  -- 0=Sunday
  start_time      TIME        NOT NULL,
  end_time        TIME        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_prof_availability_professional ON public.professional_availability(professional_id);
CREATE INDEX idx_prof_availability_clinic_id    ON public.professional_availability(clinic_id);

-- Exceptions: date-specific overrides (day off = no rows; extra hours = additional rows)
CREATE TABLE public.professional_availability_exceptions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID        NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  clinic_id       UUID        NOT NULL,
  exception_date  DATE        NOT NULL,
  exception_type  TEXT        NOT NULL CHECK (exception_type IN ('folga', 'extra')),
  -- For 'extra' type only: overrides start/end
  start_time      TIME,
  end_time        TIME,
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_prof_avail_exc_professional ON public.professional_availability_exceptions(professional_id);
CREATE INDEX idx_prof_avail_exc_date         ON public.professional_availability_exceptions(professional_id, exception_date);
```

**Availability check algorithm (D-02):**
```typescript
// Source: logical derivation from verified codebase patterns
// Called in createAppointment Server Action BEFORE the INSERT
async function isProfessionalAvailable(
  professionalId: string,
  startTime: Date,
  endTime: Date,
  supabase: SupabaseClient
): Promise<boolean> {
  const weekday = startTime.getUTCDay()  // or toZonedTime for Brazil TZ
  const startStr = startTime.toISOString().slice(11, 16)  // 'HH:MM'
  const endStr   = endTime.toISOString().slice(11, 16)
  const dateStr  = startTime.toISOString().slice(0, 10)

  // Check for folga exception first (blocks day entirely)
  const { data: folga } = await supabase
    .from('professional_availability_exceptions')
    .select('id')
    .eq('professional_id', professionalId)
    .eq('exception_date', dateStr)
    .eq('exception_type', 'folga')
    .maybeSingle()
  if (folga) return false

  // Check recurring schedule: does a window cover the requested slot?
  const { data: windows } = await supabase
    .from('professional_availability')
    .select('start_time, end_time')
    .eq('professional_id', professionalId)
    .eq('weekday', weekday)
  // A window covers if window.start <= slot.start && window.end >= slot.end
  const covered = (windows ?? []).some(
    (w) => w.start_time <= startStr && w.end_time >= endStr
  )
  if (covered) return true

  // Check 'extra' exceptions for that specific date
  const { data: extras } = await supabase
    .from('professional_availability_exceptions')
    .select('start_time, end_time')
    .eq('professional_id', professionalId)
    .eq('exception_date', dateStr)
    .eq('exception_type', 'extra')
  return (extras ?? []).some(
    (e) => e.start_time! <= startStr && e.end_time! >= endStr
  )
}
```

### Pattern 3: resource_id on appointments (D-03 — single FK, not junction)
**Rationale for single FK:** Phase 11 scope is "optional resource reservation" — one chair/sala per appointment covers the dental clinic model (one patient, one chair). A junction table (N:N) adds migration complexity for no real gain at this phase. N:N can be added in Phase 13+ if CME equipment multi-reservation is needed.

```sql
-- Migration: ADD COLUMN resource_id nullable on appointments
-- Pattern: same 3-step ADD nullable → no backfill needed → leave nullable
ALTER TABLE public.appointments
  ADD COLUMN resource_id UUID REFERENCES public.resources(id);
CREATE INDEX idx_appointments_resource_id ON public.appointments(resource_id);
```

**Resource conflict check:** Cannot use EXCLUDE GIST on resource (it operates on dentist_id). Resource conflicts are checked in the Server Action before insert — a SELECT for overlapping appointments on the same resource_id. For atomic safety: the GIST doesn't protect resources, but simultaneous bookings of the same resource race condition is very unlikely in a dental clinic. A separate EXCLUDE GIST on resource + time range could be added but adds index maintenance cost. Recommendation: application-level check + clear error message.

```sql
-- resources table
CREATE TABLE public.resources (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id             UUID        NOT NULL REFERENCES public.units(id),
  nome                TEXT        NOT NULL,
  tipo                TEXT        NOT NULL CHECK (tipo IN ('sala', 'cadeira', 'equipamento')),
  patrimonio          TEXT,                          -- RES-01: asset tag
  numero_serie        TEXT,                          -- RES-01: serial number
  status              TEXT        NOT NULL DEFAULT 'ativo'
                      CHECK (status IN ('ativo', 'manutencao', 'inativo')),
  manutencao_prevista DATE,                          -- maintenance scheduled date
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_resources_clinic_id ON public.resources(clinic_id);
CREATE INDEX idx_resources_unit_id   ON public.resources(unit_id);
```

### Pattern 4: Appointment Check-in Status (D-04)
**What:** Extend `appointments.status` check constraint OR add a separate presence column. Recommendation: separate column to avoid breaking the existing GIST WHERE clause and 5-status enum.

```sql
-- Add presence status and timestamps to appointments
ALTER TABLE public.appointments
  ADD COLUMN presence_status TEXT
    CHECK (presence_status IN ('aguardando', 'chamado', 'em_atendimento', 'finalizado')),
  ADD COLUMN arrived_at      TIMESTAMPTZ,   -- when patient checks in at reception
  ADD COLUMN called_at       TIMESTAMPTZ,   -- when receptionist calls the name
  ADD COLUMN started_at      TIMESTAMPTZ,   -- when dentist starts treatment
  ADD COLUMN finished_at     TIMESTAMPTZ;   -- when treatment ends
-- presence_status = NULL means "not yet arrived" (pre-checkin)
```

**Why separate column:** The existing `status` CHECK constraint (`agendado|confirmado|em_atendimento|concluido|cancelado`) drives the GIST WHERE clause. Mixing presence states into it would require altering the GIST constraint (expensive, locks table). A separate nullable `presence_status` column is cleaner and preserves backward compatibility.

**Waiting time calculation (server-side):**
```typescript
// waiting_minutes = (called_at - arrived_at) in minutes, or (now - arrived_at) if still waiting
function calcWaitingMinutes(arrivedAt: string | null, calledAt: string | null): number | null {
  if (!arrivedAt) return null
  const end = calledAt ? new Date(calledAt) : new Date()
  return Math.round((end.getTime() - new Date(arrivedAt).getTime()) / 60000)
}
```

### Pattern 5: Supabase Realtime for TV Panel (D-04)
**What:** The `/painel/[clinic-slug]` page subscribes to appointment changes scoped by clinic. The CLAUDE.md prescribes: Realtime events → `invalidateQueries` (TanStack Query v5).

**Enabling Realtime on appointments table:** By default, Supabase tables are not added to the Realtime publication. Must add via migration: [ASSUMED — standard Supabase Realtime pattern, not verified against current project migrations]

```sql
-- Add appointments to the supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
```

**Client-side Realtime subscribe pattern (browser client):**
```typescript
// Source: Supabase JS v2 Realtime API [ASSUMED - based on @supabase/supabase-js v2 patterns]
// Pattern: CLAUDE.md → "Realtime → invalidateQueries"
'use client'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

export function useAppointmentRealtime(clinicId: string) {
  const queryClient = useQueryClient()
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`appointments:clinic_id=eq.${clinicId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `tenant_id=eq.${clinicId}`,
        },
        () => {
          // CLAUDE.md pattern: invalidate, don't process event directly
          queryClient.invalidateQueries({ queryKey: ['appointments', clinicId] })
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [clinicId, queryClient])
}
```

**RLS on Realtime:** Supabase Realtime respects RLS policies. The panel page is public (no auth), so it must use a display token approach or the `anonKey` with a policy that allows read of appointment presence data for the given clinic. Options:
1. **Clinic-slug token (recommended):** Store a `display_token` UUID on `clinics`. The panel reads it from the URL. A Realtime channel filter and RLS policy allow SELECT on appointment presence columns WHERE clinic display_token matches. This avoids leaking cross-tenant data.
2. **Anon-accessible policy:** Add a SELECT policy allowing anon reads filtered to specific columns (presence_status, patient initials, called_at) — simpler but exposes more surface.

Recommended approach: use the existing clinic `slug` as the display token (it's already non-guessable enough for a TV display, and clinics already use it for public booking). The Realtime policy simply mirrors the booking public flow.

### Pattern 6: agenda calendar extension (D-02 — professionals as filter)
**Current state:** AgendaCalendar receives `dentists: {id, full_name}[]` fetched as `users WHERE role='dentist'`. [VERIFIED: src/app/(dashboard)/clinica/agenda/page.tsx, src/components/agenda/AgendaCalendar.tsx]

**Migration path:** The calendar's dentist dropdown must show professionals who have a `user_id` (i.e., active dentists with logins). Professionals without `user_id` cannot appear as appointment assignees until `appointments.dentist_id` is migrated to `professional_id`. For Phase 11, the safest approach:
1. Add `professional_id UUID REFERENCES professionals(id)` nullable to appointments.
2. Keep `dentist_id` (users FK) working for the GIST constraint.
3. In the agenda page, join `professionals` where `user_id IS NOT NULL` — continue showing by user_id in the calendar.
4. Phase 11 UI adds professional filter separately.

**Public booking getBookedSlots impact:** Currently resolves dentist via `users WHERE role='dentist' AND tenant_id = clinic.id`. After Phase 11: must also verify the requested slot falls within professional availability. Add an availability pre-check in `createPublicAppointment` and update `getBookedSlots` to return both booked slots AND out-of-availability slots as "unavailable" in the same call. [VERIFIED: src/actions/public-booking.ts]

### Pattern 7: Module Registration (proxy.ts + nav-config.ts)
**Current nav:** `ALL_NAV_ITEMS` uses string-key icons pattern (RSC-safe). [VERIFIED: src/components/shell/nav-config.ts, nav-icons.ts]

**Add to nav-config.ts:**
```typescript
// New entries for Phase 11 (string-key icons — never pass component across RSC boundary)
{ href: '/clinica/profissionais', label: 'Profissionais', icon: 'profissionais', adminOnly: true },
{ href: '/clinica/recursos',      label: 'Recursos',      icon: 'recursos',      adminOnly: true },
```

**Add to nav-icons.ts:**
```typescript
// Client-only file — safe to import Lucide components here
import { Stethoscope, Armchair } from 'lucide-react'
// Add to NAV_ICONS: profissionais: Stethoscope, recursos: Armchair
```

**proxy.ts ROUTE_MODULE_MAP:** Routes `/clinica/profissionais` and `/clinica/recursos` resolve to module `'clinica'` automatically (prefix match) — no change to proxy.ts required. [VERIFIED: src/proxy.ts L37-48]

**Public route `/painel`:** Must be added to `isPublicRoute` list in proxy.ts — TV panel has no auth.
```typescript
const isPublicRoute =
  pathname.startsWith('/invite') ||
  pathname.startsWith('/agendar') ||
  pathname.startsWith('/anamnese') ||
  pathname.startsWith('/painel')  // Phase 11: TV display panel
```

### Anti-Patterns to Avoid
- **Altering the GIST constraint:** Never modify `no_overlap` EXCLUDE GIST in Phase 11. Add `resource_id` as an application-level check.
- **Moving dentist_id to professional_id in GIST:** Deferred — would require dropping and recreating the GIST index with a table lock.
- **JSONB for availability schedule:** Flat rows in `professional_availability` are more queryable; JSONB makes WHERE clauses on weekday/time harder without a btree index.
- **presence_status merged into status:** Breaks GIST WHERE clause; breaks existing status transitions; keep separate.
- **Edge Runtime for Realtime:** Realtime uses WebSocket — requires the Fluid Compute (Node.js) runtime. [VERIFIED: CLAUDE.md]
- **Separate schema per tenant for professional data:** Not needed; RLS handles isolation. [VERIFIED: CLAUDE.md]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Double-booking | Custom locking logic | Existing EXCLUDE GIST `no_overlap` | Already implemented, atomic, battle-tested |
| Real-time push | Long-polling or SSE manually | Supabase Realtime `.channel().on('postgres_changes')` | Built into @supabase/supabase-js v2 |
| Availability overlap logic | Custom interval tree | Simple SQL/TS range comparison on TIME columns | Weekly schedule is simple enough |
| Form validation | Manual validation | RHF + Zod v3 | Project standard |
| URL filter state | useState | nuqs (already in agenda) | Already in use for dentist filter |
| Resource scheduling conflicts (complex) | Custom GIST on resources | Application-level pre-check + clear error | GIST overkill for Phase 11; add later if needed |

**Key insight:** The hardest problem in this phase (double-booking) is already solved by the GIST. The availability check is a simpler problem — just a time-range comparison — that does NOT need database-level enforcement because the GIST already prevents the worst case (two appointments at the same time for the same dentist). Availability check is a UX guard, not an integrity constraint.

---

## Common Pitfalls

### Pitfall 1: Breaking the GIST by touching `appointments.status`
**What goes wrong:** If Phase 11 modifies the CHECK constraint on `appointments.status` or the EXCLUDE GIST WHERE clause, all existing appointments could be affected.
**Why it happens:** The GIST uses `WHERE (status NOT IN ('cancelado'))`. Adding new status values (e.g., a presence status) to the same column changes what the GIST excludes.
**How to avoid:** Use a separate `presence_status` column (nullable, separate CHECK). Never touch the existing `status` column enum or the GIST definition.
**Warning signs:** Any migration that says `ALTER TABLE appointments ALTER COLUMN status TYPE` or `DROP CONSTRAINT no_overlap`.

### Pitfall 2: Availability check race condition
**What goes wrong:** Between the availability check in the Server Action and the subsequent INSERT, another booking could fill the same slot. The developer might try to prevent this with complex locking.
**Why it happens:** Confusion between "is the slot within availability?" (soft business rule) and "is the slot already taken?" (GIST).
**How to avoid:** Accept the split: GIST handles double-booking atomically; availability check is a soft pre-flight. A slot that passes availability check but fails the GIST returns 23P01 → show the existing "Horário indisponível" error. Both paths are already handled in the UI. [VERIFIED: src/actions/appointments.ts L84-90]
**Warning signs:** Attempting to use `FOR UPDATE` locks or transactions that span availability check + insert.

### Pitfall 3: Realtime leaking cross-tenant data (LGPD)
**What goes wrong:** The `/painel` TV page subscribes to all appointment changes without tenant filtering, exposing other clinics' patient data.
**Why it happens:** Supabase Realtime channel filters use RLS, but the public page has no auth context.
**How to avoid:** Filter the Realtime subscription by `tenant_id=eq.${clinicId}` AND ensure the RLS SELECT policy for the anon role allows only non-PII columns (presence_status, called_at, arrived_at, and patient initials only — never full_name or CPF). Resolve clinicId via slug before subscribing.
**Warning signs:** Channel filter without `filter: 'tenant_id=eq.{id}'`; SELECT * in the panel query.

### Pitfall 4: professionals.user_id uniqueness gap
**What goes wrong:** Two `professionals` rows for the same user_id in the same clinic — one active, one "deleted" (soft delete). The UNIQUE index must include `WHERE deleted_at IS NULL`.
**How to avoid:** Use the partial unique index: `CREATE UNIQUE INDEX idx_professionals_clinic_user ON professionals(clinic_id, user_id) WHERE user_id IS NOT NULL AND deleted_at IS NULL`. [VERIFIED: pattern from patients table in 20260605000100]
**Warning signs:** UNIQUE without WHERE clause on soft-deleted table.

### Pitfall 5: Public booking getBookedSlots not updated for availability
**What goes wrong:** The public booking form (`/agendar/[slug]`) still shows all 30-min slots from 08:00-18:00 even after Phase 11 adds professional availability. Patients can still select slots outside the professional's working hours; the Server Action then rejects them with a confusing error.
**How to avoid:** Update `getBookedSlots` to return both booked start_times AND out-of-availability start_times as "occupied". Or add a `getAvailableSlots` function that returns only valid slots for a date. [VERIFIED: src/actions/public-booking.ts — slot generation is in PublicBookingForm.tsx client-side]
**Warning signs:** `generateSlots()` in PublicBookingForm.tsx still produces all 08:00-18:00 slots regardless of professional availability.

### Pitfall 6: Supabase Realtime — table not in publication
**What goes wrong:** The channel subscribes but never fires events because `appointments` table was not added to `supabase_realtime` publication.
**Why it happens:** Supabase does not add tables to Realtime publication by default in migrations. [ASSUMED — standard Supabase behavior]
**How to avoid:** Add to migration: `ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;`. Also add `professionals` and `resources` if their changes should trigger UI updates.
**Warning signs:** Channel returns `SUBSCRIBED` status but no events fire on appointment updates.

### Pitfall 7: CSP header missing wss:// for Realtime WebSocket
**What goes wrong:** Realtime WebSocket connection blocked by Content Security Policy.
**Why it happens:** wss://*.supabase.co is required in `connect-src`. [VERIFIED: src/__tests__/config/security-headers.test.ts L41 — test already checks for this]
**How to avoid:** The CSP test already verifies this. Confirm `/painel` route has the same headers. No action needed if middleware applies headers to all routes.

### Pitfall 8: `professional_id` on appointments FK vs GIST
**What goes wrong:** Adding `professional_id` to appointments and then trying to put it in the GIST constraint in Phase 11, requiring a table rewrite.
**How to avoid:** Keep `professional_id` as a plain nullable FK in Phase 11. Leave GIST on `dentist_id` (users FK). The full migration of the GIST to use `professional_id` is deferred.
**Warning signs:** Any GIST modification in Phase 11 migrations.

### Pitfall 9: Supabase db push re-auth gotcha
**What goes wrong:** `supabase db push` fails because CLI is logged in to the wrong Supabase account (nexus-* instead of FYNXIA account).
**Why it happens:** The CLI caches login globally. [VERIFIED: MEMORY.md — gotcha explicitly documented]
**How to avoid:** Before any `supabase db push`, run `supabase logout && supabase login` to authenticate as the FYNXIA account (org kczvihafddupruvsrrsc / project jqjwyqlbbuqnrffdnlpp).
**Warning signs:** `supabase db push` returns 401 or "project not found".

### Pitfall 10: Gen types temp-file guard
**What goes wrong:** `supabase gen types typescript --local` overwrites `src/types/database.types.ts` directly, breaking a running TypeScript server.
**How to avoid:** Generate to a temp file, diff, then copy: `supabase gen types typescript --project-id jqjwyqlbbuqnrffdnlpp > /tmp/types.ts && mv /tmp/types.ts src/types/database.types.ts`. [VERIFIED: CLAUDE.md — "gen types temp-file guard"]

---

## Code Examples

### createAppointment extended with availability + resource check
```typescript
// Source: logical extension of src/actions/appointments.ts (VERIFIED)
// Insert BEFORE the Supabase insert call, AFTER validation:

// 1. Resolve professional_id from dentist_id (if professional row exists)
const { data: professional } = await supabase
  .from('professionals')
  .select('id')
  .eq('user_id', dentist_id)
  .eq('clinic_id', actor.tenant_id)
  .maybeSingle()

// 2. Availability check (only if professional exists)
if (professional) {
  const available = await isProfessionalAvailable(
    professional.id, new Date(start_time), new Date(end_time), supabase
  )
  if (!available) {
    return { success: false, error: 'Horário fora da disponibilidade do profissional.' }
  }
}

// 3. Resource availability check (only if resource_id provided)
if (resource_id) {
  const { data: resource } = await supabase
    .from('resources')
    .select('status')
    .eq('id', resource_id)
    .eq('clinic_id', actor.tenant_id)
    .single()
  if (!resource || resource.status !== 'ativo') {
    return { success: false, error: 'Recurso em manutenção ou indisponível.' }
  }
  // Optional: check resource overlap (application-level)
  const { data: resourceConflict } = await supabase
    .from('appointments')
    .select('id')
    .eq('resource_id', resource_id)
    .lt('start_time', end_time)
    .gt('end_time', start_time)
    .neq('status', 'cancelado')
    .limit(1)
  if (resourceConflict && resourceConflict.length > 0) {
    return { success: false, error: 'Recurso já reservado neste horário.' }
  }
}
// Then: proceed with existing supabase.from('appointments').insert(...)
```

### commission_rules JSONB shape (PRO-03)
```typescript
// Source: design decision — stored here, calculated in Phase 16 (TRIB)
// Shape for Phase 16 compatibility:
type CommissionRule =
  | { type: 'flat_pct'; pct: number }                        // default % for all services
  | { type: 'service_pct'; service_id: string; pct: number } // override per service

// commission_rules: CommissionRule[]
// Example: [{ type: 'flat_pct', pct: 40 }, { type: 'service_pct', service_id: 'uuid', pct: 35 }]
// Phase 16 reads this and applies: find service_pct match first, fall back to flat_pct.
```

### RLS for professionals (pattern from clinical_rls.sql)
```sql
-- Source: pattern from 20260605000200_clinical_rls.sql (VERIFIED)
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "professionals_tenant_read" ON public.professionals
  FOR SELECT USING (clinic_id = get_my_tenant_id());

CREATE POLICY "professionals_admin_write" ON public.professionals
  FOR ALL
  USING (clinic_id = get_my_tenant_id()
         AND get_my_role() IN ('admin', 'superadmin'))
  WITH CHECK (clinic_id = get_my_tenant_id()
         AND get_my_role() IN ('admin', 'superadmin'));
```

---

## Runtime State Inventory

> Not a rename/refactor phase. However, one runtime state item is relevant.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `appointments` rows reference `dentist_id → users.id`; no `professional_id` yet | Backfill optional in Phase 11; GIST stays on `dentist_id` — code edit only |
| Live service config | No external service configs affected by this phase | None |
| OS-registered state | None | None |
| Secrets/env vars | No new secrets; Supabase Realtime uses existing NEXT_PUBLIC_SUPABASE_URL + publishable key | None |
| Build artifacts | `src/types/database.types.ts` must be regenerated after each new migration | `supabase gen types typescript` with temp-file guard after each migration |

**Supabase Realtime publication:** `ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments` must run once (in a migration). This is a live database config change — happens via `supabase db push`, no manual action needed.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npm test` |
| Full suite command | `npm test` (all tests in `src/__tests__/**/*.test.ts`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PRO-01 | professionals schema: columns, indexes, RLS policies present | migration source-inspection | `npm test -- --reporter=verbose src/__tests__/migrations/phase11.test.ts` | ❌ Wave 0 |
| PRO-01 | professional_availability schema: weekday+TIME columns, indexes | migration source-inspection | same file | ❌ Wave 0 |
| PRO-02 | isProfessionalAvailable: folga blocks, extra extends, recurring covers | unit | `npm test -- src/__tests__/professionals/availability.test.ts` | ❌ Wave 0 |
| PRO-02 | createAppointment rejects slot outside availability | unit (action source-inspection) | `npm test -- src/__tests__/professionals/availability.test.ts` | ❌ Wave 0 |
| PRO-02 | getBookedSlots returns out-of-availability slots as unavailable | unit | same file | ❌ Wave 0 |
| PRO-03 | commission_rules JSONB shape validates correctly | unit (Zod schema) | `npm test -- src/__tests__/professionals/commission.test.ts` | ❌ Wave 0 |
| RES-01 | resources schema: columns, status enum, indexes | migration source-inspection | `npm test -- src/__tests__/migrations/phase11.test.ts` | ❌ Wave 0 |
| RES-02 | createAppointment rejects resource in 'manutencao' status | unit | `npm test -- src/__tests__/resources/blocking.test.ts` | ❌ Wave 0 |
| RES-02 | createAppointment detects resource time overlap | unit | same file | ❌ Wave 0 |
| RES-03 | presence_status transitions: aguardando→chamado→em_atendimento→finalizado | unit | `npm test -- src/__tests__/resources/checkin.test.ts` | ❌ Wave 0 |
| RES-03 | waiting time calculation: called_at - arrived_at in minutes | unit | same file | ❌ Wave 0 |
| RES-03 | /painel route registered as public in proxy.ts | source-inspection | `npm test -- src/__tests__/migrations/phase11.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test` (full suite — fast, < 30s)
- **Per wave merge:** `npm run build` (tsc + next build)
- **Phase gate:** Full suite green + `npm run build` clean before `/gsd-verify-work`

### Wave 0 Gaps
All test files for Phase 11 need to be created:
- [ ] `src/__tests__/migrations/phase11.test.ts` — migration source-inspection (schema, columns, RLS, public route in proxy)
- [ ] `src/__tests__/professionals/availability.test.ts` — availability logic unit tests (isProfessionalAvailable pure logic + source-inspection of createAppointment)
- [ ] `src/__tests__/professionals/commission.test.ts` — Zod schema for commission_rules JSONB shape
- [ ] `src/__tests__/resources/blocking.test.ts` — resource status check + overlap check
- [ ] `src/__tests__/resources/checkin.test.ts` — presence_status transitions + waiting time calc

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Not a new auth surface |
| V3 Session Management | no | Sessions unchanged |
| V4 Access Control | yes | RLS USING+WITH CHECK; admin-only mutations; assertNotReadOnly() in write actions |
| V5 Input Validation | yes | Zod v3 schemas for professionals + resources forms |
| V6 Cryptography | no | No new cryptographic operations |

### Known Threat Patterns for This Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Injecting foreign professional_id for another clinic | Spoofing | RLS `clinic_id = get_my_tenant_id()` + Server Action tenant scope guard |
| Public /painel leaking patient names | Info Disclosure | SELECT only presence_status + initials; never full_name/CPF; Realtime filter by tenant_id |
| Booking slot outside availability (timing attack) | Tampering | Server Action availability check + existing GIST |
| Realtime subscription to another clinic's data | Info Disclosure | Channel filter `tenant_id=eq.{id}` + RLS policy on anon role for appointments |
| Storing commission % as trust data without validation | Tampering | JSONB shape validated by Zod in Server Action before storage; Phase 16 validates before calc |
| professionals with deleted_at bypassing UNIQUE | Spoofing | Partial unique index WHERE deleted_at IS NULL |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Extend `users` with clinical fields | Separate `professionals` table (FK nullable) | Phase 11 design | Collaborators without login; cleaner Phase 16 integration |
| Polling for TV panel updates | Supabase Realtime postgres_changes | Already in stack | Real-time, no polling overhead |
| Client-side slot generation (fixed 08:00-18:00) | Server-resolved available slots filtered by professional availability | Phase 11 | Accurate slots; UX prevents booking outside working hours |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments` is the correct SQL to enable Realtime | Pattern 5 / Pitfall 6 | Channel would silently not receive events; test by subscribing and updating a row |
| A2 | `.channel('name').on('postgres_changes', { filter: 'tenant_id=eq.X' })` is the correct @supabase/supabase-js v2 Realtime filter syntax | Pattern 5 | Realtime events might not be filtered correctly; verify against @supabase/supabase-js v2.107 docs |
| A3 | Supabase Realtime respects RLS for postgres_changes subscriptions | Pitfall 3 | Cross-tenant data leak; must be verified before shipping the panel |
| A4 | resource time-overlap check at application level (SELECT for conflicts) is atomic enough for dental clinic use | Pattern 3 | Two simultaneous bookings could double-reserve a chair; acceptable risk for Phase 11 |
| A5 | `commission_rules` JSONB shape `[{type, pct, service_id?}]` is compatible with Phase 16 TRIB module design | Code Examples | Phase 16 may need a different shape; document the contract with the TRIB phase researcher |

---

## Open Questions

1. **GIST on resource conflicts**
   - What we know: The application-level resource conflict check has a small race window
   - What's unclear: Whether the dental clinic workflow ever has concurrent booking attempts frequent enough to hit the race (unlikely: one receptionist, one patient at a time)
   - Recommendation: Start with application-level check; add GIST later if monitoring shows conflicts

2. **professionals_id on GIST — migration timeline**
   - What we know: `appointments.dentist_id` FK references `users.id` and is in the GIST
   - What's unclear: When to migrate the GIST to use `professional_id` (Phase 11 or defer to Phase 12+)
   - Recommendation: Defer GIST migration to a future phase; Phase 11 adds `professional_id` as a plain nullable FK only

3. **TV Panel auth model for multi-unit clinics**
   - What we know: `/painel/[clinic-slug]` needs to show the right unit's waiting room
   - What's unclear: Whether to parameterize by unit_slug too (`/painel/[clinic-slug]/[unit-slug]`) or default to the clinic's default unit
   - Recommendation: `/painel/[clinic-slug]?unit=<unit_id>` via query param (no slug needed for units in TV context)

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All Server Actions | Yes | 24.14.0 [VERIFIED] | — |
| @supabase/supabase-js Realtime | TV panel | Yes (bundled with v2.107.0) | 2.107.0 [VERIFIED] | — |
| @fullcalendar/* | Agenda extension | Yes | 6.1.20 [VERIFIED] | — |
| Supabase CLI | Migrations | Yes (supabase@2.105.0) | 2.105.0 [VERIFIED: package.json devDeps] | — |
| Vitest | Tests | Yes | 4.1.8 [VERIFIED] | — |

**No missing dependencies.** All Phase 11 functionality is achievable with the current package set.

---

## Sources

### Primary (HIGH confidence — verified against codebase)
- `supabase/migrations/20260605000100_clinical_tables.sql` — appointments schema, EXCLUDE GIST definition, btree_gist extension
- `supabase/migrations/20260605000200_clinical_rls.sql` — RLS policy patterns (USING + WITH CHECK)
- `supabase/migrations/20260614000700_operational_unit_id.sql` — 3-step ADD COLUMN nullable → backfill → NOT NULL pattern
- `supabase/migrations/20260603000000_initial_schema.sql` — get_my_tenant_id(), get_my_role() SECURITY DEFINER pattern
- `supabase/migrations/20260614000300_user_units.sql` — get_my_unit_ids() function
- `supabase/migrations/20260614000100_units_table.sql` — units table schema + audit trigger pattern for tables using clinic_id (not tenant_id)
- `src/actions/appointments.ts` — createAppointment/updateAppointment Server Action, 23P01 handling
- `src/actions/public-booking.ts` — getBookedSlots, createPublicAppointment (public flow)
- `src/components/agenda/AgendaCalendar.tsx` — FullCalendar setup, dentist filter via nuqs
- `src/app/(dashboard)/clinica/agenda/page.tsx` — dentist fetch from users WHERE role='dentist'
- `src/app/agendar/[clinic-slug]/page.tsx` — public booking page, dentist fetch via adminClient
- `src/components/booking/PublicBookingForm.tsx` — slot generation, getBookedSlots integration
- `src/proxy.ts` — MODULE_PERMISSIONS, ROUTE_MODULE_MAP, isPublicRoute pattern
- `src/components/shell/nav-config.ts` — string-key icon RSC pattern
- `src/components/shell/nav-icons.ts` — client-only Lucide icon map
- `src/lib/auth/guards.ts` — assertNotReadOnly() pattern
- `src/lib/supabase/client.ts` — createBrowserClient (Realtime capable)
- `package.json` — all package versions verified
- `vitest.config.ts` — test framework config
- `src/__tests__/agenda/calendar.test.ts` — source-inspection test pattern
- `src/__tests__/actions/public-booking-availability.test.ts` — source-inspection test pattern

### Secondary (MEDIUM — project memory/context documents)
- `MEMORY.md` — Supabase account gotcha (org/project IDs), gen types guard
- `.planning/phases/11-profissionais-recursos/11-CONTEXT.md` — locked decisions D-01..D-04
- `CLAUDE.md` — tech stack, anti-patterns, Realtime → invalidateQueries prescription

### Tertiary (LOW — assumed from training knowledge, not verified this session)
- A1-A5 in Assumptions Log above

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in package.json
- Architecture patterns (schema): HIGH — derived from verified existing migrations
- Availability algorithm: MEDIUM — logical derivation from verified patterns; exact SQL not prototyped
- Realtime channel pattern: MEDIUM — API shape assumed from training; @supabase/supabase-js v2 Realtime well-established
- Resource conflict check: HIGH — simple application logic
- Pitfalls: HIGH — all derived from actual code inspection

**Research date:** 2026-06-14
**Valid until:** 2026-07-14 (stable stack — 30-day validity)
