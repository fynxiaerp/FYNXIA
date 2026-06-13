# FYNXIA — Especificação de Módulos (blueprint completo do produto)

> Fonte: 27 "cards de módulo" (Cap. 4, Módulos 1–27) enviados pelo cliente em 2026-06-12, + anatomia de tela (Cadastro de Paciente) + fluxo padrão de tela. Este é o escopo-alvo completo do produto (muito além do v1.0 MVP). Cada card vira insumo de planejamento: campos → modelo de dados; "quem usa" → RBAC; "integra com" → dependências; "mapa de navegação" → rota no app shell.
>
> **Status no v1** por módulo: ✅ feito · 🟡 parcial · 🆕 novo · 🧪 protótipo já navegável.

---

## Princípios transversais (valem para TODA tela)

**Fluxo padrão de tela:** `Entrada de dados` (digita / busca / foto via OCR) → `Validação` (formato, obrigatoriedade, duplicidade em tempo real) → `Processamento` (grava, dispara eventos, aciona integrações e agentes de IA) → `Resultado` (confirmação + próximo passo sugerido + trilha de auditoria). Se a validação falha, o usuário é avisado na hora e **nada é gravado**.

**Anatomia de tela (ex.: Novo paciente):** cada tela é documentada com a imagem (elementos numerados) + tabela campo a campo (#, Elemento, Tipo, Obrigatório, Finalidade). Ex.: Nome (Texto, Sim), CPF (Máscara, Sim — chave única), Nascimento (Data, Sim), Telefone/WhatsApp (Máscara, Sim), Origem (Seleção, Não — alimenta ROI de marketing), Consent. LGPD (Aceite, Sim — base legal), Salvar (Ação).

**Constantes do produto:**
- **IA em toda tela** com autonomia graduada **L0–L4** (L0 sugere … L4 executa); ações sensíveis sempre pedem aprovação; toda ação de IA é logada.
- **Assinatura ICP-Brasil** torna documentos/registros imutáveis e juridicamente válidos (prontuário, NFS-e, receituário, documentos).
- **Auditoria onipresente** (quem fez o quê, quando, de onde; antes/depois) — atende LGPD e CFO.
- **OCR** alimenta cadastros a partir de fotos de documentos.
- **Multiunidade/rede** (centro de custo por unidade, BI por unidade) — exige hierarquia de unidades.

---

## Mapa: Módulo Principal → Módulos numerados

| Principal | Módulos (nº do card) |
|---|---|
| **Atendimento/Clínica** | Pacientes e Prontuário (3), Agenda (4), Recursos e Sala de Espera (5), Receituário/Atestados/Exames (7), Esterilização e CME (9), Lab. de Prótese (10), Teleodontologia (20), Profissionais (2) |
| **Relacionamento** | CRC e Marketing (6) |
| **Estoque** | Estoque e Materiais (8) |
| **Financeiro** | Serviços/OS/Faturamento (12), Financeiro—Cadastros (13), Financeiro—Operação (14), Tributos/Repasses/RPA (15), Convênios (17) |
| **Gestão** | Relatórios/Orçamento/Societário (16), BI e Dashboards (24) |
| **Conformidade** | Auditoria/Logs/Estornos (25), Migração e Importação (26) |
| **Configurações** | Configuração do Sistema (1), Documentos e Assinatura (21), OCR e Automação (23), Integrações Externas (27) |
| **Portais/Apps** | Portal do Paciente (18), App do Profissional (19) |
| **IA** | IA — Copiloto e Agentes (22) |
| **Ensino** | Ensino (11) |

---

## Módulos (1–27)

### 1. Configuração do Sistema — `Configurações › Empresa/Usuários › Perfis·IA` — 🟡
Centraliza configuração institucional, de acesso e comportamento. **Quem usa:** Administrador, DPO.
**Campos:** CNPJ/CPF (Máscara, Sim — identifica/valida/enriquece) · Regime tributário (Seleção, Sim — define o motor fiscal) · Certificado ICP (Upload, Cond. — assina NFS-e e prontuário) · Perfil de acesso (Seleção, Sim — permissões por módulo) · Nível de IA (Seleção, Sim — autonomia L0–L4 por agente).
**Integra:** Todos os módulos, Documentos, IA. *(v1: usuários/perfis/empresa parciais)*

### 2. Profissionais — `Clínica › Profissionais › Ficha·Horários` — 🟡 (evolui "Equipe")
Cadastra dentistas/colaboradores, disponibilidade e regras de remuneração. **Quem usa:** Administrador, Profissional.
**Campos:** CRO+UF (Texto, Sim — autor do prontuário) · Especialidades (Multi, Sim — filtra agenda/procedimentos) · Vínculo (Seleção, Sim — afeta repasse e RPA) · % comissão (Tabela, Cond. — base do repasse) · Disponibilidade (Grade, Sim — gera horários da agenda).
**Integra:** Agenda, Repasses, Prontuário, Convênios.

### 3. Pacientes e Prontuário Clínico — `Atendimento › Pacientes/Prontuário › Odontograma` — ✅ (evoluir)
Núcleo clínico: cadastro, prontuário versionado, odontograma, registros especializados. **Quem usa:** Dentista, Recepção, Auditor.
**Campos:** CPF (Máscara, Sim — único por clínica) · Consentimento LGPD (Aceite, Sim — base legal) · Odontograma (Gráfico, Sim — condição por dente/face) · Nota SOAP (Texto, Sim — registro estruturado) · Assinatura ICP (Ação, Sim — torna imutável).
**Integra:** Agenda, Faturamento, Estoque, IA.

### 4. Agenda — `Atendimento › Agenda › Novo agendamento` — ✅ (evoluir)
Jornada de agendamento por profissional e recurso físico, com confirmação automática. **Quem usa:** Recepção, Dentista.
**Campos:** Paciente (Busca, Sim — cria lead se não existir) · Profissional (Busca, Sim — filtra disponibilidade) · Procedimento (Multi, Sim — define duração) · Data/Hora (Data, Sim — conflito em tempo real) · Sala/Cadeira (Busca, Cond. — reserva recurso).
**Integra:** Profissionais, Recursos, Prontuário, IA.

### 5. Recursos e Sala de Espera — `Clínica › Recursos › Painel de espera` — 🆕
Recursos físicos finitos (salas, cadeiras, equipamentos) + fluxo do paciente. **Quem usa:** Recepção, Administrador.
**Campos:** Tipo (Seleção, Sim — sala/cadeira/equipamento) · Patrimônio/série (Texto, Cond. — rastreabilidade) · Status (Seleção, Sim — manutenção bloqueia agenda) · Manutenção (Data, Não — alerta preventivo + custo).
**Integra:** Agenda, Financeiro, IA. *(inclui painel de chamada em TV + tempo de espera)*

### 6. CRC e Marketing — `Relacionamento › Leads/Campanhas › Funil·NPS` — 🟡 (CRM novo; mensageria existe)
Relacionamento, tarefas, retornos, reclamações, leads, campanhas, NPS, indicação. **Quem usa:** Recepção, Marketing, Gestão.
**Campos:** Origem (Seleção, Sim — alimenta ROI) · Status do funil (Seleção, Sim — Novo→Convertido/Perdido) · Tarefa (Seleção, Sim — ligação/retorno/cobrança) · Nota NPS (Número, Cond. — satisfação 0–10).
**Benefícios:** funil com origem/conversão; ROI por campanha (CPL, CAC); reativação automática de inativos.
**Integra:** Pacientes, Agenda, IA, Financeiro.

### 7. Receituário, Atestados e Exames — `Atendimento › Receituário › Receita·Atestado` — 🆕
Documentos clínicos assinados digitalmente a partir do prontuário. **Quem usa:** Dentista.
**Campos:** Tipo de receita (Seleção, Sim — simples/controle especial) · Medicamento (Busca, Sim — base DCB/DCI) · Posologia (Grupo, Sim — dose/intervalo/duração) · Assinatura ICP (Ação, Sim — valida e numera).
**Integra:** Prontuário, Portal, Teleodontologia. *(valida alergias do paciente)*

### 8. Estoque e Materiais — `Estoque › Produtos/Movimentações › Inventário` — 🆕
Produtos, movimentações, custos, rastreabilidade de lotes e implantes. **Quem usa:** Administrador, Financeiro.
**Campos:** Categoria (Seleção, Sim — insumo/implante/medicamento) · Lote/série (Texto, Cond. — rastreável p/ implantes) · Estoque mínimo (Número, Sim — dispara agente de compras) · Custo médio (Calculado, Sim — atualizado nas entradas).
**Benefícios:** baixa automática por procedimento; alertas mínimo/validade; rastreabilidade ANVISA.
**Integra:** Procedimentos, Faturamento, Compras, IA.

### 9. Esterilização e CME — `Clínica › Esterilização › Registro de ciclo` — 🆕
Rastreia o ciclo de esterilização de instrumentais (exigências sanitárias). **Quem usa:** Equipe clínica/CME, Auditor.
**Campos:** Autoclave (Busca, Sim — equipamento do ciclo) · Parâmetros (Grupo, Sim — temp./tempo/pressão) · Indicador biológico (Seleção, Sim — conforme/não conforme) · Validade (Data, Sim — ao vencer exige reprocesso).
**Benefícios:** vincula kit ao paciente; bloqueia kit reprovado/vencido; auditoria por lote.
**Integra:** Recursos, Prontuário, OCR, Auditoria.

### 10. Laboratório de Prótese — `Clínica › Prótese › Ordem de laboratório` — 🆕
Ciclo de trabalhos protéticos entre clínica e laboratórios (prazos/custos). **Quem usa:** Dentista, Recepção, Financeiro.
**Campos:** Tipo de trabalho (Seleção, Sim — coroa/prótese/alinhador) · Laboratório (Busca, Sim — parceiro) · Prazo de entrega (Data, Sim — etapas/provas) · Custo (Moeda, Sim — gera conta a pagar) · Status (Seleção, Sim — Enviado→prova→concluído).
**Integra:** Prontuário, Faturamento, Contas a Pagar.

### 11. Ensino — `Ensino › Cursos/Turmas › Alunos·Conteúdos` — 🆕
Operação educacional da clínica-escola: cursos, turmas, alunos, conteúdos. **Quem usa:** Coordenação, Professor, Aluno.
**Campos:** Curso (Texto, Sim — carga/certificação) · Turma (Grupo, Sim — período/vagas/professor) · Aluno (Busca, Sim — matrícula/frequência) · Supervisor (Busca, Cond. — responsável clínico).
**Benefícios:** turmas/matrículas/frequência integradas; aluno atua sob supervisão clínica; conteúdos/certificados.
**Integra:** Prontuário, Profissionais, Financeiro. *(novo papel "Aluno" + storage de mídia)*

### 12. Serviços, OS e Faturamento — `Financeiro › Faturamento › OS·NFS-e` — 🟡
Transforma tratamento executado em ordem de serviço e documento fiscal (NFS-e). **Quem usa:** Recepção, Financeiro.
**Campos:** Procedimentos (Lista, Sim — itens executados) · Tabela de preço (Seleção, Sim — particular/convênio) · NFS-e (Ação, Cond. — emite na prefeitura) · Forma de pagamento (Seleção, Sim — gera parcelas a receber).
**Integra:** Prontuário, Financeiro, Convênios, Integrações. *(NFS-e já prototipada)*

### 13. Financeiro — Cadastros — `Financeiro › Cadastros › Plano de contas` — 🆕
Base do financeiro: plano de contas, centros de custo, contas correntes, categorias. **Quem usa:** Financeiro, Gestão.
**Campos:** Conta contábil (Árvore, Sim — estrutura receitas/despesas) · Centro de custo (Seleção, Sim — rateio por unidade/área) · Conta corrente (Cadastro, Sim — saldo/conciliação) · Categoria (Seleção, Sim — classifica lançamento).
**Integra:** Contas a Receber, Contas a Pagar, BI.

### 14. Financeiro — Operação — `Financeiro › Operação › CR·CP·Conciliação` — 🟡
Dia a dia: contas a receber, contas a pagar, conciliação bancária. **Quem usa:** Financeiro.
**Campos:** Título (Cadastro, Sim — a receber/pagar) · Vencimento (Data, Sim — alimenta régua e fluxo) · Baixa (Ação, Cond. — conciliada com extrato) · Juros/multa (Calculado, Não — no atraso).
**Benefícios:** régua automática (✅ v1); conciliação por OFX/Open Finance (🆕); fluxo de caixa atualizado.
**Integra:** Faturamento, Bancos, IA, BI.

### 15. Tributos, Repasses e RPA — `Financeiro › Tributos/Repasses › RPA` — 🆕
Impostos, comissões de profissionais (repasse) e RPA de autônomos. **Quem usa:** Financeiro, Contabilidade.
**Campos:** Base de cálculo (Calculado, Sim — recebido líquido) · %/regra (Tabela, Sim — por profissional/serviço) · Retenções (Calculado, Cond. — INSS/IRRF/ISS no RPA) · EFD-Reinf (Ação, Cond. — envio ao fisco).
**Integra:** Faturamento, Profissionais, Integrações.

### 16. Relatórios, Orçamento e Societário — `Gestão › Relatórios › Orçamento·Societário` — 🧪 (Relatórios prototipado)
Consolida DRE, orçamento previsto×realizado, distribuição entre sócios. **Quem usa:** Gestão, Sócios, Contabilidade.
**Campos:** Período (Intervalo, Sim) · Orçado (Moeda, Cond. — meta do período) · Realizado (Calculado, Sim — apurado do financeiro) · Cota societária (%, Sim — base da distribuição).
**Integra:** Financeiro, BI.

### 17. Convênios — `Financeiro › Convênios › Lote TISS·Glosas` — 🧪 (prototipado)
Operadoras, tabelas, autorizações, faturamento TISS com tratamento de glosas. **Quem usa:** Faturamento, Financeiro.
**Campos:** Operadora (Cadastro, Sim — regras/tabela próprias) · Guia TISS (Documento, Sim — autorização) · Lote (Grupo, Sim — envio/protocolo) · Glosa (Calculado, Cond. — motivo classificado p/ recurso).
**Integra:** Faturamento, Prontuário, Integrações.

### 18. Portal do Paciente — `Portal › Acesso do paciente › Meus documentos` — 🆕
Canal digital do paciente: agendamentos, documentos, financeiro, consentimentos. **Quem usa:** Paciente.
**Campos:** Login seguro (Acesso, Sim) · Agendamentos (Lista, Sim — próximas consultas) · Documentos (Lista, Sim — receitas/atestados/recibos) · Pagamentos (Lista, Cond. — boletos/link).
**Benefícios:** acesso a documentos/recibos; pré-cadastro/consentimentos online; reduz ligações.
**Integra:** Agenda, Receituário, Financeiro, Documentos.

### 19. App do Profissional — `App › Minha agenda › Prontuário móvel` — 🆕
Mobilidade para o dentista: agenda, prontuário e Copiloto na mão. **Quem usa:** Dentista.
**Campos:** Agenda do dia (Lista, Sim) · Prontuário (Tela, Sim — consulta/registro) · Ditado por voz (Ação, Não — IA estrutura o SOAP) · Notificações (Lista, Sim — confirmações/alertas).
**Integra:** Agenda, Prontuário, IA. *(PWA/app nativo)*

### 20. Teleodontologia — `Atendimento › Teleodontologia › Sala de vídeo` — 🆕
Teleconsulta/teleorientação registradas no prontuário (normas CFO). **Quem usa:** Dentista, Paciente.
**Campos:** Tipo (Seleção, Sim — teleconsulta/teleorientação) · Consentimento (Aceite, Sim — base legal) · Gravação (Ação, Cond. — anexada ao prontuário) · Registro clínico (Texto, Sim — SOAP).
**Integra:** Prontuário, Receituário, Portal. *(estava out-of-scope no v1; valida CFO)*

### 21. Documentos e Assinatura Eletrônica — `Configurações › Documentos › Modelos·Assinatura` — 🟡
Geração, assinatura ICP-Brasil e guarda de documentos, com versionamento. **Quem usa:** Todos os perfis.
**Campos:** Modelo (Editor, Sim — texto com variáveis) · Variáveis (Auto, Sim — preenchidas pelo contexto) · Assinatura ICP (Ação, Cond. — carimbo de tempo/validade) · Versão (Auto, Sim — histórico imutável).
**Integra:** Prontuário, Portal, IA, Auditoria.

### 22. IA — Copiloto e Agentes — `Início › Copiloto › Catálogo de agentes` — 🟡 (copiloto+agentes v1)
Camada inteligente: copiloto conversacional + agentes que executam tarefas. **Quem usa:** Todos os perfis.
**Campos:** Nível de autonomia (Seleção, Sim — L0 sugere … L4 executa) · Provedor de IA (Seleção, Sim — modelo e teto de tokens) · Limite de ação (Regra, Sim — tetos e travas invioláveis) · Log de decisão (Auto, Sim — rastreia toda ação).
**Integra:** Todos os módulos.

### 23. OCR e Automação de Cadastros — `Configurações › Automação › OCR de documentos` — 🆕
Lê documentos (RG, notas, comprovantes) e preenche cadastros automaticamente. **Quem usa:** Recepção, Financeiro.
**Campos:** Documento (Upload, Sim — imagem/PDF) · Campos extraídos (Auto, Sim — reconhecidos pela IA) · Confiança (Calculado, Sim — abaixo do limite pede revisão) · Validação (Ação, Cond. — confirma antes de gravar).
**Integra:** Pacientes, Estoque, Financeiro, IA.

### 24. BI e Dashboards — `Gestão › BI › Painéis·Indicadores` — 🧪 (prototipado: Relatórios + Franquias)
Indicadores, painéis e análises preditivas sobre toda a operação. **Quem usa:** Gestão, Sócios.
**Campos:** Indicador/KPI (Cadastro, Sim) · Dimensão (Seleção, Sim — tempo/unidade/profissional) · Meta (Número, Cond. — comparada ao realizado) · Previsão (Calculado, Não — projeção da IA).
**Integra:** Todos os módulos, IA.

### 25. Auditoria, Logs e Estornos — `Conformidade › Auditoria › Logs·Estornos` — 🟡 (audit_logs existe)
Trilha de auditoria de tudo + fluxo controlado de estornos. **Quem usa:** Auditor, DPO, Gestão.
**Campos:** Evento (Auto, Sim — ação registrada) · Autor (Auto, Sim — usuário/perfil) · Antes/depois (Auto, Sim — conteúdo alterado) · Estorno (Ação, Cond. — motivo + aprovação por alçada).
**Integra:** Todos os módulos.

### 26. Migração e Importação Inicial — `Conformidade › Migração › Importar dados` — 🆕
Traz dados de sistemas anteriores de forma assistida, validada e auditável. **Quem usa:** Administrador, Implantação.
**Campos:** Origem (Seleção, Sim — planilha/sistema anterior) · Mapeamento (De-para, Sim — colunas → campos FYNXIA) · Pré-validação (Ação, Sim — aponta erros antes de gravar) · Lote (Auto, Sim — reversível e auditável).
**Integra:** Todos os módulos, OCR.

### 27. Integrações Externas — `Configurações › Integrações › Conexões·Webhooks` — 🟡
Conecta o FYNXIA ao mundo: bancos, prefeituras, operadoras, WhatsApp, órgãos oficiais. **Quem usa:** Administrador, TI.
**Campos:** Conector (Seleção, Sim — WhatsApp/NFS-e/banco/TISS) · Credencial (Seguro, Sim — token/certificado) · Webhook (URL, Cond. — recebe eventos) · Status (Monitor, Sim — saúde e fila de reenvio).
**Benefícios:** hub único de credenciais/webhooks; reenvio automático em falha; monitor de saúde.
**Integra:** Financeiro, Faturamento, CRC, Convênios.

---

## Delta vs v1.0 (o que já existe)

- **✅ Feito:** Pacientes/Prontuário/Odontograma/Anamnese (3), Agenda (4), Copiloto+agentes (22, parcial), régua de cobrança + recebíveis (14, parcial), audit_logs (25, parcial), assinatura de anamnese (21, parcial), mensageria WhatsApp/e-mail (base do 6).
- **🧪 Protótipo navegável:** Convênios (17), Relatórios/BI (16/24), Dashboard de Franquias (24/Gestão) — em `/clinica/prototipos`.
- **🆕 Totalmente novo:** Recursos/Sala de espera (5), CRM completo (6), Receituário (7), Estoque (8), Esterilização/CME (9), Prótese (10), Ensino (11), Financeiro—Cadastros/Operação-CP/Conciliação (13/14), Tributos/Repasses/RPA (15), Portal do Paciente (18), App do Profissional (19), Teleodontologia (20), OCR (23), Migração (26).
- **Fundações transversais a fazer cedo:** multiunidade/rede, novos papéis (DPO, Auditor, Aluno, Sócio, TI, Implantação), Certificado ICP + serviço de assinatura, motor de Documentos/templates, framework de IA L0–L4 + log de decisão, hub de Integrações.

---

*Capturado em 2026-06-12. Próximo passo: transformar em milestone v2 + roadmap por fases (GSD).*
