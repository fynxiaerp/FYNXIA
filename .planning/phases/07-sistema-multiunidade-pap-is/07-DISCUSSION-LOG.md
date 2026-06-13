# Phase 7: Sistema, Multiunidade & Papéis - Discussion Log

> **Audit trail only.** Decisões em CONTEXT.md; este log preserva as alternativas.

**Date:** 2026-06-12
**Phase:** 07-sistema-multiunidade-pap-is
**Areas discussed:** Multiunidade, Keystore ICP, RBAC granular, Papéis × Unidade

---

## Modelo de multiunidade

| Option | Description | Selected |
|--------|-------------|----------|
| clinics=rede + tabela `units` | `clinics`=tenant/rede; `units` filiais (FK clinic_id); `unit_id` nas linhas operacionais; RLS por clinic_id + filtro opcional por unidade | ✓ |
| clinic=unidade + tabela `networks` pai | Mantém clinic=unidade; networks como pai; RLS cross-unidade mais complexa | |
| Unidade só lógica (campo, sem tabela) | Campo `unit` nas linhas, sem cadastro formal | |

**User's choice:** clinics=rede + tabela units (recomendado)

---

## Keystore do Certificado ICP-Brasil (A1)

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase Storage privado + senha AES-256 | .pfx em bucket privado; senha cifrada AES (ENCRYPTION_KEY); assinatura server-side; só metadados legíveis | ✓ |
| Blob cifrado no banco | .pfx+senha cifrados em coluna Postgres | |
| Só metadados agora; assinatura na Fase 8 | Placeholder de metadados; upload/assinatura depois | |

**User's choice:** Supabase Storage privado + senha AES-256 (recomendado)
**Notes:** Fase 7 cobre armazenamento seguro + metadados; o USO para assinar é a Fase 8.

---

## RBAC granular

| Option | Description | Selected |
|--------|-------------|----------|
| Matriz role→módulo estendida | Evolui ROLE_ROUTES; +6 papéis; mapa role×módulo allow/deny; server-side | ✓ |
| Tabela de permissões configurável | role×módulo×ação editável pelo admin na UI | |

**User's choice:** Matriz role→módulo estendida (recomendado)
**Notes:** Permissões por ação finas e perfis 100% configuráveis ficam deferidos.

---

## Papéis × Unidade

| Option | Description | Selected |
|--------|-------------|----------|
| Papéis de rede veem tudo; operacionais por unidade | Admin/Sócio/Auditor/DPO/TI = toda a rede; Dentista/Recepção/Aluno = unidade atribuída; Auditor/DPO/Sócio read-only | ✓ |
| Todos por unidade + flag de rede | Default por unidade; flag libera cross-unidade | |
| Sem escopo por unidade no v2 | Unidade só p/ relatórios; acesso por tenant | |

**User's choice:** Papéis de rede veem tudo; operacionais por unidade (recomendado)

---

## Claude's Discretion

- Estrutura/ordem das migrations, nomes de colunas/constraints/índices.
- Helper de unidade singular vs array (`get_my_unit_ids()`); atribuição usuário↔unidade coluna vs tabela N:N.
- Armazenamento da config de autonomia IA L0–L4 (`ai_agent_config` no escopo da rede); enforcement só na Fase 10.
- UI das telas de configuração no design system v1; libs de validação CNPJ e leitura de .pfx.

## Deferred Ideas

- Tabela de permissões 100% configurável (UI); permissões por ação finas.
- Enforcement IA L0–L4 (Fase 10); motor de assinatura ICP (Fase 8); hub de integrações (Fase 9).
