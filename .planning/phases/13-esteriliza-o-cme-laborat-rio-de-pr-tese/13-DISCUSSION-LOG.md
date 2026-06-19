# Phase 13: Esterilização/CME & Laboratório de Prótese - Discussion Log

> **Audit trail only.** Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-19
**Phase:** 13-esteriliza-o-cme-laborat-rio-de-pr-tese
**Areas discussed:** Modelo de esterilização, Rastreabilidade & bloqueio do kit, OS protética, Custo do lab → financeiro

---

## Modelo de esterilização (CME-01)

| Option | Selected |
|--------|----------|
| Autoclave reusa `resources` + nova `sterilization_cycles` | ✓ |
| Tabela própria `autoclaves` + `sterilization_cycles` | |
| Você decide | |

**Choice:** Autoclave reusa `resources` (equipamento) + `sterilization_cycles` com parâmetros/indicador biológico/validade/status. Recomendado.

---

## Rastreabilidade & bloqueio do kit (CME-02/03)

| Option | Selected |
|--------|----------|
| Por LOTE (ciclo=lote) + guard no uso | ✓ |
| Por kit individual (etiqueta/QR) | |
| Você decide | |

**Choice:** Por lote (ciclo=lote); uso de kit vincula ciclo→appointment/paciente; Server Action de uso bloqueia ciclo não-aprovado/vencido. Recomendado.

---

## OS protética (LAB-01)

| Option | Selected |
|--------|----------|
| Cadastro `prosthetic_labs` + `lab_orders` com etapas/status | ✓ |
| Laboratório como texto livre na OS | |
| Você decide | |

**Choice:** `prosthetic_labs` (fornecedor reutilizável) + `lab_orders` (tipo/prazo/etapas/status enviado→prova→concluído/custo). Recomendado.

---

## Custo do lab → financeiro (LAB-02)

| Option | Selected |
|--------|----------|
| Lançar `financial_transactions` (despesa a pagar) vinculada à OS agora | ✓ |
| Só guardar custo na OS + flag p/ Fase 16 | |
| Você decide | |

**Choice:** Lançar `financial_transactions` (despesa/a-pagar) referenciando a lab_order ao definir o custo; Fase 16 evolui a gestão. Recomendado.

## Deferred Ideas

- Contas a Pagar completo (Fase 16); rastreabilidade por kit individual; relatórios ANVISA.
