# Phase 8: Documentos & Assinatura ICP-Brasil - Context

**Gathered:** 2026-06-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Motor **genérico** de documentos: criar **modelos com variáveis** (`{{nome_paciente}}`, `{{data}}`…) → preencher do contexto → gerar PDF → **assinar com o Certificado ICP** (guardado na Fase 7) → documento **imutável e versionado**. Cobre DOC-01..03.

É a base reutilizada depois por Receituário (Fase 12), NFS-e/OS (Fase 15) e Teleodontologia (Fase 20) — então o motor é **genérico** (categorias/tipos de modelo), não documentos específicos.

**Fora do escopo (outras fases):** documentos clínicos/fiscais específicos (receita, atestado, NFS-e); distribuição ao Portal do Paciente (Fase 20); PAdES embutido no PDF (refinamento futuro). Aqui é o motor de modelos + assinatura + versionamento.
</domain>

<decisions>
## Implementation Decisions

### Assinatura ICP (D-01)
- Fluxo: **gerar o PDF → calcular SHA-256 → assinar o hash com a chave privada do .pfx** (node-forge: RSA/PKCS#7) → gravar **assinatura + carimbo de tempo (signed_at) + cadeia/identidade do certificado** (titular/CNPJ/thumbprint).
- Assinatura **criptográfica real e verificável**, viável em Node serverless (Vercel nodejs runtime). **PAdES embutido no PDF** fica como refinamento futuro (deferido).
- O .pfx é buscado do bucket privado (`createAdminClient`, service role); a senha é **descriptografada AES-256** (`src/lib/crypto.ts`, `ENCRYPTION_KEY`) só em memória server-side; a chave privada **nunca** sai do servidor.
- **Fallback** (apenas se não houver certificado/chave disponível): registro hash + timestamp estilo anamnese v1, claramente marcado como "não assinado por ICP".

### Motor de Modelos + Render (D-02)
- **Modelo** = texto **rich-text/markdown com placeholders `{{variável}}`** (editor no app). Guardado como conteúdo + lista de variáveis detectadas.
- Ao **gerar**: o sistema **preenche as variáveis do contexto** (paciente, clínica, profissional, data, etc.) e **renderiza um PDF** reusando **`@react-pdf/renderer`** (lib do v1, nodejs runtime, **Flexbox apenas**, sem HTML→PDF) num **componente genérico** que recebe o conteúdo preenchido.
- O **PDF gerado é o artefato assinado** (o hash assinado é o do PDF final).

### Versionamento & Imutabilidade (D-03)
- Tabelas **`documents`** (cabeçalho: clinic_id, unit_id?, template_id, tipo/categoria, status draft/signed, current_version) + **`document_versions`** **append-only** (version_number, content preenchido, content_hash, signature, signed_at, signed_by, supersedes_id).
- Versão **assinada é imutável** via RLS (sem UPDATE/DELETE quando `signed`); **editar gera nova versão** (novo draft) preservando o histórico completo. Espelha o padrão **INSERT-only** do prontuário/odontograma do v1.

### Modelos (templates) (D-02b)
- Tabela `document_templates` (nome, categoria, conteúdo com `{{vars}}`, variáveis declaradas, ativo) — reutilizável; "tipo" do documento = categoria do modelo.

### Claude's Discretion
- Estrutura exata das migrations/colunas/índices; nomes; se `documents` carrega `unit_id` (provável, multiunidade da Fase 7).
- Biblioteca/abordagem de extração de `{{variáveis}}`; conjunto inicial de variáveis de contexto (paciente, clínica, profissional, data, número do documento).
- Detalhes de PKCS#7 com node-forge (detached vs attached signature; formato de armazenamento da assinatura — base64 no DB).
- UI do editor de modelos + tela de geração/visualização/assinatura (design system v1, @base-ui render-prop, tokens, pt-BR).
- Componente genérico `@react-pdf` (cabeçalho com logo/clínica, corpo, bloco de assinatura/validação).
- Rota: `Configurações › Documentos › Modelos·Assinatura` (per spec card); RBAC: módulo `config`/documentos, acessível conforme matriz da Fase 7.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spec & roadmap
- `.planning/MODULES-SPEC-v2.md` — Módulo 21 (Documentos e Assinatura Eletrônica: Modelo/Variáveis/Assinatura ICP/Versão) + princípio de assinatura ICP transversal.
- `.planning/ROADMAP.md` §"Phase 8" — goal, success criteria, v1 reuse.
- `.planning/REQUIREMENTS.md` — DOC-01, DOC-02, DOC-03.

### Código a reutilizar (Fase 7 + v1)
- `src/actions/certificate.ts` + `src/lib/icp/pfx-metadata.ts` — keystore do certificado (getCertificate, metadados); a senha vem cifrada (AES).
- `src/lib/crypto.ts` — AES-256-GCM (descriptografar a senha do .pfx em memória).
- `src/lib/supabase/server.ts` (`createAdminClient`) — ler o .pfx do bucket privado `icp-certificates` (service role).
- `node-forge` (instalado na Fase 7) — RSA/PKCS#7 para assinar o hash.
- `@react-pdf/renderer` (v1) — render do PDF (Flexbox only; nodejs runtime). Ver geração de PDF de prontuário/recibo do v1 como referência.
- Padrão de assinatura da **anamnese v1** (SHA-256 + imutabilidade) — `supabase/migrations` Fase 2; tabelas INSERT-only.
- `src/proxy.ts` (MODULE_PERMISSIONS) — gating da rota de Documentos.
- `CLAUDE.md` — **PDF: usar @react-pdf/renderer, Flexbox, NUNCA Puppeteer/HTML→PDF**; @base-ui render-prop; RLS USING+WITH CHECK.

[Sem ADRs dedicados — requisitos nas decisões acima + spec.]
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Certificado ICP (Fase 7):** certificates table + getCertificate + bucket privado + senha AES — a base da assinatura.
- **@react-pdf/renderer (v1):** já gera PDFs server-side (recibo, prontuário) — reusar para o documento genérico.
- **node-forge:** instalado; faz RSA sign + PKCS#7.
- **Padrão INSERT-only + RLS (v1 prontuário/anamnese):** modelo para document_versions imutável.
- **audit_logs:** registrar criação/assinatura de documento.
- **Design system v1 + config routes (Fase 7):** PageHeader, tokens, @base-ui — para editor de modelos e telas.

### Established Patterns
- RLS USING+WITH CHECK; index clinic_id (+ unit_id); migrations versionadas + [BLOCKING] db push (gotcha de re-auth da CLI).
- `'use server'` só async; service role server-only; node runtime para @react-pdf e node-forge (não Edge).
- Deploy: push em `master` E `master:main` (produção = `main`).

### Integration Points
- Novas tabelas: `document_templates`, `documents`, `document_versions` (+ RLS, índices, audit).
- Server Actions: criar/editar modelo, gerar documento (preenche+PDF), assinar (node-forge+cert), listar versões. Mutações chamam `assertNotReadOnly()`.
- Rota nova sob `config` (ou `documentos`) no app shell; nav role-gated.
- Storage: PDFs gerados/assinados em bucket (privado por tenant) ou tabela + storage.
</code_context>

<specifics>
## Specific Ideas

- Assinatura **criptográfica real** (não só hash) usando o .pfx ICP da Fase 7 — diferencial jurídico do produto.
- Motor **genérico** para destravar receituário/NFS-e/teleodonto depois (não construir documentos específicos agora).
- Imutabilidade via versões append-only — consistente com a filosofia LGPD/CFO do v1 (prontuário imutável).
</specifics>

<deferred>
## Deferred Ideas

- **PAdES embutido no PDF** (assinatura validável nativamente no leitor) — refinamento futuro; nesta fase a assinatura é PKCS#7 sobre o hash + metadados.
- **Documentos específicos** (receita/atestado/exame, NFS-e, teleconsulta) — Fases 12/15/20 consomem este motor.
- **Distribuição ao Portal do Paciente** — Fase 20.
- **Editor WYSIWYG avançado / biblioteca de modelos pronta** — começar com editor simples + {{variáveis}}.

### Reviewed Todos (not folded)
Nenhum todo pendente casou com a Fase 8.
</deferred>

---

*Phase: 08-documentos-assinatura-icp-brasil*
*Context gathered: 2026-06-14*
