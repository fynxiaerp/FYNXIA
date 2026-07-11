# Phase 18: CRC & Marketing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-11
**Phase:** 18-crc-marketing
**Areas discussed:** Funil de leads & ROI, Campanhas de reativação, NPS pós-consulta, Programa de indicação

---

## Funil de leads & ROI

| Pergunta | Opções | Escolha |
|----------|--------|---------|
| Estágios do funil | Novo→Contatado→Agendado→Convertido/Perdido · Novo→Em contato→Convertido/Perdido · Novo→Convertido/Perdido | **Novo→Contatado→Agendado→Convertido/Perdido** |
| Visualização | Kanban · Tabela · Ambos | **Kanban (arrastar entre estágios)** |
| Origem do lead | Lista fixa gerenciável · Lista fixa + campanha · Campo livre | **Lista fixa gerenciável** |
| Custo para CPL/CAC | Entrada manual · Puxar do financeiro · Você decide | **Puxar do módulo financeiro** |

---

## Campanhas de reativação

| Pergunta | Opções | Escolha |
|----------|--------|---------|
| Segmentação | X dias configurável + filtros · X dias fixo · Construtor flexível | **X dias configurável + filtros opcionais** |
| Canal | Ambos c/ preferência do paciente · WhatsApp+fallback e-mail · Por campanha | **Ambos, respeitando preferência/opt-in** |
| IA / autonomia | L2 (personaliza + aprovação humana) · L1 (sugere) · L0 (template fixo) | **L2 — IA personaliza, humano aprova o blast** |
| Disparo | Manual · Agendado (cron) · Ambos | **Manual (marketing seleciona e dispara)** |

---

## NPS pós-consulta

| Pergunta | Opções | Escolha |
|----------|--------|---------|
| Timing | X horas após atendimento · Batch diário · Manual | **Batch diário (à noite, cron)** |
| Captura da nota | Link mini-form web · Resposta numérica no WhatsApp · Quick-reply buttons | **Link para mini-formulário web (token)** |
| Classificação | Padrão 9-10/7-8/0-6 · Customizável por clínica | **Padrão NPS 9-10/7-8/0-6** |
| Detrator (0–6) | Alerta interno · Só registra · Agente automático | **Alerta para recepção/gestor tratar** |

---

## Programa de indicação

| Pergunta | Opções | Escolha |
|----------|--------|---------|
| Registro | Indicador ao cadastrar lead · Código/link · Ambos | **Indicador escolhido ao cadastrar o lead/paciente** |
| Recompensa | Crédito/desconto em serviços · Valor fixo · Pontos | **Crédito/desconto em serviços** |
| Gatilho | Na conversão do indicado · No 1º pagamento · Ao criar lead | **Quando o indicado converte** |
| Visibilidade | Tela interna + pronto p/ portal · Notificar por msg · Só interno | **Tela interna agora + modelado p/ portal (Fase 20)** |

---

## Claude's Discretion
- Lib de kanban/DnD; modelagem de tabelas + RLS; forma exata do vínculo campanha↔despesa; layout dos painéis de ROI e NPS.

## Deferred Ideas
- Disparo agendado automático de reativação; código/link de indicação; exposição self-service de NPS/recompensas (portal, Fase 20); construtor de segmento avançado; pontos/gamificação.
