# FYNXIA ERP Odontológico

## What This Is

FYNXIA é um ERP SaaS multi-tenant para clínicas odontológicas que unifica gestão clínica (agenda, prontuário, odontograma), gestão financeira (fluxo de caixa, faturamento, conciliação) e automação por IA (copiloto contextual e agentes autônomos). Destinado a dentistas, recepcionistas e administradores de clínicas e redes de franquias no Brasil.

## Core Value

Um dentista deve conseguir ver a agenda do dia, registrar atendimento e fechar o caixa — tudo em menos de 3 cliques por etapa, com dados protegidos por LGPD.

## Requirements

### Validated

#### Infraestrutura (Validated in Phase 0: Foundation)
- [x] Deploy automatizado na Vercel com CI/CD — `vercel.json` pina gru1 (São Paulo); gru1 region + Fluid Compute configurados
- [x] Schema de banco no Supabase com migrations versionadas — 2 migrations aplicadas em sa-east-1; `src/types/database.types.ts` gerado ao vivo
- [x] Variáveis sensíveis gerenciadas via Vercel environment variables — `.env.local.example` documenta contrato; `server-only` guards em todos os clientes privilegiados
- [x] Dados isolados por tenant_id (multi-tenant) com RLS no Supabase — `get_my_tenant_id()` + `get_my_role()` SECURITY DEFINER; RLS em 3 tabelas; C-1 resolvido
- [x] Todas as ações sensíveis registradas em audit_log imutável — `audit_logs` com DELETE/UPDATE = false via RLS

### Active

#### Clínica
- [ ] Usuário pode visualizar e gerenciar agenda semanal por dentista
- [ ] Usuário pode cadastrar e editar fichas de pacientes com CPF, dados de saúde e contato
- [ ] Dentista pode registrar prontuário clínico com diagnóstico, plano de tratamento e prescrição
- [ ] Dentista pode registrar ocorrências no odontograma interativo por dente
- [ ] Sistema envia confirmação automática de consultas via WhatsApp/e-mail
- [ ] Paciente pode solicitar agendamento online

#### Financeiro
- [ ] Usuário pode visualizar fluxo de caixa com entradas e saídas do mês
- [ ] Usuário pode lançar transações financeiras (receita/despesa) com categoria
- [ ] Sistema lista contas a receber com status e data de vencimento
- [ ] Sistema alerta sobre inadimplência e permite acionar cobrança via agente IA
- [ ] Usuário pode emitir recibo de consulta em PDF

#### Autenticação e Segurança
- [ ] Usuário pode criar conta, fazer login e logout com JWT
- [ ] Sistema suporta múltiplos perfis: admin, dentista, recepcionista, paciente
- [ ] Dados isolados por tenant_id (multi-tenant) com RLS no Supabase
- [ ] Todas as ações sensíveis registradas em audit_log imutável
- [ ] CPF, e-mail e telefone mascarados em listagens (LGPD)

#### IA / Copiloto
- [ ] Copiloto IA disponível em toda tela para responder perguntas contextuais
- [ ] Agente autônomo confirma consultas do dia seguinte via WhatsApp/e-mail
- [ ] Agente autônomo lista e contata inadimplentes com cobrança personalizada

#### Infraestrutura
- [ ] Deploy automatizado na Vercel com CI/CD
- [ ] Schema de banco no Supabase com migrations versionadas
- [ ] Variáveis sensíveis gerenciadas via Vercel environment variables

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
- **Stack decidida**: Next.js 14 App Router + TypeScript + Tailwind CSS + shadcn/ui + Supabase + Vercel
- **Mercado**: Brasil, setor odontológico, foco em clínicas individuais e pequenas redes
- **Conformidade**: LGPD obrigatório; HIPAA e CFO a considerar

## Constraints

- **Tech Stack**: Next.js 14 + TypeScript + Supabase + Vercel — decisão tomada, não renegociar
- **Segurança**: LGPD obrigatório — RLS, soft delete, audit trail, mascaramento de dados sensíveis
- **Performance**: Latência < 200ms, 1.000+ usuários simultâneos
- **Pagamentos**: Asaas (primário, BR) + Stripe (secundário) — ambos necessários
- **Comunicação**: WhatsApp Business API + SendGrid/Resend (e-mail)
- **Disponibilidade**: 99,9% uptime — Supabase + Vercel garantem

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Next.js App Router | SSR/SSG nativo, melhor SEO, integração Vercel | — Pending |
| Supabase como BaaS | Auth + DB + Storage + Realtime em um lugar, RLS nativo | — Pending |
| Multi-tenant via RLS | Isolamento de dados sem schemas separados, escalável | — Pending |
| Vercel AI Gateway | Observabilidade de IA, fallbacks entre provedores | — Pending |
| shadcn/ui | Componentes customizáveis, acessibilidade, Tailwind nativo | — Pending |
| Asaas como gateway primário | Suporte nativo a Pix + boleto + cartão no Brasil | — Pending |
| MVP Clínica + Financeiro paralelos | Entregas simultâneas aceleram validação de negócio | — Pending |

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
*Last updated: 2026-06-04 — Phase 0 (Foundation) complete*
