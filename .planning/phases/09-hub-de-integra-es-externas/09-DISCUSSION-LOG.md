# Phase 9: Hub de Integrações Externas - Discussion Log

> Audit trail only. Decisões em CONTEXT.md.

**Date:** 2026-06-14 · **Phase:** 09-hub-de-integra-es-externas
**Areas:** Credenciais, Webhooks/registry, Saúde+reenvio

## Credenciais
- ✓ AES-256 cifrado no DB (crypto.ts), server-only, UI mascarada
- ( ) Vault/KMS externo · ( ) só env vars

## Webhooks / registry
- ✓ Registry + reusar handlers Asaas/WhatsApp existentes + webhook_events (dedup v1)
- ( ) Endpoint único genérico que roteia (risco de regressão nos webhooks em produção)

## Saúde & reenvio
- ✓ Generalizar outbox (message_outbox/worker) + integration_events log + Vercel Cron; saúde derivada
- ( ) Tabela de health dedicada + worker novo

## Claude's Discretion
- Schema/índices; enum de tipos de conector; camada de log nos handlers existentes (aditiva); UI do painel; rota /config/integracoes; mascaramento; validação Zod por tipo.

## Deferred
- Protocolo NFS-e/Open Finance/TISS (Fases 15/16); marketplace; KMS externo.
