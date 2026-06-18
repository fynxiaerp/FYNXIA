# Phase 12: Receituário & Teleodontologia - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-18
**Phase:** 12-receitu-rio-teleodontologia
**Areas discussed:** Base de medicamentos, Validação de alergia, Vídeo da teleconsulta, Documentos clínicos & numeração & Portal

---

## Base de medicamentos (DCB/DCI)

| Option | Description | Selected |
|--------|-------------|----------|
| Subconjunto curado (~100-200) | Seed dos medicamentos odontológicos comuns, tabela própria com classe/alérgeno marcado; habilita match de alergia; cresce sob demanda | ✓ |
| Dataset DCB completo (ANVISA) | Importar lista DCB inteira via ETL; máxima cobertura, mais esforço, sem classe de alergia | |
| Texto livre + autocomplete | Sem base fixa; autocomplete dos já usados; mínimo esforço, sem padronização nem base p/ alergia | |

**User's choice:** Subconjunto curado (~100-200) — recomendado
**Notes:** A marcação de classe/alérgeno por item é o que liga RX-01 ao match de alergia (RX-02).

---

## Validação de alergia (RX-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Alerta suave não-bloqueante | Casa nome/classe do medicamento contra alergia texto-livre do paciente + flags da anamnese; aviso destacado, dentista confirma; sem modelo novo pesado | ✓ |
| Lista estruturada de alérgenos | Nova tabela de alergias (alérgeno + classe) p/ match determinístico; mais escopo, exige recadastro | |
| Só exibir alergias (manual) | Mostra alergias na tela de emissão, sem casar automaticamente | |

**User's choice:** Alerta suave não-bloqueante — recomendado
**Notes:** Preserva a autonomia clínica do dentista; aproveita a classe marcada na base curada.

---

## Vídeo da teleconsulta (TEL-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Link externo + consentimento registrado | Link de reunião (Meet/Zoom/Jitsi); FYNXIA registra consentimento CFO, início/fim, link e SOAP; sem infra de mídia | ✓ |
| Vídeo nativo WebRTC (provedor) | Daily/Twilio embutido; melhor UX, mais infra/custo/escopo LGPD | |
| Jitsi embed (sem custo/min) | Sala Jitsi embutida; infra a manter, menos garantias SLA/LGPD | |

**User's choice:** Link externo + consentimento registrado — recomendado
**Notes:** Entrega TEL-01/02 sem assumir infra/custo/risco LGPD de mídia nativa.

---

## Documentos clínicos, numeração & Portal (RX-01/RX-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Receita simples+controle especial, atestado, solicitação de exame; número por clínica+tipo; flag portal | Cobre leque clínico RX-01/03; numeração sequencial por clínica+tipo; flag visível-no-portal agora, UI portal na Fase 20; ICP reusa Fase 8 | ✓ |
| Só receitas nesta fase | Apenas receita simples + controle especial; atestado/exame depois | |
| Você decide o conjunto | Claude escolhe conjunto + numeração | |

**User's choice:** Conjunto completo + numeração por clínica+tipo + flag portal — recomendado
**Notes:** UI de consumo no Portal do Paciente é a Fase 20; aqui só a flag de visibilidade.

## Claude's Discretion

- Estrutura/colunas/índices das migrations; enums de tipo de documento e status de teleconsulta.
- Formato da tabela de medicamentos + tags de classe/alérgeno; algoritmo de match textual tolerante.
- Layout das telas; geração atômica da numeração sequencial por tenant+tipo.

## Deferred Ideas

- UI do Portal do Paciente (Fase 20); vídeo nativo WebRTC/Jitsi self-host; dataset DCB completo; lista estruturada de alérgenos; TISS de receituário.
