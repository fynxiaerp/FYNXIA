# FYNXIA ERP — Roadmap

**Project:** FYNXIA Multi-Tenant Dental ERP SaaS

---

## Milestones

- ✅ **v1.0 MVP** — Phases 0–6 (shipped 2026-06-12) — full clinical + financial + communications + AI product, dual-theme app shell. See [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md).
- 📋 **v2.0 — Produto Completo** — Phases 7–21 (in progress) — 27 modules, blocos A–E.

---

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 0–6) — SHIPPED 2026-06-12</summary>

- [x] Phase 0: Foundation (3/3 plans) — multi-tenant RLS, secure middleware, AES-256, gru1
- [x] Phase 1: Auth & Tenant Onboarding (3/3 plans) — auth lifecycle, RBAC, invites, masking
- [x] Phase 2: Clinical MVP (5/5 plans) — agenda, pacientes, prontuário, odontograma, anamnese
- [x] Phase 3: Financial MVP (4/4 plans) — Asaas PIX/boleto, receivables, installments, PDF
- [x] Phase 4: Communications & Async (4/4 plans) — WhatsApp/Resend, outbox + Vercel Cron
- [x] Phase 5: AI Agents (5/5 plans) — copilot sidebar, confirmation + collection agents
- [x] Phase 6: UX Polish & App Shell (8/8 plans) — dual-theme, sidebar shell, token sweep

Full detail archived in [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md).

</details>

### v2.0 — Produto Completo

**Bloco A — Fundações**

- [ ] **Phase 7: Sistema, Multiunidade & Papéis** — Configuração da empresa, rede de unidades, RBAC granular e nível de autonomia de IA por agente
- [ ] **Phase 8: Documentos & Assinatura ICP-Brasil** — Motor de modelos de documentos com variáveis, assinatura ICP-Brasil e versionamento imutável
- [ ] **Phase 9: Hub de Integrações Externas** — Hub central de credenciais, webhooks e saúde de conectores (WhatsApp, NFS-e, banco, TISS)
- [x] **Phase 10: IA Governada (L0–L4), Auditoria & OCR** — Framework de agentes governados com autonomia graduada, trilha de auditoria com estornos e OCR de documentos

**Bloco B — Clínico**

- [x] **Phase 11: Profissionais & Recursos** — Cadastro de profissionais (CRO, comissão, disponibilidade) e recursos físicos com painel de sala de espera
 (completed 2026-06-15)
- [x] **Phase 12: Receituário & Teleodontologia** — Documentos clínicos assinados (receita/atestado/exame) e teleconsultas registradas no prontuário
 (completed 2026-06-19)
- [x] **Phase 13: Esterilização/CME & Laboratório de Prótese** — Controle de ciclos de esterilização com rastreabilidade e gestão de ordens de serviço protéticas
 (completed 2026-06-19)

**Bloco C — Financeiro**

- [x] **Phase 14: Financeiro — Cadastros Base** — Plano de contas em árvore, centros de custo, contas correntes e categorias de lançamento
 (completed 2026-06-20)
- [ ] **Phase 15: Faturamento/NFS-e & Convênios/TISS** — OS automática pós-atendimento, emissão de NFS-e e faturamento de convênios com guia TISS e glosas
- [ ] **Phase 16: Contas a Pagar, Conciliação & Tributos** — Contas a pagar, conciliação bancária OFX/Open Finance, fluxo de caixa atualizado, repasses e RPA com retenções
- [ ] **UI hint**: yes

**Bloco D — Operação & Crescimento**

- [ ] **Phase 17: Estoque & Materiais** — Cadastro de produtos com baixa automática por procedimento, alertas de estoque mínimo e rastreabilidade ANVISA
- [ ] **Phase 18: CRC & Marketing** — Funil de leads, ROI de campanhas, campanhas segmentadas, NPS e programa de indicação

**Bloco E — Analítico & Canais**

- [ ] **Phase 19: Relatórios, Orçamento & BI** — DRE gerencial, orçado × realizado, distribuição societária e painéis de KPIs com previsões de IA
- [ ] **Phase 20: Portal do Paciente & App do Profissional** — Portal self-service do paciente e PWA móvel do dentista com ditado SOAP por voz
- [ ] **Phase 21: Migração & Ensino** — Importação assistida de dados de sistemas anteriores e módulo de clínica-escola com turmas e supervisão clínica

---

## Phase Details

### Phase 7: Sistema, Multiunidade & Papéis
**Goal**: Administradores podem configurar a empresa, rede de unidades, RBAC granular por módulo e nível de autonomia da IA por agente, habilitando o escopo multi-unidade em todo o sistema
**Depends on**: Phase 0 (foundation/RLS), Phase 1 (auth/RBAC v1)
**Requirements**: SYS-01, SYS-02, SYS-03, SYS-04, SYS-05, ROLE-01, ROLE-02
**Success Criteria** (what must be TRUE):
  1. Admin cadastra CNPJ/CPF com validação, regime tributário e múltiplas unidades; dados filtram por unidade em toda a plataforma
  2. Admin faz upload de Certificado ICP-Brasil A1 e o sistema valida o certificado antes de salvar
  3. Admin cria perfis de acesso custom controlando permissões por módulo com gating server-side
  4. Os seis novos papéis (DPO, Auditor, Sócio, TI, Implantação, Aluno) são reconhecidos pelo RBAC e cada um vê apenas módulos/ações autorizados
  5. Admin configura nível de autonomia L0–L4 por agente de IA e a configuração é respeitada em runtime
**Plans**: 6 plans
- [x] 07-01-PLAN.md — Wave 0: node-forge install + assertNotReadOnly guard + RED test scaffolds + .pfx fixture
- [x] 07-02-PLAN.md — Wave 1: multiunidade migrations (units, user_units + get_my_unit_ids, role expansion, unit_id backfill)
- [x] 07-03-PLAN.md — Wave 1: RBAC module matrix + read-only gating in proxy.ts, node-forge pfx reader, certificates + ai_agent_config migrations
- [x] 07-04-PLAN.md — Wave 2: [BLOCKING] supabase db push + regenerate types (human re-auth)
- [x] 07-05-PLAN.md — Wave 3: Empresa & Unidades config UI (SYS-01)
- [x] 07-06-PLAN.md — Wave 3: Certificado ICP + Autonomia IA + Perfis config UI (SYS-02/03/04)
**v1 reuse**: Expande `public.clinics` + `public.users` + RBAC matrix do Phase 1; novos papéis adicionam linhas ao ROLE_ROUTES; SYS-02 prepara keystore para DOC (Phase 8)

---

### Phase 8: Documentos & Assinatura ICP-Brasil
**Goal**: Usuários podem criar modelos de documento com variáveis, assiná-los com ICP-Brasil (carimbo de tempo) e o documento assinado fica imutável com histórico de versões
**Depends on**: Phase 7 (certificado ICP cadastrado em SYS-02)
**Requirements**: DOC-01, DOC-02, DOC-03
**Success Criteria** (what must be TRUE):
  1. Usuário cria um modelo com variáveis (ex: {{nome_paciente}}, {{data}}) e o sistema preenche automaticamente ao gerar o documento
  2. Documento gerado é assinado com o certificado ICP-Brasil; o carimbo de tempo é gravado e exibido ao abrir o documento
  3. Documento assinado não pode ser editado; qualquer alteração cria uma nova versão preservando o histórico completo
**Plans**: 5 plans
- [x] 08-01-PLAN.md — Wave 1: RED test scaffolds (sign→verify vs .pfx fixture, template engine, migration/action/PDF source-inspection)
- [x] 08-02-PLAN.md — Wave 2: migrations (3 tables + RLS INSERT-only + private bucket) + template engine + ICP signing lib + DocumentoPDF
- [x] 08-03-PLAN.md — Wave 3: [BLOCKING] supabase db push + regenerate types (human re-auth)
- [x] 08-04-PLAN.md — Wave 4: template CRUD + editor UI at /config/documentos (DOC-01)
- [x] 08-05-PLAN.md — Wave 4: documentos module + generate/sign/verify + immutable versions UI at /clinica/documentos (DOC-02/03)
**v1 reuse**: Expande assinatura de anamnese (SHA-256 + token Phase 2); reutiliza storage Supabase; base para RX (Phase 12) e OS/NFS-e (Phase 15)
**UI hint**: yes

---

### Phase 9: Hub de Integrações Externas
**Goal**: Administradores/TI cadastram conectores externos com credenciais seguras, o sistema recebe eventos via webhooks e um painel mostra a saúde de cada integração com reenvio automático em falha
**Depends on**: Phase 7 (papéis TI/Admin), Phase 8 (infra de configurações)
**Requirements**: INT-01, INT-02, INT-03
**Success Criteria** (what must be TRUE):
  1. Admin cadastra conector (WhatsApp, NFS-e, banco, TISS) com credenciais armazenadas criptografadas; credenciais nunca aparecem em texto plano na UI
  2. Sistema recebe payload de webhook por conector e o roteia ao módulo correto com log do evento
  3. Painel mostra status (ativo/falha/degradado) de cada integração; integrações com falha são reenviadas automaticamente e o painel reflete a atualização
**Plans**: 5 plans
Plans:
- [x] 09-01-PLAN.md — Wave 0 RED test scaffolds (connectors/webhooks/health source-inspection + units)
- [x] 09-02-PLAN.md — Migrations (integration_connectors + integration_events + REVOKE) + lib (types/mask/health/validators) + connector vault Server Action
- [x] 09-03-PLAN.md — logToHub + additive hub-log in Asaas/WhatsApp handlers + drainIntegrationEvents worker/cron + integracoes module in proxy
- [x] 09-04-PLAN.md — [BLOCKING] supabase db push + gen types (truncation guard) + post-push DB checks
- [x] 09-05-PLAN.md — /config/integracoes UI: connectors registry + masked register/edit form + health panel + reprocess action
**v1 reuse**: Expande outbox + webhook_events (Phase 4); reutiliza WhatsApp Cloud API e Resend já integrados; padrão idempotent webhook handler do Phase 3
**UI hint**: yes

---

### Phase 10: IA Governada (L0–L4), Auditoria & OCR
**Goal**: Agentes de IA operam dentro de limites invioláveis com aprovação humana em ações sensíveis; auditores consultam trilha completa com estornos controlados; usuários fazem OCR de documentos com revisão de extrações incertas
**Depends on**: Phase 7 (nível de autonomia por agente SYS-04), Phase 9 (hub de integrações)
**Requirements**: AIG-01, AIG-02, AIG-03, AUD-01, AUD-02, AUD-03, OCR-01, OCR-02
**Success Criteria** (what must be TRUE):
  1. Agente de IA que tentaria ultrapassar seu teto de ação configurado é bloqueado e a tentativa é registrada no log de decisão
  2. Ação sensível (ex: cancelar cobrança > R$ X) pausa e exibe aprovação humana pendente antes de executar
  3. Auditor/DPO acessa tela dedicada e filtra a trilha por entidade, usuário e período; cada entrada mostra antes/depois
  4. Estorno requer motivo e aprovação por alçada configurada; o fluxo é registrado na trilha de auditoria
  5. Usuário faz upload/foto de documento e a IA extrai campos; extrações abaixo do threshold de confiança ficam em fila de revisão antes de gravar
**Plans**: 8 plans
- [x] 10-01-PLAN.md — Wave 0: RED test scaffolds (migrations + policy + approvals + audit + ocr)
- [x] 10-02-PLAN.md — Wave 1: 3 migrations (ai_decision_log/approval_requests/ocr_extractions) + audit_logs indexes + conformidade RBAC module
- [x] 10-03-PLAN.md — Wave 1: withAgentPolicy + approval actions + additive governance wrap of tools/agents (AIG-01/02/03)
- [x] 10-04-PLAN.md — Wave 2: audit query lib + generic estorno via approval-by-alçada (AUD-01/02)
- [x] 10-05-PLAN.md — Wave 2: OCR extract route (Gateway multimodal + ZDR + FilePart) + confidence gating + review/commit actions (OCR-01/02)
- [x] 10-06-PLAN.md — Wave 3: [BLOCKING] supabase db push + gen types (truncation guard)
- [x] 10-07-PLAN.md — Wave 4: conformidade UI — audit screen + approval inbox (AUD-01/03, AIG-02, AUD-02)
- [x] 10-08-PLAN.md — Wave 4: conformidade UI — OCR upload + confidence-flagged review (OCR-01/02)
**v1 reuse**: Expande `audit_logs` (Phase 0, imutável por RLS); expande copiloto/agentes (Phase 5) com framework L0–L4; AUD-03 adiciona UI sobre dados existentes
**UI hint**: yes

---

### Phase 11: Profissionais & Recursos
**Goal**: Administradores cadastram profissionais com CRO, grade de disponibilidade e regras de comissão, além de recursos físicos que bloqueiam a agenda quando indisponíveis, com painel de sala de espera em tempo real
**Depends on**: Phase 7 (papéis/Admin), Phase 2 (agenda v1 a evoluir)
**Requirements**: PRO-01, PRO-02, PRO-03, RES-01, RES-02, RES-03
**Success Criteria** (what must be TRUE):
  1. Admin cadastra profissional com CRO+UF, especialidades, tipo de vínculo e grade de disponibilidade; a agenda exibe horários gerados automaticamente
  2. Regra de comissão (% por profissional/serviço) está configurada e alimenta o módulo de repasse
  3. Recurso (sala, cadeira, equipamento) com status "manutenção" bloqueia aquele horário na agenda e impede agendamento
  4. Painel de sala de espera (display TV) mostra chamadas em tempo real e exibe o tempo de espera de cada paciente
**Plans**: 8 plans
Plans:
- [x] 11-01-PLAN.md — Wave 0: RED test scaffolds (migrations/professionals/resources/waiting-room + GIST-regression guard)
- [x] 11-02-PLAN.md — Wave 1: professionals + availability(+exceptions) migrations + RLS + dentist backfill + isSlotWithinAvailability pure + commission Zod
- [x] 11-03-PLAN.md — Wave 1: resources + appointment extension (resource_id/presence_status/timestamps) + realtime publication + isResourceAvailable/waitingMinutes pure + resource Zod
- [x] 11-04-PLAN.md — Wave 2: booking integration (availability + resource guards in internal/public actions) + /painel public route + profissionais/recursos nav
- [ ] 11-05-PLAN.md — Wave 3: [BLOCKING] supabase db push (6 migrations) + gen types (truncation guard)
- [x] 11-06-PLAN.md — Wave 4: professionais cadastro UI (tabbed ProfessionalForm + AvailabilityGrid + commission JSONB) (PRO-01/03)
- [x] 11-07-PLAN.md — Wave 4: recursos cadastro UI (ResourceForm + list/edit, status manutenção) (RES-01)
- [x] 11-08-PLAN.md — Wave 4: check-in actions + /painel TV (Supabase Realtime, initials-only LGPD) (RES-03)
**v1 reuse**: Expande agenda FullCalendar multi-dentista (Phase 2); anti-double-booking GIST existente cobre RES-02; módulo "Equipe" parcial do v1 evolui para PRO
**UI hint**: yes

---

### Phase 12: Receituário & Teleodontologia
**Goal**: Dentistas emitem receitas e atestados assinados com ICP-Brasil (com validação de alergias) e realizam teleconsultas que geram registro SOAP no prontuário e documentos clínicos na hora
**Depends on**: Phase 8 (assinatura ICP), Phase 11 (profissionais), Phase 2 (prontuário v1)
**Requirements**: RX-01, RX-02, RX-03, TEL-01, TEL-02
**Success Criteria** (what must be TRUE):
  1. Dentista emite receita (simples ou controle especial) com medicamento da base DCB/DCI e posologia; o sistema alerta se o medicamento conflita com uma alergia cadastrada do paciente
  2. Receita/atestado é assinado com ICP-Brasil, recebe número sequencial e fica disponível no Portal do Paciente
  3. Dentista inicia teleconsulta com consentimento da sessão registrado (CFO); a sessão produz registro SOAP no prontuário e eventuais documentos emitidos ficam vinculados ao atendimento
**Plans**: 7 plans
Plans:
- [x] 12-01-PLAN.md — Wave 0: RED test scaffolds (allergy-check + clinical-documents + RX/TEL migrations) + GIST/Phase-8-signing regression guard
- [x] 12-02-PLAN.md — Wave 1: receituário migrations (medications+seed, clinical_documents, document_seq_counters+next_doc_number, bucket, RLS) + checkMedicationAllergy + formatDocNumber + Zod
- [x] 12-03-PLAN.md — Wave 1: teleodontologia migrations (teleconsultations + soap_records + RLS) + teleconsultation/SOAP Zod
- [x] 12-04-PLAN.md — Wave 2: Server Actions (issue/sign clinical docs reusing Phase 8 signPdfBuffer; teleconsultation + SOAP) + ReceituarioPDF/AtestadoPDF/ExamePDF
- [x] 12-05-PLAN.md — Wave 3: [BLOCKING] supabase db push (5 migrations) + gen types (truncation guard)
- [x] 12-06-PLAN.md — Wave 4: receituário UI (emissão + alerta de alergia + assinatura ICP) + módulos receituario/teleodonto no proxy+nav (RX-01/02/03)
- [x] 12-07-PLAN.md — Wave 4: teleodontologia UI (consentimento CFO + link externo + iniciar/encerrar) + editor SOAP (TEL-01/02)
**v1 reuse**: Expande prontuário/anamnese (Phase 2); assinatura ICP de DOC (Phase 8); base de medicamentos é nova tabela
**UI hint**: yes

---

### Phase 13: Esterilização/CME & Laboratório de Prótese
**Goal**: A equipe clínica registra ciclos de esterilização com rastreabilidade completa de kit por paciente, e dentistas abrem ordens de serviço protéticas cujos custos alimentam automaticamente o contas a pagar
**Depends on**: Phase 10 (auditoria/rastreabilidade), Phase 11 (recursos/equipamentos), Phase 2 (prontuário)
**Requirements**: CME-01, CME-02, CME-03, LAB-01, LAB-02
**Success Criteria** (what must be TRUE):
  1. Equipe registra ciclo de esterilização com autoclave, parâmetros (temp/tempo/pressão) e indicador biológico; ciclos reprovados ou vencidos ficam bloqueados para uso
  2. Kit esterilizado é vinculado ao paciente atendido e o vínculo aparece na rastreabilidade por lote
  3. Dentista abre ordem de serviço protética com tipo, laboratório, prazo e etapas; a OS tem status Enviado→prova→concluído
  4. Custo do laboratório gera conta a pagar automaticamente e está visível no módulo financeiro
**Plans**: 7 plans
Plans:
- [x] 13-01-PLAN.md — Wave 0: RED test scaffolds (cycle-status + kit-block-guard + lab-cost + CME/LAB migrations + GIST/financial regression guard)
- [x] 13-02-PLAN.md — Wave 1: CME migrations (sterilization_cycles + kit_usages, autoclave→resources) + RLS + cycle-status pure block-guard lib + Zod (CME-01/02/03)
- [x] 13-03-PLAN.md — Wave 1: LAB migrations (prosthetic_labs + lab_orders +financial_transaction_id link) + RLS + lab-cost pure helpers + Zod (LAB-01/02)
- [x] 13-04-PLAN.md — Wave 2: Server Actions (registerKitUsage server-side block guard CME-02 + setLabOrderCost posting despesa to financial_transactions LAB-02)
- [x] 13-05-PLAN.md — Wave 3: [BLOCKING] supabase db push (4 migrations) + gen types (truncation guard)
- [x] 13-06-PLAN.md — Wave 4: CME UI (CycleForm + KitUsageForm + block surfaced) + esterilizacao/protese module registration in proxy+nav (CME-01/02/03)
- [x] 13-07-PLAN.md — Wave 4: LAB UI (LabForm + LabOrderForm stages editor + status enviado→prova→concluído + cost→financeiro) (LAB-01/02)
**v1 reuse**: Reutiliza audit trail (Phase 0/10) para rastreabilidade; LAB-02 conecta com contas a pagar que existirá após Phase 16

---

### Phase 14: Financeiro — Cadastros Base
**Goal**: O financeiro estrutura o plano de contas em árvore, centros de custo por unidade, contas correntes e categorias, e todos os lançamentos passam a ser classificados por conta contábil e centro de custo
**Depends on**: Phase 7 (unidades como centro de custo), Phase 3 (schema financeiro v1)
**Requirements**: FCAD-01, FCAD-02
**Success Criteria** (what must be TRUE):
  1. Financeiro cria e edita o plano de contas em estrutura hierárquica (receitas/despesas/grupos); a árvore é visualizada na tela de cadastro
  2. Lançamento financeiro classifica conta contábil e centro de custo obrigatoriamente; o filtro por unidade/centro de custo funciona nas telas de fluxo de caixa e relatórios
**Plans**: 7 plans
Plans:
- [x] 14-01-PLAN.md — Wave 0: RED test scaffolds (migrations source-inspection + buildTree + Zod classification + Phase 3 regression guard)
- [x] 14-02-PLAN.md — Wave 1: Migrations (chart_of_accounts + cost_centers + bank_accounts + ALTERs + RLS + seed/backfill) (FCAD-01/02)
- [x] 14-03-PLAN.md — Wave 2: [BLOCKING] supabase db push (3 migrations, project jqjwyqlbbuqnrffdnlpp) + gen types
- [x] 14-04-PLAN.md — Wave 3: Server Actions (chart/cost-centers/bank-accounts/categories) + buildTree lib + required classification on createTransaction + non-blocking Asaas webhook resolver (FCAD-01/02)
- [x] 14-05-PLAN.md — Wave 4: Plano de Contas UI (Accordion tree + AccountFormDialog) + financeiro hub cards (FCAD-01)
- [x] 14-06-PLAN.md — Wave 4: Centros de Custo + Contas Correntes UI (tabular cadastros) (FCAD-01)
- [x] 14-07-PLAN.md — Wave 4: Classificação no TransactionModal + Categorias→conta mapping + filtro unidade/CC no fluxo de caixa (FCAD-02)
**v1 reuse**: Expande schema `financial_categories` (Phase 3); reutiliza estrutura de `financial_transactions`; adiciona `chart_of_accounts` e `cost_centers`
**UI hint**: yes

---

### Phase 15: Faturamento/NFS-e & Convênios/TISS
**Goal**: Atendimentos concluídos viram ordens de serviço automáticas com NFS-e emitida na prefeitura, e o faturamento de convênios gera guia TISS com tratamento de glosas
**Depends on**: Phase 8 (ICP para NFS-e), Phase 9 (conector NFS-e/TISS), Phase 14 (plano de contas), Phase 3 (recebíveis v1)
**Requirements**: OS-01, OS-02, OS-03, CONV-01, CONV-02, CONV-03
**Success Criteria** (what must be TRUE):
  1. Ao concluir atendimento, ordem de serviço é criada automaticamente com os procedimentos executados e a forma de pagamento gera as parcelas a receber
  2. A partir da OS, usuário emite NFS-e na prefeitura do município; o documento fiscal retorna com número e fica arquivado
  3. Usuário cadastra operadora de convênio com tabela de preços própria e gera guia TISS; o lote é enviado com protocolo por operadora
  4. Glosas recebidas são classificadas por motivo e o usuário registra recurso, com o status atualizado na tela de convênios
**Plans**: 9 plans
Plans:
- [x] 15-01-PLAN.md — Wave 0: RED test scaffolds (migrations source-inspection + service-orders/nfse/tiss behavior + regression guard)
- [x] 15-02-PLAN.md — Wave 1: catalog/fiscal migrations (services, insurer_prices, unit_fiscal_config, glosa_motivos) + seed + service/insurer Zod
- [x] 15-03-PLAN.md — Wave 1: OS+TISS migrations (service_orders, items, nfse_records, tiss_lotes/guides/items, next_os_number, charges link) + unified RLS + service-order Zod
- [x] 15-04-PLAN.md — Wave 2: [BLOCKING] supabase db push (5 migrations) + gen types (truncation guard)
- [x] 15-05-PLAN.md — Wave 3: OS domain (os-math, createOs, faturarOs CAS+idempotency, cancelar via alçada, auto-OS on concluido) (OS-01/03)
- [ ] 15-06-PLAN.md — Wave 3: FiscalProvider abstraction + Stub/FocusNFe + ISS + emitirNfse (regime split) + NFS-e webhook (OS-02)
- [ ] 15-07-PLAN.md — Wave 3: TissProvider abstraction + Stub + glosa-math + criarGuia/fecharLote/registrarGlosa/registrarRecurso + insurers CRUD (CONV-01/02/03)
- [ ] 15-08-PLAN.md — Wave 4: OS + NFS-e + Faturamento hub UI + financeiro nav cards (OS-01/02/03)
- [ ] 15-09-PLAN.md — Wave 4: Convênios + Operadoras + price table + Glosas UI (CONV-01/02/03)
**v1 reuse**: Expande receivables/charges (Phase 3); reusa protótipo navegável de Convênios (`/clinica/prototipos`); conector NFS-e via INT (Phase 9)
**UI hint**: yes

---

### Phase 16: Contas a Pagar, Conciliação & Tributos
**Goal**: O financeiro opera contas a pagar integradas a fornecedores, concilia o extrato bancário automaticamente, o fluxo de caixa reflete as baixas e o sistema calcula repasses de profissionais e retenções de RPA com envio de EFD-Reinf
**Depends on**: Phase 14 (plano de contas), Phase 15 (OS/faturamento gera CP e base de repasse), Phase 9 (conector banco/Open Finance)
**Requirements**: FOP-01, FOP-02, FOP-03, TRIB-01, TRIB-02, TRIB-03
**Success Criteria** (what must be TRUE):
  1. Financeiro cadastra conta a pagar com vencimento e fornecedor; a baixa atualiza automaticamente o fluxo de caixa
  2. Conciliação importa extrato OFX ou via Open Finance e bate automaticamente com os lançamentos; divergências são destacadas para revisão
  3. Repasse do profissional é calculado sobre o valor recebido conforme a regra configurada; o demonstrativo de repasse fica disponível para conferência
  4. RPA de autônomo é gerado com retenções de INSS/IRRF/ISS calculadas; o arquivo de EFD-Reinf é gerado para envio ao fisco
**Plans**: TBD
**v1 reuse**: Expande contas a receber + fluxo de caixa (Phase 3); reusa régua de cobrança automática (Phase 4); PRO-03 (comissão) de Phase 11 alimenta TRIB-01
**UI hint**: yes

---

### Phase 17: Estoque & Materiais
**Goal**: Usuários cadastram produtos com lote/série, o procedimento realizado dá baixa automática de materiais no estoque, e alertas de estoque mínimo e validade disparam o agente de compras com rastreabilidade ANVISA
**Depends on**: Phase 10 (agente IA para compras), Phase 15 (procedimentos concluídos disparam baixa)
**Requirements**: EST-01, EST-02, EST-03
**Success Criteria** (what must be TRUE):
  1. Usuário cadastra produto com categoria (insumo/implante/medicamento), lote/série, estoque mínimo e custo médio calculado
  2. Ao registrar procedimento concluído, a baixa de materiais associados é feita automaticamente no estoque
  3. Sistema alerta quando estoque atinge o mínimo ou produto está próximo do vencimento; implantes têm rastreabilidade de lote por exigência ANVISA e o agente de compras é disparado
**Plans**: TBD
**v1 reuse**: Novo módulo; conecta com procedimentos do prontuário (Phase 2) e agentes IA (Phase 10)

---

### Phase 18: CRC & Marketing
**Goal**: Recepção e marketing gerenciam o funil de leads com origem e ROI, disparam campanhas segmentadas via WhatsApp/e-mail, coletam NPS e rastreiam o programa de indicação
**Depends on**: Phase 9 (hub INT para WhatsApp/e-mail), Phase 7 (papéis Marketing/Recepção)
**Requirements**: CRC-01, CRC-02, CRC-03, CRC-04, CRC-05
**Success Criteria** (what must be TRUE):
  1. Lead é cadastrado com origem e percorre o funil (Novo→Convertido/Perdido); a tela mostra a conversão por origem
  2. Painel de ROI de campanha exibe CPL e CAC calculados a partir da origem dos pacientes convertidos
  3. Campanha de reativação dispara mensagem segmentada (WhatsApp e/ou e-mail) para pacientes inativos há X dias com personalização de IA
  4. NPS é coletado automaticamente pós-consulta (0–10); painel classifica promotores/neutros/detratores
  5. Programa de indicação registra quem indicou quem e as recompensas acumuladas ficam visíveis para o paciente indicador
**Plans**: TBD
**v1 reuse**: Expande mensageria WhatsApp/Resend (Phase 4) e agentes de IA (Phase 5); funil de leads é novo; NPS é novo; pacientes existentes (Phase 2) são base do CRC
**UI hint**: yes

---

### Phase 19: Relatórios, Orçamento & BI
**Goal**: Gestão e sócios visualizam DRE gerencial por unidade, orçado × realizado com desvios, distribuição de lucro por cota societária e painéis de KPIs com previsões geradas por IA
**Depends on**: Phase 16 (dados financeiros completos), Phase 15 (faturamento), Phase 7 (unidades/cotas)
**Requirements**: REP-01, REP-02, REP-03, BI-01, BI-02
**Success Criteria** (what must be TRUE):
  1. Gestor seleciona período e unidade e visualiza DRE gerencial com receitas, despesas e resultado
  2. Tela de orçamento mostra metas cadastradas versus realizado, com desvios destacados por período
  3. Sócio visualiza a distribuição de lucro proporcional à sua cota societária configurada
  4. Painel de BI exibe KPIs por dimensão (tempo/unidade/profissional) comparados à meta; a IA gera previsões e alertas baseados na tendência
**Plans**: TBD
**v1 reuse**: Reusa protótipos navegáveis de Relatórios/BI e Dashboard de Franquias (`/clinica/prototipos`); alimentado por todos os dados financeiros de Phases 14–16
**UI hint**: yes

---

### Phase 20: Portal do Paciente & App do Profissional
**Goal**: Pacientes acessam seu portal self-service (agendamentos, documentos, pagamentos, consentimentos) e dentistas usam o PWA móvel para ver agenda, acessar prontuário e ditar SOAP por voz
**Depends on**: Phase 12 (documentos clínicos assinados disponíveis no portal), Phase 15 (links de pagamento), Phase 10 (IA para ditado SOAP)
**Requirements**: POR-01, POR-02, POR-03, APP-01, APP-02, APP-03
**Success Criteria** (what must be TRUE):
  1. Paciente faz login seguro no portal e vê os próximos agendamentos com data, hora e profissional
  2. Paciente acessa receitas, atestados e recibos assinados; links de boleto/PIX pendentes aparecem na seção financeira
  3. Paciente realiza pré-cadastro e assina consentimentos LGPD online antes da primeira consulta
  4. Dentista acessa a agenda do dia e o prontuário do paciente pelo celular (PWA) sem degradação de experiência
  5. Dentista dita o registro SOAP por voz e a IA estrutura o texto no prontuário para revisão e confirmação
**Plans**: TBD
**v1 reuse**: Expande `patient_consents` (Phase 1) para POR-03; copiloto IA (Phase 5) para ditado SOAP (APP-02); agenda (Phase 2) exposta no portal; documentos de DOC (Phase 8)
**UI hint**: yes

---

### Phase 21: Migração & Ensino
**Goal**: A equipe de implantação importa dados de sistemas anteriores de forma validada e reversível, e coordenadores de clínicas-escola gerenciam cursos, turmas, matrículas e supervisão clínica de alunos
**Depends on**: Phase 7 (papéis Implantação/Aluno), Phase 10 (OCR para leitura de documentos na migração), Phase 2 (prontuário como destino da migração)
**Requirements**: MIG-01, MIG-02, EDU-01, EDU-02, EDU-03
**Success Criteria** (what must be TRUE):
  1. Implantação faz upload de planilha/export do sistema anterior, configura o mapeamento de-para (colunas → campos FYNXIA) e a pré-validação aponta inconsistências antes de gravar
  2. Importação executada em lote é reversível; o registro de auditoria mostra exatamente o que foi importado e por quem
  3. Coordenador cria curso com turmas (período/vagas/professor), matricula alunos e registra frequência
  4. Aluno registra atendimento sob supervisão de um profissional responsável vinculado ao prontuário do paciente
  5. Certificados e conteúdos do curso ficam centralizados e acessíveis por aluno na plataforma
**Plans**: TBD
**v1 reuse**: Reutiliza audit trail (Phase 0/10) para MIG-02; OCR (Phase 10) auxilia extração em MIG-01; papel Aluno de Phase 7; prontuário de Phase 2 como destino
**UI hint**: yes

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 0. Foundation | v1.0 | 3/3 | Complete | 2026-06-04 |
| 1. Auth & Tenant Onboarding | v1.0 | 3/3 | Complete | 2026-06-05 |
| 2. Clinical MVP | v1.0 | 5/5 | Complete | 2026-06-06 |
| 3. Financial MVP | v1.0 | 4/4 | Complete | 2026-06-07 |
| 4. Communications & Async | v1.0 | 4/4 | Complete | 2026-06-08 |
| 5. AI Agents | v1.0 | 5/5 | Complete | 2026-06-11 |
| 6. UX Polish & App Shell | v1.0 | 8/8 | Complete | 2026-06-12 |
| 7. Sistema, Multiunidade & Papéis | v2.0 | 0/6 | Planned | - |
| 8. Documentos & Assinatura ICP-Brasil | v2.0 | 0/5 | Planned | - |
| 9. Hub de Integrações Externas | v2.0 | 0/? | Not started | - |
| 10. IA Governada, Auditoria & OCR | v2.0 | 8/8 | Complete    | 2026-06-14 |
| 11. Profissionais & Recursos | v2.0 | 7/8 | Complete    | 2026-06-15 |
| 12. Receituário & Teleodontologia | v2.0 | 7/7 | Complete    | 2026-06-19 |
| 13. Esterilização/CME & Laboratório de Prótese | v2.0 | 7/7 | Complete    | 2026-06-19 |
| 14. Financeiro — Cadastros Base | v2.0 | 7/7 | Complete    | 2026-06-20 |
| 15. Faturamento/NFS-e & Convênios/TISS | v2.0 | 5/9 | In Progress|  |
| 16. Contas a Pagar, Conciliação & Tributos | v2.0 | 0/? | Not started | - |
| 17. Estoque & Materiais | v2.0 | 0/? | Not started | - |
| 18. CRC & Marketing | v2.0 | 0/? | Not started | - |
| 19. Relatórios, Orçamento & BI | v2.0 | 0/? | Not started | - |
| 20. Portal do Paciente & App do Profissional | v2.0 | 0/? | Not started | - |
| 21. Migração & Ensino | v2.0 | 0/? | Not started | - |
