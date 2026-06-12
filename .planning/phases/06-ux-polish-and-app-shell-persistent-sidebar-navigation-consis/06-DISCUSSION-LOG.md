# Phase 6: UX Polish & App Shell - Discussion Log

> **Audit trail only.** Decisions are captured in CONTEXT.md.

**Date:** 2026-06-12
**Phase:** 06-ux-polish-and-app-shell
**Areas discussed:** Tema/Marca, App shell/sidebar, Padrão de página + estados, Escopo
**Base:** auditoria UI-REVIEW-v1.0.md (15/24) + marca extraída de fynxia.com.br

---

## Marca de referência (input do usuário)
Usuário pediu fynxia.com.br como referência de cores/fontes/logo. Extraído do CSS do site: fontes Space Grotesk (headings) + Inter (corpo); tokens cyan(185 100% 50%)/magenta(300 100% 60%)/purple(270 100% 60%)/accent(250 100% 65%), dark-navy(240 20% 6%); gradiente cyan→magenta + glow/glass; logo nó gradiente. Salvo em memória `project-fynxia-brand` + `.firecrawl/`.

## Tema/Marca
| Option | Selected |
|--------|----------|
| Light clínico + accent cyan da marca | |
| Dark/neon completo (igual ao site) | |
| Dual-theme: claro padrão + dark da marca alternável | ✓ |

**Escolha:** Dual-theme — claro clínico padrão + dark/neon da marca como toggle; tokens pros dois; Space Grotesk + Inter; logo; gradiente só em destaques.

## App shell / sidebar
| Option | Selected |
|--------|----------|
| Sidebar fixa à esquerda, colapsável p/ ícones | ✓ |
| Top bar + sidebar só no mobile | |
| Rail de ícones sempre colapsado | |

**Escolha:** Sidebar fixa ~240px (logo + módulos role-gated + rodapé clínica/usuário/tema/sair), colapsa p/ rail/drawer no mobile; copiloto flutuante.

## Padrão de página + estados
| Option | Selected |
|--------|----------|
| PageHeader compartilhado + skeletons que imitam o layout | ✓ |
| PageHeader + estados simples | |
| Só padronizar cabeçalho | |

**Escolha:** PageHeader compartilhado (Space Grotesk + breadcrumb + ações); skeletons que imitam layout; empty (ícone+CTA); error.tsx com retry.

## Escopo
| Option | Selected |
|--------|----------|
| Amplo porém delimitado | |
| Cirúrgico | |
| Varredura completa tela-a-tela | ✓ |

**Escolha:** Varredura completa — propagação global (shell/tema/tokens/fontes/PageHeader/estados) + reprojetar o interior de cada módulo. Fase grande (múltiplos planos/ondas).

## Claude's Discretion
- Componentes do shell/PageHeader/skeletons; escala tipográfica; mecanismo de tema (next-themes vs cookie); densidade de tabelas; versão da logo p/ light/dark.

## Deferred
- Motion design avançado; ilustrações custom; a11y AAA; landing no app.
