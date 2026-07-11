# FYNXIA ERP — Requirements (Milestone v2.0 — Produto Completo)

> Derivados de `.planning/MODULES-SPEC-v2.md` (27 módulos). Constrói sobre o MVP v1.0 (Fases 0–6). Agrupados por bloco → módulo. Numeração de fases continua do v1 (próxima fase: 07+).

## v2 Requirements

### Bloco A — Fundações

#### SYS — Configuração do Sistema & Multiunidade
- [ ] **SYS-01**: Admin cadastra a empresa (CNPJ/CPF com máscara/validação, regime tributário) e múltiplas unidades da rede
- [x] **SYS-02**: Admin faz upload do Certificado ICP-Brasil (A1) usado para assinar NFS-e e prontuário
- [x] **SYS-03**: Admin define perfis de acesso que controlam permissões por módulo (RBAC granular)
- [x] **SYS-04**: Admin define o nível de autonomia da IA (L0–L4) por agente
- [ ] **SYS-05**: Dados e relatórios podem ser filtrados/escopados por unidade (centro de custo por unidade)

#### ROLE — Papéis Estendidos
- [ ] **ROLE-01**: Sistema suporta papéis adicionais: DPO, Auditor, Sócio, TI, Implantação e Aluno (além dos 4 do v1)
- [x] **ROLE-02**: Cada papel vê apenas os módulos/ações permitidos pelo seu perfil (gating server-side por unidade)

#### DOC — Documentos & Assinatura Eletrônica
- [x] **DOC-01**: Usuário cria modelos de documento com variáveis preenchidas automaticamente pelo contexto
- [x] **DOC-02**: Documento é assinado com ICP-Brasil (carimbo de tempo, validade jurídica)
- [x] **DOC-03**: Documento assinado é imutável e versionado (histórico preservado)

#### INT — Integrações Externas
- [x] **INT-01**: Admin/TI cadastra conectores (WhatsApp, NFS-e, banco, TISS) com credenciais armazenadas com segurança
- [x] **INT-02**: Sistema recebe eventos externos via webhooks por conector
- [x] **INT-03**: Painel mostra a saúde de cada integração e reenvia automaticamente em caso de falha

#### AIG — IA Governada (L0–L4)
- [x] **AIG-01**: Cada agente opera dentro de limites de ação invioláveis (tetos e travas configuráveis)
- [x] **AIG-02**: Ações sensíveis sempre exigem aprovação humana antes de executar
- [x] **AIG-03**: Toda decisão/ação da IA é registrada em log auditável (catálogo de agentes)

#### AUD — Auditoria, Logs & Estornos
- [x] **AUD-01**: Trilha de auditoria registra quem fez o quê, quando, de onde e o conteúdo antes/depois
- [x] **AUD-02**: Estorno exige motivo e aprovação por alçada, registrado na trilha
- [x] **AUD-03**: Auditor/DPO consulta a trilha por entidade, usuário e período em tela dedicada

#### OCR — OCR & Automação de Cadastros
- [x] **OCR-01**: Usuário faz upload/foto de um documento e a IA extrai os campos automaticamente
- [x] **OCR-02**: Extrações abaixo do limite de confiança exigem revisão humana antes de gravar

### Bloco B — Clínico

#### PRO — Profissionais
- [x] **PRO-01**: Admin cadastra profissional com CRO+UF, especialidades, vínculo e grade de disponibilidade
- [x] **PRO-02**: A disponibilidade do profissional gera os horários da agenda
- [x] **PRO-03**: Regras de % de comissão por profissional/serviço alimentam o repasse

#### RES — Recursos & Sala de Espera
- [x] **RES-01**: Admin cadastra recursos físicos (sala, cadeira, equipamento) com patrimônio/série e status
- [x] **RES-02**: Recurso em manutenção/indisponível bloqueia o horário na agenda
- [x] **RES-03**: Painel de chamada em tempo real (TV) e medição do tempo de espera por paciente

#### RX — Receituário, Atestados & Exames
- [x] **RX-01**: Dentista emite receita (simples/controle especial) com medicamento (base DCB/DCI) e posologia
- [x] **RX-02**: A receita valida as alergias do paciente antes de emitir
- [x] **RX-03**: Documento clínico é assinado com ICP-Brasil e numerado, disponível no Portal do Paciente

#### TEL — Teleodontologia
- [x] **TEL-01**: Dentista realiza teleconsulta/teleorientação com vídeo, registrando consentimento da sessão (CFO)
- [x] **TEL-02**: A sessão gera registro clínico (SOAP) no prontuário e documentos emitidos na hora

#### CME — Esterilização & CME
- [x] **CME-01**: Equipe registra ciclo de esterilização (autoclave, parâmetros, indicador biológico, validade)
- [x] **CME-02**: Kit reprovado ou vencido é bloqueado para uso
- [x] **CME-03**: Kit esterilizado é vinculado ao paciente atendido (rastreabilidade por lote)

#### LAB — Laboratório de Prótese
- [x] **LAB-01**: Usuário abre ordem de serviço protética (tipo, laboratório, prazo, etapas de prova) com status
- [x] **LAB-02**: O custo do laboratório gera conta a pagar e entra no faturamento

### Bloco C — Financeiro

#### FCAD — Financeiro: Cadastros
- [x] **FCAD-01**: Financeiro estrutura plano de contas (árvore), centros de custo, contas correntes e categorias
- [x] **FCAD-02**: Lançamentos são classificados por conta contábil e centro de custo (rateio por unidade/área)

#### OS — Serviços, OS & Faturamento (NFS-e)
- [x] **OS-01**: Atendimento concluído vira ordem de serviço automática com os procedimentos executados
- [x] **OS-02**: Usuário emite NFS-e na prefeitura do município a partir da OS
- [x] **OS-03**: A forma de pagamento gera as parcelas a receber (base do contas a receber e do repasse)

#### FOP — Financeiro: Operação
- [x] **FOP-01**: Financeiro opera contas a pagar (vencimentos, baixa) integradas a fornecedores/laboratório
- [x] **FOP-02**: Conciliação bancária por OFX/Open Finance bate extrato × lançamentos
- [x] **FOP-03**: Fluxo de caixa é atualizado automaticamente a partir das baixas conciliadas

#### CONV — Convênios / TISS
- [x] **CONV-01**: Usuário cadastra operadoras com tabelas e regras próprias
- [x] **CONV-02**: Sistema gera guia TISS e lote de envio/protocolo por operadora
- [x] **CONV-03**: Glosas são classificadas por motivo e tratadas (recurso)

#### TRIB — Tributos, Repasses & RPA
- [x] **TRIB-01**: Sistema calcula o repasse do profissional sobre o valor recebido (regra por profissional/serviço)
- [x] **TRIB-02**: Sistema gera RPA de autônomos com retenções (INSS/IRRF/ISS) calculadas
- [x] **TRIB-03**: Apuração de tributos por regime e envio de retenções (EFD-Reinf)

### Bloco D — Operação & Crescimento

#### EST — Estoque & Materiais
- [x] **EST-01**: Usuário cadastra produtos (categoria, lote/série, estoque mínimo, custo médio)
- [ ] **EST-02**: Procedimento dá baixa automática de material no estoque
- [x] **EST-03**: Sistema alerta estoque mínimo (dispara agente de compras) e validade; rastreia lote de implante (ANVISA)

#### CRC — Relacionamento & Marketing
- [ ] **CRC-01**: Recepção/Marketing gerencia funil de leads com origem e status (Novo→Convertido/Perdido)
- [ ] **CRC-02**: Sistema calcula ROI por campanha (CPL, CAC) a partir da origem dos leads
- [ ] **CRC-03**: Campanhas disparam mensagens segmentadas (reativação automática de inativos) via WhatsApp/e-mail
- [ ] **CRC-04**: Sistema coleta NPS (0–10) e apura promotores/neutros/detratores
- [ ] **CRC-05**: Programa de indicação rastreia quem indicou quem e recompensas

### Bloco E — Analítico & Canais

#### REP — Relatórios, Orçamento & Societário
- [ ] **REP-01**: Gestão visualiza DRE gerencial por unidade em um período
- [ ] **REP-02**: Orçado × realizado com desvios por período
- [ ] **REP-03**: Distribuição de lucro por cota societária

#### BI — BI & Dashboards
- [ ] **BI-01**: Gestão/Sócios acompanham KPIs por dimensão (tempo/unidade/profissional) com meta × realizado
- [ ] **BI-02**: Painéis trazem previsões/alertas gerados por IA

#### POR — Portal do Paciente
- [ ] **POR-01**: Paciente faz login seguro e vê próximos agendamentos
- [ ] **POR-02**: Paciente acessa documentos (receitas, atestados, recibos) e links de pagamento
- [ ] **POR-03**: Paciente faz pré-cadastro e dá consentimentos online

#### APP — App do Profissional
- [ ] **APP-01**: Dentista acessa agenda do dia e prontuário pelo celular (PWA)
- [ ] **APP-02**: Dentista dita o SOAP por voz e a IA estrutura o registro
- [ ] **APP-03**: Profissional recebe notificações de confirmação e alertas

#### MIG — Migração & Importação Inicial
- [ ] **MIG-01**: Implantação importa dados de sistema anterior com mapeamento de-para (colunas → campos FYNXIA)
- [ ] **MIG-02**: Pré-validação aponta inconsistências antes de gravar; importação em lote reversível e auditável

#### EDU — Ensino
- [ ] **EDU-01**: Coordenação cria cursos, turmas (período/vagas/professor) e matricula alunos com frequência
- [ ] **EDU-02**: Aluno atua sob supervisão clínica vinculada ao atendimento
- [ ] **EDU-03**: Conteúdos e certificados centralizados por curso

---

## Future Requirements (deferred)

- App mobile **nativo** (PWA cobre o v2; nativo é evolução)
- Voz/IA generativa avançada além do ditado SOAP
- Marketplace de integrações de terceiros

## Out of Scope (v2)

- **Folha de pagamento/RH completo** — produto adjacente
- **Multi-idioma/multi-moeda** — mercado BR
- **Contabilidade fiscal completa (ECD/ECF)** — integra com contador externo; FYNXIA cobre NFS-e + retenções (EFD-Reinf)

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| SYS-01 | Phase 7 | Pending |
| SYS-02 | Phase 7 | Complete |
| SYS-03 | Phase 7 | Complete |
| SYS-04 | Phase 7 | Complete |
| SYS-05 | Phase 7 | Pending |
| ROLE-01 | Phase 7 | Pending |
| ROLE-02 | Phase 7 | Complete |
| DOC-01 | Phase 8 | Complete |
| DOC-02 | Phase 8 | Complete |
| DOC-03 | Phase 8 | Complete |
| INT-01 | Phase 9 | Complete |
| INT-02 | Phase 9 | Complete |
| INT-03 | Phase 9 | Complete |
| AIG-01 | Phase 10 | Complete |
| AIG-02 | Phase 10 | Complete |
| AIG-03 | Phase 10 | Complete |
| AUD-01 | Phase 10 | Complete |
| AUD-02 | Phase 10 | Complete |
| AUD-03 | Phase 10 | Complete |
| OCR-01 | Phase 10 | Complete |
| OCR-02 | Phase 10 | Complete |
| PRO-01 | Phase 11 | Complete |
| PRO-02 | Phase 11 | Complete |
| PRO-03 | Phase 11 | Complete |
| RES-01 | Phase 11 | Complete |
| RES-02 | Phase 11 | Complete |
| RES-03 | Phase 11 | Complete |
| RX-01 | Phase 12 | Complete |
| RX-02 | Phase 12 | Complete |
| RX-03 | Phase 12 | Complete |
| TEL-01 | Phase 12 | Complete |
| TEL-02 | Phase 12 | Complete |
| CME-01 | Phase 13 | Complete |
| CME-02 | Phase 13 | Complete |
| CME-03 | Phase 13 | Complete |
| LAB-01 | Phase 13 | Complete |
| LAB-02 | Phase 13 | Complete |
| FCAD-01 | Phase 14 | Complete |
| FCAD-02 | Phase 14 | Complete |
| OS-01 | Phase 15 | Complete |
| OS-02 | Phase 15 | Complete |
| OS-03 | Phase 15 | Complete |
| CONV-01 | Phase 15 | Complete |
| CONV-02 | Phase 15 | Complete |
| CONV-03 | Phase 15 | Complete |
| FOP-01 | Phase 16 | Complete |
| FOP-02 | Phase 16 | Complete |
| FOP-03 | Phase 16 | Complete |
| TRIB-01 | Phase 16 | Complete |
| TRIB-02 | Phase 16 | Complete |
| TRIB-03 | Phase 16 | Complete |
| EST-01 | Phase 17 | Complete |
| EST-02 | Phase 17 | Pending |
| EST-03 | Phase 17 | Complete |
| CRC-01 | Phase 18 | Pending |
| CRC-02 | Phase 18 | Pending |
| CRC-03 | Phase 18 | Pending |
| CRC-04 | Phase 18 | Pending |
| CRC-05 | Phase 18 | Pending |
| REP-01 | Phase 19 | Pending |
| REP-02 | Phase 19 | Pending |
| REP-03 | Phase 19 | Pending |
| BI-01 | Phase 19 | Pending |
| BI-02 | Phase 19 | Pending |
| POR-01 | Phase 20 | Pending |
| POR-02 | Phase 20 | Pending |
| POR-03 | Phase 20 | Pending |
| APP-01 | Phase 20 | Pending |
| APP-02 | Phase 20 | Pending |
| APP-03 | Phase 20 | Pending |
| MIG-01 | Phase 21 | Pending |
| MIG-02 | Phase 21 | Pending |
| EDU-01 | Phase 21 | Pending |
| EDU-02 | Phase 21 | Pending |
| EDU-03 | Phase 21 | Pending |

**Coverage:** 75/75 v2 requirements mapped. No orphans.

---

## Notas de continuidade do v1

Reaproveitar (não reconstruir): pacientes/prontuário/odontograma/anamnese, agenda multi-dentista, copiloto+agentes (evoluir p/ L0–L4), recebíveis+régua de cobrança, `audit_logs` (expor UI em AUD), mensageria WhatsApp/Resend (base de CRC/INT), `patient_consents` (base de DOC/AUD/LGPD). Protótipos navegáveis já existem: Convênios (CONV), Relatórios/BI (REP/BI), Dashboard de Franquias (BI/SYS-05).
