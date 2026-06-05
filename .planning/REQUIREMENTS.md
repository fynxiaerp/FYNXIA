# FYNXIA ERP — Requirements

## v1 Requirements

### INFRA — Infraestrutura e Fundação

- [ ] **INFRA-01**: Sistema usa Next.js 15 (App Router) + TypeScript como framework principal
- [ ] **INFRA-02**: Banco de dados Supabase PostgreSQL na região sa-east-1 (São Paulo)
- [ ] **INFRA-03**: Deploy na Vercel na região gru1 (São Paulo) com CI/CD automático
- [ ] **INFRA-04**: Migrations de banco versionadas em supabase/migrations/
- [ ] **INFRA-05**: Variáveis sensíveis gerenciadas via Vercel Environment Variables (nunca em código)
- [ ] **INFRA-06**: RLS habilitado em todas as tabelas com políticas usando get_my_tenant_id() SECURITY DEFINER
- [ ] **INFRA-07**: Isolamento multi-tenant via funções SECURITY DEFINER (get_my_tenant_id() + get_my_role()) — compatível com Supabase FREE plan. Custom Access Token Hook disponível como upgrade de performance ao migrar para Pro.

### AUTH — Autenticação e Autorização

- [ ] **AUTH-01**: Usuário pode criar conta com e-mail e senha via Supabase Auth
- [ ] **AUTH-02**: Usuário pode fazer login e manter sessão ativa entre visitas (JWT refresh automático)
- [ ] **AUTH-03**: Usuário pode fazer logout de qualquer página
- [ ] **AUTH-04**: Middleware usa getUser() (não getSession()) para validar autenticidade do JWT
- [ ] **AUTH-05**: Sistema suporta 4 perfis com RBAC: admin, dentist, receptionist, patient
- [ ] **AUTH-06**: Dados completamente isolados por tenant_id via RLS (tenant A nunca vê dados do tenant B)
- [ ] **AUTH-07**: tenant_id e role armazenados em public.users (somente service role pode alterar via RLS) — lidos via get_my_tenant_id()+get_my_role() SECURITY DEFINER; sem dependência de app_metadata/JWT claims (FREE plan)

### SEC — Segurança e LGPD

- [ ] **SEC-01**: CPF, e-mail e telefone mascarados em listagens públicas/logs
- [ ] **SEC-02**: Todas as ações sensíveis registradas em audit_logs imutável (sem DELETE policy)
- [ ] **SEC-03**: Trigger automático de auditoria em tabelas: patients, appointments, medical_records, financial_transactions
- [x] **SEC-04**: Soft delete em patients via deleted_at (LGPD — nunca hard delete de prontuário)
- [ ] **SEC-05**: Tabela patient_consents com registro de consentimento LGPD por paciente
- [ ] **SEC-06**: Headers de segurança configurados (CSP, X-Frame-Options, HSTS, X-Content-Type-Options)
- [ ] **SEC-07**: Todas as colunas de timestamp usam TIMESTAMPTZ (suporte multi-fuso horário Brasil)
- [ ] **SEC-08**: Dados de saúde sensíveis criptografados com AES-256 antes de armazenar

### CLINIC — Módulo Clínica

- [x] **CLINIC-01**: Usuário pode visualizar agenda semanal por dentista com slots de horário
- [x] **CLINIC-02**: Usuário pode criar, editar e cancelar agendamentos sem conflito de horário (EXCLUDE USING GIST)
- [x] **CLINIC-03**: Usuário pode cadastrar paciente com: nome, CPF, data de nascimento, telefone, e-mail, endereço, histórico de saúde, alergias
- [x] **CLINIC-04**: Usuário pode editar ficha de paciente existente
- [ ] **CLINIC-05**: Dentista pode registrar prontuário clínico com diagnóstico, plano de tratamento e prescrições
- [ ] **CLINIC-06**: Dentista pode registrar ocorrências no odontograma interativo por dente (hígido, cariado, extraído, em tratamento)
- [ ] **CLINIC-07**: Sistema exibe histórico de atendimentos completo por paciente em ordem cronológica
- [ ] **CLINIC-08**: Paciente assina anamnese digitalmente com captura de timestamp e IP (requisito CFO)
- [ ] **CLINIC-09**: Usuário pode gerar link de agendamento online para o paciente

### FIN — Módulo Financeiro

- [ ] **FIN-01**: Usuário pode visualizar fluxo de caixa com entradas e saídas do mês corrente
- [ ] **FIN-02**: Usuário pode lançar transação financeira (receita/despesa) com categoria, valor e data
- [ ] **FIN-03**: Sistema lista contas a receber com status (pendente/pago/vencido) e data de vencimento
- [ ] **FIN-04**: Usuário pode gerar link de pagamento via Pix (Asaas) e recebe confirmação automática por webhook
- [ ] **FIN-05**: Usuário pode gerar boleto bancário (Asaas) para paciente
- [ ] **FIN-06**: Sistema rastreia parcelamentos com data e status de cada parcela
- [ ] **FIN-07**: Sistema dispara régua de cobrança automática (WhatsApp/e-mail) no vencimento e a cada N dias de atraso
- [ ] **FIN-08**: Usuário pode emitir recibo de consulta em PDF usando @react-pdf/renderer
- [ ] **FIN-09**: Webhook handler do Asaas retorna HTTP 200 imediatamente e processa pagamento de forma assíncrona com idempotência

### COMMS — Comunicações

- [ ] **COMMS-01**: Sistema envia confirmação de consulta via WhatsApp (Meta Cloud API) 24h antes
- [ ] **COMMS-02**: Sistema envia lembrete de consulta via e-mail (Resend) 24h antes
- [ ] **COMMS-03**: Templates WhatsApp separados por categoria (utility vs marketing) para evitar reclassificação Meta
- [ ] **COMMS-04**: Sistema usa pg_cron + pgmq para jobs assíncronos de envio de mensagens

### AI — IA e Automação

- [ ] **AI-01**: Copiloto IA disponível em toda tela via chat lateral (Vercel AI Gateway)
- [ ] **AI-02**: Agente autônomo confirma consultas do dia seguinte via WhatsApp e registra resposta
- [ ] **AI-03**: Agente autônomo identifica inadimplentes e envia mensagem de cobrança personalizada

---

## v2 Requirements (deferred)

- App mobile nativo (PWA é suficiente para v1)
- Emissão de NF-e fiscal (certificado digital, alta complexidade)
- Integração com planos de saúde / convênios
- Dashboard de franquias com agregação cross-tenant
- Módulo de RH / folha de pagamento
- Relatórios BI avançados com filtros customizáveis
- Voice-to-text em prontuário (risco regulatório, validar antes de ship)
- NFSe para municípios além do Nacional + top-5 cidades

---

## Out of Scope (explicitly excluded)

- **App mobile nativo** — PWA cobre o caso de uso v1; nativo adiciona 2x complexidade de build
- **NF-e (nota fiscal produto)** — serviços odontológicos emitem NFSe, não NF-e; escopo errado
- **Multi-currency** — mercado exclusivamente brasileiro v1
- **Telemedicina/teleconsulta** — fora do escopo clínico dentário
- **Gestão de RH/ponto eletrônico** — produto separado
- **Evolution API / Baileys** — violação de ToS WhatsApp; risco existencial

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| INFRA-01 | Phase 0 — Foundation | Pending |
| INFRA-02 | Phase 0 — Foundation | Pending |
| INFRA-03 | Phase 0 — Foundation | Pending |
| INFRA-04 | Phase 0 — Foundation | Pending |
| INFRA-05 | Phase 0 — Foundation | Pending |
| INFRA-06 | Phase 0 — Foundation | Pending |
| INFRA-07 | Phase 0 — Foundation | Pending |
| SEC-07 | Phase 0 — Foundation | Pending |
| SEC-08 | Phase 0 — Foundation | Pending |
| AUTH-01 | Phase 1 — Auth & Tenant Onboarding | Pending |
| AUTH-02 | Phase 1 — Auth & Tenant Onboarding | Pending |
| AUTH-03 | Phase 1 — Auth & Tenant Onboarding | Pending |
| AUTH-04 | Phase 1 — Auth & Tenant Onboarding | Pending |
| AUTH-05 | Phase 1 — Auth & Tenant Onboarding | Pending |
| AUTH-06 | Phase 1 — Auth & Tenant Onboarding | Pending |
| AUTH-07 | Phase 1 — Auth & Tenant Onboarding | Pending |
| SEC-01 | Phase 1 — Auth & Tenant Onboarding | Pending |
| SEC-02 | Phase 1 — Auth & Tenant Onboarding | Pending |
| SEC-05 | Phase 1 — Auth & Tenant Onboarding | Pending |
| CLINIC-01 | Phase 2 — Clinical MVP | Complete |
| CLINIC-02 | Phase 2 — Clinical MVP | Complete |
| CLINIC-03 | Phase 2 — Clinical MVP | Complete |
| CLINIC-04 | Phase 2 — Clinical MVP | Complete |
| CLINIC-05 | Phase 2 — Clinical MVP | Pending |
| CLINIC-06 | Phase 2 — Clinical MVP | Pending |
| CLINIC-07 | Phase 2 — Clinical MVP | Pending |
| CLINIC-08 | Phase 2 — Clinical MVP | Pending |
| CLINIC-09 | Phase 2 — Clinical MVP | Pending |
| SEC-03 | Phase 2 — Clinical MVP | Pending |
| SEC-04 | Phase 2 — Clinical MVP | Complete |
| FIN-01 | Phase 3 — Financial MVP | Pending |
| FIN-02 | Phase 3 — Financial MVP | Pending |
| FIN-03 | Phase 3 — Financial MVP | Pending |
| FIN-04 | Phase 3 — Financial MVP | Pending |
| FIN-05 | Phase 3 — Financial MVP | Pending |
| FIN-06 | Phase 3 — Financial MVP | Pending |
| FIN-07 | Phase 3 — Financial MVP | Pending |
| FIN-08 | Phase 3 — Financial MVP | Pending |
| FIN-09 | Phase 3 — Financial MVP | Pending |
| SEC-06 | Phase 3 — Financial MVP | Pending |
| COMMS-01 | Phase 4 — Communications & Async | Pending |
| COMMS-02 | Phase 4 — Communications & Async | Pending |
| COMMS-03 | Phase 4 — Communications & Async | Pending |
| COMMS-04 | Phase 4 — Communications & Async | Pending |
| AI-01 | Phase 5 — AI Agents | Pending |
| AI-02 | Phase 5 — AI Agents | Pending |
| AI-03 | Phase 5 — AI Agents | Pending |

**Total mapped: 47/47**

---

## Open Questions (need resolution before implementation)

1. **Supabase plan**: Pro plan obrigatório para pg_cron (<daily), pgmq e Custom Auth Hooks — confirmar orçamento
2. **E-assinatura**: D4Sign (recomendado, ICP-Brasil) vs DocuSign vs implementação própria — decisão antes da Fase 2
3. **FullCalendar licença**: scheduler multi-dentista = licença comercial (~$500/ano) — aprovar budget
4. **Meta Business**: verificação tem lead time 7-14 dias — iniciar no kickoff da Fase 1
5. **NFSe**: construir somente para NFSe Nacional + top-5 cidades v1, ou integrar via Tecnospeed?
6. **Asaas vs Stripe primário**: Asaas para Pix/boleto BR; Stripe para cartão internacional — confirmar se ambos são necessários no v1
7. **Franquias**: tenant_groups hierarchy needed? Define antes da Fase 0 (afeta schema inicial)
