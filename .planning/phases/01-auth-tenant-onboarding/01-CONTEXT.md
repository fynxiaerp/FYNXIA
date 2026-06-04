# Phase 1: Auth & Tenant Onboarding — Context

**Coletado:** 2026-06-04
**Status:** Pronto para planejamento

<domain>
## Escopo da Fase

Esta fase entrega: autenticação completa (cadastro, login, logout, recuperação de senha), registro de clínica com dados essenciais, convite de membros da equipe (invite por e-mail + criação direta), RBAC em nível de rota, infraestrutura de conta de paciente (sem UI), mascaramento de CPF/e-mail/telefone via RLS view, e auditoria híbrida nas tabelas de auth.

**Não inclui:** telas de gestão de pacientes (Fase 2), UI de agendamento (Fase 2), branding white-label por clínica (futuro), componentes com controle de visibilidade por role (Fase 2+).

</domain>

<decisions>
## Decisões de Implementação

### Registro da Clínica
- **D-01:** Admin fornece na tela de cadastro: nome da clínica + e-mail + senha + CNPJ + telefone. Demais dados (endereço, especialidade, timezone) são preenchidos nas Configurações depois.
- **D-02:** Entidade clínica usa tabela `public.clinics` (não `public.tenants`). A relação `public.users.tenant_id` referencia `public.clinics.id`. A tabela `public.tenants` criada na Fase 0 é renomeada/substituída por `public.clinics` nesta migração — ou uma migração `ALTER TABLE public.tenants RENAME TO public.clinics` é executada. Planejador/pesquisador deve verificar o impacto nas foreign keys e nas funções SECURITY DEFINER existentes.
- **D-03:** Após cadastro bem-sucedido → redirect direto para `/clinica`. Sem gate de confirmação de e-mail no fluxo de onboarding do admin.

### Convites e Entrada de Membros
- **D-04:** Dois caminhos disponíveis para o admin adicionar staff:
  1. **Invite por e-mail:** admin informa e-mail + role → sistema envia link via Resend → membro clica, define senha, entra no app já vinculado à clínica.
  2. **Criação direta:** admin informa e-mail + role + senha temporária → conta criada imediatamente.
- **D-05:** Convite por e-mail expira em **24 horas**, uso único. Reenvio invalida o convite anterior. Estado dos convites: `pending → accepted | expired`.

### RBAC — Controle de Acesso por Rota
- **D-06:** RBAC aplicado apenas em nível de rota no `proxy.ts` (Fase 1). Nenhuma lógica de ocultação de componentes/botões por role nesta fase.
- **D-07:** Matriz de acesso por role (apenas rotas existentes na Fase 1):

| Role | Rotas permitidas |
|------|-----------------|
| `admin` | Todas as rotas |
| `dentist` | `/clinica/*`, `/perfil` |
| `receptionist` | `/clinica/*`, `/perfil` |
| `patient` | `/paciente/*` apenas |
| `superadmin` | Todas + `/superadmin/*` (rota futura) |

- **D-08:** Role lida via `get_my_role()` SECURITY DEFINER (já existe na Fase 0). `proxy.ts` faz um DB call para obter o role do usuário autenticado e aplica a matriz acima.

### Contas de Pacientes
- **D-09:** Infraestrutura de paciente criada na Fase 1, UI na Fase 2. Inclui:
  - Backend do fluxo de convite para pacientes (mesmo mecanismo de staff, role = `patient`)
  - Migration da tabela `patient_consents` (SEC-05)
- **D-10:** Dois caminhos de cadastro de paciente:
  1. **Recepcionista cadastra + convite por e-mail** (24h, mesmo mecanismo do staff)
  2. **Auto-cadastro via link público** `/agendar/[clinic-slug]` — rota pública sem autenticação (preparação para CLINIC-09). A página de auto-cadastro é criada na Fase 2; a Fase 1 define o endpoint de API e a lógica de criação de conta.

### Mascaramento de Dados (SEC-01)
- **D-11:** Mascaramento implementado via **PostgreSQL view** com RLS. Roles sem permissão de leitura completa (receptionist, patient) recebem colunas já mascaradas da view; roles privilegiados (admin, dentist, superadmin) recebem dados completos.
- **D-12:** Formato brasileiro legível:
  - CPF: `123.***.***-**`
  - E-mail: `jo***@gmail.com`
  - Telefone: `(11) 9****-1234`

### Auditoria (SEC-02)
- **D-13:** Auditoria **híbrida**:
  1. **Trigger PostgreSQL** nas tabelas `clinics` e `users` — captura qualquer INSERT/UPDATE automaticamente (inclusive via Supabase Studio ou migrations).
  2. **Registro manual em Server Actions** para eventos de negócio com contexto enriquecido (ex: `"admin X convidou user Y com role dentist"`).
- **D-14:** Trigger de auditoria retorna SECURITY DEFINER para conseguir escrever em `audit_logs` sem policy de INSERT.

### UI das Telas de Auth
- **D-15:** Páginas separadas com URL própria: `/login`, `/signup`, `/forgot-password`. Já mapeado no `proxy.ts` existente.
- **D-16:** Branding FYNXIA fixo na Fase 1. Sem personalização por clínica (white-label é funcionalidade futura).

### Discretion do Claude
- Estrutura exata da tabela `invitations` (campos, índices)
- Implementação do mecanismo de expiração de convite (cron vs. verificação em runtime)
- Esquema de validação Zod para formulários de cadastro e convite
- Componentes shadcn específicos usados nas telas de auth
- Cópia dos e-mails de convite e recuperação de senha

</decisions>

<canonical_refs>
## Referências Canônicas

**Agentes de downstream DEVEM ler estes arquivos antes de planejar ou implementar.**

### Segurança e Arquitetura
- `.planning/research/PITFALLS.md` — 6 pitfalls críticos; C-1, C-4, C-5 especialmente relevantes para auth
- `.planning/research/ARCHITECTURE.md` — padrão `get_my_tenant_id()`, isolamento multi-tenant
- `.planning/research/STACK.md` — versões confirmadas de bibliotecas

### Fase 0 (foundation criada)
- `.planning/phases/00-foundation/00-CONTEXT.md` — decisões D-01..D-11 (schema, criptografia, scaffold)
- `.planning/phases/00-foundation/00-01-SUMMARY.md` — o que o scaffold criou (proxy.ts, clients, route groups)
- `.planning/phases/00-foundation/00-02-SUMMARY.md` — schema do banco (tenants, users, audit_logs, funções SECURITY DEFINER)

### Requisitos
- `.planning/REQUIREMENTS.md` — IDs da Fase 1: AUTH-01..07, SEC-01, SEC-02, SEC-05
- `.planning/ROADMAP.md` — success criteria da Fase 1 (5 critérios verificáveis)

### Contexto do Projeto
- `.planning/PROJECT.md` — valor central, constraints, decisões-chave
- `CLAUDE.md` — stack técnica, anti-padrões proibidos (getSession, auth-helpers-nextjs, etc.)

</canonical_refs>

<code_context>
## Código Existente Relevante

### Assets Reutilizáveis (Fase 0)
- `src/lib/supabase/client.ts` — cliente browser para formulários de auth client-side
- `src/lib/supabase/server.ts` — cliente server para Server Components e Server Actions
- `src/lib/supabase/admin.ts` — cliente service-role para operações privilegiadas (criar contas de staff)
- `src/lib/crypto.ts` — AES-256-GCM para `users.sensitive_data`
- `src/components/ui/button.tsx` — único componente shadcn disponível; shadcn já inicializado

### Padrões Estabelecidos
- **Proxy auth** (`src/proxy.ts`): já roteia `/login`, `/signup`, `/forgot-password` como auth routes; redireciona para `/clinica` após login. Fase 1 adiciona role-check neste arquivo.
- **Route groups**: `(auth)/layout.tsx` existe como passthrough; páginas de auth vão em `src/app/(auth)/`
- **Supabase Auth**: Supabase FREE plan — sem Custom Access Token Hook. Role e tenant lidos via `get_my_role()` + `get_my_tenant_id()` SECURITY DEFINER.

### Pontos de Integração
- `public.users` — Phase 1 adiciona trigger de auditoria e view mascarada
- `public.tenants` → renomear para `public.clinics` + adicionar colunas (CNPJ, telefone)
- `public.audit_logs` — já imutável via RLS; Phase 1 adiciona trigger que escreve via SECURITY DEFINER
- `src/proxy.ts` — estender com matriz de acesso por role

</code_context>

<specifics>
## Referências Específicas

- ROADMAP success criteria #1: "a new row exists in `public.clinics`" — confirma que a tabela se chama `clinics`, não `tenants`
- O link de convite deve funcionar mesmo sem uma sessão ativa (rota pública `/invite/[token]`)
- `proxy.ts` já expõe `/api/*` como rota pública — `/agendar/[slug]` precisará ser adicionada ao matcher ou tratada como rota pública explícita
- `get_my_role()` retorna TEXT — proxy.ts precisará de um helper que faz o DB call de forma eficiente (não por request, usar cache curto)

</specifics>

<deferred>
## Ideias Diferidas

- **White-label / branding por clínica** — personalização da tela de login com logo da clínica. Registrado para v2 ou fase de polish.
- **Login social (Google/Apple)** — não discutido; pode ser adicionado em fase posterior se houver demanda.
- **Controle de visibilidade de componentes por role** (useRole() hook) — Fase 2+ quando houver componentes complexos para proteger.
- **E-mail de confirmação obrigatório para admin** — optamos por redirect direto; pode ser ativado via config Supabase Auth se necessário em produção.
- **Supabase CLI em CI para validação de migrations** — deferred to Phase 1 (já estava como deferred na Fase 0)

</deferred>

---

*Phase: 01-auth-tenant-onboarding*
*Contexto coletado: 2026-06-04*
