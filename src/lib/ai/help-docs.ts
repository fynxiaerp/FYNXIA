// src/lib/ai/help-docs.ts
// Curated help/FAQ content for the FYNXIA copilot (D-03)
// The copilot uses searchHelpDocs to answer how-to questions about system usage
import 'server-only'

export interface HelpDoc {
  id: string
  topic: string
  keywords: string[]
  content: string
}

/**
 * HELP_DOCS — curated pt-BR how-to entries, one per major module.
 * Content is read-only guidance — never instructs the copilot to take actions.
 */
export const HELP_DOCS: HelpDoc[] = [
  {
    id: 'cadastrar-paciente',
    topic: 'Cadastrar Paciente',
    keywords: ['cadastrar', 'paciente', 'novo paciente', 'criar paciente', 'adicionar paciente', 'cpf', 'ficha'],
    content:
      'Para cadastrar um novo paciente, acesse o menu Pacientes no painel lateral e clique em "Novo Paciente". ' +
      'Preencha o nome completo, CPF, telefone e e-mail. ' +
      'Após salvar, o paciente estará disponível para ser vinculado a consultas e cobranças.',
  },
  {
    id: 'criar-remarcar-consulta',
    topic: 'Criar ou Remarcar Consulta',
    keywords: ['consulta', 'agendar', 'agendamento', 'remarcar', 'reagendar', 'agenda', 'horário', 'dentista'],
    content:
      'Na tela de Agenda, clique em um horário disponível para criar uma nova consulta. ' +
      'Selecione o paciente, o dentista e o tipo de procedimento. ' +
      'Para remarcar, clique na consulta existente e use o botão "Remarcar" para escolher o novo horário.',
  },
  {
    id: 'registrar-prontuario',
    topic: 'Registrar Prontuário',
    keywords: ['prontuário', 'prontuario', 'atendimento', 'registro', 'evolução', 'evoluçao', 'notas clínicas', 'notas clinicas'],
    content:
      'Após o atendimento, acesse o prontuário do paciente em Pacientes → selecione o paciente → aba Prontuário. ' +
      'Clique em "Nova Evolução", registre o procedimento realizado e salve. ' +
      'Todos os registros são auditados e não podem ser alterados após o salvamento.',
  },
  {
    id: 'usar-odontograma',
    topic: 'Usar o Odontograma',
    keywords: ['odontograma', 'dente', 'dentes', 'tratamento dental', 'superfície', 'superficies', 'status dental'],
    content:
      'O odontograma está disponível no prontuário do paciente, aba Odontograma. ' +
      'Clique em um dente para registrar o status (hígido, cariado, restaurado, extraído etc.) e o tipo de intervenção. ' +
      'O histórico de alterações é preservado para auditoria.',
  },
  {
    id: 'gerar-cobranca',
    topic: 'Gerar Cobrança (Pix, Boleto ou Cartão)',
    keywords: ['cobrança', 'cobranca', 'pix', 'boleto', 'cartão', 'cartao', 'pagamento', 'fatura', 'gerar cobrança', 'nova cobrança'],
    content:
      'Acesse Financeiro → Nova Cobrança e selecione o paciente. ' +
      'Escolha o valor, a forma de pagamento (Pix, Boleto ou Cartão de Crédito) e o vencimento. ' +
      'Para Pix, o QR Code é gerado automaticamente via Asaas; para Boleto, o link é enviado ao paciente.',
  },
  {
    id: 'ver-fluxo-de-caixa',
    topic: 'Ver Fluxo de Caixa',
    keywords: ['fluxo de caixa', 'fluxo', 'caixa', 'receitas', 'despesas', 'financeiro', 'saldo', 'lançamentos'],
    content:
      'O fluxo de caixa está em Financeiro → Fluxo de Caixa. ' +
      'Você verá o resumo de entradas e saídas do período e pode filtrar por data ou categoria. ' +
      'Lançamentos manuais (receitas e despesas) são adicionados pelo botão "Novo Lançamento".',
  },
  {
    id: 'regua-de-cobranca',
    topic: 'Régua de Cobrança (Lembretes Automáticos)',
    keywords: ['régua', 'regua', 'régua de cobrança', 'regua de cobranca', 'lembrete', 'inadimplente', 'vencido', 'cobrança automática', 'automático'],
    content:
      'A régua de cobrança envia lembretes automáticos via WhatsApp para pacientes com cobranças vencidas. ' +
      'Configure os dias de antecipação e reenvio em Financeiro → Régua de Cobrança. ' +
      'Os envios são registrados em log e podem ser acompanhados em tempo real.',
  },
  {
    id: 'modulos-do-sistema',
    topic: 'Módulos do Sistema FYNXIA',
    keywords: ['módulos', 'modulos', 'sistema', 'fynxia', 'o que faz', 'funcionalidades', 'visão geral', 'visao geral', 'ajuda'],
    content:
      'O FYNXIA possui os módulos: Agenda (consultas e dentistas), Pacientes (cadastro e prontuário), ' +
      'Odontograma (status dental), Financeiro (cobranças, fluxo de caixa, régua), ' +
      'Comunicações (WhatsApp automático), e IA (copiloto contextual e agentes autônomos). ' +
      'Acesse cada módulo pelo menu lateral do dashboard.',
  },
]

/**
 * searchHelpDocs — case-insensitive keyword/topic match over HELP_DOCS.
 * Returns up to 3 best matches. Empty query → [].
 * Pure function — no side effects.
 */
export function searchHelpDocs(query: string): { topic: string; content: string }[] {
  if (!query || !query.trim()) return []

  const normalizedQuery = query.toLowerCase().trim()

  // Score each doc by counting keyword/topic matches
  const scored = HELP_DOCS.map((doc) => {
    let score = 0
    // Topic match (highest weight)
    if (doc.topic.toLowerCase().includes(normalizedQuery)) score += 10
    // Exact keyword match
    for (const kw of doc.keywords) {
      if (normalizedQuery.includes(kw.toLowerCase())) score += 5
      else if (kw.toLowerCase().includes(normalizedQuery)) score += 3
    }
    return { doc, score }
  })

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => ({ topic: s.doc.topic, content: s.doc.content }))
}
