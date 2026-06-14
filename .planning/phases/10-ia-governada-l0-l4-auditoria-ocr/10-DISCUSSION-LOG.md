# Phase 10: IA Governada + Auditoria + OCR - Discussion Log

> Audit trail only. Decisões em CONTEXT.md.

**Date:** 2026-06-14 · **Phase:** 10-ia-governada-l0-l4-auditoria-ocr
**Areas:** Enforcement IA, Aprovação humana, OCR, Auditoria/Estorno

## Enforcement IA (L0–L4)
- ✓ Camada de política central withAgentPolicy() embrulhando agentes/tools + log de decisão (ai_decision_log)
- ( ) Checagens inline em cada agente

## Aprovação humana (AIG-02 + AUD-02)
- ✓ Fila única approval_requests (serve IA-sensível E estorno por alçada)
- ( ) Mecanismos separados

## OCR
- ✓ Vercel AI Gateway multimodal (visão) + extração estruturada + confiança + fila de revisão (ocr_extractions). Sem novo serviço.
- ( ) Serviço de OCR dedicado (Textract/Vision)

## Auditoria & Estorno
- ✓ Tela sobre audit_logs (entidade/usuário/período + antes/depois) + estorno genérico por alçada via fila única
- ( ) Só leitura da trilha (estorno depois)

## Claude's Discretion
- Schema/índices (ai_decision_log/approval_requests/ocr_extractions); forma do withAgentPolicy; "ação sensível" por nível; modelo multimodal + schema zod + threshold; cadastro piloto OCR; UIs; módulo conformidade no proxy. POSSÍVEL SPLIT (3 subsistemas) — planner decide.

## Deferred
- Estorno por entidade financeira (Fases 14-16); OCR em todos os formulários; novos agentes; aprovação multi-etapa.
