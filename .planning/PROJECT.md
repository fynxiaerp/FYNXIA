# FYNXIA ERP Odontológico

## What This Is

FYNXIA é um ERP SaaS multi-tenant para clínicas odontológicas que unifica gestão clínica (agenda, prontuário, odontograma), gestão financeira (fluxo de caixa, faturamento, conciliação) e automação por IA (copiloto contextual e agentes autônomos). Destinado a dentistas, recepcionistas e administradores de clínicas e redes de franquias no Brasil.

## Core Value

Um dentista deve conseguir ver a agenda do dia, registrar atendimento e fechar o caixa — tudo em menos de 3 cliques por etapa, com dados protegidos por LGPD.

## Requirements

### Validated

#### Auth & Tenant Onboarding (Validated in Phase 1)
- [x] Usuário pode criar conta com e-mail e senha via Supabase Auth — `signUpClinic` cria clinic + user atomicamente com rollback compensatório
- [x] Usuário pode fazer login e manter sessão ativa — `updateSession` via proxy.ts; `signInWithPassword` + cookies HTTP-only
- [x] Usuário pode fazer logout de qualquer página — `signOut` Server Action com redirect para /login
- [x] Middleware usa getUser() — proxy.ts usa exclusivamente `getUser()`; zero `getSession()` no codebase
- [x] Sistema suporta 4 perfis com RBAC — ROLE_ROUTES matrix em proxy.ts; admin/dentist/receptionist/patient/superadmin
- [x] Dados isolados por tenant_id via RLS — `public.clinics` (renomeada de tenants); `get_my_tenant_id()` preservado; isolamento verificado em produção
- [x] CPF/e-mail mascarados — view `users_masked` com CASE-based masking por role
- [x] Consentimento LGPD — tabela `patient_consents` criada com tipos: data_processing, marketing_whatsapp, medical_record_sharing, ai_processing
- [x] Invite por e-mail (Resend) + criação direta — `createInvitation` modo email/direct; 24h expiração; re-invite revoga anterior
- [x] Deploy em produção — `fynxia.vercel.app` funcionando com gru1 (São Paulo) + todas env vars

#### Infraestrutura (Validated in Phase 0: Foundation)
- [x] Deploy automatizado na Vercel com CI/CD — `vercel.json` pina gru1 (São Paulo); gru1 region + Fluid Compute configurados
- [x] Schema de banco no Supabase com migrations versionadas — 2 migrations aplicadas em sa-east-1; `src/types/database.types.ts` gerado ao vivo
- [x] Variáveis sensíveis gerenciadas via Vercel environment variables — `.env.local.example` documenta contrato; `server-only` guards em todos os clientes privilegiados
- [x] Dados isolados por tenant_id (multi-tenant) com RLS no Supabase — `get_my_tenant_id()` + `get_my_role()` SECURITY DEFINER; RLS em 3 tabelas; C-1 resolvido
- [x] Todas as ações sensíveis registradas em audit_log imutável — `audit_logs` com DELETE/UPDATE = false via RLS

#### Clínica (Validated in Phase 2)
- [x] Agenda semanal multi-dentista com anti-double-booking (EXCLUDE GIST) — FullCalendar timeGridWeek
- [x] CRUD de pacientes com CPF, dados de saúde (AES-256) e contato + anonimização LGPD
- [x] Prontuário clínico com diagnóstico, plano de tratamento e prescrição (histórico cronológico)
- [x] Odontograma interativo SVG por dente (32 FDI, 9 status)
- [x] Anamnese digital com assinatura (signature_pad + SHA-256 + token single-use)
- [x] Link de agendamento online público com slot locking atômico

#### Financeiro (Validated in Phase 3)
- [x] Fluxo de caixa mensal (entradas/saídas) em BRL
- [x] Lançamento de transações (receita/despesa) com categoria
- [x] Contas a receber com status (pendente/pago/vencido derivado) + parcelamento
- [x] Pix/boleto via Asaas (PaymentGateway provider-agnostic) + webhook idempotente
- [x] Recibo de consulta em PDF (@react-pdf/renderer)

#### Comunicações (Validated in Phase 4)
- [x] Confirmação/lembrete de consulta via WhatsApp (Meta Cloud API) + e-mail (Resend)
- [x] Jobs assíncronos via outbox pattern + Vercel Cron (substitui pg_cron/pgmq do FREE plan)
- [x] Régua de cobrança automática no vencimento/atraso

#### IA / Copiloto (Validated in Phase 5)
- [x] Copiloto IA em toda tela (Vercel AI Gateway + AI SDK v6, read-only, PII masking, ZDR)
- [x] Agente de confirmação de consultas via WhatsApp (inbound webhook sender-bound, cross-tenant-safe)
- [x] Agente de cobrança de inadimplentes com mensagem personalizada por IA

#### UX / App Shell (Validated in Phase 6)
- [x] Dual-theme (claro clínico + dark/neon da marca) em tokens FYNXIA, WCAG-AA
- [x] App shell com sidebar persistente colapsável + PageHeader + estados loading/empty/error

### Active

_Nenhum — v1.0 entregue. Próximo milestone definido via `/gsd-new-milestone`._

### Out of Scope (v1)

- App mobile nativo — PWA é suficiente para v1
- Integração com planos de saúde/convênios — complexidade regulatória alta, v2
- Emissão de NF-e fiscal — necessita certificado digital, v2
- Módulo de RH / folha de pagamento — v2
- Relatórios BI avançados — dashboard simples é suficiente para v1

## Context

- **Arquitetura documentada** em `FYNXIA-ERP.md` e `ARQUITETURA.docx` — análise completa já realizada
- **Wireframes aprovados** para Dashboard, Agenda, Ficha do Paciente e Fluxo de Caixa
- **Supabase já criado** pelo usuário — URL e chaves disponíveis
- **Stack decidida**: Next.js 15 App Router + TypeScript + Tailwind v4 + shadcn/ui + @base-ui + Supabase + Vercel
- **Mercado**: Brasil, setor odontológico, foco em clínicas individuais e pequenas redes
- **Conformidade**: LGPD obrigatório; HIPAA e CFO a considerar

### Estado atual (pós-v1.0)
- **Shipped:** v1.0 MVP em 2026-06-12 — 7 fases, 32 planos, ~76k linhas TS. Live em fynxia.vercel.app.
- **Stack em produção:** Next.js 15 + Supabase (sa-east-1, FREE plan) + Vercel (gru1) + Tailwind v4 + AI SDK v6.
- **Gated em setup externo (não-código):** conta Asaas (sandbox Pix), verificação Meta Business + templates WhatsApp, `AI_GATEWAY_API_KEY`, `CRON_SECRET`. Upgrade Supabase Pro habilita Auth Hook + pg_cron/pgmq.
- **Dívida técnica conhecida:** Zod pinado em v3; audit cross-fase do milestone não executado (cada fase verificada individualmente).

## Constraints

- **Tech Stack**: Next.js 15 (App Router) + TypeScript (strict) + Supabase + Vercel — decisão tomada, não renegociar
- **Segurança**: LGPD obrigatório — RLS, soft delete, audit trail, mascaramento de dados sensíveis
- **Performance**: Latência < 200ms, 1.000+ usuários simultâneos
- **Pagamentos**: Asaas (primário, BR) + Stripe (secundário) — ambos necessários
- **Comunicação**: WhatsApp Business API + SendGrid/Resend (e-mail)
- **Disponibilidade**: 99,9% uptime — Supabase + Vercel garantem

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Next.js 15 App Router (upgrade do 14) | Opt-in caching melhor para freshness de ERP; Turbopack dev | ✓ Good — usado em produção |
| Supabase como BaaS | Auth + DB + Storage + Realtime em um lugar, RLS nativo | ✓ Good |
| Multi-tenant via RLS (SECURITY DEFINER, sem Auth Hook) | Isolamento sem schemas separados; compatível com FREE plan | ✓ Good — isolamento verificado em prod |
| @supabase/ssr (não auth-helpers depreciado) | Pacote oficial atual; auth em Server Components | ✓ Good |
| Vercel AI Gateway + AI SDK v6 | Observabilidade, fallbacks, ZDR para LGPD | ✓ Good |
| shadcn/ui + @base-ui (render-prop, sem asChild) + Tailwind v4 | Componentes acessíveis customizáveis | ✓ Good |
| Asaas via REST direto (sem SDK community) | Pix/boleto BR nativo; controle de idempotência | ✓ Good — sandbox live pendente de conta |
| Outbox pattern + Vercel Cron (não pg_cron/pgmq) | pg_cron/pgmq são Pro-only; outbox entrega o mesmo no FREE | ✓ Good — adapter troca no upgrade Pro |
| Zod v3 (pin) | hookform/resolvers v5 tem issues com v4 | ⚠️ Revisit — migrar quando resolvers estabilizar |
| MVP Clínica + Financeiro paralelos | Entregas simultâneas aceleram validação | ✓ Good |

## Evolution

Este documento evolui a cada transição de fase e marco de milestone.

**Após cada fase** (via `/gsd-transition`):
1. Requisitos invalidados? → Mover para Out of Scope com razão
2. Requisitos validados? → Mover para Validated com referência da fase
3. Novos requisitos emergiram? → Adicionar em Active
4. Decisões a registrar? → Adicionar em Key Decisions
5. "What This Is" ainda preciso? → Atualizar se divergiu

**Após cada milestone** (via `/gsd-complete-milestone`):
1. Revisão completa de todas as seções
2. Core Value ainda correto?
3. Auditar Out of Scope — razões ainda válidas?
4. Atualizar Context com estado atual

---
*Last updated: 2026-06-12 — after v1.0 MVP milestone (Phases 0–6 shipped)*
