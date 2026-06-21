# Phase 16: Contas a Pagar, Conciliação & Tributos - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-21
**Phase:** 16-contas-a-pagar-concilia-o-tributos
**Areas discussed:** Contas a pagar & fornecedores, Conciliação bancária, Repasse do profissional, RPA/retenções/EFD-Reinf, Permissões, Estorno, Telas/rotas, Período/fechamento, Conciliação N:1, Lote de convênio, Escopo EFD-Reinf, Lembrete de vencimento, Idempotência OFX, Anexos, Provider EFD-Reinf, Saldo de abertura/unidade

---

## Contas a Pagar & Fornecedores

| Questão | Opções | Escolha |
|---------|--------|---------|
| Modelo de fornecedor | Tabela `suppliers` nova (rede) ✓ / Texto livre no CP | **Tabela suppliers nova (rede)** |
| Origens de CP (multi) | Manual ✓ / Recorrente ✓ / Auto OS-lab ✓ / Auto repasse ✓ | **Todas as quatro** |
| Baixa mexe no saldo? | Baixa move saldo + saída no caixa ✓ / Só na conciliação | **Baixa move saldo + cria saída** |
| Parcelamento de CP | CP com parcelas + baixas parciais ✓ / Baixa única | **CP com parcelas + baixas parciais** |

**Notas:** Lab (Fase 13) e profissional autônomo linkam/viram supplier. Conciliação posterior confirma a baixa.

---

## Conciliação Bancária & Fluxo de Caixa

| Questão | Opções | Escolha |
|---------|--------|---------|
| Entrada de extrato | OFX real + Open Finance STUB-gated ✓ / Só OFX | **OFX real + Open Finance STUB-gated** |
| Matching | Auto exato + sugestões fuzzy ✓ / Só exato manual | **Auto exato + fuzzy p/ revisão** |
| Linha sem par | Sugerir criar lançamento 1 clique ✓ / Só divergência | **Sugerir criar lançamento** |
| Previsto × realizado | Status conciliado + previsto×realizado ✓ / Só marca | **Status + caixa previsto×realizado** |
| Conciliação N:1 (payout Asaas) | Match N:1 + taxa no líquido ✓ / Só 1:1 | **Match N:1 com agrupamento + taxa** |
| Lote de convênio | Baixa concilia recebível, respeita glosa ✓ / Baixa manual | **Concilia recebível, respeita glosa** |
| Idempotência OFX | Dedup conta+FITID (fallback data+valor+doc) ✓ / Você decide | **Dedup conta+FITID** |
| Saldo de abertura/unidade | Saldo datado + operação por unidade ✓ / Você decide | **Saldo inicial datado + por unidade** |

**Notas:** Open Finance via Hub (Fase 9). Glosa item a item (Fase 15 D-28). bank_accounts de rede, mas filtro por unidade via centro de custo.

---

## Repasse do Profissional

| Questão | Opções | Escolha |
|---------|--------|---------|
| Base de cálculo | Recebido com deduções configuráveis ✓ / Sempre bruto | **Recebido com deduções configuráveis** |
| Momento | No recebimento conciliado (caixa) ✓ / No faturamento | **No recebimento conciliado (caixa)** |
| Saída | Demonstrativo + CP ao profissional ✓ / Só demonstrativo | **Demonstrativo + CP ao profissional** |
| Vínculo (Fase 11) | Vínculo define tratamento ✓ / Tratar igual | **Vínculo define o tratamento** |

**Notas:** Autônomo→RPA c/ retenções; PJ→sem retenção; CLT→fora de escopo (folha v2). Deduções=0 ⇒ bruto.

---

## RPA, Retenções & Tributos

| Questão | Opções | Escolha |
|---------|--------|---------|
| Cálculo INSS/IRRF/ISS | Tabelas de faixa seed, versionadas por vigência ✓ / Alíquotas fixas | **Tabelas de faixa, versionadas** |
| EFD-Reinf | STUB-gated (como NFS-e/TISS) ✓ / Arquivo oficial real | **STUB-gated** |
| Regime dirige apuração? | Sim, regime dirige ✓ / Genérico, regime informativo | **Sim — regime dirige** |
| Saída do RPA | PDF arquivado + tributos a recolher ✓ / Só cálculo | **PDF arquivado + obrigação** |
| Abrangência EFD-Reinf | Só RPA autônomo / Inclui serviços tomados PJ/lab ✓ | **Inclui serviços tomados PJ/lab** |
| Provider EFD-Reinf | Provider-agnostic + conector no Hub ✓ / Você decide | **Provider-agnostic + Hub (Tecnospeed)** |

**Notas:** Regime via clinics_regime (Fase 15). Tributos a recolher = DARF/GPS/ISS com vencimento.

---

## Permissões, Estorno, Telas & Fechamento

| Questão | Opções | Escolha |
|---------|--------|---------|
| Permissões | Escrita admin/financeiro; auditor/dpo/sócio read-only ✓ / Você decide | **Admin/financeiro write; demais read-only** |
| Estorno | Aprovação por alçada + auditoria (Fase 10) ✓ / Estorno direto admin | **Aprovação por alçada + auditoria** |
| Telas/rotas | Subrotas sob /clinica/financeiro ✓ / Novo grupo top-level | **Subrotas sob /clinica/financeiro** |
| Fechamento | Competência mensal por unidade + retro na próxima ✓ / Sem fechamento | **Competência mensal por unidade** |
| Lembrete de vencimento | Reusar régua/Cron Fase 4 ✓ / Sem notificação | **Reusar régua/Cron Fase 4** |
| Anexos CP/RPA | Bucket de documentos Fase 8 ✓ / Sem anexos | **Anexar no bucket (Fase 8)** |

**Notas:** Numeração de RPA sequencial por unidade. Recepção/dentista sem acesso ao módulo.

---

## Claude's Discretion

- Nomes/colunas/índices/FKs exatos das novas tabelas; padrão financeiro (`NUMERIC(12,2)`, index clinic_id/unit_id).
- Precedência da regra de comissão (serviço sobrepõe geral; sem regra ⇒ 0% + alerta).
- Estrutura dos seeds (tributos por vigência, tipos de fornecedor); janela de tolerância do matching; ranking fuzzy.
- Formato dos PDFs e da representação stub de OFX/EFD-Reinf; componentização fina das telas (→ /gsd-ui-phase).

## Deferred Ideas

- DRE/orçado×realizado/distribuição de lucro → Fase 19.
- Profissional ver próprio demonstrativo → Fase 18.
- Folha CLT → v2 (RH). XML/transmissão fiscal real homologada → gated. Rateio % multi-CC → deferido da Fase 14. Baixa de estoque → Fase 17.
</content>
