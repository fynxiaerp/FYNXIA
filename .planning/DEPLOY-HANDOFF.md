# Handoff — Deploy pendente para a Vercel

**Salvo em:** 2026-07-13 (retomar amanhã)
**Objetivo da próxima sessão:** subir o código para o GitHub e disparar o deploy na Vercel, sincronizando produção com o banco (que já está à frente).

---

## Estado atual

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
