# Milestone v1.0 — FYNXIA ERP — Resumo do Projeto

**Gerado:** 2026-06-11
**Propósito:** Onboarding de time e revisão de projeto
**Status:** 6/6 fases completas · 24/24 planos · 47/47 requisitos implementados (em código) · 368 testes GREEN

---

## 1. Visão Geral

**FYNXIA** é um ERP SaaS multi-tenant para clínicas odontológicas que unifica gestão clínica (agenda, prontuário, odontograma), gestão financeira (Pix/boleto, fluxo de caixa, recebíveis) e automação por IA (copiloto contextual + agentes autônomos). Público: dentistas, recepcionistas e administradores de clínicas no Brasil.

**Core value:** um dentista vê a agenda do dia, registra atendimento e fecha o caixa em <3 cliques por etapa, com dados protegidos por LGPD.

**Live:** https://fynxia.vercel.app (deploy contínuo via GitHub → Vercel, região gru1).

---

## 2. Arquitetura & Decisões Técnicas

**Stack:** Next.js 16 (App Router) + TypeScript strict · Supabase (Postgres, sa-east-1) · Vercel (gru1) · shadcn/ui + @base-ui/react + Tailwind v4 · TanStack Table + nuqs + Zustand · RHF + Zod v3 · vitest.

Decisões fundadoras (com rationale):
- **Multi-tenant via RLS + SECURITY DEFINER** (`get_my_tenant_id()`/`get_my_role()`) — sem Custom Access Token Hook (Pro-only); compatível com Supabase FREE. RLS com `USING` + `WITH CHECK` e `tenant_id` indexado em toda tabela.
- **Supabase FREE no MVP** — upgrade para Pro é o gatilho para pg_cron/pgmq e o Auth Hook (path de performance documentado).
- **AES-256-GCM seletivo** — dados de saúde (medical_history/allergies/medications) criptografados na Server Action; CPF plaintext (busca na recepção), mascarado em listagens/logs.
- **Pagamentos: Asaas via REST direto** atrás de uma abstração `PaymentGateway` (provider-agnostic: `provider`/`provider_charge_id`) — porta aberta para outros gateways sem mudança de schema.
- **Async/mensageria: padrão outbox** (`message_outbox` + `MessageQueue` interface + worker em Vercel Cron) no lugar de pg_cron/pgmq (FREE) — mesmo outcome, troca para pgmq no Pro atrás da interface.
- **IA: Vercel AI Gateway + AI SDK v6** (`anthropic/claude-sonnet-4.6`), tool-calling com ferramentas read-only tenant-scoped + **mascaramento de PII** e **zero data retention** — copiloto nunca recebe dado cru de paciente (estratégia LGPD que fecha a Q6, sem DPA formal).
- **WhatsApp: Meta Cloud API oficial apenas** (nunca Evolution/Baileys — ToS/risco existencial); templates utility.
- **PDF: @react-pdf/renderer** (Flexbox, runtime nodejs) — sem Puppeteer (limite de função Vercel).
- **CSP estática** via `next.config.ts` (sem nonce, que forçaria render dinâmico) — `connect-src` libera Supabase (https+wss) e Asaas.
- **Lições de build** (recorrentes): credenciais lidas em **call-time** (não module-scope) para o `next build` não quebrar; singletons lazy (Resend); módulos `'use server'` só exportam async (testes via source-inspection).

---

## 3. Fases Entregues

| Fase | Nome | Status | Resumo |
|------|------|--------|--------|
| 0 | Foundation | ✅ Complete | Scaffold Next.js, 3 clients Supabase, middleware seguro (getUser), RLS SECURITY DEFINER, AES-256, gru1 |
| 1 | Auth & Tenant Onboarding | ✅ Complete | Signup de clínica, login/logout/reset, RBAC (admin/dentist/receptionist/patient), convites, mascaramento PII |
| 2 | Clinical MVP | ✅ Complete | Pacientes (CRUD + LGPD), agenda FullCalendar anti-double-booking (GIST), prontuário, odontograma SVG FDI, anamnese assinada, agendamento público |
| 3 | Financial MVP | ✅ Complete | Cobrança Pix/boleto (Asaas) + webhook idempotente, recebíveis/parcelas, fluxo de caixa, recibo PDF, régua de cobrança (Vercel Cron + Resend) |
| 4 | Communications & Async | ✅ Complete | WhatsApp Cloud API + outbox/worker, lembretes (WhatsApp+e-mail) via cron diário, canal WhatsApp na régua, headers SEC-06 |
| 5 | AI Agents | ✅ Complete | Copiloto (sidebar em toda tela, tool-calling PII-masked, ZDR, também HELP), agente de confirmação (webhook inbound + status), agente de cobrança (LLM + link Asaas real) |

---

## 4. Cobertura de Requisitos (47/47)

Todos os requisitos v1 estão implementados e verificados em código:
- ✅ INFRA-01..07, SEC-01..08 (segurança/LGPD/infra)
- ✅ AUTH-01..07 (autenticação + RBAC + isolamento)
- ✅ CLINIC-01..09 (agenda, pacientes, prontuário, odontograma, anamnese, agendamento público)
- ✅ FIN-01..08 (fluxo de caixa, transações, recebíveis, Pix/boleto, parcelas, régua, recibo PDF)
- ⚠️ FIN-09 (webhook idempotente) — **código completo + unit-testado**; "pending" na traceability até o replay live no sandbox Asaas confirmar idempotência
- ✅ COMMS-01..04 (WhatsApp/e-mail, templates, async) — código completo; envio live pende verificação Meta
- ✅ AI-01..03 (copiloto, agente de confirmação, agente de cobrança) — código completo; uso live pende AI_GATEWAY_API_KEY + Meta

**Verificação:** cada fase passou por code review (achados critical/warning corrigidos) + gsd-verifier (goal-backward). Itens "live" registrados como UAT humano por fase.

---

## 5. Log de Decisões-Chave (por fase)

- **D (F2):** CPF plaintext + AES-256 em saúde; dental_records INSERT-only (preserva histórico); anamnese pública via service role + token single-use; agendamento público `patient_id=null` (sem placeholder de CPF).
- **D (F3):** schema financeiro provider-agnostic; "vencido" derivado em read-time (sem coluna stored); webhook_events service-role only para dedup; integridade do webhook lança do `receivable.value` confiável (não do payload); centavos de parcela exatos.
- **D (F4):** COMMS-04 via outbox+Vercel Cron (pgmq deferido pro Pro); cron auth fail-closed + timing-safe; e-mail durável via outbox; E.164.
- **D (F5):** copiloto tool-calling tenant-scoped + PII mascarada + ZDR; read-only no v1 (write-via-chat = v2); copiloto também é HELP (data + how-to); agentes ambos LLM-driven; link Asaas sempre real (`getInvoiceUrl`, nunca fabricado); inbound free-text vinculado ao telefone do remetente (fix cross-tenant).

(Tabela completa em `.planning/STATE.md` → Key Decisions Made.)

---

## 6. Tech Debt & Itens Deferidos

**UAT live pendente (depende de setups externos, não de código):**
- `CRON_SECRET` no Vercel → ativa lembretes por e-mail (F4).
- Conta/sandbox **Asaas** → Pix/boleto live + replay de webhook (FIN-09) + link de cobrança (F3/F5).
- **Verificação Meta Business** (7-14 dias) → todo o WhatsApp (F4/F5): lembretes, confirmação, cobrança.
- `AI_GATEWAY_API_KEY` no Vercel → copiloto live (F5).

**Deferido para v2:** dashboard de franquias (agregação cross-tenant), BI avançado, app mobile nativo, NF-e/NFSe fiscal, voice-to-text, ações de escrita via copiloto, multi-gateway de pagamento real (Stripe/PagSeguro/Mercado Pago/Infinite Pay — abstração já pronta), pg_cron/pgmq nativo.

**Gotcha operacional recorrente:** o Supabase CLI não persiste a conta entre dias — antes de cada `db push` é preciso re-logar na conta dona do FYNXIA (org `kczvihafddupruvsrrsc`). Documentado na memória do projeto.

---

## 7. Getting Started (novos contribuidores)

- **Rodar local:** `npm run dev` (precisa de `.env.local` — ver `.env.local.example`).
- **Build de produção:** `npm run build` (sempre rode antes de deployar — pega erros que vitest/tsc não pegam, ex.: export sync em `'use server'`).
- **Testes:** `npm run test` (vitest, 368 testes; estilo source-inspection para migrations/'use server', unit para lógica).
- **Deploy:** push para `master`/`main` → Vercel auto-deploya (gru1). Migrations: `supabase db push` (conta FYNXIA) + `supabase gen types`.
- **Diretórios-chave:**
  - `src/app/(dashboard)/clinica/` — telas autenticadas (agenda, pacientes, financeiro, ia/agentes) + `layout.tsx` monta o copiloto.
  - `src/actions/` — Server Actions (patients, appointments, charges, transactions, anamneses…).
  - `src/lib/` — `supabase/` (3 clients), `crypto.ts` (AES), `asaas/` (gateway), `whatsapp/` + `messaging/` (outbox), `ai/` (copiloto: tools/masking), `agents/` (confirmation/collection).
  - `supabase/migrations/` — 17 migrations versionadas (schema é a fonte da verdade).
  - `.planning/` — artefatos GSD (ROADMAP, REQUIREMENTS, fases com CONTEXT/RESEARCH/PLAN/SUMMARY/VERIFICATION/UAT).
- **Onde olhar primeiro:** `CLAUDE.md` (convenções + anti-patterns), `.planning/STATE.md` (decisões acumuladas), `src/proxy.ts` (RBAC/middleware), `02-01`/`03-01`/`04-01`/`05-01` migrations (modelo de dados).

---

## Stats

- **Linha do tempo:** 2026-06-02 → 2026-06-11 (~10 dias)
- **Fases:** 6/6 completas · **Planos:** 24/24
- **Commits:** 232 (~214 de fase)
- **Arquivos alterados:** 338 (+64.374 / −99)
- **Código:** 183 arquivos TS/TSX · 17 migrations SQL · 33 arquivos de teste (368 testes)
- **Contribuidor:** ReynaldsLima (via GSD workflow)
