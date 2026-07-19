# Phase 19: Relatórios, Orçamento & BI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-19
**Phase:** 19-relatórios-orçamento-bi
**Áreas discutidas:** DRE — estrutura e granularidade; Orçamento — modelo e fluxo; Cotas societárias — modelo de dados; BI & IA — escopo e previsões

---

## DRE — estrutura e granularidade

| Pergunta | Opções apresentadas | Selecionado |
|----------|---------------------|-------------|
| Estrutura da DRE | DRE simples / DRE formal com subtotais / Configurável pelo usuário | **DRE simples (Receita − Despesa = Resultado)** |
| Períodos suportados | Mês + intervalo customizado / Apenas mensal / Mensal+trimestral+anual | **Mês + intervalo customizado** |
| Seleção de unidade | Todas (consolidado) + drill-down / Sempre uma unidade | **Todas (consolidado) + drill-down por unidade** |
| Drill-down até lançamento | Sim / Não | **Sim — clique abre lista de lançamentos** |
| Export PDF | Sim / Não | **Sim — export PDF sob demanda** |
| % sobre receita (análise vertical) | Sim / Não | **Sim — coluna de % ao lado do valor** |
| Papéis com acesso | Admin+Sócio+Superadmin / + Auditor/DPO read-only | **Admin + Sócio + Superadmin** |
| Quebra por centro de custo | Não, só total / Sim, expansível | **Sim — expansível por centro de custo** |
| Exibição do consolidado ("Todas") | DRE única + tabela comparativa / Só agregado / Colunas lado a lado | **DRE única somada + tabela comparativa por unidade** |
| Snapshot vs tempo real | Tempo real / Snapshot congelado no fechamento | **Sempre recalculada em tempo real (sem snapshot)** |
| Comparação YoY | Sim, quando houver ≥12 meses / Não | **Sim, quando houver dados suficientes** |

**Notas:** Usuário pediu repetidamente para aprofundar esta área além do padrão de 4 perguntas — cobertura estendida por escolha explícita.

---

## Orçamento — modelo e fluxo

| Pergunta | Opções apresentadas | Selecionado |
|----------|---------------------|-------------|
| Granularidade da meta | Por conta contábil+unidade / Só macro / Por centro de custo | **Por conta contábil (chart_of_accounts) + unidade** |
| Fluxo de cadastro | Anual com 12 valores editáveis / Mês a mês / Anual com distribuição automática | **Cadastro anual com 12 valores mensais editáveis** |
| Quem cadastra/edita | Admin+Superadmin / Admin+Sócio+Superadmin | **Admin + Sócio + Superadmin** |
| Destaque de desvios | Semáforo por faixa de % / Só valor/% sem cor / Semáforo + alerta automático | **Semáforo por faixa de % (verde/amarelo/vermelho)** |
| Relação com a tela de DRE | Tela separada com link cruzado / Coluna extra na DRE | **Tela separada, com link cruzado** |
| Copiar do ano anterior | Sim / Não | **Sim — botão "Copiar do ano anterior"** |
| Edição retroativa de meses passados | Sempre editável / Travado após o mês fechar | **Não — meses passados ficam travados** |
| Export PDF | (decidido junto com pergunta geral de export, ver BI&IA) | **Sim, todas as telas têm export** |

---

## Cotas societárias — modelo de dados

| Pergunta | Opções apresentadas | Selecionado |
|----------|---------------------|-------------|
| Cadastro de percentual | Fixo com vigência/histórico / Fixo sem histórico | **Percentual fixo por sócio, com vigência (histórico)** |
| Base de cálculo | Sempre consolidado (rede) / Configurável por unidade | **Sempre consolidado (rede inteira)** |
| Validação de soma 100% | Bloqueia salvar / Só alerta | **Sim — bloqueia salvar se não somar 100%** |
| Exibição do valor | R$ calculado por sócio / Só percentual | **R$ calculado por sócio (percentual × resultado)** |
| Visibilidade entre sócios | Admin+Superadmin veem tudo, Sócio só a própria cota / Todos veem tudo | **Admin+Superadmin veem tudo; Sócio vê só a própria cota** |
| Sócio precisa ser usuário do sistema? | Sempre vinculado a users role='socio' / Pode ser sem login | **Sempre vinculado a um usuário (role='socio')** |
| Gera lançamento financeiro? | Puramente informativa / Gera saída de caixa | **Puramente informativa — sem lançamento** |
| Resultado negativo (prejuízo) | Mostra dividido (negativo) / Oculta/zera | **Mostra prejuízo dividido proporcionalmente** |

---

## BI & IA — escopo e previsões

| Pergunta | Opções apresentadas | Selecionado |
|----------|---------------------|-------------|
| Escopo intra-tenant vs cross-tenant | Confirma intra-tenant / Precisa cross-tenant real | **Confirma — unidades intra-tenant** |
| KPIs a incluir | Operacional / Produtividade / CRC / Estoque-TISS (multi-select) | **Todos os 4 grupos selecionados** (+ "Atrasos de pagamento e faturamento" via texto livre) |
| Metas dos KPIs operacionais | Metas próprias por KPI / Só financeiro tem meta | **Metas próprias por KPI operacional (tabela separada)** |
| Método de previsão | Estatística+narrativa LLM / Totalmente LLM / Só estatística sem narrativa | **Extrapolação estatística + narrativa gerada por LLM** |
| Gatilhos de alerta | Desvio orçamentário / Queda vs tendência / KPI fora da meta (multi-select) | **Todos os 3 + "Atrasos de pagamentos e faturamento"** (texto livre) |
| Nível de autonomia L0-L4 | L0 somente leitura / L1-L2 com ação sugerida e aprovação | **L1/L2 — sugere ação com aprovação** |
| Ação concreta do agente L1/L2 | Sugerir ajuste de meta / Só registrar alerta | **Sugerir ajuste de meta orçamentária para aprovação** |
| Reaproveitar componentes do protótipo | Sim, promover / Não, construir novos | **Não — construir componentes novos** |
| Frequência do cálculo de previsão | Cron diário/noturno / Tempo real a cada carregamento | **Cron diário/noturno** |
| Janela de histórico para previsão | 6 meses / 12 meses (ou tudo se <12) | **Últimos 12 meses (ou histórico disponível)** |
| Organização de rotas/módulos | Hub único com abas / Módulos separados no menu | **Módulos separados no menu** |
| Permissões do painel de BI | Mesmas da DRE / Dentista vê própria produtividade | **Mesmas permissões da DRE** |
| Onde aparecem os alertas de IA | Seção própria + inbox só quando há ação / Tudo no inbox | **Seção própria "Alertas & Previsões" + inbox quando há ação** |
| Layout dos grupos de KPI | Abas por dimensão / Dashboard único rolável | **Abas por dimensão** |
| Dados mínimos para painel funcionar | KPIs desde o 1º mês, previsão exige 3 meses / Bloqueia tudo até 12 meses | **KPIs desde o início; previsão exige mínimo 3 meses** |
| Remover protótipos após entrega real | Sim / Manter como referência | **Sim — remover as páginas de protótipo** |

---

## Claude's Discretion

- Nomes/colunas/índices exatos das novas tabelas.
- Thresholds exatos do semáforo de desvio e do gatilho de "queda vs tendência".
- Algoritmo exato de regressão/tendência.
- Rotas exatas de cada módulo.
- Layout fino das telas → via `/gsd-ui-phase`.

## Deferred Ideas

- DRE formal com subtotais/EBITDA.
- Cotas societárias por unidade (em vez de consolidado).
- Lançamento financeiro automático + retenção fiscal sobre distribuição de lucro.
- Cadastro de sócio sem login (investidor externo).
- Vista de BI restrita para dentista (autoavaliação).
- Ação de agente de BI mais ampla além de ajuste de meta.
- Snapshot/fechamento mensal formal da DRE.
