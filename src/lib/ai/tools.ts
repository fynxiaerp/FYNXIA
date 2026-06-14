// src/lib/ai/tools.ts
// Read-only tenant-scoped copilot tools (AI-01, D-01, D-05)
// Uses createClient() (RLS user session) — service-role client is forbidden here (T-5-tenant)
// D-01 PII: only selects id, full_name, cpf, phone, email from patients — no health columns
// D-05 READ-ONLY enforcement: only .select() calls — no mutation methods allowed
//
// Phase 10 (AIG-01/03): each tool's execute is wrapped with withAgentPolicy to log
// EVERY decision to ai_decision_log (agentKey='copilot', sensitivity='safe').
// Open Question 1 resolution: read-only tools always execute regardless of governance
// decision (safe reads cannot cause harm). The wrap is ADDITIVE — existing behavior
// at any enabled config is unchanged.
import 'server-only'
import { tool } from 'ai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { maskCPF, maskPhone } from './masking'
import { searchHelpDocs } from './help-docs'
import { withAgentPolicy } from './policy'

// ─── Internal helper: resolve governance context from session ─────────────────

/**
 * getGovContext — resolves clinicId + actorId from the authenticated session.
 *
 * Falls back to sentinel values if session is unavailable (unauthenticated calls).
 * withAgentPolicy try/catch ensures an INSERT failure never throws out of the tool.
 */
async function getGovContext(): Promise<{ clinicId: string; actorId: string | null }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { clinicId: 'unauthenticated', actorId: null }

    const { data: userData } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    return {
      clinicId: userData?.tenant_id ?? 'unknown',
      actorId: user.id,
    }
  } catch {
    return { clinicId: 'unknown', actorId: null }
  }
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * maskEmail — keeps first character + masks local part + keeps domain.
 * Example: joao.silva@gmail.com → j***@gmail.com
 *
 * WR-01: declared above the tool definitions (rather than relying on function
 * hoisting from below) so the security-sensitive masking path stays readable and
 * is safe against a future refactor to a `const` arrow (which would TDZ-error).
 */
function maskEmail(email: string): string {
  const atIdx = email.indexOf('@')
  if (atIdx <= 0) return '***@***'
  const local = email.slice(0, atIdx)
  const domain = email.slice(atIdx) // includes @
  return `${local[0]}***${domain}`
}

/**
 * getTodayAppointments — returns appointment metadata for the authenticated tenant.
 * RLS ensures only the user's clinic appointments are returned.
 * No CPF, no health columns selected.
 *
 * Phase 10 governance wrap (additive): logs decision to ai_decision_log.
 * sensitivity='safe' → read-only tools always execute regardless of decision
 * (Open Question 1 resolution).
 */
export const getTodayAppointments = tool({
  description:
    'Busca as consultas do dia (ou de uma data específica) para a clínica autenticada. ' +
    'Retorna horário, status, nome do paciente e nome do dentista.',
  inputSchema: z.object({
    date: z
      .string()
      .optional()
      .describe('Data no formato ISO YYYY-MM-DD. Padrão: hoje.'),
  }),
  execute: async (input) => {
    const { date } = input
    const supabase = await createClient()
    const targetDate = date ?? new Date().toISOString().split('T')[0]

    const originalExecute = async () => {
      const { data: appointments, error } = await supabase
        .from('appointments')
        .select(
          'id, start_time, end_time, status, patient:patients(full_name), dentist:users(full_name)'
        )
        .gte('start_time', `${targetDate}T00:00:00`)
        .lte('start_time', `${targetDate}T23:59:59`)
        .neq('status', 'cancelado')
        .order('start_time', { ascending: true })

      if (error) {
        return { error: 'Não foi possível buscar as consultas.', appointments: [] }
      }
      return { date: targetDate, appointments: appointments ?? [] }
    }

    const { clinicId, actorId } = await getGovContext()
    const result = await withAgentPolicy(
      { clinicId, agentKey: 'copilot', actorId, action: 'copilot.getTodayAppointments', actionSensitivity: 'safe' },
      originalExecute,
    )
    // Read-only fallback: if governance returned a _policy sentinel, still execute
    if (result && typeof result === 'object' && '_policy' in result) {
      return originalExecute()
    }
    return result
  },
})

/**
 * getOverdueReceivables — returns pending receivables with due_date < today.
 * "Vencido" is derived at read-time (no stored status — D-04 schema decision).
 * CPF never returned.
 */
export const getOverdueReceivables = tool({
  description:
    'Lista os recebíveis vencidos (status pendente com vencimento antes de hoje) da clínica. ' +
    'Retorna valor, data de vencimento e nome do paciente.',
  inputSchema: z.object({}),
  execute: async (_input) => {
    const supabase = await createClient()
    const today = new Date().toISOString().split('T')[0]

    const originalExecute = async () => {
      const { data: receivables, error } = await supabase
        .from('receivables')
        .select('id, due_date, value, patient:patients(full_name)')
        .eq('status', 'pendente')
        .lt('due_date', today)
        .order('due_date', { ascending: true })

      if (error) {
        return { error: 'Não foi possível buscar os recebíveis vencidos.', receivables: [] }
      }

      const mapped = (receivables ?? []).map((r) => ({
        id: r.id,
        dueDate: r.due_date,
        value: r.value,
        patientName: (r.patient as unknown as { full_name: string } | null)?.full_name ?? 'Desconhecido',
      }))

      return { today, overdueCount: mapped.length, receivables: mapped }
    }

    const { clinicId, actorId } = await getGovContext()
    const result = await withAgentPolicy(
      { clinicId, agentKey: 'copilot', actorId, action: 'copilot.getOverdueReceivables', actionSensitivity: 'safe' },
      originalExecute,
    )
    if (result && typeof result === 'object' && '_policy' in result) {
      return originalExecute()
    }
    return result
  },
})

/**
 * getPatientSummary — returns basic patient info with PII masked.
 * CPF masked (***.***.***-XX), phone masked (keeps last 4 digits).
 * Email partially masked (first char + domain).
 * D-01: only selects id, full_name, cpf, phone, email — no health data columns sent to LLM.
 */
export const getPatientSummary = tool({
  description:
    'Busca o resumo de um paciente pelo nome (pesquisa parcial). ' +
    'Retorna nome, CPF mascarado, telefone mascarado e contagem de próximas consultas.',
  inputSchema: z.object({
    fullName: z
      .string()
      .min(2)
      .describe('Nome completo ou parcial do paciente para busca.'),
  }),
  execute: async (input) => {
    const { fullName } = input
    const supabase = await createClient()

    const originalExecute = async () => {
      // Search patient — only safe columns; no health data columns
      const { data: patients, error } = await supabase
        .from('patients')
        .select('id, full_name, cpf, phone, email')
        .ilike('full_name', `%${fullName}%`)
        .is('deleted_at', null)
        .limit(5)

      if (error) {
        return { error: 'Não foi possível buscar o paciente.', patients: [] }
      }

      if (!patients || patients.length === 0) {
        return { patients: [], message: 'Nenhum paciente encontrado com esse nome.' }
      }

      // Count upcoming appointments for each patient
      const nowIso = new Date().toISOString()

      const summaries = await Promise.all(
        patients.map(async (p) => {
          const { count } = await supabase
            .from('appointments')
            .select('id', { count: 'exact', head: true })
            .eq('patient_id', p.id)
            .gte('start_time', nowIso)
            .neq('status', 'cancelado')

          return {
            fullName: p.full_name,
            cpf: maskCPF(p.cpf ?? ''),
            phone: maskPhone(p.phone ?? ''),
            email: p.email ? maskEmail(p.email) : null,
            upcomingAppointments: count ?? 0,
          }
        })
      )

      return { patients: summaries }
    }

    const { clinicId, actorId } = await getGovContext()
    const result = await withAgentPolicy(
      { clinicId, agentKey: 'copilot', actorId, action: 'copilot.getPatientSummary', actionSensitivity: 'safe' },
      originalExecute,
    )
    if (result && typeof result === 'object' && '_policy' in result) {
      return originalExecute()
    }
    return result
  },
})

/**
 * searchHelpDocsTool — wraps searchHelpDocs to provide how-to guidance (D-03).
 * Returns curated content for usage questions about the FYNXIA system.
 */
export const searchHelpDocsTool = tool({
  description:
    'Busca documentação de ajuda e guias de uso do sistema FYNXIA. ' +
    'Use esta ferramenta para responder perguntas sobre como usar o sistema (cadastrar paciente, agendar, gerar cobrança, etc.).',
  inputSchema: z.object({
    query: z.string().describe('Pergunta ou palavra-chave sobre o uso do sistema.'),
  }),
  execute: async (input) => {
    const originalExecute = async () => searchHelpDocs(input.query)

    const { clinicId, actorId } = await getGovContext()
    const result = await withAgentPolicy(
      { clinicId, agentKey: 'copilot', actorId, action: 'copilot.searchHelpDocs', actionSensitivity: 'safe' },
      originalExecute,
    )
    if (result && typeof result === 'object' && '_policy' in result) {
      return originalExecute()
    }
    return result
  },
})
