'use server'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { logBusinessEvent } from '@/lib/audit'
import {
  sha256OfPngDataUrl,
  cfoResponsesSchema,
  type CfoResponses,
} from '@/lib/validators/anamnesis'

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

// ─── Helper: extract IP and User-Agent from incoming request headers ─────────
// LGPD/CFO: IP address and user-agent are stored in the anamnesis row as
// evidence of the signing event. They are NOT stored in audit logs (T-2-08).

async function getRequestMeta(): Promise<{ ip: string; userAgent: string }> {
  const h = await headers()
  const ip =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    h.get('x-real-ip') ??
    'unknown'
  const userAgent = h.get('user-agent') ?? 'unknown'
  return { ip, userAgent }
}

// ─── createAnamnesisToken ─────────────────────────────────────────────────────
// Staff (admin/dentist/receptionist) creates a single-use anamnesis link for a
// patient. Inserts a "pending" anamnesis row with signature_hash='PENDING' as
// a placeholder (schema requires NOT NULL). The public submitAnamnesisPublic
// action completes the row via an atomic conditional UPDATE.
//
// D-20 nuance: signature_hash='PENDING' is the pre-signature state. Immutability
// enforces AFTER signature — the single UPDATE gate (token_used_at IS NULL AND
// token_expires_at > now() AND signature_hash='PENDING') allows exactly ONE
// transition from pending to signed. After that, no further UPDATE passes the gate.

export async function createAnamnesisToken(
  patientId: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: 'Não autenticado' }
  }

  const { data: actor, error: actorError } = await supabase
    .from('users')
    .select('id, tenant_id, role')
    .eq('id', user.id)
    .single()

  if (actorError || !actor) {
    return { success: false, error: 'Usuário não encontrado' }
  }

  // Role gate: only staff may generate anamnesis links
  const staffRoles = ['admin', 'dentist', 'receptionist', 'superadmin']
  if (!staffRoles.includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente para gerar link de anamnese' }
  }

  // Use admin client to insert via service role (bypass RLS INSERT on anamneses)
  const admin = createAdminClient()

  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()

  const { data: row, error: insertError } = await admin
    .from('anamneses')
    .insert({
      tenant_id: actor.tenant_id,
      patient_id: patientId,
      signature_hash: 'PENDING',
      responses: {},
      flow: 'link_publico',
      token_expires_at: expiresAt,
    })
    .select('id, token')
    .single()

  if (insertError || !row) {
    return { success: false, error: insertError?.message ?? 'Falha ao criar token de anamnese' }
  }

  const url = `${SITE_URL}/anamnese/${patientId}/${row.token}`

  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'anamnesis.token_created',
    details: { anamnesis_id: row.id, patient_id: patientId },
  })

  return { success: true, url }
}

// ─── submitAnamnesisPublic ────────────────────────────────────────────────────
// Public Server Action (no auth session). Called from the public anamnesis page.
// Uses service-role client (createAdminClient) to bypass RLS.
//
// T-2-07: Single-use token gate via atomic conditional UPDATE:
//   WHERE token = $token
//     AND token_used_at IS NULL
//     AND token_expires_at > now()
//     AND signature_hash = 'PENDING'
// If 0 rows → invalid/expired/used → return SAME generic message (security: no distinction).
// D-20: After token_used_at is set, no subsequent UPDATE can pass this gate (immutable).

export async function submitAnamnesisPublic(
  patientId: string,
  token: string,
  responses: CfoResponses,
  signatureDataUrl: string
): Promise<{ success: boolean; error?: string }> {
  if (!token || !patientId || !signatureDataUrl) {
    return { success: false, error: 'Dados incompletos' }
  }

  // CR-02: validate `responses` against the CFO schema before persisting via
  // the service-role client (RLS bypassed). Rejects unknown keys / oversized
  // payloads so arbitrary JSON cannot be injected into a clinical record.
  const parsedResponses = cfoResponsesSchema.safeParse(responses)
  if (!parsedResponses.success) {
    return { success: false, error: 'Respostas inválidas' }
  }

  const admin = createAdminClient()
  const { ip, userAgent } = await getRequestMeta()

  // Compute SHA-256 hash of the signature PNG (CLINIC-08, D-16)
  const signatureHash = sha256OfPngDataUrl(signatureDataUrl)
  const now = new Date().toISOString()

  // Atomic conditional UPDATE — single-use gate (T-2-07)
  // Only succeeds if: token matches, not yet used, not expired, still pending
  const { data: rows, error: updateError } = await admin
    .from('anamneses')
    .update({
      signature_hash: signatureHash,
      responses: parsedResponses.data,
      ip_address: ip,
      user_agent: userAgent,
      signed_at: now,
      token_used_at: now,
      flow: 'link_publico',
    })
    .eq('token', token)
    .eq('patient_id', patientId)
    .is('token_used_at', null)
    .gt('token_expires_at', now)
    .eq('signature_hash', 'PENDING')
    .select('id, tenant_id')

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  // 0 rows returned → token invalid, expired, or already used
  // Pitfall 5 / T-2-07: same generic message — never distinguishes used vs expired
  if (!rows || rows.length === 0) {
    return {
      success: false,
      error: 'Este link de anamnese expirou ou já foi utilizado. Solicite um novo link à sua clínica.',
    }
  }

  const row = rows[0]!

  // Audit: only IDs logged — no IP/UA in audit details (T-2-08)
  await logBusinessEvent({
    tenantId: row.tenant_id,
    actorId: 'system',
    action: 'anamnesis.signed',
    details: { anamnesis_id: row.id, patient_id: patientId },
  })

  return { success: true }
}

// ─── submitAnamnesisPresencial ────────────────────────────────────────────────
// Authenticated staff flow: dentist/receptionist records the anamnesis in-office.
// Uses RLS-aware createClient() (staff JWT). INSERT-only — no pending row.
// D-20: immutable after insert (no UPDATE policy for presencial flow).

export async function submitAnamnesisPresencial(
  patientId: string,
  responses: CfoResponses,
  signatureDataUrl: string
): Promise<{ success: boolean; error?: string }> {
  if (!patientId || !signatureDataUrl) {
    return { success: false, error: 'Dados incompletos' }
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: 'Não autenticado' }
  }

  const { data: actor, error: actorError } = await supabase
    .from('users')
    .select('id, tenant_id, role')
    .eq('id', user.id)
    .single()

  if (actorError || !actor) {
    return { success: false, error: 'Usuário não encontrado' }
  }

  const staffRoles = ['admin', 'dentist', 'receptionist', 'superadmin']
  if (!staffRoles.includes(actor.role)) {
    return { success: false, error: 'Permissão insuficiente para registrar anamnese' }
  }

  // WR-01: validate responses (defense in depth — same schema as public flow).
  const parsedResponses = cfoResponsesSchema.safeParse(responses)
  if (!parsedResponses.success) {
    return { success: false, error: 'Respostas inválidas' }
  }

  const { ip, userAgent } = await getRequestMeta()
  const signatureHash = sha256OfPngDataUrl(signatureDataUrl)
  const now = new Date().toISOString()

  // WR-01: presencial flow IS authenticated AND has an RLS insert policy
  // (anamneses_staff_insert). Use the RLS-aware client so the DB-level
  // tenant-isolation WITH CHECK applies (defense in depth) — no service role.
  const { data: inserted, error: insertError } = await supabase
    .from('anamneses')
    .insert({
      tenant_id: actor.tenant_id,
      patient_id: patientId,
      signature_hash: signatureHash,
      responses: parsedResponses.data,
      ip_address: ip,
      user_agent: userAgent,
      flow: 'presencial',
      signed_at: now,
    })
    .select('id')
    .single()

  if (insertError || !inserted) {
    return { success: false, error: insertError?.message ?? 'Falha ao salvar anamnese' }
  }

  // Audit: only IDs (T-2-08)
  await logBusinessEvent({
    tenantId: actor.tenant_id,
    actorId: actor.id,
    action: 'anamnesis.signed',
    details: { anamnesis_id: inserted.id, patient_id: patientId },
  })

  return { success: true }
}
