# Phase 18: CRC & Marketing - Context

**Gathered:** 2026-07-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Recepção e marketing gerenciam o funil de leads (com origem e ROI), disparam
campanhas segmentadas de reativação (WhatsApp/e-mail com personalização de IA),
coletam NPS pós-consulta e rastreiam o programa de indicação com recompensas.

Cobre CRC-01..05. **Não** cobre: portal do paciente (exposição self-service das
recompensas/NPS ao paciente é Fase 20), construtor de segmento avançado, sistema
de pontos/gamificação, código/link de indicação compartilhável.
</domain>

<decisions>
## Implementation Decisions

### Funil de leads (CRC-01)
- **D-01:** Estágios do funil: **Novo → Contatado → Agendado → Convertido / Perdido**. "Agendado" conecta ao módulo de agenda existente (mede onde o lead esfria).
- **D-02:** Visualização **Kanban** com arrastar-e-soltar entre estágios. Não existe componente kanban no projeto — será novo (o planner deve pesquisar a lib de DnD; respeitar Tailwind v4 + shadcn).
- **D-03:** Origem do lead via **lista fixa gerenciável** (seed inicial: Indicação, Google, Instagram, Facebook, Walk-in, WhatsApp, Outro). Admin pode adicionar origens. Origem padronizada é a base da agregação de conversão/ROI — NÃO usar campo livre.
- **D-04:** Conversão do lead cria/vincula um `patient` (a origem 'Indicação' amarra ao programa de indicação — D-13). Lead e paciente são entidades distintas; a conversão liga as duas.

### ROI de campanha (CRC-02)
- **D-05:** Custo da campanha **vem do módulo financeiro** (despesas de marketing lançadas em Fase 14/16), não entrada manual isolada. O planner deve amarrar campanha ↔ despesa (ex.: centro de custo/categoria de marketing, ou FK campanha→financial_transactions/payables). Trade-off aceito: mais integração em troca de auditabilidade e fonte única de verdade do custo.
- **D-06:** Métricas: **CPL = custo / nº de leads** da campanha; **CAC = custo / nº de pacientes convertidos** atribuídos à campanha/origem. Painel exibe conversão por origem.

### Campanhas de reativação (CRC-03)
- **D-07:** Segmentação = **"inativo há X dias" com X configurável + filtros opcionais** (último procedimento, faixa etária, unidade). NÃO é um construtor de query livre (diferido).
- **D-08:** Canal = **ambos (WhatsApp e/ou e-mail)**, respeitando a **preferência/opt-in do paciente** (LGPD). Reutiliza o outbox de mensageria + whatsapp client + resend.
- **D-09:** IA em **nível L2**: o agente personaliza a mensagem (apenas primeiro nome + dados mínimos, ZDR/LGPD) e monta a campanha, mas o **disparo em massa exige aprovação humana** (alçada/approval_requests da Fase 10). Salvaguarda de custo + regras da Meta.
- **D-10:** Disparo **manual** em v1: marketing seleciona o segmento e aciona o envio (casa com a aprovação L2). Agendado automático (cron) fica diferido.
- **D-11:** **Restrição Meta:** mensagens WhatsApp outbound de reativação estão fora da janela de 24h → exigem **template aprovado** (categoria utility/marketing). O planner deve tratar a campanha como envio via template com variáveis, não texto livre no WhatsApp.

### NPS pós-consulta (CRC-04)
- **D-12:** Coleta em **batch diário (cron à noite)** — varre atendimentos concluídos no dia e envia o convite de NPS. (Não é disparo imediato pós-atendimento.)
- **D-13:** Captura via **link para mini-formulário web** (0–10 + comentário), enviado por WhatsApp/e-mail. Usa **rota pública com token single-use** (padrão da anamnese, Fase 2) — evita parsing frágil de resposta no chat e funciona em qualquer canal.
- **D-14:** Classificação **padrão NPS**: 9–10 promotor, 7–8 neutro, 0–6 detrator. NPS = %promotores − %detratores. Painel classifica os três grupos.
- **D-15:** Detrator (0–6) gera **alerta interno** para recepção/gestor tratar o resgate (fecha o loop sem automação de contato). Sem mensagem automática ao paciente detrator.

### Programa de indicação (CRC-05)
- **D-16:** Indicação registrada ao **cadastrar o lead/paciente**: recepção vincula "indicado por" a um paciente existente. Sem código/link compartilhável em v1 (depende do portal, Fase 20).
- **D-17:** Recompensa = **crédito/desconto em serviços** (valor por indicação configurável). Fica no ecossistema da clínica; sem saída de caixa direta.
- **D-18:** Recompensa creditada **na conversão do indicado** (lead indicado chega a 'Convertido'). Alinha incentivo ao resultado real.
- **D-19:** Saldo de recompensas visível em **tela interna** agora (recepção consulta/informa), com o dado **modelado para o portal do paciente expor na Fase 20**.

### Claude's Discretion
- Escolha da lib de kanban/DnD (D-02) e do componente de tabela onde aplicável.
- Modelagem exata das tabelas (leads, lead_sources, campaigns, nps_responses, referrals, referral_rewards) e RLS multi-tenant + unit_id (seguir padrões das fases 7/16/17).
- Forma exata do vínculo campanha↔despesa financeira (D-05) — escolher o mais simples e auditável.
- Estrutura do painel de ROI/conversão e do painel de NPS (seguir UI-SPEC a ser gerado).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Escopo & requisitos
- `.planning/ROADMAP.md` §"Phase 18: CRC & Marketing" — goal, success criteria, depends_on (Fase 9 hub, Fase 7 papéis)
- `.planning/REQUIREMENTS.md` — CRC-01..05

### Mensageria (reutilizar — não recriar)
- `src/lib/messaging/queue.ts`, `src/lib/messaging/worker.ts`, `src/lib/messaging/reminder-scan.ts` — outbox pattern (message_outbox + Vercel Cron), padrão para disparo de campanhas/NPS
- `src/lib/whatsapp/client.ts` — envio via Meta WhatsApp Cloud API
- `src/lib/whatsapp/templates.ts` — templates aprovados (D-11: reativação/NPS exigem template)
- `src/lib/resend.ts` — envio de e-mail (Resend)

### IA governada (reutilizar padrão)
- `src/lib/agents/collection-agent.ts`, `src/lib/agents/confirmation-agent.ts` — padrão `withAgentPolicy` (L0–L4) para o agente de personalização de campanha (D-09)
- `src/lib/ai/whatsapp-intent.ts` — personalização por IA com dados mínimos (LGPD/ZDR)
- Alçada/aprovação (Fase 10): `approval_requests` — usado para o gate humano do blast L2

### Padrões reaproveitáveis
- Anamnese public-token (Fase 2) — modelo da rota pública com token single-use para o formulário de NPS (D-13)
- Financeiro (Fases 14/16): centros de custo, `financial_transactions`/`payables` — fonte do custo de campanha para ROI (D-05)
- RLS multi-tenant + `unit_id` + soft-delete (Fases 0/7/17) — padrão para todas as tabelas novas

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Outbox de mensageria** (`src/lib/messaging/`): fila + worker + Vercel Cron — reusar para o disparo de campanhas e do convite de NPS em vez de enviar síncrono.
- **WhatsApp Cloud API + templates** (`src/lib/whatsapp/`): cliente de envio e catálogo de templates aprovados — campanha/NPS enviam via template (D-11).
- **Resend** (`src/lib/resend.ts`): e-mail transacional com React Email.
- **Padrão de agente governado** (`src/lib/agents/*`): `withAgentPolicy` L0–L4 + `approval_requests` — base do agente de personalização de campanha com aprovação humana (D-09).
- **Rota pública com token** (anamnese, Fase 2): base do mini-form de NPS (D-13).

### Established Patterns
- Server Actions com `getActor()` + role gate (`WRITER_ROLES`), RLS `USING`/`WITH CHECK` por `clinic_id`, `createAdminClient` só para escrita sem sessão (cron/agente).
- Migrations em `supabase/migrations/` + `supabase db push` + regen de tipos (fase com tabelas novas terá tarefa `[BLOCKING]` de push).

### Integration Points
- Conversão de lead → `patients` (Fase 2); origem 'Indicação' → programa de indicação (D-16).
- Custo de campanha → módulo financeiro (Fases 14/16).
- NPS disparado a partir de atendimentos `concluido` (mesma transição que já dispara OS/estoque — `appointments.ts`).
- Papéis Marketing/Recepção (Fase 7) para o RBAC das telas.

</code_context>

<specifics>
## Specific Ideas

- Kanban do funil com arrastar-e-soltar (D-02).
- Origens seed: Indicação, Google, Instagram, Facebook, Walk-in, WhatsApp, Outro (D-03).
- NPS via mini-form web com token (D-13), classificação padrão 9-10/7-8/0-6 (D-14).
- Recompensa de indicação como crédito em serviços, creditada na conversão (D-17/D-18).

</specifics>

## Accepted Risk / Assumption

- **A2 â Consentimento unico de marketing (v1):** O phase reutiliza o consent_type `marketing_whatsapp` como opt-in guarda-chuva de marketing para AMBOS os canais (WhatsApp **e** e-mail). Nao existe um consent_type `marketing_email` separado em v1. O gate de disparo do Plano 05 (`segment.ts` / `approveCampaignAndDispatch`) usa `marketing_whatsapp` (revoked_at IS NULL) para os dois canais. **Pendente de confirmacao do usuario** â se for exigido consentimento por canal, sera necessario adicionar `marketing_email` ao CHECK de patient_consents e desmembrar o gate.

<deferred>
## Deferred Ideas

- **Disparo agendado automático de reativação** (cron recorrente) — v1 é manual (D-10); avaliar depois com salvaguardas anti-spam.
- **Código/link de indicação compartilhável** — depende do portal do paciente (Fase 20); v1 é vinculação manual (D-16).
- **Exposição de NPS/recompensas ao paciente** (self-service) — Fase 20 (portal). v1 modela o dado e mostra internamente (D-19).
- **Construtor de segmento avançado** (filtros AND/OR combináveis) — v1 é "X dias + filtros opcionais" (D-07).
- **Sistema de pontos/gamificação** de indicação — fora de escopo; v1 é crédito em serviços (D-17).

</deferred>

---

*Phase: 18-crc-marketing*
*Context gathered: 2026-07-11*
