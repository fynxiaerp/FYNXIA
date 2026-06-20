# Phase 15: Faturamento/NFS-e & Convênios/TISS - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-20
**Phase:** 15-faturamento-nfs-e-conv-nios-tiss
**Areas discussed:** Integração NFS-e/TISS, Catálogo de serviços/preços, Gatilho & ciclo da OS, Particular×Convênio/TISS/Glosas, Config fiscal, Arquivamento de documentos, Permissões por papel, Cancelamento/estorno, Momento de emissão NFS-e, Parcelas particular×Asaas, Lote TISS, Retorno assíncrono, Protótipos→telas/rota, Numeração & descontos OS, Cadastro operadora, Estados/enums, Glosa granularidade, Base de repasse, Idempotência, Fronteiras deferidas

---

## Integração NFS-e/TISS

| Opção | Selecionada |
|-------|-------------|
| Abstração + adapter STUB (gated) | ✓ |
| Agregador real agora | |

| Alvo da abstração NFS-e | Selecionada |
|-------|-------------|
| Agregador único (PlugNotas/Tecnospeed) | ✓ |
| Por município (ABRASF direto) | |

| Conector | Selecionada |
|-------|-------------|
| Reusar Hub de Integrações (Phase 9) | ✓ |
| Cadastro próprio no módulo fiscal | |

---

## Catálogo de serviços/preços

| Catálogo estruturado | Selecionada |
|-------|-------------|
| Sim — nova tabela `services` | ✓ |
| Derivar de texto livre do prontuário | |

| Código TUSS | Selecionada |
|-------|-------------|
| Sim, campo TUSS opcional | ✓ |

| Preço por operadora | Selecionada |
|-------|-------------|
| Linhas de preço (operadora × serviço) | ✓ |
| Multiplicador por operadora | |

| Seed | Selecionada |
|-------|-------------|
| Sim, seed padrão editável | ✓ |

---

## Gatilho & ciclo da OS

| Gatilho | Selecionada |
|-------|-------------|
| appointment → 'concluido' | ✓ |
| Ação manual 'Concluir atendimento' | |
| Registro de procedimento no prontuário | |

| Linhas da OS | Selecionada |
|-------|-------------|
| Novo vínculo `appointment_procedures` | ✓ |
| OS rascunho vazia + adicionar do catálogo | |

| Ciclo | Selecionada |
|-------|-------------|
| Rascunho → revisar → faturar | ✓ |
| Fatura direto na conclusão | |

| Origem | Selecionada |
|-------|-------------|
| 1 OS por atendimento (+ OS manual) | ✓ |
| Somente 1 OS por atendimento | |

---

## Particular × Convênio / TISS / Glosas

| Pagador | Selecionada |
|-------|-------------|
| Pagador no nível da OS | ✓ |
| Pagador por linha da OS | |

| Escopo TISS | Selecionada |
|-------|-------------|
| Modelo interno + export STUB | ✓ |
| XML TISS real agora | |

| Glosas | Selecionada |
|-------|-------------|
| Tabela de motivos ANS (seed) + recurso | ✓ |
| Classificação livre + recurso | |

| Recebível convênio | Selecionada |
|-------|-------------|
| Recebível contra a operadora (por lote) | ✓ |
| Só controle de status do lote | |

---

## Config fiscal

| Opção | Selecionada |
|-------|-------------|
| Config fiscal por unidade (mínimo viável) | ✓ |
| Config no nível da clínica | |

---

## Arquivamento de documentos

| Opção | Selecionada |
|-------|-------------|
| Reusar bucket de documentos + PDF de recibo | ✓ |
| Só metadados/links nesta fase | |

---

## Permissões por papel

| Opção | Selecionada |
|-------|-------------|
| Dentista conclui; Recepção+Admin faturam; Admin fiscal/glosa | ✓ |
| Só admin escreve (padrão financeiro atual) | |

---

## Cancelamento/estorno fiscal

| Opção | Selecionada |
|-------|-------------|
| Cancelar via aprovação por alçada (Phase 10) | ✓ |
| Cancelamento simples (admin, sem alçada) | |

---

## Momento de emissão NFS-e

| Opção | Selecionada |
|-------|-------------|
| Ao faturar a OS, com escolha caixa/competência | ✓ |
| Só por competência (1 NFS-e por OS) | |

---

## Parcelas particular × Asaas

| Opção | Selecionada |
|-------|-------------|
| Faturar OS chama `createCharge` (Asaas) por OS | ✓ |
| Recebíveis internos sem Asaas agora | |

---

## Lote TISS

| Opção | Selecionada |
|-------|-------------|
| Por operadora + competência, com fechar manual | ✓ |
| Lote automático por período | |

---

## Retorno assíncrono NFS-e/lote

| Opção | Selecionada |
|-------|-------------|
| Webhook via Hub (Phase 9) + worker de fallback | ✓ |
| Só polling por worker/cron | |

---

## Protótipos → telas reais & rota

| Opção | Selecionada |
|-------|-------------|
| Telas reais em /clinica/financeiro; protótipo vira referência | ✓ |
| Substituir protótipos in-place | |

---

## Numeração & descontos da OS

| Opção | Selecionada |
|-------|-------------|
| Sequencial por unidade + desconto por item e total | ✓ |
| Sequencial simples, sem desconto agora | |

---

## Cadastro da operadora

| Opção | Selecionada |
|-------|-------------|
| Dados ANS + integração TISS + regras de pagamento | ✓ |
| Cadastro básico (nome/CNPJ/ANS + tabela) | |

---

## Estados/enums (alinhar ao protótipo)

| Opção | Selecionada |
|-------|-------------|
| Sim, travar enums alinhados ao protótipo | ✓ |
| Você decide os nomes | |

---

## Glosa granularidade

| Opção | Selecionada |
|-------|-------------|
| Glosa por item da guia | ✓ |
| Glosa só no total da guia | |

---

## Base de repasse

| Opção | Selecionada |
|-------|-------------|
| Sim, linha da OS carrega profissional | ✓ |
| Só profissional no nível da OS | |

---

## Idempotência da emissão

| Opção | Selecionada |
|-------|-------------|
| Chave por OS/guia + checagem de status | ✓ |

---

## Fronteiras deferidas

| Opção | Selecionada |
|-------|-------------|
| Sim, confirmar deferidos | ✓ |
| Revisar antes de deferir | |

**Deferidos confirmados:** orçamento/estimativa pré-OS (Relatórios/Orçamento); tributos além de ISS — PIS/COFINS/IR/RPA/EFD-Reinf (Phase 16); conciliação do recebimento do lote/extrato (Phase 16); baixa de estoque por procedimento (Phase 17).

## Claude's Discretion

- Nomenclatura exata de colunas/índices/FKs; estrutura do seed do catálogo e dos motivos de glosa; formato do export TISS stub e da chave de idempotência; layout fino das telas (→ /gsd-ui-phase).

## Deferred Ideas

Ver seção `<deferred>` do CONTEXT.md.
