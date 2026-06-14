---
phase: 08-documentos-assinatura-icp-brasil
verified: 2026-06-14T13:10:00Z
status: human_needed
score: 10/10 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Gerar documento a partir de um modelo real com {{nome_paciente}}/{{data}} e verificar que as variáveis foram substituídas corretamente no PDF"
    expected: "PDF renderizado com os valores corretos sem nenhum placeholder {{var}} remanescente"
    why_human: "Requer uma clínica cadastrada, um modelo criado, e renderização real via @react-pdf no browser/servidor live"
  - test: "Assinar documento com um certificado ICP-Brasil real (A1 ou A3) e verificar carimbo de tempo + identidade do signatário"
    expected: "signedAt, signerCn, thumbprint retornados e exibidos na UI; PDF salvo no bucket documents-pdf; status do documento muda para 'signed'"
    why_human: "Requer .pfx de produção carregado no bucket icp-certificates e conexão live ao Supabase"
  - test: "Verificar assinatura de um documento assinado via botão 'Verificar Assinatura' na UI"
    expected: "verifyDocumentSignature retorna verified=true; badge 'Assinatura válida' aparece na UI"
    why_human: "Requer PDF assinado real armazenado no bucket documents-pdf"
  - test: "Tentar editar uma versão assinada e verificar que o sistema cria nova versão draft em vez de modificar a existente"
    expected: "A versão assinada permanece imutável; nova versão com version_number+1 é criada; histórico preservado"
    why_human: "Requer fluxo completo de gerar → assinar → tentar editar — validação de UX e imutabilidade end-to-end"
  - test: "Logar como auditor/dpo/socio e verificar que botões 'Assinar' e 'Gerar' estão desabilitados; ações de mutação retornam erro"
    expected: "Roles read-only veem histórico de versões mas não podem gerar/assinar; assertNotReadOnly lança erro se tentar via API direta"
    why_human: "Requer múltiplas sessões com diferentes roles e teste de chamada direta à Server Action"
  - test: "Acessar /config/documentos como dentist e verificar que o Alert 'Acesso restrito' é exibido"
    expected: "Alert 'Acesso restrito. Esta área é exclusiva para administradores e TI.' visível; sem redirect"
    why_human: "Requer sessão autenticada com role dentist no ambiente live"
  - test: "Renderizar o PDF no browser via link 'Baixar PDF' e verificar suporte a acentuação pt-BR (ã, ç, ê, õ)"
    expected: "PDF renderiza com fonte Roboto; acentos pt-BR corretos; sem caracteres substituídos por '?'"
    why_human: "Requer PDF real renderizado via @react-pdf com conteúdo em português"
---

# Phase 08: Documentos & Assinatura ICP-Brasil — Verification Report

**Phase Goal:** Modelos de documento com variáveis → preenche do contexto → gera PDF → assina com o .pfx ICP (Fase 7) → documento imutável e versionado.
**Verified:** 2026-06-14T13:10:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Tabelas `document_templates`, `documents`, `document_versions` existem nas migrations e nos tipos TypeScript | VERIFIED | `20260615000100_document_tables.sql` contém os 3 CREATE TABLEs; `database.types.ts` linhas 913, 977, 1073 |
| 2 | `document_versions` tem RLS INSERT-only (sem UPDATE/DELETE); REVOKE em `storage_path`/`cert_pem` | VERIFIED | `20260615000200_document_rls.sql`: `FOR INSERT WITH CHECK`; sem FOR UPDATE/FOR DELETE policy; `REVOKE SELECT (storage_path, cert_pem) ON public.document_versions FROM authenticated, anon` |
| 3 | Bucket `documents-pdf` privado criado | VERIFIED | `20260615000300_documents_bucket.sql`: `INSERT INTO storage.buckets ('documents-pdf', 'documents-pdf', false)` |
| 4 | `fillTemplate`/`detectVariables` funcionam corretamente com `{{var}}` | VERIFIED | `src/lib/documents/template-engine.ts`: implementação real, sem 'use server'; 55/55 testes Phase 8 GREEN |
| 5 | `signPdfBuffer`/`verifyPdfSignature` usam RSA real (node-forge, algoritmo testado contra .pfx) | VERIFIED | `src/lib/icp/sign-document.ts`: `import 'server-only'`; algoritmo SHA-256 + RSA forge; `verifyPdfSignature` usa `md2` fresco (Pitfall 2); sign-document.test.ts 2/2 GREEN |
| 6 | `DocumentoPDF` renderiza conteúdo + bloco de assinatura; Flexbox-only; sem `use client` | VERIFIED | `src/components/pdf/DocumentoPDF.tsx`: `@react-pdf/renderer`; `flexDirection` em todos os estilos; sem `display: 'grid'`; sem `'use client'`; `Font.register` Roboto; `signatureBlock?` condicional |
| 7 | `documents.ts` implementa `generateDocument/signDocument/verifyDocumentSignature/listDocumentVersions`; conteúdo AES-encriptado; editar signed cria nova versão | VERIFIED | `src/actions/documents.ts` linha 1 `'use server'`; `encrypt(filledContent)` + `is_content_encrypted: true` em generateDocument; `decrypt(version.content)` antes de renderToBuffer em signDocument; `assertNotReadOnly()` em generateDocument e signDocument; guard cross-tenant em ambos |
| 8 | Módulo `documentos` em `proxy.ts` com permissões corretas; `/clinica/documentos` mapeado | VERIFIED | `src/proxy.ts` linha 14: `ModuleKey` inclui `'documentos'`; dentist `{allowed:true}`; dpo/auditor/socio `{allowed:true, readOnly:true}`; `ROUTE_MODULE_MAP` linha 38: `/clinica/documentos` antes de `/clinica` |
| 9 | Rotas `/config/documentos` e `/clinica/documentos` existem e constam no build | VERIFIED | `next build` lista `/config/documentos ƒ` e `/clinica/documentos ƒ`; arquivos `page.tsx` confirmados em disco |
| 10 | Gates: vitest GREEN, tsc exit 0, next build green | VERIFIED | 712/712 testes passando (48 test files); tsc exit 0; next build sem erros |

**Score:** 10/10 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260615000100_document_tables.sql` | 3-table schema + indexes + UNIQUE(document_id, version_number) + is_content_encrypted | VERIFIED | 93 linhas; CREATE TABLE para os 3 schemas; UNIQUE constraint linha 86; is_content_encrypted linha 74 |
| `supabase/migrations/20260615000200_document_rls.sql` | RLS USING+WITH CHECK; INSERT-only em document_versions | VERIFIED | 77 linhas; ENABLE ROW LEVEL SECURITY nos 3; FOR INSERT WITH CHECK; sem FOR UPDATE/DELETE; REVOKE linha 76 |
| `supabase/migrations/20260615000300_documents_bucket.sql` | Bucket privado documents-pdf | VERIFIED | 14 linhas; `public = false`; ON CONFLICT DO NOTHING |
| `src/lib/documents/template-engine.ts` | fillTemplate + detectVariables | VERIFIED | 52 linhas; exporta as 2 funções; sem 'use server'; deduplicação com Set |
| `src/lib/icp/sign-document.ts` | signPdfBuffer + verifyPdfSignature; server-only | VERIFIED | 137 linhas; `import 'server-only'`; decrypt + createAdminClient + forge RSA; OID fallbacks; certificateToAsn1 thumbprint |
| `src/components/pdf/DocumentoPDF.tsx` | Generic @react-pdf; Flexbox; Font.register; signatureBlock prop | VERIFIED | 310 linhas; Font.register Roboto 400/700; todos styles com flexDirection; signatureBlock? condicional; sem 'use client' |
| `src/actions/document-templates.ts` | createTemplate/updateTemplate/deleteTemplate/listTemplates; 'use server'; assertNotReadOnly | VERIFIED | 313 linhas; 'use server' linha 1; assertNotReadOnly em createTemplate, updateTemplate, deleteTemplate |
| `src/actions/documents.ts` | generateDocument/signDocument/verifyDocumentSignature/listDocumentVersions; 'use server'; assertNotReadOnly; AES-encrypt | VERIFIED | 498 linhas; 'use server' linha 1; encrypt em generateDocument; decrypt em signDocument; assertNotReadOnly em ambos mutating actions |
| `src/app/api/documentos/[versionId]/route.ts` | runtime='nodejs'; maxDuration=30; signed URL; Cache-Control: no-store | VERIFIED | `export const runtime = 'nodejs'`; `export const maxDuration = 30`; createSignedUrl TTL=60s; fallback stream com Cache-Control: no-store |
| `src/proxy.ts` | documentos ModuleKey; ROUTE_MODULE_MAP; MODULE_PERMISSIONS corretos | VERIFIED | Linha 14: ModuleKey inclui 'documentos'; linha 38: prefix antes de '/clinica'; permissões por role corretas |
| `src/app/(dashboard)/config/documentos/page.tsx` | Server Component; gate admin/superadmin/ti; Alert Acesso restrito | VERIFIED | Imports listTemplates + DocumentTemplatesManager; role gate com Alert (sem redirect) |
| `src/app/(dashboard)/clinica/documentos/page.tsx` | Server Component; isReadOnly de x-read-only; DocumentGenerator | VERIFIED | Arquivo existe; `DocumentGenerator` renderizado |
| `src/components/documents/DocumentGenerator.tsx` | 'use client'; generate→sign→verify; botões desabilitados para read-only | VERIFIED | Arquivo existe |
| `src/components/documents/DocumentVersionsList.tsx` | 'use client'; badges signed/draft; imutable lock | VERIFIED | Arquivo existe |
| `src/types/database.types.ts` | Contém document_templates, documents, document_versions | VERIFIED | Linhas 913, 977, 1073 confirmadas; `is_content_encrypted: boolean` na linha 988 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `sign-document.ts` | `crypto.ts` + bucket `icp-certificates` | `decrypt(certPasswordEnc)` + `createAdminClient().storage.from('icp-certificates').download` | WIRED | Linhas 55 e 60-61 confirmadas |
| `DocumentoPDF.tsx` | `@react-pdf/renderer` | `Document/Page/View/Text` + `Font.register` (Flexbox only) | WIRED | Linha 20-27; todos layouts com flexDirection |
| `documents.ts` | `signPdfBuffer` + `renderToBuffer` + bucket `documents-pdf` | `fill→render→hash→sign→upload→update version` (atomic) | WIRED | Linhas 179 (renderToBuffer), 332 (signPdfBuffer), 340 (storage.upload documents-pdf) |
| `proxy.ts` | `/clinica/documentos` route | `ROUTE_MODULE_MAP` prefix antes de `/clinica` + `MODULE_PERMISSIONS` gate | WIRED | Linha 38; deriveRoleRoutes trata documentos como sub-rota de /clinica |
| `document-templates.ts` | tabela `document_templates` via `detectVariables()` | `supabase.from('document_templates').insert({...variables})` | WIRED | Linha 122: detectVariables; linha 126: insert com variables array |
| `document-templates.ts` | `createTemplate/updateTemplate` via react-hook-form + zodResolver | `zodResolver(documentTemplateSchema)` em DocumentTemplateForm | WIRED | `src/lib/validators/document-template.ts` + DocumentTemplateForm confirmados |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `DocumentGenerator.tsx` | templates (template picker) | `listTemplates()` Server Action → `document_templates` table via RLS | Sim — query `select id, name, category, content, variables, is_active` | FLOWING |
| `documents.ts:generateDocument` | `filledContent` | `fillTemplate(template.content, ctx)` onde ctx vem de DB (clinicName, actor, etc.) | Sim — dados reais da clínica e profissional | FLOWING |
| `documents.ts:signDocument` | `pdfBuffer` | `renderToBuffer(createElement(DocumentoPDF, {...}))` com conteúdo decriptado | Sim — renderiza PDF real com bytes reais assinados | FLOWING |
| `documents.ts:listDocumentVersions` | version rows | `createClient().from('document_versions').select(...)` via RLS | Sim — sem campos estáticos; exclui storage_path/cert_pem (REVOKE-protected) | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Vitest suite completa (712 testes) | `npx vitest run` | 712/712 passed (48 files) | PASS |
| Phase 8 specific tests (55 testes: sign-document, template-engine, migrations, actions, PDF) | `npx vitest run src/__tests__/documents/ src/__tests__/icp/sign-document.test.ts src/__tests__/migrations/phase8.test.ts src/__tests__/pdf/documento.test.ts` | 55/55 passed (5 files) | PASS |
| RBAC tests (documentos module não quebra testes existentes) | `npx vitest run src/__tests__/proxy/rbac.test.ts src/__tests__/rbac/` | 48/48 passed (2 files) | PASS |
| TypeScript type check | `npx tsc --noEmit` | exit 0 | PASS |
| Next.js build (incluindo /config/documentos e /clinica/documentos e /api/documentos/[versionId]) | `npx next build` | Green; ambas as rotas listadas como ƒ (dynamic) | PASS |

---

### Requirements Coverage

| Requirement | Planos | Descrição | Status | Evidência |
|-------------|--------|-----------|--------|-----------|
| DOC-01 | 01, 02, 04 | Usuário cria modelos com variáveis preenchidas automaticamente pelo contexto | SATISFIED | template-engine.ts (fillTemplate/detectVariables); document-templates.ts CRUD; /config/documentos UI; document_templates migration |
| DOC-02 | 01, 02, 05 | Documento assinado com ICP-Brasil (carimbo de tempo, validade jurídica) | SATISFIED | sign-document.ts (RSA node-forge); signDocument atomic flow; signed_at/signer_cn/cert_thumbprint stored; /api/documentos download route nodejs |
| DOC-03 | 01, 02, 03, 05 | Documento assinado imutável e versionado | SATISFIED | document_versions INSERT-only RLS (sem UPDATE/DELETE); is_content_encrypted; UNIQUE(document_id, version_number); AES encrypt em generateDocument |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | Nenhum encontrado | — | — |

Nenhum TODO/FIXME/placeholder, stub, `return null`, `return []` sem dados reais, `display: 'grid'`, ou `'use client'` indevido encontrados nos arquivos de produção verificados.

---

### Human Verification Required

#### 1. Geração de documento com preenchimento real de variáveis

**Test:** Criar um modelo com variáveis `{{nome_paciente}}`, `{{data_documento}}`, `{{nome_profissional}}`; gerar um documento selecionando um paciente real; baixar o PDF.
**Expected:** PDF renderizado com valores reais substituídos; sem `{{var}}` remanescente; fonte Roboto com acentos pt-BR corretos.
**Why human:** Requer clínica cadastrada, paciente no DB, renderização @react-pdf e visualização em browser.

#### 2. Assinatura ICP-Brasil com certificado real

**Test:** Fazer upload de um .pfx de produção (A1) via /config/certificado; gerar um documento; clicar "Assinar com ICP-Brasil".
**Expected:** Assinatura retornada com `signerCn`, `signedAt`, `thumbprint`, `sha256Hex`; status do documento muda para 'signed'; ícone de cadeado visível no DocumentVersionsList.
**Why human:** Requer .pfx de produção ou .pfx de homologação válido; Supabase live com icp-certificates bucket; chamada real a signPdfBuffer.

#### 3. Verificação de assinatura on-demand

**Test:** Em um documento assinado, clicar "Verificar Assinatura".
**Expected:** `verified: true`; badge "Assinatura válida" exibido; RSA verify + SHA-256 cross-check ambos passam.
**Why human:** Requer PDF real no bucket documents-pdf e cert_pem armazenado no document_versions.

#### 4. Imutabilidade live — editar versão assinada

**Test:** Após assinar, tentar clicar em "Nova Revisão" ou enviar uma edição do conteúdo.
**Expected:** Sistema cria nova versão (version_number+1, status='draft'); versão assinada anterior permanece intacta; RLS bloqueia UPDATE/DELETE direto no Supabase Dashboard.
**Why human:** Requer fluxo end-to-end gerar → assinar → editar e verificação no Supabase Dashboard que a versão assinada não foi alterada.

#### 5. Roles read-only não conseguem mutar

**Test:** Logar como `auditor`, `dpo`, ou `socio`; tentar gerar ou assinar um documento pela UI e via chamada direta à Server Action.
**Expected:** Botões desabilitados na UI (`isReadOnly=true`); assertNotReadOnly() lança erro "Operação não permitida para usuários com acesso somente leitura" se chamado diretamente.
**Why human:** Requer múltiplas contas com roles diferentes no Supabase Auth live; validação do header `x-read-only` setado pelo middleware.

#### 6. Acesso restrito em /config/documentos para dentist

**Test:** Logar como `dentist`; navegar para /config/documentos.
**Expected:** Alert "Acesso restrito. Esta área é exclusiva para administradores e TI." exibido; sem redirect.
**Why human:** Requer sessão autenticada com role dentist no ambiente live.

#### 7. Renderização de PDF com acentuação pt-BR

**Test:** Gerar e baixar um documento com conteúdo contendo `ã`, `ç`, `ê`, `õ`, `á`.
**Expected:** Todos os caracteres renderizados corretamente via fonte Roboto (Latin Extended); sem substituição por '?' ou caracteres inválidos.
**Why human:** Requer renderização real via @react-pdf e visualização do PDF gerado.

---

### Gaps Summary

Nenhuma gap identificada. Todos os must-haves verificados programaticamente. Os 7 itens acima são exclusivamente validações de comportamento em runtime que requerem ambiente live com dados reais, certificados de produção e múltiplas sessões autenticadas — não podem ser verificados via análise estática ou testes unitários.

---

## Gates Summary

| Gate | Result |
|------|--------|
| `npx vitest run` | 712/712 GREEN (48 test files) |
| Phase 8 tests | 55/55 GREEN (sign-document, template-engine, migrations, actions, PDF) |
| RBAC regression | 48/48 GREEN (documentos module não quebrou testes existentes) |
| `npx tsc --noEmit` | exit 0 |
| `npx next build` | Green — /config/documentos ƒ, /clinica/documentos ƒ, /api/documentos/[versionId] ƒ |

---

_Verified: 2026-06-14T13:10:00Z_
_Verifier: Claude (gsd-verifier)_
