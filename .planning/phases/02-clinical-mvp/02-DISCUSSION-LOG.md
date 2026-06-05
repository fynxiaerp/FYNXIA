# Phase 2: Clinical MVP — Log de Discussão

> **Apenas para auditoria.** Não usar como input para agentes de pesquisa, planejamento ou execução.

**Data:** 2026-06-05
**Fase:** 02-clinical-mvp
**Áreas discutidas:** Agenda, Odontograma/Prontuário/Ficha, Anamnese Digital, CPF e Dados Sensíveis

---

## Agenda (CLINIC-01, 02, 09)

| Opção | Selecionado |
|-------|-------------|
| FullCalendar free (dropdown por dentista) | ✓ |
| FullCalendar Scheduler (~$500/ano) | |
| Lista/tabela | |

| Opção | Selecionado |
|-------|-------------|
| Slots de 30 minutos | |
| 1 hora fixo | |
| Duração livre configurável | ✓ |

| Opção | Selecionado |
|-------|-------------|
| 5 status (agendado, confirmado, em_atendimento, concluido, cancelado) | ✓ |
| 3 status simplificado | |

| Opção | Selecionado |
|-------|-------------|
| Fila de confirmação para agendamento público | |
| Agendamento direto (GIST bloqueia conflito) | ✓ |

---

## Ficha do Paciente (CLINIC-03, 04, SEC-04)

| Opção | Selecionado |
|-------|-------------|
| Sem foto no MVP | ✓ |
| Foto opcional (Supabase Storage) | |

| Opção | Selecionado |
|-------|-------------|
| Botão 'Arquivar' (soft delete) | |
| Botão 'Excluir' que anonimiza | ✓ |

---

## Odontograma (CLINIC-06)

| Opção | Selecionado |
|-------|-------------|
| SVG customizado React | ✓ |
| Grid/tabela de dentes | |
| Biblioteca npm | |

| Opção | Selecionado |
|-------|-------------|
| 4 status básicos | |
| 8+ status completos | ✓ |

| Opção | Selecionado |
|-------|-------------|
| Rastrear histórico por dente | ✓ |
| Apenas estado atual | |

| Opção | Selecionado |
|-------|-------------|
| Apenas dentista edita | |
| Admin e dentista editam | ✓ |

---

## Prontuário (CLINIC-05, 07)

| Opção | Selecionado |
|-------|-------------|
| Textarea simples | |
| Rich text (TipTap) | |
| Campos estruturados (diagnóstico, plano, prescrição) | ✓ |

| Opção | Selecionado |
|-------|-------------|
| Todos os dentistas da clínica | ✓ |
| Apenas o dentista que criou | |

| Opção | Selecionado |
|-------|-------------|
| Não na Fase 2 | |
| PDF do prontuário na Fase 2 | ✓ |

---

## Anamnese Digital (CLINIC-08)

| Opção | Selecionado |
|-------|-------------|
| D4Sign (ICP-Brasil) | |
| Canvas de assinatura manuscrita + hash | ✓ |
| Checkbox LGPD + timestamp | |

| Opção | Selecionado |
|-------|-------------|
| Paciente preenche online (link público) | |
| Recepcionista preenche presencialmente | |
| Ambos os fluxos | ✓ |

| Opção | Selecionado |
|-------|-------------|
| Formulário fixo padrão CFO | ✓ |
| Customizável por clínica | |

| Opção | Selecionado |
|-------|-------------|
| Assinatura canvas obrigatória | ✓ |
| Opcional | |

---

## CPF e Dados Sensíveis

| Opção | Selecionado |
|-------|-------------|
| CPF plaintext com índice (busca eficiente) | ✓ |
| CPF AES-256 criptografado | |

| Opção | Selecionado |
|-------|-------------|
| Apenas dados de saúde criptografados | |
| CPF + dados de saúde criptografados | ✓ |

**Nota de reconciliação:** User escolheu CPF plaintext (D-06) para busca eficiente E CPF na lista de campos criptografados (D-07). CONTEXT.md adota CPF plaintext (D-06 tem precedência por ser mais específico sobre busca); apenas medical_history, allergies, medications são criptografados.

---

## Discretion do Claude
- Numeração FDI de dentes
- Schema exato de appointments
- Estrutura de componentes FullCalendar
- Validação Zod dos formulários
- Cores dos status do odontograma

## Ideias Diferidas
- FullCalendar Scheduler (Scheduler, multi-dentista paralelo)
- D4Sign / ICP-Brasil
- Customização de anamnese por clínica
- Foto do paciente
- Módulo de estoque
