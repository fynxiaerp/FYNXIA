# Phase 19: Relatórios, Orçamento & BI - Context

**Gathered:** 2026-07-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Construir o módulo de **Relatórios, Orçamento & BI** do FYNXIA ERP Odontológico:

1. **DRE gerencial** (REP-01) — Receita × Despesa = Resultado por período/unidade, com drill-down até lançamento.
2. **Orçamento** (REP-02) — metas mensais por conta contábil × unidade, comparativo orçado × realizado com desvios.
3. **Distribuição societária** (REP-03) — cotas percentuais por sócio (com vigência), cálculo de distribuição de lucro/prejuízo sobre o resultado consolidado da rede.
4. **BI & Dashboards** (BI-01, BI-02) — painel de KPIs multi-dimensão (financeiro + operacional + CRC + estoque/TISS) com meta × realizado, previsões estatísticas e alertas gerados por IA.

**Escopo confirmado:** tudo intra-tenant — "unidades" são as `units` já existentes dentro do mesmo `clinic_id` (Fase 7). Não há necessidade de `tenant_groups` nem agregação cross-tenant (o comentário do protótipo de Dashboard de Franquias sobre isso não se aplica a este escopo).

**Fora de escopo:** DRE formal com subtotais/EBITDA; cotas societárias por unidade (sempre consolidado); lançamento financeiro automático da distribuição de lucro (retenção fiscal sobre distribuição — tema jurídico/tributário separado); sócio sem login (investidor externo); vista de BI restrita para dentista (autoavaliação); agregação cross-tenant/franquia real.

</domain>

<decisions>
## Implementation Decisions

### DRE gerencial (D-01 a D-11)
- **D-01:** DRE **simples**: Receita − Despesa = Resultado + Margem (como já está no protótipo `biKpis()`). Não é uma DRE formal com subtotais (Receita Bruta → Deduções → EBITDA). Usa `chart_of_accounts.type` (`grupo`/`receita`/`despesa`) já existente da Fase 14.
- **D-02:** Seletor de período: **mês/ano (padrão) + intervalo de datas customizado** livre.
- **D-03:** Seletor de unidade: **"Todas" (consolidado) + drill-down por unidade individual**.
- **D-04:** Quando "Todas" selecionado: DRE única somada **+ tabela comparativa/ranking por unidade** (mesmo padrão visual do protótipo Dashboard de Franquias), não apenas um número agregado nem colunas lado a lado por unidade.
- **D-05:** **Drill-down até lançamento**: cada linha/grupo é clicável e abre os `financial_transactions` subjacentes (filtrados por `account_id` + período + unidade).
- **D-06:** Cada linha também é **expansível por centro de custo** dentro da unidade (`cost_centers`, Fase 14).
- **D-07:** **Export PDF** sob demanda (`@react-pdf/renderer`, mesmo padrão do relatório ANVISA/recibos já existentes).
- **D-08:** Cada linha exibe **coluna de % sobre a receita total** do período (análise vertical de DRE).
- **D-09:** Acesso: **Admin + Sócio + Superadmin** apenas (dados financeiros sensíveis).
- **D-10:** DRE **sempre recalculada em tempo real** a partir de `financial_transactions` — **sem snapshot/fechamento mensal**. Reflete estornos/edições posteriores, mesmo padrão read-time já usado no fluxo de caixa (Fase 3/16).
- **D-11:** **Comparação YoY** (mesmo período do ano anterior) quando houver ≥12 meses de histórico; antes disso, mostra "comparação indisponível" sem quebrar a tela.

### Orçamento (D-12 a D-19)
- **D-12:** Meta cadastrada **por conta contábil (`chart_of_accounts`) + unidade** — mesma granularidade da DRE, permite localizar exatamente onde o desvio ocorre.
- **D-13:** Cadastro **anual com 12 valores mensais editáveis** (não distribuição automática igual/12, não cadastro mês a mês isolado).
- **D-14:** Quem cadastra/edita metas: **Admin + Sócio + Superadmin**.
- **D-15:** Desvios destacados por **semáforo de faixa de %** (verde/amarelo/vermelho). Thresholds exatos: Claude's Discretion na pesquisa/planejamento.
- **D-16:** Tela **separada** da DRE, com **link cruzado** (não é uma coluna extra dentro da DRE).
- **D-17:** Botão **"Copiar do ano anterior"** ao criar orçamento de um novo ano (valores editáveis depois).
- **D-18:** Meses passados (com resultado já realizado) ficam **travados/não editáveis** após o mês fechar. Mês atual e futuros permanecem editáveis.
- **D-19:** Export PDF disponível (mesma capacidade da DRE).

### Cotas societárias / Distribuição de lucro (D-20 a D-27)
- **D-20:** Percentual por sócio **com vigência/histórico** (data início/fim) — mesmo padrão de vigência usado no repasse de profissionais (Fase 16, TRIB-01). Preserva o percentual correto para distribuições passadas mesmo se cotas mudarem depois.
- **D-21:** Base de cálculo: **sempre consolidado** — resultado da rede inteira (todas as unidades), nunca por unidade individual.
- **D-22:** **Validação bloqueante**: a soma dos percentuais vigentes deve ser exatamente 100% para salvar/ativar uma nova vigência.
- **D-23:** Tela mostra **R$ calculado por sócio** (percentual × resultado do período selecionado), não apenas o percentual abstrato.
- **D-24:** Visão: **Admin + Superadmin veem a distribuição completa** (todos os sócios); **cada Sócio vê apenas a própria cota** (privacidade entre sócios).
- **D-25:** Um "sócio" cadastrado **deve ser um `users` existente com role='socio'** (já existe desde Fase 7/ROLE-01) — sem cadastro de investidor externo sem login nesta fase.
- **D-26:** **Puramente informativa** — não gera lançamento financeiro automático (sem saída de caixa, sem retenção fiscal/IRRF sobre distribuição). O pagamento efetivo, se ocorrer, é tratado fora do sistema ou lançado manualmente como despesa comum, sem vínculo automático com esta tela.
- **D-27:** Se o resultado do período for **negativo (prejuízo)**, a tela mostra o prejuízo dividido proporcionalmente (valores **negativos** por sócio) — não oculta nem zera a distribuição.

### BI & Previsões de IA (D-28 a D-40)
- **D-28:** Escopo **confirmado intra-tenant**: unidades dentro do mesmo `clinic_id`. Não requer `tenant_groups` nem agregação cross-tenant.
- **D-29:** KPIs incluídos além dos financeiros (DRE/Orçamento):
  - **Operacionais**: ocupação de agenda, ticket médio, consultas/mês.
  - **Produtividade por profissional**: faturamento/procedimentos por dentista.
  - **CRC/Marketing** (dados da Fase 18): NPS, ROI de campanha (CPL/CAC), conversão de leads.
  - **Estoque/Compliance**: alertas de estoque mínimo (Fase 17), taxa de glosa TISS (Fase 15), **e atrasos de pagamento/faturamento** (item adicional pedido pelo usuário).
- **D-30:** KPIs operacionais/CRC/estoque têm **metas próprias** (tabela separada da meta financeira do orçamento) — cada um configurável independentemente (ex: meta de ocupação 85%, meta de NPS 70).
- **D-31:** Previsão (BI-02): **extrapolação estatística** (tendência linear/média móvel) calcula o número da previsão; **narrativa em texto gerada por LLM** (Vercel AI Gateway, mesmo padrão do copiloto) explica/contextualiza o alerta. Não é 100% LLM (LLM não estima o número diretamente) nem 100% estatístico sem narrativa.
- **D-32:** Janela de histórico: **últimos 12 meses, ou todo histórico disponível se <12 meses**. Mínimo de **3 meses de dados** exigido antes de exibir qualquer previsão/alerta de tendência — antes disso, mostra aviso "dados insuficientes para previsão". KPIs atuais (não-preditivos) aparecem desde o 1º mês, sem essa restrição.
- **D-33:** Gatilhos de alerta: (a) desvio orçamentário acima do threshold (semáforo vermelho); (b) queda de receita/margem vs tendência histórica; (c) KPI operacional fora da meta (ocupação baixa, NPS em queda, glosa alta); (d) atrasos de pagamento/faturamento.
- **D-34:** Autonomia **L1/L2** (framework Fase 10, AIG-01/02): ao detectar desvio persistente, o agente **sugere um ajuste de meta orçamentária** (novo valor) — a sugestão entra no `ApprovalInbox` existente (Fase 10) para aprovação por Admin/Sócio/Superadmin. O agente **nunca** toca lançamentos financeiros ou cotas societárias diretamente — só a tabela de metas, e apenas via sugestão aprovável.
- **D-35:** Alertas **informativos** (sem ação sugerida) ficam numa seção própria **"Alertas & Previsões"** dentro do painel de BI. Só quando há uma sugestão de ação concreta (ajuste de meta) é que gera uma entrada no `ApprovalInbox` — evita poluir o inbox de aprovações com itens que não exigem decisão.
- **D-36:** Cálculo de previsão/alerta roda via **cron diário/noturno** (mesmo padrão de `/api/cron/estoque-validade` da Fase 17 e do NPS scan da Fase 18) — o painel apenas lê o resultado já calculado, sem recalcular (nem chamar o LLM) a cada carregamento de tela.
- **D-37:** Os componentes de gráfico do protótipo (`src/components/prototipos/charts.tsx`: `KpiCard`, `ChartCard`, `LineChart`, `BarChart`, `DonutChart`) **NÃO são reaproveitados** — produção constrói componentes de gráfico novos (fora do namespace `prototipos/`).
- **D-38:** Layout do painel de BI: **abas por dimensão** (Operacional | Profissionais | CRC | Estoque/TISS); a seção "Alertas & Previsões" fica **fixa no topo**, visível em qualquer aba selecionada.
- **D-39:** Acesso ao painel de BI: **mesmas permissões da DRE** — Admin + Sócio + Superadmin. Dentista não tem acesso, nem a uma vista restrita da própria produtividade.
- **D-40:** Export PDF disponível também para as telas de Orçamento e BI (não só DRE).

### Navegação (D-41 a D-42)
- **D-41:** Módulos **separados** no menu: Relatórios (DRE), Orçamento, Societário (cotas), BI — não um hub único com abas internas.
- **D-42:** As páginas de protótipo existentes (`/clinica/prototipos/relatorios` e `/clinica/prototipos/dashboard-franquias`) devem ser **removidas** quando as telas reais desta fase forem entregues, evitando duas versões (mock e real) coexistindo na navegação.

### Claude's Discretion
- Nomes/colunas/índices exatos das novas tabelas (ex: `partner_shares`/`socio_cotas`, `budget_targets`, `kpi_targets`, `bi_alerts`/`bi_forecasts`), seguindo padrões da base (`NUMERIC(12,2)` para valores, índice em `clinic_id`+`unit_id`, RLS `USING`+`WITH CHECK`, soft delete onde há PII).
- Thresholds exatos do semáforo de desvio orçamentário (ex: <5%/5–15%/>15%) — fixos ou configuráveis por admin.
- Threshold exato de "queda vs tendência histórica" para disparar alerta (ex: >15% abaixo da projeção).
- Algoritmo exato de regressão/tendência (linear simples vs média móvel ponderada).
- Estrutura de rotas exatas dentro de cada módulo (ex: `/clinica/relatorios`, `/clinica/orcamento`, `/clinica/societario`, `/clinica/bi`).
- Layout/componentização fina das telas → definido via `/gsd-ui-phase` (UI hint = yes para esta fase, conforme ROADMAP.md).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spec & roadmap
- `.planning/ROADMAP.md` §"Phase 19" — goal, success criteria, dependências (Phase 16, 15, 7).
- `.planning/REQUIREMENTS.md` — REP-01, REP-02, REP-03, BI-01, BI-02.

### Estrutura financeira (Fase 14 — base da DRE e do Orçamento)
- `supabase/migrations/20260619001100_financial_cadastros_tables.sql` — `chart_of_accounts` (type: grupo/receita/despesa), `cost_centers` (unit_id FK), `bank_accounts`.
- `.planning/phases/14-financeiro-cadastros-base/14-CONTEXT.md` — decisões de classificação contábil (D-02a, D-03b).

### Faturamento & fluxo de caixa (Fases 3, 15, 16 — fonte dos dados da DRE)
- `financial_transactions` (Fase 3, expandida Fase 14/16) — fonte de todos os valores da DRE, recalculada em tempo real (D-10).
- `.planning/phases/16-contas-a-pagar-concilia-o-tributos/16-CONTEXT.md` — fluxo de caixa atualizado por baixas conciliadas; padrão de vigência do repasse de profissionais (TRIB-01) reusado para cotas societárias (D-20).

### Multiunidade & papéis (Fase 7 — base de unit_id e role='socio')
- `supabase/migrations/20260614000100_units_table.sql` + `20260614000300_user_units.sql` — `units`, `user_units`, `get_my_unit_ids()`.
- `.planning/phases/07-sistema-multiunidade-pap-is/07-CONTEXT.md` — SYS-05 (filtragem por unidade, enforcement deferido para esta fase), ROLE-01 (papel "socio" já existe no RBAC).

### IA Governada, Aprovações & Auditoria (Fase 10 — base do agente de BI/previsão)
- `.planning/phases/10-ia-governada-l0-l4-auditoria-ocr/10-CONTEXT.md` — framework L0–L4 (`withAgentPolicy`), `approval_requests`/`ApprovalInbox`, `ai_decision_log`.
- Padrão de agente L2 com aprovação: `.planning/phases/17-estoque-materiais/17-CONTEXT.md` §D-15 (agente de compras) — mesmo padrão de "criar sugestão → inbox de aprovação" a seguir para o agente de BI (D-34).

### CRC & Marketing (Fase 18 — dados de NPS/ROI/leads para BI)
- `.planning/phases/18-crc-marketing/18-CONTEXT.md` — `nps_responses`, `campaigns`, `leads`, ROI (CPL/CAC) — fonte dos KPIs de CRC no painel de BI (D-29).

### Estoque & Convênios (Fases 17, 15 — dados de compliance para BI)
- `.planning/phases/17-estoque-materiais/17-CONTEXT.md` — padrão de alerta/cron (`/api/cron/estoque-validade`) a replicar para o cron de previsões de BI (D-36).
- `.planning/phases/15-faturamento-nfs-e-conv-nios-tiss/15-CONTEXT.md` — `glosa_motivos`/guias TISS — fonte da taxa de glosa no painel de BI.

### Protótipos navegáveis (referência visual — não reaproveitar como componente, D-37)
- `src/lib/prototipos/mock-data.ts` — dados mock de DRE (`biKpis`), produtividade por dentista, split de pagamento, top procedimentos, KPIs de rede (`networkKpis`).
- `src/app/(dashboard)/clinica/prototipos/relatorios/page.tsx` e `dashboard-franquias/page.tsx` — referência de UX; remover após entrega real (D-42).
- `src/components/prototipos/charts.tsx` — referência visual de `KpiCard`/`ChartCard`/gráficos; não reaproveitar (D-37).

### PDF Generation (padrão já usado — export DRE/Orçamento/BI)
- `@react-pdf/renderer` — mesmo padrão do relatório ANVISA (Fase 17) e recibos (Fase 3).

### Convenções
- `CLAUDE.md` — RLS USING+WITH CHECK; index clinic_id+unit_id; `NUMERIC(12,2)` para valores financeiros; 'use server' async-only; nodejs runtime; gen types temp-file guard.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`chart_of_accounts` + `cost_centers` (Fase 14)** — base direta da DRE e do orçamento (D-01, D-12).
- **`financial_transactions` (Fase 3/14/16)** — fonte read-time de todos os valores financeiros; nenhuma tabela de snapshot necessária (D-10).
- **`units` + `user_units` + `get_my_unit_ids()` (Fase 7)** — base do seletor de unidade/consolidado em toda a fase.
- **`ApprovalInbox` + `withAgentPolicy` (Fase 10)** — reusado pelo agente de BI L1/L2 (D-34).
- **Padrão de vigência do repasse (TRIB-01, Fase 16)** — modelo a replicar para cotas societárias com histórico (D-20).
- **`nps_responses`, `campaigns`, `leads` (Fase 18)** — fonte dos KPIs de CRC no BI.
- **Padrão de cron (`/api/cron/estoque-validade`, Fase 17; NPS scan, Fase 18)** — modelo para o cron noturno de previsões/alertas (D-36).
- **`@react-pdf/renderer` (Fase 3/17)** — padrão de export PDF a reusar em DRE/Orçamento/BI.
- **role='socio' (Fase 7/ROLE-01)** — já existe no RBAC; base do vínculo sócio→usuário (D-25).

### Established Patterns
- `NUMERIC(12,2)` para valores financeiros; índice em `clinic_id`+`unit_id` em toda tabela nova.
- RLS `USING (clinic_id = get_my_tenant_id())` + `WITH CHECK` em toda tabela nova.
- Vigência/histórico (data início/fim) para regras que mudam ao longo do tempo (commission_rules, repasse, agora cotas societárias).
- Server Actions `'use server'` com Zod validation antes de tocar no banco.
- Agentes L1/L2 criam sugestão → `approval_requests` → aprovação humana antes de qualquer efeito (nunca ação direta sobre dados sensíveis).

### Integration Points
- `chart_of_accounts.id` → nova tabela de metas orçamentárias (budget targets) por conta+unidade+mês.
- `users` (role='socio') → nova tabela de cotas societárias com vigência.
- `approval_requests` (Fase 10) → sugestões de ajuste de meta do agente de BI.
- `nps_responses`/`campaigns`/`leads` (Fase 18), `stock_alerts` (Fase 17), `glosa_motivos`/guias TISS (Fase 15) → fontes de dados dos KPIs não-financeiros do painel de BI.
- Novo cron `/api/cron/bi-previsoes` (ou equivalente) → calcula tendências/alertas nightly, grava resultado para leitura do painel.

</code_context>

<specifics>
## Specific Ideas

- Visual de referência (não componente reaproveitado): cards de KPI com delta vs período anterior, gráfico de linha Receita×Despesa, donut de formas de pagamento, ranking de unidades por faturamento com barra de ocupação e badge de inadimplência — tudo já prototipado em `mock-data.ts`/`relatorios/page.tsx`/`dashboard-franquias/page.tsx`, mas a serem reconstruídos como componentes de produção.
- Tabela comparativa por unidade na DRE consolidada deve seguir o mesmo estilo de ranking do protótipo Dashboard de Franquias (posição, nome, valor, ocupação, delta).
- Seção "Alertas & Previsões" do painel de BI fica fixa no topo, visível em todas as abas de KPI.

</specifics>

<deferred>
## Deferred Ideas

- **DRE formal com subtotais (Receita Bruta → Deduções → EBITDA)** — se a necessidade de granularidade contábil formal aparecer no futuro.
- **Cotas societárias por unidade** (em vez de sempre consolidado) — caso o modelo societário real exija participação por unidade específica.
- **Lançamento financeiro automático da distribuição de lucro + retenção fiscal (IRRF sobre distribuição)** — tema jurídico/tributário que pode virar uma extensão do módulo TRIB (Fase 16) numa fase futura.
- **Cadastro de sócio sem login (investidor externo passivo)** — estender o modelo de cotas para pessoas sem usuário no sistema.
- **Vista de BI restrita para dentista** (autoavaliação da própria produtividade) — hoje só Admin/Sócio/Superadmin acessam o painel.
- **Ação de agente de BI mais ampla** (além de sugerir ajuste de meta) — ex: sugerir realocação de recursos, criar campanha de reativação automaticamente a partir de um alerta de queda.
- **Snapshot/fechamento mensal formal da DRE** — avaliado e descartado nesta fase (D-10); pode voltar se auditoria contábil externa exigir imutabilidade de períodos fechados.

</deferred>

---

*Phase: 19-relat-rios-or-amento-bi*
*Context gathered: 2026-07-19*
