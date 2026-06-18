# Phase 12: Receituário & Teleodontologia - Context

**Gathered:** 2026-06-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Abrir os documentos clínicos assinados + a teleodontologia, sobre o prontuário v1 e a assinatura ICP da Fase 8:
1. **Receituário (RX-01..03):** dentista emite receita (simples / controle especial), atestado e solicitação de exame, com medicamento de uma base curada DCB/DCI + posologia; o sistema **alerta** se o medicamento conflita com uma alergia do paciente; o documento é **assinado com ICP-Brasil**, **numerado sequencialmente** e marcado como visível no Portal do Paciente.
2. **Teleodontologia (TEL-01..02):** dentista realiza teleconsulta/teleorientação via **link de reunião externo**, com **consentimento da sessão (CFO)** registrado; a sessão gera **registro SOAP no prontuário** e permite emitir documentos clínicos na hora.

**Fora do escopo:** UI do Portal do Paciente (Fase 20 — aqui só a flag/visibilidade); vídeo nativo WebRTC; importação do dataset DCB completo da ANVISA; integração TISS de receituário.
</domain>

<decisions>
## Implementation Decisions

### Base de medicamentos (D-01)
- **Subconjunto CURADO (~100-200 itens)** em tabela própria (`medications` ou similar): seed dos medicamentos odontológicos mais comuns (analgésicos, AINEs, antibióticos, anestésicos locais, medicamentos de controle especial).
- Cada item carrega **classe terapêutica + alérgeno/tag** (ex: penicilina, AINE, dipirona, sulfa) — é essa marcação que habilita o match de alergia (D-02).
- Base cresce sob demanda; NÃO importar o dataset DCB completo da ANVISA nesta fase.

### Validação de alergia (D-02) — RX-02
- **Alerta suave NÃO-bloqueante** ao emitir: casa nome/classe do medicamento contra (a) o campo de **alergia texto-livre** do paciente (cadastro) + (b) as **flags da anamnese** (`alergia_medicamento`, `alergia_anestesia`).
- Exibe aviso destacado; o dentista **confirma e segue** (não trava a emissão). Sem nova tabela estruturada de alérgenos nesta fase.
- O match usa a classe/tag marcada na base curada (D-01) + comparação textual tolerante (case/acento-insensível).

### Vídeo da teleconsulta (D-03) — TEL-01
- **Link de reunião EXTERNO** (Meet/Zoom/Jitsi público): o dentista informa/cola o link; FYNXIA NÃO hospeda mídia.
- FYNXIA registra: **consentimento da sessão (CFO)**, início/fim da teleconsulta, o link e os metadados — tudo no prontuário/atendimento.
- Sem infra de vídeo nativo (WebRTC/Daily/Twilio) e sem Jitsi self-host nesta fase.

### Documentos clínicos, numeração & Portal (D-04) — RX-01/RX-03
- Conjunto no escopo: **receita simples, receita de controle especial, atestado, solicitação de exame**.
- **Numeração sequencial por clínica + por tipo de documento** (cada tipo tem sua própria sequência dentro do tenant).
- **Assinatura ICP-Brasil reusa a engine da Fase 8** (`signPdfBuffer` / `SignatureResult`; status `draft`→`signed` imutável).
- Cada documento recebe uma **flag "visível no portal"** agora; a UI de consumo no Portal do Paciente é a **Fase 20** (não construir o portal aqui).

### TEL-02 (SOAP)
- A teleconsulta gera um **registro SOAP** no prontuário (Subjetivo/Objetivo/Avaliação/Plano) — estende o prontuário da Fase 2; documentos emitidos durante a sessão ficam vinculados ao atendimento.

### Claude's Discretion
- Estrutura/colunas/índices das migrations (sempre indexar clinic_id + unit_id quando aplicável); enums de tipo de documento e de status da teleconsulta.
- Formato exato da tabela de medicamentos e das tags de alergia/classe; o algoritmo de match textual tolerante.
- Layout das telas (emissão de receita/atestado/exame, tela de teleconsulta + consentimento, editor SOAP), seguindo o design system v1, @base-ui render-prop, tokens, RHF+Zod v3, pt-BR.
- Como a numeração sequencial é gerada de forma atômica (sequência por tenant+tipo) sem corrida.
- Reaproveitar ao máximo a engine de documentos/assinatura (Fase 8) e o PDF (`@react-pdf/renderer`).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spec & roadmap
- `.planning/MODULES-SPEC-v2.md` — Módulo de Receituário (receita/atestado/exame, DCB/DCI, alergia) e Teleodontologia (consentimento CFO, SOAP).
- `.planning/ROADMAP.md` §"Phase 12" — goal, success criteria, dependências.
- `.planning/REQUIREMENTS.md` — RX-01, RX-02, RX-03, TEL-01, TEL-02.

### Assinatura ICP & engine de documentos (Fase 8 — REUSAR)
- `src/lib/icp/sign-document.ts` — `signPdfBuffer` → `SignatureResult` (SHA-256 + RSA-2048 + carimbo).
- `src/lib/documents/document-types.ts` — `DocumentContext`, `DocumentStatus` (`draft`→`signed` imutável), `SignatureResult`.
- `src/lib/documents/template-engine.ts` — `fillTemplate()` (substituição de variáveis {{...}}).
- `src/lib/icp/pfx-metadata.ts` — leitura de metadados do certificado A1.
- `src/app/(dashboard)/clinica/documentos/page.tsx` — fluxo de documentos v1 (gerar/assinar/versão imutável).

### Prontuário, anamnese & alergias (Fase 2)
- `src/app/(dashboard)/clinica/pacientes/[id]/prontuario/page.tsx` — prontuário (destino do SOAP).
- `src/lib/validators/anamnesis.ts` — flags `alergia_medicamento` / `alergia_anestesia`.
- `src/components/patients/PatientForm.tsx` §"Alergias" — campo de alergia texto-livre do paciente.

### Profissionais / CRO (Fase 11)
- `professionals` (CRO+UF) — assinante da receita; `DocumentContext.cro_profissional`.

### Convenções
- `CLAUDE.md` — RLS USING+WITH CHECK; index clinic_id; 'use server' async-only; nodejs runtime; `@react-pdf/renderer` (Flexbox, sem CSS Grid); gen types temp-file guard; deploy master+master:main.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Engine de assinatura ICP + documentos imutáveis (Fase 8)** — base direta para RX-03 (assinar/numerar/imutabilizar).
- **`@react-pdf/renderer` + DocumentoPDF (Fase 8)** — modelo de PDF para receita/atestado/exame.
- **Prontuário/anamnese (Fase 2)** — destino do SOAP (TEL-02) e fonte das flags de alergia (RX-02).
- **Campo Alergias do paciente (Fase 2)** — fonte texto-livre para o alerta de alergia.
- **professionals/CRO (Fase 11)** — assinante e dados do cabeçalho do documento.
- **Padrão de módulo no proxy + nav string-key (Fases 7-11)** — registrar receituário/teleodonto.

### Established Patterns
- Numeração sequencial: seguir o padrão de `numero_documento` já existente na engine de documentos (Fase 8), estendendo para sequência por clínica+tipo.
- 'use server' async-only; createAdminClient server-only; RSC sem funções→client; RLS USING+WITH CHECK + index clinic_id; [BLOCKING] db push único + gen types guard; deploy master+master:main.

### Integration Points
- Novas tabelas: base de medicamentos curada, documentos clínicos (receita/atestado/exame) ou extensão da tabela de documentos da Fase 8, sessões de teleconsulta + consentimento, registro SOAP (extensão do prontuário).
- Tela de emissão reusa a assinatura ICP; tela de teleconsulta registra consentimento + link + gera SOAP.
- Módulos receituário/teleodonto no proxy + nav.
</code_context>

<specifics>
## Specific Ideas

- Base de medicamentos curada com tag de classe/alérgeno é o que liga RX-01 a RX-02 (o match de alergia depende dessa marcação).
- Alerta de alergia é informativo, não bloqueante — preserva a autonomia clínica do dentista.
- Teleconsulta MVP é "link externo + registro" — entrega TEL-01/02 sem assumir infra/custo/risco LGPD de mídia nativa.
- Documento assinado fica imutável (reusa a regra da Fase 8) e marcado para o Portal (Fase 20).
</specifics>

<deferred>
## Deferred Ideas

- UI de consumo dos documentos no **Portal do Paciente** (Fase 20).
- **Vídeo nativo WebRTC** (Daily/Twilio) ou Jitsi self-host para teleconsulta.
- Importação do **dataset DCB/DCI completo** da ANVISA.
- **Lista estruturada de alérgenos** do paciente (match determinístico) — evolução futura do RX-02.
- Integração TISS/convênio do receituário.

### Reviewed Todos (not folded)
Nenhum todo pendente casou com a Fase 12.
</deferred>

---

*Phase: 12-receitu-rio-teleodontologia*
*Context gathered: 2026-06-18*
