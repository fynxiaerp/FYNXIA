# Phase 2: Clinical MVP — Context

**Coletado:** 2026-06-05
**Status:** Pronto para planejamento

<domain>
## Escopo da Fase

Esta fase entrega o fluxo clínico completo: agenda semanal por dentista (FullCalendar free, duração configurável, 5 status), cadastro e edição de paciente (CPF plaintext + dados de saúde AES-256), prontuário clínico com campos estruturados, odontograma SVG interativo com 8+ status e histórico por dente, anamnese digital com canvas de assinatura obrigatória (2 fluxos: link público + presencial), PDF do prontuário, e link de agendamento público com bloqueio GIST.

**Não inclui:** FullCalendar Scheduler (view multi-dentista paralela — futuro), customização de formulário de anamnese por clínica, D4Sign (ICP-Brasil — futuro), foto de paciente, gestão financeira (Fase 3).

</domain>

<decisions>
## Decisões de Implementação

### Agenda (CLINIC-01, CLINIC-02, CLINIC-09)
- **D-01:** FullCalendar **free** (sem licença Scheduler). View semanal por dentista — dentista selecionado por dropdown (não colunas paralelas). Drag-and-drop dentro do mesmo dentista permitido.
- **D-02:** Duração dos slots **livre e configurável** — cada agendamento tem `start_time` e `end_time` (TIMESTAMPTZ). O EXCLUDE USING GIST bloqueia conflito com `tstzrange(start_time, end_time, '[)')` por dentista.
- **D-03:** 5 status de agendamento: `agendado`, `confirmado`, `em_atendimento`, `concluido`, `cancelado`. Recepcionista gerencia transições.
- **D-04:** Agendamento público (CLINIC-09) — paciente escolhe data/hora no link público `/agendar/[clinic-slug]` e o slot é bloqueado imediatamente na agenda (não fila de confirmação). O GIST constraint cobre também esses agendamentos.

### Ficha do Paciente (CLINIC-03, CLINIC-04, SEC-04)
- **D-05:** Ficha do paciente contém: nome completo, CPF, data de nascimento, telefone, e-mail, endereço, histórico de saúde, alergias, medicamentos em uso. **Sem foto no MVP.**
- **D-06:** **CPF armazenado em plaintext** com índice UNIQUE por tenant (permite busca eficiente na recepção). RLS garante isolamento.
- **D-07:** Campos criptografados com AES-256 (`src/lib/crypto.ts`): `medical_history`, `allergies`, `medications`. CPF e dados de identificação ficam em plaintext.
- **D-08:** "Excluir" paciente **anonimiza** (nome → "Paciente Excluído", CPF → "000.000.000-00", telefone/e-mail → valores genéricos), mas preserva prontuários clínicos e histórico (Lei 13.787/2018 — 20 anos). `deleted_at` setado para soft delete. Campo `is_anonymized: boolean` indica estado.

### Prontuário Clínico (CLINIC-05, CLINIC-07)
- **D-09:** Prontuário usa **campos estruturados separados**: `diagnosis` (TEXT), `treatment_plan` (TEXT), `prescription` (TEXT). Sem rich text/TipTap. Cada atendimento cria um novo registro `medical_records` com timestamp.
- **D-10:** Histórico de atendimentos (CLINIC-07) exibe prontuários de **todos os dentistas da clínica** em ordem cronológica — não limitado ao dentista logado.
- **D-11:** PDF do prontuário gerado com `@react-pdf/renderer` — histórico completo do paciente para impressão/arquivamento. Endpoint: `GET /api/patients/[id]/prontuario.pdf` (Node.js runtime).

### Odontograma (CLINIC-06)
- **D-12:** Implementação via **SVG customizado React** — 32 dentes clicáveis, sem dependência externa. Cada dente é um componente `<Tooth />` com props `number`, `status`, `onClick`.
- **D-13:** **8+ status de dente**: `higido`, `cariado`, `extraido`, `em_tratamento`, `implante`, `coroa`, `selante`, `fraturado`, `restaurado`. Cada status tem uma cor distinta no SVG.
- **D-14:** **Histórico por dente rastreado** — tabela `dental_records` com snapshot por atendimento: `patient_id`, `tooth_number` (1-32), `status`, `notes`, `dentist_id`, `appointment_id`, `created_at`. Permite ver evolução do tratamento dente a dente.
- **D-15:** **Admin e dentista** podem editar o odontograma. Recepcionista e patient têm acesso somente leitura.

### Anamnese Digital (CLINIC-08)
- **D-16:** Implementação via **canvas de assinatura manuscrita** (`react-signature-canvas` ou similar) + SHA-256 hash da imagem PNG + timestamp ISO + IP + user-agent registrados. Sem D4Sign no MVP (custo; deferred para compliance avançado).
- **D-17:** **Dois fluxos de preenchimento**:
  1. **Link público** (`/anamnese/[patient-id]/[token]`) — enviado ao paciente por e-mail/WhatsApp antes da consulta. Paciente preenche sem login.
  2. **Presencial** — recepcionista ou dentista abre o formulário no sistema e paciente assina na tela.
- **D-18:** Formulário de anamnese **fixo padrão CFO** — perguntas pré-definidas sobre alergias, medicamentos, doenças crônicas, hipertensão, diabetes, gravidez, etc. Sem customização por clínica no MVP.
- **D-19:** Assinatura canvas **obrigatória** para submeter o formulário. Sem assinatura, o botão "Assinar e Enviar" fica desabilitado.
- **D-20:** Registro de anamnese é **imutável após assinatura** (apenas visualização posterior). Nova anamnese em consultas futuras cria um novo registro.

### Discretion do Claude
- Numeração exata dos dentes no SVG (FDI vs. Universal system) — usar FDI por padrão no Brasil
- Schema exato da tabela `appointments` além dos campos discutidos
- Estrutura de componentes do FullCalendar (customização de eventContent)
- Validação Zod dos formulários de paciente e prontuário
- Cores exatas dos status do odontograma no SVG

</decisions>

<canonical_refs>
## Referências Canônicas

**Agentes de downstream DEVEM ler estes arquivos antes de planejar ou implementar.**

### Fases Anteriores
- `.planning/phases/01-auth-tenant-onboarding/01-CONTEXT.md` — decisões D-01..D-20 (RBAC, mascaramento, audit)
- `.planning/phases/01-auth-tenant-onboarding/01-01-SUMMARY.md` — schema DB atual (clinics, users, invitations, patient_consents, users_masked view)
- `.planning/phases/00-foundation/00-CONTEXT.md` — D-01..D-11 (schema, criptografia, proxy.ts)
- `.planning/phases/00-foundation/00-02-SUMMARY.md` — audit_logs schema + triggers

### Requisitos
- `.planning/REQUIREMENTS.md` — IDs Fase 2: CLINIC-01..09, SEC-03, SEC-04
- `.planning/ROADMAP.md` — success criteria da Fase 2 (5 critérios verificáveis)

### Segurança e Arquitetura
- `.planning/research/PITFALLS.md` — pitfalls C-1..C-6 já resolvidos; SEC-04 soft delete obrigatório
- `CLAUDE.md` — stack técnica: @react-pdf/renderer (não Puppeteer), FullCalendar, shadcn/ui

### Padrões de Código Existentes
- `src/lib/crypto.ts` — AES-256-GCM encrypt/decrypt para campos sensíveis
- `src/lib/audit.ts` — logBusinessEvent (padrão de auditoria manual)
- `src/actions/auth.ts` e `src/actions/invitations.ts` — padrão de Server Actions com rollback

</canonical_refs>

<code_context>
## Código Existente Relevante

### Assets Reutilizáveis
- `src/lib/crypto.ts` — AES-256-GCM para `medical_history`, `allergies`, `medications`
- `src/lib/audit.ts` — logBusinessEvent para ações clínicas (criar prontuário, assinar anamnese)
- `src/lib/supabase/admin.ts` — createAdminClient para bypass de RLS em operações privilegiadas
- `src/components/ui/button.tsx` — shadcn Button; shadcn completo disponível via `npx shadcn@latest add`
- `src/proxy.ts` — ROLE_ROUTES já define acesso por role; extensível para rotas clínicas

### Padrões Estabelecidos
- **Server Actions** com rollback compensatório (ver signUpClinic, acceptInvitation)
- **Auditoria híbrida**: trigger automático + logBusinessEvent manual
- **Criptografia seletiva**: plaintext para busca, AES-256 para dados sensíveis em `sensitive_data` TEXT
- **Migrations versionadas** em `supabase/migrations/` + `supabase db push`

### Pontos de Integração
- `public.users` — FK para pacientes (patients.registered_by, appointments.dentist_id)
- `public.clinics` — FK raiz de todas as tabelas clínicas (tenant isolation via RLS)
- `public.audit_logs` — trigger já instalado em clinics/users; expandir para patients/appointments/medical_records
- `src/proxy.ts` — adicionar `/clinica/pacientes`, `/clinica/agenda`, `/anamnese` às rotas permitidas por role

</code_context>

<specifics>
## Referências Específicas

- FullCalendar free: `@fullcalendar/react`, `@fullcalendar/daygrid`, `@fullcalendar/timegrid`, `@fullcalendar/interaction` — sem `@fullcalendar/resource-*` (Scheduler)
- EXCLUDE USING GIST: `tstzrange(start_time, end_time, '[)') && tstzrange(start_time, end_time, '[)')` com extensão `btree_gist` habilitada
- FDI tooth numbering: dentes 11-18, 21-28 (superiores), 31-38, 41-48 (inferiores) — padrão brasileiro
- `react-signature-canvas` para canvas de assinatura (ou alternativa headless como `signature_pad`)
- SHA-256 do canvas PNG: `crypto.createHash('sha256').update(pngBuffer).digest('hex')` — Node.js crypto built-in
- PDF prontuário: `@react-pdf/renderer` — Flexbox layout apenas (sem CSS Grid); fonte latin extended para caracteres brasileiros

</specifics>

<deferred>
## Ideias Diferidas

- **FullCalendar Scheduler (~$500/ano)** — view multi-dentista em colunas paralelas. Adquirir quando a clínica tiver 3+ dentistas simultâneos.
- **D4Sign / ICP-Brasil** — assinatura com validade jurídica máxima. Integrar quando compliance odontológico avançado for requisito de venda.
- **Customização de anamnese por clínica** — editor de formulários JSON. Fase posterior.
- **Foto do paciente** — upload para Supabase Storage. Fase posterior.
- **Módulo de estoque odontológico** — fora do escopo v1.
- **Teleconsulta / prontuário por voz** — risco regulatório; validar antes de implementar.

</deferred>

---

*Phase: 02-clinical-mvp*
*Contexto coletado: 2026-06-05*
