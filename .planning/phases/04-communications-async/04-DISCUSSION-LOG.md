# Phase 4: Communications & Async - Discussion Log

> **Audit trail only.** Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-06
**Phase:** 04-communications-async
**Areas discussed:** Infra assíncrona, WhatsApp Meta lead-time, Templates WhatsApp, Agendamento e dedup dos lembretes

---

## Infra assíncrona (pg_cron/pgmq vs Vercel Cron)

| Option | Description | Selected |
|--------|-------------|----------|
| Abstração + FREE agora, Pro depois | MessageQueue interface + outbox + Vercel Cron worker; swap p/ pgmq no Pro | ✓ |
| Supabase Pro + pg_cron/pgmq | Migra pro Pro (~US$25/mês), implementa literal COMMS-04 | |
| FREE direto (sem abstração) | Outbox + Vercel Cron sem camada, refatorar depois | |

**User's choice:** Abstração + FREE agora, Pro depois (recomendado)
**Notes:** Vercel Hobby = 1 cron/dia → lembretes em batch diário. Outcome de COMMS-04 satisfeito; pgmq nativo deferido.

---

## WhatsApp Meta (lead-time)

| Option | Description | Selected |
|--------|-------------|----------|
| Construir + adiar live (Meta não iniciada) | Integração + templates agora, verificação live = UAT; usuário inicia Meta em paralelo | ✓ |
| Construir + adiar live (Meta já iniciada) | Mesma construção, Meta já em andamento | |
| Só e-mail nesta fase | Adiar todo o WhatsApp | |

**User's choice:** Construir + adiar live (ainda não iniciei a Meta)
**Notes:** Meta Business verification 7-14 dias. Mesmo padrão do Asaas (Fase 3).

---

## Templates WhatsApp

| Option | Description | Selected |
|--------|-------------|----------|
| Lembrete (com botões) + Cobrança | 2 templates utility; lembrete com quick-reply Confirmar/Cancelar | ✓ |
| Lembrete (sem botões) + Cobrança | Lembrete só informativo | |
| Só lembrete | Apenas COMMS-01 | |

**User's choice:** Lembrete (com botões) + Cobrança (recomendado)
**Notes:** Capturar/agir na resposta dos botões = Fase 5 (AI-02). Categoria utility locked.

---

## Agendamento e dedup dos lembretes

| Option | Description | Selected |
|--------|-------------|----------|
| Manhã do dia anterior ~8h BRT | Cron 11h UTC varre consultas do dia seguinte | ✓ |
| Noite do dia anterior ~19h BRT | Lembrete na noite anterior | |
| Mesmo dia ~7h BRT | Lembrete de última hora | |

**User's choice:** Manhã do dia anterior, ~8h BRT (recomendado)
**Notes:** Dedup por (appointment_id + channel + type) em tabela de log. WhatsApp + e-mail ambos.

## Claude's Discretion
- Estrutura da tabela outbox + log de dedup; 1 cron scan+enqueue+drain vs cron separado; cópia dos templates; retry policy.

## Deferred Ideas
- pg_cron/pgmq nativo (Supabase Pro); captura de resposta dos botões (Fase 5/AI-02); agendamento sub-diário (Vercel Pro); templates extras.
