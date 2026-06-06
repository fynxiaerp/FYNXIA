# Phase 3: Financial MVP - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-06
**Phase:** 03-financial-mvp
**Areas discussed:** Estratégia de gateway, Integração Asaas, Recebíveis & parcelamento, Fluxo de caixa, Régua de cobrança

---

## Estratégia de gateway de pagamento

| Option | Description | Selected |
|--------|-------------|----------|
| Asaas-only + abstração | Só Asaas agora, atrás de interface PaymentGateway + adapter; schema agnóstico (provider, provider_charge_id) | ✓ |
| Asaas hardcoded | Integra Asaas direto, sem abstração; refatorar depois | |
| Multi-gateway agora | 2+ gateways nesta fase; atrasa o MVP | |

**User's choice:** Asaas-only + abstração (recomendado)
**Notes:** Usuário levantou interesse em Stripe/PagSeguro/Infinite Pay/Mercado Pago via "Other" na seleção de áreas; resposta = abstração mantém a porta aberta sem implementá-los agora.

---

## Integração Asaas (ambiente)

| Option | Description | Selected |
|--------|-------------|----------|
| Sandbox agora, produção via env | Desenvolve contra sandbox, troca por env var | |
| Produção direto | Cobranças reais desde o início | |
| Ainda não tenho conta Asaas | Planejar integração; teste real bloqueado até criar conta | ✓ |

**User's choice:** Ainda não tenho conta Asaas
**Notes:** Integração planejada contra API documentada, atrás de env vars; teste real vira checkpoint/user_setup. Sandbox recomendado (grátis).

---

## Recebíveis & parcelamento

| Option | Description | Selected |
|--------|-------------|----------|
| Asaas gera as parcelas | Parcelamento nativo Asaas; espelhar recebíveis locais; sync via webhook | ✓ |
| Parcelamento local | Calcular plano local, cobrança avulsa por parcela; mais controle/lógica | |

**User's choice:** Asaas gera as parcelas (recomendado)
**Notes:** "Vencido" derivado na leitura (sem cron) decidido por Claude como padrão.

---

## Fluxo de caixa (categorias)

| Option | Description | Selected |
|--------|-------------|----------|
| Lista padrão editável | Categorias odontológicas seedadas + admin edita | ✓ |
| Lista fixa (enum) | Conjunto fixo no código | |
| Texto livre | Usuário digita por lançamento | |

**User's choice:** Lista padrão editável (recomendado)
**Notes:** Regime de caixa, auto-lançamento de receita ao confirmar pagamento, e visão totais+lista decididos por Claude como padrão.

---

## Régua de cobrança (escopo de envio)

| Option | Description | Selected |
|--------|-------------|----------|
| Motor + e-mail (Resend) agora; WhatsApp Fase 4 | Regras + Vercel Cron + envio real por e-mail; WhatsApp depois | ✓ |
| Só motor + fila; envio na Fase 4 | Constrói regras/cron, sem envio real até Fase 4 | |
| Adiar FIN-07 inteiro p/ Fase 4 | Nenhuma régua na Fase 3 | |

**User's choice:** Motor + e-mail (Resend) agora; WhatsApp na Fase 4 (recomendado)
**Notes:** Agendamento via Vercel Cron decidido por Claude (única opção FREE-compatível). Disparo idempotente por (recebível + marco).

## Claude's Discretion

- Recibo PDF (FIN-08) reusa padrão @react-pdf da Fase 2
- Headers de segurança SEC-06 (CSP/HSTS/X-Frame-Options/X-Content-Type-Options)
- Onde guardar asaas_customer_id; gráfico no fluxo de caixa; detalhe do processamento assíncrono do webhook no plano FREE

## Deferred Ideas

- Multi-gateway real (PagSeguro, Infinite Pay, Mercado Pago, Stripe-pacientes) via adapters futuros
- Stripe para assinatura SaaS da clínica
- WhatsApp como canal da régua (Fase 4)
- Regras de juros/multa/desconto customizáveis
