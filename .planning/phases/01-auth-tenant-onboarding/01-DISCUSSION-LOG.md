# Phase 1: Auth & Tenant Onboarding — Log de Discussão

> **Apenas para auditoria.** Não usar como input para agentes de pesquisa, planejamento ou execução.
> As decisões estão em CONTEXT.md — este log preserva as alternativas consideradas.

**Data:** 2026-06-04
**Fase:** 01-auth-tenant-onboarding
**Áreas discutidas:** Registro da Clínica, Convites e Entrada, RBAC, Pacientes, Mascaramento de Dados, Auditoria, UI de Auth

---

## Registro da Clínica

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Minimal (nome + email + senha) | Apenas o necessário para Auth; resto preenchido depois | |
| Essenciais (nome + email + senha + CNPJ + telefone) | Captura dados difíceis de recuperar depois | ✓ |
| Wizard completo (multi-step) | Todos os dados no cadastro; mais atrito | |

**Escolha:** Essenciais no cadastro — nome da clínica, e-mail, senha, CNPJ, telefone.

---

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| `clinics` (alinhado com success criteria) | ROADMAP usa "public.clinics" | ✓ |
| `tenants` (da Fase 0) | Manter tabela existente | |

**Escolha:** `public.clinics` — renomear/substituir `public.tenants`.

---

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Dashboard direto (/clinica) | Sem gate de confirmação | ✓ |
| Confirmação de e-mail obrigatória | LGPD-friendly, mais atrito | |
| Confirmação + setup nudge | Checklist pós-confirmação | |

**Escolha:** Redirect direto para `/clinica` após cadastro.

---

## Convites e Entrada de Membros

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Apenas invite por e-mail (magic link) | Mais seguro, LGPD-friendly | |
| Apenas criação direta pelo admin | Simples, menos seguro | |
| Ambos os caminhos | Cobre todos os cenários | ✓ |

**Escolha:** Dois caminhos — invite por e-mail E criação direta.

---

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| 7 dias, reenvio cancela anterior | Padrão SaaS | |
| 24 horas, uso único | Mais seguro para saúde | ✓ |
| Claude decide | — | |

**Escolha:** 24 horas, uso único. Reenvio invalida convite anterior.

---

## RBAC — Controle de Acesso por Rota

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Apenas nível de rota | proxy.ts bloqueia rotas por role | ✓ |
| Rota + componente | useRole() hook também | |
| Apenas redirect por role | Sem bloqueio real de rotas | |

**Escolha:** Nível de rota apenas no proxy.ts.

---

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Split padrão dental SaaS | Matriz completa por role | ✓ |
| Simples: staff vs paciente | Refinamento na Fase 2 | |
| Claude decide | — | |

**Escolha:** Matriz padrão — admin (tudo), dentist (/clinica + /perfil), receptionist (/clinica + /perfil), patient (/paciente/*), superadmin (tudo + /superadmin).

---

## Contas de Pacientes

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Infraestrutura na Fase 1, UI na Fase 2 | Backend + patient_consents agora | ✓ |
| Diferir completamente | Risco de retrabalho | |
| Apenas patient_consents | Só a tabela de consentimento | |

**Escolha:** Infraestrutura completa na Fase 1 (fluxo de convite + patient_consents), UI na Fase 2.

---

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Recepcionista cadastra + invite | Mesmo mecanismo do staff | |
| Link público de auto-cadastro | /agendar/[slug] | |
| Ambos os caminhos | Invite + auto-cadastro | ✓ |

**Escolha:** Dois caminhos — recepcionista convida E paciente se auto-cadastra via link público.

---

## Mascaramento de Dados (SEC-01)

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Camada de API (Server Actions) | Dado bruto nunca chega ao browser | |
| Componente React (client-side) | Dado completo no bundle | |
| RLS + PostgreSQL view | Isolamento garantido no banco | ✓ |

**Escolha:** PostgreSQL view com RLS — roles sem permissão recebem colunas já mascaradas.

---

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Padrão brasileiro legível | 123.***.***-** / jo***@gmail.com | ✓ |
| Asteriscos completos | ***.***.***-** | |
| Claude decide | — | |

**Escolha:** Formato brasileiro legível.

---

## Auditoria (SEC-02)

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Trigger PostgreSQL automático | Captura toda mudança de dado | |
| Manual em Server Actions | Controle fino, depende de disciplina | |
| Híbrido: trigger + manual | Trigger para dados + manual para negócio | ✓ |

**Escolha:** Híbrido — trigger para escritas diretas no banco + registro manual em Server Actions para eventos de negócio enriquecidos.

---

## UI das Telas de Auth

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Páginas separadas (/login, /signup, /forgot-password) | Já no proxy.ts | ✓ |
| Uma página com tabs (/auth) | Menos páginas, URL não muda | |
| Claude decide | — | |

**Escolha:** Páginas separadas — alinhado com proxy.ts existente.

---

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Branding FYNXIA apenas | Mais simples para MVP | ✓ |
| Branding da clínica na Fase 1 | Melhor UX para convite de paciente | |

**Escolha:** Branding FYNXIA fixo na Fase 1.

---

## Discretion do Claude

- Estrutura da tabela `invitations`
- Mecanismo de expiração de convite
- Schemas Zod dos formulários
- Componentes shadcn para telas de auth
- Cópia dos e-mails transacionais

## Ideias Diferidas

- White-label por clínica — funcionalidade futura
- Login social (Google/Apple) — se houver demanda
- useRole() hook para visibilidade de componentes — Fase 2+
