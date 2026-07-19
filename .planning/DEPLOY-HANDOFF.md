# Handoff — Deploy pendente para a Vercel

**Salvo em:** 2026-07-13 (retomar amanhã)
**Atualizado em:** 2026-07-19 — push + deploy concluídos, ver seção "Update 2026-07-19" no final.

---

## Estado atual (histórico — ver update no final para status real)

| Camada | Estado |
|--------|--------|
| Código Fases 17 (Estoque) + 18 (CRC & Marketing) | ✅ Commitado localmente. Branch `master` está **101 commits à frente** de `origin/main`. **NADA foi pushado.** |
| GitHub (`github.com/fynxiaerp/FYNXIA`) | ❌ Sem push — remoto desatualizado. |
| Deploy Vercel (repo linkado via `.vercel/project.json`) | ❌ Nenhum deploy disparado (Vercel faz deploy a partir do GitHub). |
| Banco Supabase (`jqjwyqlbbuqnrffdnlpp`) | ✅ **AO VIVO** — migrations das Fases 17 e 18 já aplicadas via `db push`. |

⚠️ **Descompasso:** o schema do banco está À FRENTE do código em produção. Enquanto o push/deploy não acontecer, produção (código antigo) e banco (tabelas novas de estoque + CRC) estão dessincronizados.

---

## Bloqueadores / pré-checks antes do deploy

1. **`.vercelignore` está UNTRACKED** — precisa ser commitado (e pushado) para valer no build da Vercel. Conteúdo atual exclui `.planning/`, `.claude/`, `.firecrawl/`, `_docx_temp/`, `*.docx`, `FYNXIA-ERP.md`, `ARQUITETURA.docx`. Sem commitá-lo, o deploy inclui esses diretórios.
2. **Branch mismatch:** local é `master`, remoto rastreado é `origin/main`. Definir para qual branch a Vercel faz deploy de produção (provavelmente `main`) e alinhar o push (ex.: `git push origin master:main`, ou renomear/mergear).
3. **Variáveis de ambiente na Vercel** precisam existir para crons/campanhas/NPS funcionarem em produção:
   - Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - Meta WhatsApp Cloud API (envio de campanha/NPS via template)
   - Resend (e-mail)
   - `CRON_SECRET` (usado por `isCronAuthorized` nos crons de estoque-validade e nps-scan)
   - Chave do provedor de IA (personalização L2 de campanha — tem fallback estático se ausente)
4. **Crons registrados em `vercel.json`:** `estoque-validade` (Fase 17) e `nps-scan` (`0 23 * * *`, Fase 18). Conferir que o plano Vercel suporta os cron jobs e que o `CRON_SECRET` casa.
5. **3 UATs manuais da Fase 18 ainda pendentes** (ver `.planning/phases/18-crc-marketing/18-HUMAN-UAT.md`): kanban drag-and-drop, envio live de campanha, form público de NPS. Decidir se valida antes ou depois do deploy.

---

## Passos sugeridos para amanhã

1. `git add .vercelignore && git commit` (para o ignore valer no deploy).
2. Revisar o que vai subir: `git log --oneline origin/main..master` (101 commits).
3. Confirmar/alinhar o branch de produção da Vercel.
4. Push: `git push origin master:main` (ou o alvo correto) — **ação de produção, confirmar antes.**
5. Acompanhar o build/deploy na Vercel; conferir env vars; validar as rotas novas (`/clinica/crc/*`, `/clinica/estoque/*`, `/nps/[patient-id]/[token]`).
6. Rodar os 3 UATs manuais da Fase 18 no ambiente deployado.

**Nota de segurança:** push + deploy são ações externas/produção — Claude não fará sem seu OK explícito na próxima sessão.

---

## Update 2026-07-19

- **Push:** feito. `master` == `origin/main` (0 commits de diferença). Inclui o fix de build (`a0f68b2`/`872e021` — `REFERRAL_REWARD_DEFAULT` movido para fora do arquivo `'use server'`).
- **Deploy Vercel:** `Ready` em produção, 2 tentativas anteriores falharam (erro de build antes do fix), a 3ª subiu. Alias `fynxia.vercel.app` / `fynxia-git-main-fynxia.vercel.app` servindo o build atual.
- **`.vercelignore`:** já commitado (`3e95fd4`).
- **Env vars conferidas na Vercel (produção):**
  - ✅ `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (nome atual do Supabase — substituiu `ANON_KEY`), `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `ENCRYPTION_KEY`, `CRON_SECRET`
  - ❌ **Faltando:** `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN` — sem elas, envio de campanhas (Fase 18), NPS invite via WhatsApp, crons `reminder-dispatch`/`collection-ruler` e o webhook inbound (`/api/webhooks/whatsapp`) não funcionam em produção. **Decisão do usuário 2026-07-19: deixar pendente por enquanto** (depende de Meta Business verification — Open Question 3 do STATE.md).
  - ⚠️ `AI_GATEWAY_API_KEY` também ausente, mas tem fallback estático (D-184) — não bloqueia.
- **Próximos passos:** rodar os 3 UATs manuais da Fase 18 (ver `18-HUMAN-UAT.md`) — o de kanban e o de NPS público não dependem de WhatsApp; o de campanha só pode ser validado até a etapa de aprovação sem envio real.
