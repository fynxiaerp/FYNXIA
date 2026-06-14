# Phase 8: Documentos & Assinatura ICP-Brasil - Discussion Log

> **Audit trail only.** Decisões em CONTEXT.md.

**Date:** 2026-06-14
**Phase:** 08-documentos-assinatura-icp-brasil
**Areas discussed:** Assinatura ICP, Motor de modelos/render, Versionamento

---

## Assinatura ICP (formato/fidelidade)

| Option | Selected |
|--------|----------|
| Assinar hash + PKCS#7/timestamp (node-forge RSA; PAdES depois) | ✓ |
| PAdES completo embutido no PDF | |
| Registro hash + timestamp (estilo anamnese v1) — só fallback | |

## Motor de modelos + render

| Option | Selected |
|--------|----------|
| Template rich-text/markdown com {{variáveis}} → PDF via @react-pdf | ✓ |
| Template como componentes @react-pdf (estruturado) | |
| Editor HTML → PDF (html-to-pdf) — vetado pelo CLAUDE.md | |

## Versionamento & imutabilidade

| Option | Selected |
|--------|----------|
| documents + document_versions append-only (assinado imutável via RLS) | ✓ |
| Uma tabela documents com version + flag locked | |

## Claude's Discretion
- Estrutura das migrations/colunas/índices; unit_id em documents; extração de {{vars}}; conjunto de variáveis de contexto; detalhes PKCS#7 (detached/attached, base64 no DB); UI editor + geração/assinatura; componente @react-pdf genérico; rota Configurações › Documentos.

## Deferred
- PAdES embutido; documentos específicos (RX/NFS-e/teleodonto); distribuição ao Portal; editor WYSIWYG avançado.
