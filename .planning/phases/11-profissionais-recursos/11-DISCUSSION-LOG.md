# Phase 11: Profissionais & Recursos - Discussion Log

> Audit trail only. Decisões em CONTEXT.md.

**Date:** 2026-06-14 · **Phase:** 11-profissionais-recursos
**Areas:** Profissionais, Disponibilidade→Agenda, Recursos, Sala de Espera

## Profissionais
- ✓ Tabela `professionals` ligada a users (user_id nullable) + professional_availability
- ( ) Estender users

## Disponibilidade → Agenda
- ✓ Grade semanal recorrente + exceções; booking valida contra ela (reusa FullCalendar v1)
- ( ) Slots materializados

## Recursos
- ✓ Tabela `resources` + reserva opcional no appointment; status manutenção bloqueia
- ( ) Só cadastro (sem agenda)

## Sala de Espera
- ✓ Check-in no appointment (timestamps) + painel /painel (TV) via Supabase Realtime
- ( ) Polling · ( ) só medir espera

## Claude's Discretion
- Schema/índices; junção appointment↔resource; formato da grade; integração da checagem ao booking; canal Realtime do painel; UIs; módulos no proxy. PRO-03 comissão: só armazena (cálculo na Fase 16).

## Deferred
- Cálculo de repasse (Fase 16); TISS de profissionais; encaixe por IA.
