# Phase 2: Clinical MVP — Research

**Pesquisado:** 2026-06-05
**Domínio:** Gestão Clínica Odontológica — Agenda, Prontuário, Odontograma, Anamnese Digital, PDF
**Confiança Geral:** HIGH (stack verificado no registro npm; padrões confirmados via codebase existente)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Agenda (CLINIC-01, CLINIC-02, CLINIC-09)**
- D-01: FullCalendar **free** (sem licença Scheduler). View semanal por dentista — dentista selecionado por dropdown (não colunas paralelas). Drag-and-drop dentro do mesmo dentista permitido.
- D-02: Duração dos slots **livre e configurável** — cada agendamento tem `start_time` e `end_time` (TIMESTAMPTZ). EXCLUDE USING GIST com `tstzrange(start_time, end_time, '[)')` por dentista.
- D-03: 5 status: `agendado`, `confirmado`, `em_atendimento`, `concluido`, `cancelado`.
- D-04: Agendamento público `/agendar/[clinic-slug]` — bloqueio imediato de slot. GIST constraint cobre também esses agendamentos.

**Ficha do Paciente (CLINIC-03, CLINIC-04, SEC-04)**
- D-05: Campos: nome completo, CPF, data de nascimento, telefone, e-mail, endereço, histórico de saúde, alergias, medicamentos. Sem foto no MVP.
- D-06: CPF em plaintext com índice UNIQUE por tenant.
- D-07: AES-256 para `medical_history`, `allergies`, `medications` via `src/lib/crypto.ts` existente.
- D-08: Anonimização em delete (nome → "Paciente Excluído", CPF → "000.000.000-00"). `deleted_at` + `is_anonymized: boolean`. 20 anos de retenção de prontuários (Lei 13.787/2018).

**Prontuário Clínico (CLINIC-05, CLINIC-07)**
- D-09: Campos estruturados separados: `diagnosis`, `treatment_plan`, `prescription` (TEXT). Sem rich text/TipTap.
- D-10: Histórico de todos os dentistas em ordem cronológica.
- D-11: PDF via `@react-pdf/renderer`. Endpoint: `GET /api/patients/[id]/prontuario.pdf` (Node.js runtime).

**Odontograma (CLINIC-06)**
- D-12: SVG customizado React — 32 dentes, componente `<Tooth />` com props `number`, `status`, `onClick`.
- D-13: 8+ status: `higido`, `cariado`, `extraido`, `em_tratamento`, `implante`, `coroa`, `selante`, `fraturado`, `restaurado`.
- D-14: Tabela `dental_records` — snapshot por atendimento: `tooth_number` FDI, `status`, `notes`, `dentist_id`, `appointment_id`.
- D-15: Admin + dentista editam odontograma. Recepcionista/patient leitura apenas.

**Anamnese Digital (CLINIC-08)**
- D-16: Canvas de assinatura manuscrita + SHA-256 do PNG + timestamp ISO + IP + user-agent.
- D-17: Dois fluxos: link público `/anamnese/[patient-id]/[token]` + presencial.
- D-18: Formulário fixo padrão CFO — sem customização por clínica.
- D-19: Assinatura canvas obrigatória para submeter.
- D-20: Registro imutável após assinatura — soft delete apenas em patients via `deleted_at`.

### Claude's Discretion
- Numeração exata dos dentes no SVG (FDI por padrão no Brasil): 11-18, 21-28 (superiores), 31-38, 41-48 (inferiores)
- Schema exato da tabela `appointments` além dos campos discutidos
- Estrutura de componentes do FullCalendar (customização de eventContent)
- Validação Zod dos formulários de paciente e prontuário
- Cores exatas dos status do odontograma no SVG

### Deferred Ideas (OUT OF SCOPE)
- FullCalendar Scheduler (~$500/ano) — view multi-dentista em colunas paralelas
- D4Sign / ICP-Brasil — assinatura com validade jurídica máxima
- Customização de anamnese por clínica — editor de formulários JSON
- Foto do paciente — upload para Supabase Storage
- Módulo de estoque odontológico
- Teleconsulta / prontuário por voz
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Descrição | Suporte na Pesquisa |
|----|-----------|---------------------|
| CLINIC-01 | Visualizar agenda semanal por dentista com slots de horário | FullCalendar 6.1.20 free — timeGridWeek view + dentist dropdown |
| CLINIC-02 | Criar, editar e cancelar agendamentos sem conflito (EXCLUDE USING GIST) | btree_gist extension + tstzrange exclusion constraint — padrão confirmado no PITFALLS.md |
| CLINIC-03 | Cadastrar paciente com todos os campos obrigatórios | Schema `patients` table + encrypt() para campos sensíveis |
| CLINIC-04 | Editar ficha de paciente existente | Server Action com rollback compensatório — padrão de Phase 1 |
| CLINIC-05 | Dentista registra prontuário clínico (diagnóstico, plano, prescrição) | Tabela `medical_records` com campos TEXT; logBusinessEvent para auditoria |
| CLINIC-06 | Odontograma interativo por dente | SVG customizado React + tabela `dental_records` (FDI numbering) |
| CLINIC-07 | Histórico completo por paciente em ordem cronológica | Query em `medical_records` ORDER BY created_at — todos os dentistas do tenant |
| CLINIC-08 | Anamnese digital com assinatura, timestamp e IP (CFO) | `signature_pad` v5.1.3 + SHA-256 Node.js built-in + tabela `anamneses` |
| CLINIC-09 | Link de agendamento online para o paciente | Rota pública `/agendar/[clinic-slug]` já em `proxy.ts` como `isPublicRoute` |
| SEC-03 | Trigger de auditoria em patients, appointments, medical_records | Extensão do `audit_table_changes()` SECURITY DEFINER existente |
| SEC-04 | Soft delete em patients via deleted_at (LGPD — 20 anos) | Campo `deleted_at` + `is_anonymized` + anonimização em Server Action |
</phase_requirements>

---

## Sumário

A Fase 2 entrega o fluxo clínico completo sobre a fundação de Fase 0+1 já consolidada. O projeto tem hoje: migrations versionadas em `supabase/migrations/`, AES-256-GCM em `src/lib/crypto.ts`, auditoria híbrida (trigger SECURITY DEFINER + `logBusinessEvent`), proxy RBAC em `src/proxy.ts` com `/agendar` já marcado como rota pública, vitest 4.1.8 com 59 testes GREEN, e o padrão de Server Actions com rollback compensatório em `src/actions/`.

A fase está completamente contida no projeto existente — sem novos serviços externos. Todos os pacotes principais (FullCalendar 6.1.20, @react-pdf/renderer 4.5.1, signature_pad 5.1.3) foram verificados no registro npm e são compatíveis com React 19.2.4.

**Recomendação principal:** Estruturar a fase em 4 planos sequenciais — (1) migrations SQL (patients, appointments, medical_records, dental_records, anamneses + RLS + triggers), (2) CRUD de pacientes + agendamentos com FullCalendar, (3) prontuário + odontograma SVG + PDF, (4) anamnese digital + link público. Cada plano tem testes Vitest que validam antes do push.

---

## Standard Stack

### Core (já no projeto ou confirmados no npm)

| Biblioteca | Versão | Propósito | Status |
|-----------|--------|-----------|--------|
| `@fullcalendar/react` | 6.1.20 | Componente React para calendário | A instalar |
| `@fullcalendar/daygrid` | 6.1.20 | Plugin month view | A instalar |
| `@fullcalendar/timegrid` | 6.1.20 | Plugin timeGridWeek/Day | A instalar |
| `@fullcalendar/interaction` | 6.1.20 | Drag-and-drop nos eventos | A instalar |
| `@react-pdf/renderer` | 4.5.1 | Geração de PDF no servidor | A instalar |
| `signature_pad` | 5.1.3 | Canvas de assinatura (headless, sem dependência React) | A instalar |
| `date-fns` | 4.4.0 | Manipulação de datas | A instalar |
| `date-fns-tz` | 3.2.0 | Conversão de timezone BR | A instalar |
| `nuqs` | 2.8.9 | URL state para filtros da agenda | A instalar |
| `@tanstack/react-query` | 5.101.0 | Cache de dados do servidor | A instalar |
| `zustand` | 5.0.14 | Estado client-only (seleção, modais) | A instalar |
| `@tanstack/react-table` | 8.21.3 | Tabela headless para lista de pacientes | A instalar |

**Já no projeto (package.json verificado):**
- `zod` v3.25.76 — validação de formulários
- `react-hook-form` v7.77.0 + `@hookform/resolvers` v5.4.0 — formulários
- `@supabase/supabase-js` v2.107.0 — cliente Supabase
- `src/lib/crypto.ts` — AES-256-GCM encrypt/decrypt (pronto)
- `src/lib/audit.ts` — logBusinessEvent (pronto)
- `vitest` v4.1.8 — test runner (pronto)

### Por que signature_pad em vez de react-signature-canvas

`react-signature-canvas` (v1.1.0-alpha.2) está em alpha e usa um wrapper React antigo sobre `signature_pad`. `signature_pad` v5.1.3 é headless, zero dependências além do canvas do browser, e tem API estável. Para integração com React 19, usar `signature_pad` diretamente com `useRef<HTMLCanvasElement>` e `useEffect` é mais robusto e sem risco de incompatibilidade. [VERIFIED: npm registry]

### Instalação

```bash
npm install @fullcalendar/react @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction @react-pdf/renderer signature_pad date-fns date-fns-tz nuqs @tanstack/react-query @tanstack/react-table zustand
```

---

## Architecture Patterns

### Estrutura de Diretórios Recomendada (extensão do projeto existente)

```
src/
├── app/
│   ├── (dashboard)/
│   │   └── clinica/
│   │       ├── page.tsx                    # Dashboard (existente — stub)
│   │       ├── agenda/
│   │       │   ├── page.tsx                # Server Component: carrega dentistas + agendamentos do dia
│   │       │   └── AgendaCalendar.tsx      # 'use client': FullCalendar component
│   │       ├── pacientes/
│   │       │   ├── page.tsx                # Server Component: lista paginada
│   │       │   ├── novo/page.tsx           # Formulário RHF + Zod
│   │       │   └── [id]/
│   │       │       ├── page.tsx            # Ficha completa do paciente
│   │       │       ├── prontuario/
│   │       │       │   └── page.tsx        # Histórico + novo registro
│   │       │       └── odontograma/
│   │       │           └── page.tsx        # SVG interativo
│   └── anamnese/
│       └── [patient-id]/
│           └── [token]/
│               └── page.tsx                # Rota pública — anamnese digital
├── agendar/
│   └── [clinic-slug]/
│       └── page.tsx                        # Rota pública — agendamento online
├── api/
│   └── patients/
│       └── [id]/
│           └── prontuario.pdf/
│               └── route.ts               # GET — Node.js runtime, @react-pdf/renderer
├── components/
│   ├── agenda/
│   │   └── AgendaCalendar.tsx             # FullCalendar wrapper ('use client')
│   ├── patients/
│   │   ├── PatientForm.tsx                # RHF + Zod ('use client')
│   │   └── PatientTable.tsx               # TanStack Table ('use client')
│   ├── odontogram/
│   │   ├── Odontogram.tsx                 # SVG container ('use client')
│   │   └── Tooth.tsx                      # Dente individual ('use client')
│   └── anamnesis/
│       ├── AnamnesisForm.tsx              # CFO form + signature ('use client')
│       └── SignatureCanvas.tsx            # signature_pad wrapper ('use client')
├── actions/
│   ├── appointments.ts                    # Server Actions: create, update, cancel
│   ├── patients.ts                        # Server Actions: create, update, anonymize
│   ├── medical-records.ts                 # Server Actions: create prontuário
│   ├── dental-records.ts                  # Server Actions: update odontograma
│   └── anamneses.ts                       # Server Actions: submit + sign
├── lib/
│   └── validators/
│       ├── patient.ts                     # Zod schema paciente
│       ├── appointment.ts                 # Zod schema agendamento
│       ├── medical-record.ts              # Zod schema prontuário
│       └── anamnesis.ts                   # Zod schema anamnese CFO
└── __tests__/
    ├── migrations/
    │   └── clinical.test.ts               # SQL content assertions (btree_gist, EXCLUDE, audit triggers)
    ├── actions/
    │   ├── patients.test.ts               # encrypt/decrypt, anonymize logic
    │   └── appointments.test.ts           # conflict detection, status transitions
    ├── components/
    │   └── odontogram.test.ts             # FDI numbering, status colors
    └── anamnesis/
        └── signature.test.ts              # SHA-256 hash, token expiry
```

### Padrão 1: EXCLUDE USING GIST para anti-double-booking

```sql
-- Requer btree_gist extension (disponível no Supabase FREE plan)
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE public.appointments (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  dentist_id   UUID        NOT NULL REFERENCES public.users(id),
  patient_id   UUID        REFERENCES public.patients(id),
  start_time   TIMESTAMPTZ NOT NULL,
  end_time     TIMESTAMPTZ NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'agendado'
               CHECK (status IN ('agendado','confirmado','em_atendimento','concluido','cancelado')),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- D-02: Exclusion constraint — impede double-booking a nível de banco
  -- '[)' = fechado-aberto: [start_time, end_time) — agendamentos adjacentes são permitidos
  CONSTRAINT no_overlap EXCLUDE USING GIST (
    tenant_id  WITH =,
    dentist_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
  ) WHERE (status NOT IN ('cancelado'))
);

-- H-1: Indexes para RLS e queries de agenda
CREATE INDEX idx_appointments_tenant_id ON public.appointments(tenant_id);
CREATE INDEX idx_appointments_dentist_date
  ON public.appointments(tenant_id, dentist_id, start_time);
CREATE INDEX idx_appointments_patient_id ON public.appointments(patient_id);
```

[VERIFIED: padrão de PITFALLS.md H-9 + decisão D-02 do CONTEXT.md]

### Padrão 2: Pacientes com criptografia seletiva

```sql
CREATE TABLE public.patients (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  registered_by   UUID        REFERENCES public.users(id),
  full_name       TEXT        NOT NULL,
  cpf             TEXT        NOT NULL,  -- plaintext (D-06) para busca na recepção
  date_of_birth   DATE,
  phone           TEXT,
  email           TEXT,
  address         TEXT,
  -- D-07: Criptografados com AES-256-GCM via src/lib/crypto.ts
  medical_history TEXT,   -- encrypt(plaintext) antes de armazenar
  allergies       TEXT,   -- encrypt(plaintext)
  medications     TEXT,   -- encrypt(plaintext)
  -- D-08: LGPD anonymization fields
  deleted_at      TIMESTAMPTZ,
  is_anonymized   BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- D-06: CPF único por tenant (não global — cada clínica tem seus próprios pacientes)
CREATE UNIQUE INDEX idx_patients_cpf_tenant ON public.patients(tenant_id, cpf)
  WHERE deleted_at IS NULL;

-- H-1: Index obrigatório para RLS performance
CREATE INDEX idx_patients_tenant_id ON public.patients(tenant_id);
```

### Padrão 3: Server Action com encrypt/decrypt

```typescript
// src/actions/patients.ts
'use server'
import { encrypt, decrypt } from '@/lib/crypto'
import { createClient } from '@/lib/supabase/server'
import { logBusinessEvent } from '@/lib/audit'

export async function createPatient(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Criptografar campos sensíveis ANTES de enviar ao banco
  const { error, data: patient } = await supabase.from('patients').insert({
    tenant_id: /* from headers x-user-id lookup */,
    full_name:       formData.get('full_name') as string,
    cpf:             formData.get('cpf') as string,          // plaintext
    medical_history: encrypt(formData.get('medical_history') as string || ''),
    allergies:       encrypt(formData.get('allergies') as string || ''),
    medications:     encrypt(formData.get('medications') as string || ''),
  }).select('id').single()

  if (!error && patient) {
    await logBusinessEvent({
      tenantId: /* tenant_id */,
      actorId: user!.id,
      action: 'patient.created',
      details: { patient_id: patient.id },  // NUNCA logar dados do paciente
    })
  }

  return error ? { error: error.message } : { success: true, id: patient!.id }
}
```

### Padrão 4: FullCalendar timeGridWeek com dropdown de dentista

```typescript
// src/components/agenda/AgendaCalendar.tsx
'use client'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { useQueryState } from 'nuqs'

interface Props {
  dentists: { id: string; full_name: string }[]
  events: CalendarEvent[]
}

export function AgendaCalendar({ dentists, events }: Props) {
  const [dentistId, setDentistId] = useQueryState('dentist')

  return (
    <div>
      <select value={dentistId ?? ''} onChange={e => setDentistId(e.target.value)}>
        {dentists.map(d => (
          <option key={d.id} value={d.id}>{d.full_name}</option>
        ))}
      </select>
      <FullCalendar
        plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        locale="pt-br"
        slotMinTime="07:00:00"
        slotMaxTime="20:00:00"
        allDaySlot={false}
        editable={true}           // drag-and-drop (D-01)
        selectable={true}         // clique para criar novo slot
        events={events.filter(e => e.dentistId === dentistId)}
        eventContent={renderEventContent}
        select={handleSelect}     // abre modal de novo agendamento
        eventDrop={handleEventDrop}
      />
    </div>
  )
}
```

[ASSUMED: eventContent e handlers específicos — verificar docs FullCalendar para API exata em v6]

### Padrão 5: Odontograma SVG com numeração FDI

```typescript
// src/components/odontogram/Tooth.tsx
'use client'

// Numeração FDI (padrão brasileiro)
// Superiores: 11-18 (direito), 21-28 (esquerdo)
// Inferiores: 31-38 (esquerdo), 41-48 (direito)

const STATUS_COLORS: Record<ToothStatus, string> = {
  higido:        '#4ade80',  // verde
  cariado:       '#ef4444',  // vermelho
  extraido:      '#6b7280',  // cinza escuro (X sobre dente)
  em_tratamento: '#f59e0b',  // amarelo/âmbar
  implante:      '#3b82f6',  // azul
  coroa:         '#a855f7',  // roxo
  selante:       '#06b6d4',  // ciano
  fraturado:     '#f97316',  // laranja
  restaurado:    '#84cc16',  // verde-limão
}

export type ToothStatus =
  | 'higido' | 'cariado' | 'extraido' | 'em_tratamento'
  | 'implante' | 'coroa' | 'selante' | 'fraturado' | 'restaurado'

interface ToothProps {
  number: number        // FDI number (11-18, 21-28, 31-38, 41-48)
  status: ToothStatus
  onClick: (number: number) => void
  readonly?: boolean
}

export function Tooth({ number, status, onClick, readonly = false }: ToothProps) {
  return (
    <g
      onClick={() => !readonly && onClick(number)}
      style={{ cursor: readonly ? 'default' : 'pointer' }}
      aria-label={`Dente ${number}: ${status}`}
    >
      <rect
        width={30} height={35}
        rx={4}
        fill={STATUS_COLORS[status]}
        stroke="#374151"
        strokeWidth={1}
      />
      {status === 'extraido' && (
        <>
          <line x1={5} y1={5} x2={25} y2={30} stroke="#111827" strokeWidth={2} />
          <line x1={25} y1={5} x2={5} y2={30} stroke="#111827" strokeWidth={2} />
        </>
      )}
      <text x={15} y={48} textAnchor="middle" fontSize={10} fill="#374151">
        {number}
      </text>
    </g>
  )
}
```

### Padrão 6: Assinatura digital com signature_pad + SHA-256

```typescript
// src/components/anamnesis/SignatureCanvas.tsx
'use client'
import { useRef, useEffect, useState } from 'react'
import SignaturePad from 'signature_pad'

interface Props {
  onSign: (dataUrl: string) => void
  onClear: () => void
}

export function SignatureCanvas({ onSign, onClear }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePad | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    padRef.current = new SignaturePad(canvas, { penColor: '#111827' })
    return () => padRef.current?.off()  // M-8: cleanup no unmount
  }, [])

  function handleConfirm() {
    const pad = padRef.current
    if (!pad || pad.isEmpty()) return
    onSign(pad.toDataURL('image/png'))  // PNG para SHA-256
  }

  function handleClear() {
    padRef.current?.clear()
    onClear()
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={600} height={200}
        className="border rounded-md bg-white touch-none"
        style={{ touchAction: 'none' }}
      />
      <button onClick={handleClear}>Limpar</button>
      <button onClick={handleConfirm}>Confirmar Assinatura</button>
    </div>
  )
}
```

```typescript
// src/actions/anamneses.ts — SHA-256 no servidor (D-16)
'use server'
import { createHash } from 'crypto'
import { headers } from 'next/headers'

export async function submitAnamnesis(formData: FormData, signatureDataUrl: string) {
  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for') ?? headersList.get('x-real-ip') ?? 'unknown'
  const userAgent = headersList.get('user-agent') ?? 'unknown'

  // SHA-256 do PNG base64 (D-16)
  const base64Data = signatureDataUrl.replace(/^data:image\/png;base64,/, '')
  const pngBuffer = Buffer.from(base64Data, 'base64')
  const signatureHash = createHash('sha256').update(pngBuffer).digest('hex')

  // Salvar anamnese — imutável após este INSERT (D-20)
  // ...insert na tabela anamneses com signature_hash, ip_address, user_agent, signed_at
}
```

### Padrão 7: PDF do prontuário com @react-pdf/renderer

```typescript
// src/app/api/patients/[id]/prontuario.pdf/route.ts
export const runtime = 'nodejs'  // CRÍTICO: não usar Edge (sem @react-pdf suporte)

import { renderToBuffer } from '@react-pdf/renderer'
import { ProntuarioPDF } from '@/components/pdf/ProntuarioPDF'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  // Buscar dados do paciente + médical_records (decrypt os campos sensíveis)
  // ...

  const buffer = await renderToBuffer(<ProntuarioPDF patient={patient} records={records} />)

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="prontuario-${params.id}.pdf"`,
    },
  })
}
```

**Restrição do @react-pdf/renderer:** Flexbox apenas — sem CSS Grid. Fonte com suporte latin extended necessária para caracteres brasileiros (ã, ç, ê). [VERIFIED: CLAUDE.md + npm peerDependencies]

### Anti-Padrões a Evitar

- **Nunca** usar `'use client'` na página de prontuário inteira — push para leaf components apenas (H-3 pattern)
- **Nunca** passar dados decriptados para o componente PDF via props client-side — decrypt no Route Handler server-side
- **Nunca** salvar a imagem PNG da assinatura em Supabase Storage sem hash de integridade
- **Nunca** criar agendamento sem verificar o constraint GIST — a tentativa de INSERT vai falhar com `ERROR 23P01: exclusion_violation` e deve ser capturada e retornada como erro do usuário
- **Nunca** usar `unstable_cache` sem `tenantId` no array de chave (C-3 — cross-tenant leak)
- **Nunca** logar CPF ou dados de saúde em `logBusinessEvent.details` — apenas IDs

---

## Don't Hand-Roll

| Problema | Não Construir | Usar em Vez | Por Quê |
|----------|--------------|-------------|---------|
| Anti-double-booking de agendamentos | Verificação em aplicação com SELECT + INSERT | EXCLUDE USING GIST no PostgreSQL | Race condition entre receptionistas simultâneas — apenas o constraint de banco é atômico |
| Geração de PDF | Puppeteer / html-to-pdf | `@react-pdf/renderer` | Puppeteer = 100MB+ binary, excede limite de 50MB da Vercel Function |
| Assinatura canvas | Canvas API manual | `signature_pad` v5.1.3 | Smooth interpolation, pressure sensitivity, touch/mouse unificado, zero dependências |
| Hash de integridade da assinatura | MD5 / CRC32 | SHA-256 via `crypto.createHash` do Node.js | Nativo, sem dependência, padrão forense |
| Formatação de datas BR | Moment.js / custom | `date-fns` + `date-fns-tz` | Suporte nativo a `America/Sao_Paulo`, `America/Manaus`, `America/Rio_Branco` |
| Estado de filtros da agenda | `useState` | `nuqs` (URL state) | `useState` quebra browser history; link compartilhável por role — recepcionista envia link da semana certa |
| Cache de dados do servidor | `useState` + `useEffect` | `@tanstack/react-query` | Cache, deduplicação, revalidação em background, devtools |

---

## Schema Completo das Tabelas (Phase 2)

### Tabela: patients

```sql
CREATE TABLE public.patients (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  registered_by   UUID        REFERENCES public.users(id),
  full_name       TEXT        NOT NULL,
  cpf             TEXT        NOT NULL,          -- plaintext D-06
  date_of_birth   DATE,
  phone           TEXT,
  email           TEXT,
  address         TEXT,
  medical_history TEXT,                           -- AES-256-GCM D-07
  allergies       TEXT,                           -- AES-256-GCM D-07
  medications     TEXT,                           -- AES-256-GCM D-07
  deleted_at      TIMESTAMPTZ,                    -- D-08 soft delete
  is_anonymized   BOOLEAN     NOT NULL DEFAULT false,  -- D-08
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_patients_cpf_tenant
  ON public.patients(tenant_id, cpf) WHERE deleted_at IS NULL;
CREATE INDEX idx_patients_tenant_id ON public.patients(tenant_id);
CREATE INDEX idx_patients_name ON public.patients(tenant_id, full_name);
```

### Tabela: appointments

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE public.appointments (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  dentist_id   UUID        NOT NULL REFERENCES public.users(id),
  patient_id   UUID        REFERENCES public.patients(id),
  start_time   TIMESTAMPTZ NOT NULL,
  end_time     TIMESTAMPTZ NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'agendado'
               CHECK (status IN ('agendado','confirmado','em_atendimento','concluido','cancelado')),
  notes        TEXT,
  source       TEXT        NOT NULL DEFAULT 'interno'  -- 'interno' | 'publico' (D-04)
               CHECK (source IN ('interno','publico')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT no_overlap EXCLUDE USING GIST (
    tenant_id  WITH =,
    dentist_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
  ) WHERE (status NOT IN ('cancelado'))
);
CREATE INDEX idx_appointments_tenant_id ON public.appointments(tenant_id);
CREATE INDEX idx_appointments_dentist_time
  ON public.appointments(tenant_id, dentist_id, start_time);
CREATE INDEX idx_appointments_patient_id ON public.appointments(patient_id);
```

### Tabela: medical_records

```sql
CREATE TABLE public.medical_records (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id     UUID        NOT NULL REFERENCES public.patients(id),
  appointment_id UUID        REFERENCES public.appointments(id),
  dentist_id     UUID        NOT NULL REFERENCES public.users(id),
  diagnosis      TEXT,
  treatment_plan TEXT,
  prescription   TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_medical_records_tenant_id  ON public.medical_records(tenant_id);
CREATE INDEX idx_medical_records_patient    ON public.medical_records(patient_id, created_at DESC);
CREATE INDEX idx_medical_records_dentist    ON public.medical_records(dentist_id);
```

### Tabela: dental_records

```sql
CREATE TABLE public.dental_records (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id     UUID        NOT NULL REFERENCES public.patients(id),
  appointment_id UUID        REFERENCES public.appointments(id),
  dentist_id     UUID        NOT NULL REFERENCES public.users(id),
  tooth_number   SMALLINT    NOT NULL CHECK (
    tooth_number BETWEEN 11 AND 18 OR  -- superiores direitos (FDI)
    tooth_number BETWEEN 21 AND 28 OR  -- superiores esquerdos
    tooth_number BETWEEN 31 AND 38 OR  -- inferiores esquerdos
    tooth_number BETWEEN 41 AND 48     -- inferiores direitos
  ),
  status         TEXT        NOT NULL CHECK (status IN (
    'higido','cariado','extraido','em_tratamento',
    'implante','coroa','selante','fraturado','restaurado'
  )),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dental_records_tenant_id ON public.dental_records(tenant_id);
CREATE INDEX idx_dental_records_patient   ON public.dental_records(patient_id, tooth_number);
```

### Tabela: anamneses

```sql
CREATE TABLE public.anamneses (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id      UUID        NOT NULL REFERENCES public.patients(id),
  -- Respostas CFO fixas em JSONB (D-18)
  responses       JSONB       NOT NULL DEFAULT '{}',
  -- Metadados de assinatura (D-16)
  signature_hash  TEXT        NOT NULL,  -- SHA-256 do PNG
  signature_url   TEXT,                  -- path no Supabase Storage (opcional)
  signed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address      INET,
  user_agent      TEXT,
  -- D-17: rastreamento do fluxo
  flow            TEXT        NOT NULL DEFAULT 'presencial'
                  CHECK (flow IN ('presencial','link_publico')),
  -- Token para o link público (D-17)
  token           UUID        UNIQUE,
  token_expires_at TIMESTAMPTZ,
  token_used_at   TIMESTAMPTZ,
  -- D-20: imutável após assinatura — sem UPDATE; soft delete apenas via patients.deleted_at
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_anamneses_tenant_id  ON public.anamneses(tenant_id);
CREATE INDEX idx_anamneses_patient_id ON public.anamneses(patient_id);
CREATE INDEX idx_anamneses_token      ON public.anamneses(token) WHERE token IS NOT NULL;
```

---

## Common Pitfalls

### Pitfall 1: EXCLUDE USING GIST sem btree_gist ativado

**O que dá errado:** A migration que cria o constraint `EXCLUDE USING GIST` falha com `ERROR: data type uuid has no default operator class for access method "gist"` porque a extensão `btree_gist` não está habilitada.

**Por que acontece:** PostgreSQL nativo usa o operador `=` via `btree_gist` para tipos não-geométricos (UUID, TEXT) no GIST index. Sem a extensão, somente tipos geométricos são suportados.

**Como evitar:** Sempre incluir `CREATE EXTENSION IF NOT EXISTS btree_gist;` na migration ANTES do CREATE TABLE. Supabase FREE plan inclui btree_gist na lista de extensões disponíveis. [VERIFIED: PITFALLS.md H-9]

**Sinal de alerta:** Migration aplicada, mas `\dx` no psql não mostra `btree_gist`. Teste imediato: tentar inserir dois agendamentos sobrepostos e verificar se o erro `23P01 exclusion_violation` é disparado.

---

### Pitfall 2: Decrypt de campo NULL (paciente sem histórico cadastrado)

**O que dá errado:** `decrypt(null)` em `src/lib/crypto.ts` lança exceção `Invalid ciphertext format`. Campos `medical_history`, `allergies`, `medications` são opcionais — muitos pacientes cadastrados pela recepção não terão esses dados.

**Por que acontece:** A função `decrypt()` espera string no formato `iv:authTag:ciphertext` mas recebe `null` ou `''`.

**Como evitar:**
```typescript
// CORRETO: guard antes de decrypt
const medicalHistory = patient.medical_history
  ? decrypt(patient.medical_history)
  : ''

// ERRADO:
const medicalHistory = decrypt(patient.medical_history)  // explode com null
```
[VERIFIED: leitura de src/lib/crypto.ts linha 42-50]

---

### Pitfall 3: FullCalendar — eventos do tenant errado em cache do TanStack Query

**O que dá errado:** Recepcionista de Clínica A vê agendamentos de Clínica B no calendário porque a chave de cache do TanStack Query não inclui `tenantId`.

**Por que acontece:** Mesma classe de bug que Pitfall C-3 (unstable_cache), mas no client-side cache do React Query.

**Como evitar:**
```typescript
// CORRETO: tenantId na query key
const { data } = useQuery({
  queryKey: ['appointments', tenantId, dentistId, weekStart],
  queryFn: () => fetchAppointments(tenantId, dentistId, weekStart),
})

// ERRADO:
const { data } = useQuery({
  queryKey: ['appointments', dentistId],  // sem tenantId — cross-tenant cache
  queryFn: () => fetchAppointments(dentistId, weekStart),
})
```
[VERIFIED: PITFALLS.md C-3 — mesma lógica aplicada ao React Query]

---

### Pitfall 4: Odontograma — RLS permite recepcionista editar via curl

**O que dá errado:** A RLS permite `INSERT` em `dental_records` para todos os roles do tenant, mas D-15 diz que apenas admin e dentista podem editar. Recepcionista faz request direto ao PostgREST e insere registro.

**Por que acontece:** Sem `WITH CHECK` específico de role na policy de INSERT/UPDATE, qualquer usuário autenticado do tenant pode escrever.

**Como evitar:**
```sql
-- Policy CORRETA para dental_records:
CREATE POLICY "dental_records_write" ON public.dental_records
  FOR INSERT
  WITH CHECK (
    tenant_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'dentist')
  );
CREATE POLICY "dental_records_read" ON public.dental_records
  FOR SELECT USING (tenant_id = get_my_tenant_id());
```
[VERIFIED: padrão de Phase 1 com `invitations_admin_write` — mesma estrutura USING + WITH CHECK]

---

### Pitfall 5: Anamnese — token público reutilizável (link enviado por e-mail pode ser reusado)

**O que dá errado:** Paciente recebe o link `/anamnese/[patient-id]/[token]` por e-mail. Assina e submete. Link permanece válido — qualquer pessoa com o link pode submeter uma segunda anamnese.

**Por que acontece:** O token não tem verificação de uso único no banco.

**Como evitar:**
```sql
-- token_used_at NULL = não usado; token_expires_at < now() = expirado
-- Na Server Action de submit:
UPDATE anamneses
  SET token_used_at = now()
  WHERE token = $1 AND token_used_at IS NULL AND token_expires_at > now()
RETURNING id;
-- Se UPDATE retorna 0 rows: token inválido/expirado/já usado → rejeitar
```
[ASSUMED: prazo de expiração padrão = 72h — razoável para uso odontológico, confirmar com usuário]

---

### Pitfall 6: PDF — caracteres brasileiros cortados (ã, ç, ê)

**O que dá errado:** PDF gerado com `@react-pdf/renderer` exibe `?` no lugar de `ã`, `ç`, `ê`, `õ` porque a fonte padrão (Helvetica built-in) não suporta Latin Extended.

**Por que acontece:** Fontes built-in do PDFKit/react-pdf não incluem Unicode completo.

**Como evitar:**
```typescript
import { Font } from '@react-pdf/renderer'

// Registrar fonte com suporte Latin Extended (ex: Roboto do Google Fonts)
Font.register({
  family: 'Roboto',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxK.woff2' },
    { src: 'https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmEU9fBBc4.woff2', fontWeight: 700 },
  ],
})

// Usar a fonte em todos os componentes PDF
const styles = StyleSheet.create({
  text: { fontFamily: 'Roboto' },
})
```
[VERIFIED: CLAUDE.md — "embed a Latin Extended font for full Brazilian Portuguese character support"]

---

### Pitfall 7: Link público de agendamento — race condition entre pacientes

**O que dá errado:** Dois pacientes acessam `/agendar/[clinic-slug]` ao mesmo tempo e ambos selecionam o slot das 10h. O primeiro POST cria o agendamento. O segundo POST passa pela validação client-side mas o INSERT falha com `23P01 exclusion_violation` no banco.

**Por que acontece:** O constraint GIST rejeita o segundo INSERT — isso é o comportamento correto. O problema é tratar o erro de forma user-friendly.

**Como evitar:** Na Server Action de agendamento público, capturar `code === '23P01'` e retornar `{ error: 'Este horário acabou de ser reservado. Por favor, escolha outro.' }`. Na UI pública, ao receber esse erro, recarregar os slots disponíveis.

[VERIFIED: PostgreSQL error code 23P01 = exclusion_violation]

---

## Pitfalls Herdados de Fases Anteriores (ainda relevantes)

| Pitfall ID | Relevância na Fase 2 | Mitigação |
|-----------|---------------------|-----------|
| C-3 (cache cross-tenant) | React Query usa `tenantId` na query key | Ver Pitfall 3 acima |
| H-1 (RLS sem index) | Indexes obrigatórios em todas as novas tabelas | Incluídos no schema acima |
| H-3 (use client muito alto) | Odontograma e Agenda são Client Components leaf | Página pai é Server Component |
| H-6 (LGPD erasure vs audit logs) | Anonimização de paciente preserva prontuários | `is_anonymized` flag + dados genéricos |
| H-9 (double-booking) | EXCLUDE USING GIST no banco | Schema acima |
| M-3 (timeout em PDF) | PDF de prontuário completo pode ser grande | `runtime = 'nodejs'` + maxDuration explícito |
| M-8 (Realtime memory leak) | Agenda com updates em real-time | Cleanup no useEffect return |

---

## Validation Architecture

### Test Framework

| Propriedade | Valor |
|-------------|-------|
| Framework | Vitest 4.1.8 |
| Config | `vitest.config.ts` (raiz do projeto) |
| Ambiente | `node` |
| Comando rápido | `npx vitest run src/__tests__/` |
| Suite completa | `npx vitest run` |
| Baseline atual | 59 testes GREEN (4 arquivos) |

### Mapa de Requisitos → Testes

| Req ID | Comportamento | Tipo de Teste | Comando Automatizado | Arquivo Existe? |
|--------|--------------|---------------|---------------------|-----------------|
| CLINIC-01 | FullCalendar renderiza eventos por dentist_id selecionado | Unit (filtro) | `npx vitest run src/__tests__/agenda/calendar.test.ts` | ❌ Wave 0 |
| CLINIC-02 | GIST constraint rejeita double-booking (`23P01`) | SQL content assertion | `npx vitest run src/__tests__/migrations/clinical.test.ts` | ❌ Wave 0 |
| CLINIC-03/04 | encrypt/decrypt roundtrip para medical_history | Unit | `npx vitest run src/__tests__/lib/crypto-patient.test.ts` | ❌ Wave 0 |
| CLINIC-03/04 | CPF único por tenant (partial index presente no SQL) | SQL content assertion | `npx vitest run src/__tests__/migrations/clinical.test.ts` | ❌ Wave 0 |
| CLINIC-05 | medical_records INSERT cria registro com dentist_id correto | Unit (action mock) | `npx vitest run src/__tests__/actions/medical-records.test.ts` | ❌ Wave 0 |
| CLINIC-06 | FDI tooth_number constraint permite 11-18, 21-28, 31-38, 41-48 | SQL content assertion | `npx vitest run src/__tests__/migrations/clinical.test.ts` | ❌ Wave 0 |
| CLINIC-06 | STATUS_COLORS contém todos os 9 status (D-13) | Unit (component) | `npx vitest run src/__tests__/components/odontogram.test.ts` | ❌ Wave 0 |
| CLINIC-07 | Query retorna prontuários de todos dentistas em ordem cronológica | Unit (query builder mock) | `npx vitest run src/__tests__/actions/medical-records.test.ts` | ❌ Wave 0 |
| CLINIC-08 | SHA-256 do PNG é determinístico (mesmo input = mesmo hash) | Unit | `npx vitest run src/__tests__/anamnesis/signature.test.ts` | ❌ Wave 0 |
| CLINIC-08 | Token de anamnese público expira e não pode ser reutilizado | Unit (action mock) | `npx vitest run src/__tests__/anamnesis/signature.test.ts` | ❌ Wave 0 |
| CLINIC-09 | `/agendar` está marcado como rota pública no proxy.ts | Source assertion | `npx vitest run src/__tests__/proxy/rbac.test.ts` | ✅ linha 136 |
| SEC-03 | SQL de migration contém `audit_table_changes` trigger em patients | SQL content assertion | `npx vitest run src/__tests__/migrations/clinical.test.ts` | ❌ Wave 0 |
| SEC-04 | Anonimização zera campos PII mantendo prontuário | Unit (action mock) | `npx vitest run src/__tests__/actions/patients.test.ts` | ❌ Wave 0 |
| SEC-04 | `is_anonymized` e `deleted_at` presentes no schema SQL | SQL content assertion | `npx vitest run src/__tests__/migrations/clinical.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Por commit de task:** `npx vitest run src/__tests__/` (toda a suite)
- **Por wave merge:** `npx vitest run && npx tsc --noEmit`
- **Phase gate (antes de /gsd-verify-work):** Suite completa GREEN + `next build` sem erros

### Wave 0 Gaps (arquivos a criar antes da implementação)

- [ ] `src/__tests__/migrations/clinical.test.ts` — SQL content assertions: btree_gist, EXCLUDE, tooth_number CHECK, audit triggers, is_anonymized
- [ ] `src/__tests__/actions/patients.test.ts` — encrypt/decrypt roundtrip, anonymize logic
- [ ] `src/__tests__/actions/medical-records.test.ts` — insert com dentist_id, query order
- [ ] `src/__tests__/components/odontogram.test.ts` — STATUS_COLORS, FDI numbers
- [ ] `src/__tests__/anamnesis/signature.test.ts` — SHA-256 determinism, token expiry
- [ ] `src/__tests__/agenda/calendar.test.ts` — event filtering by dentistId

---

## Security Domain

### Categorias ASVS Aplicáveis

| Categoria ASVS | Aplica | Controle Padrão |
|----------------|--------|-----------------|
| V2 Autenticação | sim | getUser() + @supabase/ssr (estabelecido em Phase 1) |
| V3 Gerenciamento de Sessão | sim | HTTP-only cookies (estabelecido em Phase 0) |
| V4 Controle de Acesso | sim | RLS por tenant_id + get_my_role() nas policies de dental_records |
| V5 Validação de Input | sim | Zod v3 em todos os formulários; tooth_number CHECK no banco |
| V6 Criptografia | sim | AES-256-GCM via src/lib/crypto.ts; SHA-256 para assinatura |
| V8 Data Protection | sim | Encrypt de medical_history/allergies/medications antes do INSERT |
| V13 API (token de anamnese pública) | sim | token UUID único, expires_at, used_at — single-use |

### Padrões de Ameaça Específicos para Esta Fase

| Padrão | STRIDE | Mitigação |
|--------|--------|-----------|
| Recepcionista edita odontograma via curl | Elevation of Privilege | RLS WITH CHECK: get_my_role() IN ('admin','dentist') em dental_records |
| Token de anamnese compartilhado/reutilizado | Spoofing | token UUID único + token_used_at + token_expires_at |
| Agendamento público sem autenticação — flooding | DoS | Rate limiting na rota pública; token de anamnese expira em 72h |
| Decrypt de campo de outro tenant via PostgREST | Information Disclosure | RLS USING tenant_id = get_my_tenant_id() em patients |
| PDF de prontuário de paciente de outro tenant | Information Disclosure | Route Handler verifica `patient.tenant_id = get_my_tenant_id()` antes de renderizar |
| Dados de saúde em logs de auditoria | Privacy Violation | `logBusinessEvent` recebe apenas IDs — nunca dados de saúde em `new_values` |
| LGPD: deletar paciente sem anonimizar prontuário | Repudiation | Server Action de delete implementa anonimização completa ANTES de setar deleted_at |
| Double-booking via race condition | Tampering | EXCLUDE USING GIST — atômico no banco, independente de race conditions na aplicação |

### Fluxo LGPD para Exclusão de Paciente (SEC-04)

```
1. Verificar role: apenas admin pode executar
2. Anonimizar patients row:
   - full_name → "Paciente Excluído"
   - cpf → "000.000.000-00"
   - phone → "(00) 00000-0000"
   - email → "anonimizado@excluido.local"
   - address → NULL
   - medical_history → NULL (dado de saúde — perda intencional)
   - allergies → NULL
   - medications → NULL
   - is_anonymized → true
   - deleted_at → now()
3. NÃO deletar medical_records (Lei 13.787/2018 — 20 anos)
4. NÃO deletar dental_records
5. NÃO deletar anamneses (imutável + assinatura jurídica)
6. logBusinessEvent({ action: 'patient.anonymized', details: { patient_id } })
7. Audit trigger captura UPDATE automaticamente
```

---

## Environment Availability

| Dependência | Requerido Por | Disponível | Versão | Fallback |
|-------------|--------------|-----------|--------|---------|
| Node.js | @react-pdf/renderer server-side | ✓ | v24.14.0 | — |
| TypeScript | Compilação | ✓ | 5.9.3 | — |
| Supabase CLI | db push migrations | ✓ | v2.105.0 | — |
| btree_gist extension | EXCLUDE USING GIST | [ASSUMED] disponível no Supabase FREE | — | Sem fallback — requerido |
| vitest | Testes | ✓ | 4.1.8 | — |
| npm registry | Instalar novos pacotes | ✓ | — | — |

**btree_gist:** Extensão disponível no Supabase FREE plan (consta na lista oficial de extensões disponíveis). A migration inclui `CREATE EXTENSION IF NOT EXISTS btree_gist` — se já estiver ativa, a instrução é no-op. [ASSUMED: verificar com `SELECT * FROM pg_available_extensions WHERE name = 'btree_gist'` no dashboard do Supabase]

---

## State of the Art

| Abordagem Antiga | Abordagem Atual | Quando Mudou | Impacto |
|-----------------|-----------------|--------------|---------|
| `react-signature-canvas` wrapper | `signature_pad` v5 headless | 2023+ | Sem wrapper React quebrável; API estável |
| Puppeteer para PDF no servidor | `@react-pdf/renderer` | 2022+ para serverless | Puppeteer = 100MB; Vercel function limit = 50MB |
| `moment.js` para timezone | `date-fns-tz` v3 | 2021+ | Moment.js deprecated; date-fns tree-shakeable |
| FullCalendar 5.x | FullCalendar 6.x | 2022 | FullCalendar 6 requer `@fullcalendar/core` como peer explícito |
| `useState` para filtros de agenda | `nuqs` (URL state) | 2024+ | Links compartilháveis, browser history funcional |

**Deprecated/obsoleto:**
- `react-signature-canvas` v1.x (alpha): wrapper desatualizado sobre signature_pad; usar signature_pad diretamente
- `@fullcalendar/resource-*` (Scheduler): licença comercial ~$500/ano — fora de escopo (D-01 deferred)

---

## Open Questions

1. **btree_gist ativado no projeto Supabase remoto?**
   - O que sabemos: Supabase FREE plan lista btree_gist como disponível
   - O que não está claro: se o projeto específico `jqjwyqlbbuqnrffdnlpp` já tem a extensão ativa
   - Recomendação: Wave 0 inclui verificação — `SELECT * FROM pg_available_extensions WHERE name = 'btree_gist'` no Supabase SQL Editor antes do push da migration

2. **Prazo de validade do token de anamnese pública (D-17)?**
   - O que sabemos: token deve ter prazo; uso único obrigatório (D-20)
   - O que não está claro: prazo padrão — 24h, 48h, 72h?
   - Recomendação: [ASSUMED] 72h — cobre o caso de dentista enviar link antes do fim de semana; confirmar com usuário

3. **Storage da imagem da assinatura (PNG)?**
   - O que sabemos: SHA-256 hash é obrigatório (D-16). Decisão não menciona armazenamento da imagem.
   - O que não está claro: armazenar o PNG no Supabase Storage ou apenas o hash?
   - Recomendação: Armazenar apenas o hash para MVP. A imagem pode ser reconstituída se necessário mas não é requisito clínico obrigatório. Registrar `signature_url` como nullable para upgrade futuro.

4. **Partições de audit_logs para julho/agosto 2026 já existem (criadas no Phase 1). Setembro/outubro ainda precisarão ser criadas antes de Phase 4.**
   - O que sabemos: partições 2026_07 e 2026_08 já existem (confirmado em 01-01-SUMMARY.md)
   - Recomendação: Plan de Phase 2 deve criar partição `2026_09` proativamente

---

## Assumptions Log

| # | Claim | Seção | Risco se Errado |
|---|-------|-------|-----------------|
| A1 | btree_gist disponível no projeto Supabase remoto FREE plan | Schema / Environment Availability | Migration falha; EXCLUDE USING GIST não funciona; requer fallback com advisory locks |
| A2 | FullCalendar v6 `timeGridWeek` locale pt-br funciona sem configuração adicional | Architecture Patterns Padrão 4 | Calendário exibe em inglês; requer importação explícita de locale |
| A3 | Token de anamnese pública expira em 72h | Schema tabela anamneses / Pitfall 5 | Prazo pode ser muito longo (risco jurídico) ou muito curto (UX ruim) |
| A4 | PNG da assinatura não precisa ser armazenado — apenas o SHA-256 | Schema anamneses | Auditoria forense requer a imagem original; risco de compliance |
| A5 | @react-pdf/renderer v4.5.1 renderiza PT-BR com fonte Roboto sem problemas | Pitfall 6 | Caracteres especiais cortados se font bundle não incluir Latin Extended |
| A6 | signature_pad v5.1.3 funciona corretamente em dispositivos touch no iOS Safari | Component Padrão 6 | Assinatura em tablet/iPad pode ter comportamento diferente do esperado |

---

## Sources

### Primary (HIGH confidence — verificados diretamente)
- `src/lib/crypto.ts` (leitura direta) — API de encrypt/decrypt, formato iv:authTag:ciphertext
- `src/lib/audit.ts` (leitura direta) — assinatura de logBusinessEvent, tenantId obrigatório
- `src/proxy.ts` (leitura direta) — `/agendar` já como rota pública, ROLE_ROUTES
- `supabase/migrations/*.sql` (leitura direta) — schema existente: clinics, users, invitations, patient_consents
- `package.json` (leitura direta) — dependências atuais: next 16.2.7, react 19.2.4, zod 3.25.76
- `.planning/research/PITFALLS.md` (leitura direta) — H-9 double-booking, C-3 cache, H-1 indexes
- npm registry (verificado via `npm view`) — versões: FullCalendar 6.1.20, @react-pdf/renderer 4.5.1, signature_pad 5.1.3, date-fns 4.4.0, nuqs 2.8.9
- `vitest` baseline: 59 testes GREEN confirmados via `npx vitest run`

### Secondary (MEDIUM confidence)
- `CLAUDE.md` — font Latin Extended para @react-pdf/renderer, FullCalendar Scheduler como opção futura, anti-patterns Puppeteer
- `.planning/phases/02-clinical-mvp/02-CONTEXT.md` — decisões D-01..D-20 do usuário
- `.planning/phases/01-auth-tenant-onboarding/01-01-SUMMARY.md` — schema atual no banco remoto

### Tertiary (LOW confidence — aguardam validação)
- A2: FullCalendar locale pt-br sem config adicional — não verificado em docs oficiais desta sessão
- A3: Prazo 72h para token de anamnese — estimativa razoável, não confirmada pelo usuário
- A6: signature_pad comportamento em iOS Safari touch — reportado como funcional na comunidade, não testado

---

## Project Constraints (from CLAUDE.md)

Diretivas obrigatórias extraídas do CLAUDE.md que o planner DEVE verificar:

| Constraint | Regra | Impacto no Plano |
|------------|-------|-----------------|
| **Stack imutável** | Next.js 15 + TypeScript + Supabase + Vercel | Sem alternativas de framework |
| **LGPD obrigatório** | RLS, soft delete, audit trail, mascaramento | SEC-03, SEC-04 são bloqueadores |
| **@supabase/ssr** | Nunca `auth-helpers-nextjs` (deprecated 2024) | Clientes já corretos no projeto |
| **getUser() não getSession()** | Middleware deve usar getUser() | proxy.ts já correto |
| **Zod v3** | Não usar v4 (`@hookform/resolvers` tem edge cases com v4) | zod@3.25.76 já no projeto |
| **@react-pdf/renderer** | Nunca Puppeteer na Vercel | Limite 50MB da Function |
| **Flexbox only em PDF** | CSS Grid não suportado pelo @react-pdf | Layouts de prontuário usam apenas Flexbox |
| **Fonte Latin Extended** | Embed em @react-pdf para PT-BR | Registrar fonte Roboto ou similar |
| **Node.js runtime** | PDF generation — não Edge Runtime | `export const runtime = 'nodejs'` no route handler |
| **FullCalendar free** | `@fullcalendar/resource-*` não instalar | Apenas react, daygrid, timegrid, interaction |
| **service role key server-only** | `import 'server-only'` em admin.ts | Já implementado |
| **RLS com USING + WITH CHECK** | Nunca apenas USING em policies de escrita | dental_records write policy |
| **Index em tenant_id** | Toda tabela com tenant_id deve ter index | Incluído no schema acima |
| **Migrations em supabase/migrations/** | Nunca alterar schema pelo dashboard em produção | `supabase db push` workflow |
| **shadcn add primeiro** | Usar `npx shadcn@latest add <component>` antes de @base-ui/react | Formulários de paciente/agendamento usam shadcn |
| **@base-ui/react apenas para Button** | Não instalar mais componentes @base-ui além do Button existente | Button.tsx já implementado |
| **Sem Evolution API / Baileys** | WhatsApp ToS — não relevante nesta fase | N/A Fase 2 |

---

## Metadata

**Confidence breakdown:**
- Stack e versões: HIGH — verificado no npm registry e package.json
- Schema SQL: HIGH — baseado em padrões existentes confirmados nas migrations de Phase 0+1
- FullCalendar patterns: MEDIUM — API verificada via peer deps e CLAUDE.md; eventContent handlers são ASSUMED
- signature_pad integration: MEDIUM — API é estável; comportamento iOS ASSUMED
- LGPD compliance: MEDIUM — baseado em PITFALLS.md H-6 e decisões CONTEXT.md D-08/D-20
- btree_gist availability: MEDIUM — Supabase docs listam como disponível no FREE plan; projeto específico não verificado

**Research date:** 2026-06-05
**Valid until:** 2026-07-05 (30 dias — stack estável; FullCalendar e @react-pdf não têm histórico de breaking changes frequentes)
