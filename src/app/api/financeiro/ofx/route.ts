/**
 * POST /api/financeiro/ofx — OFX statement upload endpoint (FOP-02)
 *
 * Receives multipart/form-data with OFX file + bankAccountId, delegates
 * parsing to the pure lib (parseOfxBuffer) and import to the bank-statements
 * Server Action (importOFX).
 *
 * Security / Threats:
 *   T-16-30: Rejects file.size > 5MB (413) before bufferising.
 *   T-16-31: Role gate + bank_account ownership check via RLS (clinic_id sourced from actor).
 *   T-16-33: Writer gate — only admin/superadmin may import statements.
 *   NEVER parses OFX here — all extraction is in the pure lib.
 *
 * Runtime: nodejs (OFX files can exceed Edge 1MB limit — RESEARCH Pitfall OFX).
 */

// CRITICAL: Node.js runtime required — OFX can exceed Edge 1MB limit
export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { importOFX } from '@/actions/bank-statements'

const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5MB (T-16-30)

const WRITER_ROLES = ['admin', 'superadmin'] as const

export async function POST(request: Request) {
  // ── 1. Auth gate ─────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  // ── 2. Role gate (T-16-33) ────────────────────────────────────────────────────
  const { data: userRow, error: userError } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (userError || !userRow) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 403 })
  }

  if (!(WRITER_ROLES as readonly string[]).includes(userRow.role)) {
    return NextResponse.json(
      { error: 'Sem permissão para importar extrato' },
      { status: 403 }
    )
  }

  // ── 3. Parse multipart form ───────────────────────────────────────────────────
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 })
  }

  const file = form.get('file') as File | null
  const bankAccountId = String(form.get('bankAccountId') ?? '').trim()

  // ── 4. Input validation ───────────────────────────────────────────────────────
  if (!file) {
    return NextResponse.json({ error: 'Campo "file" é obrigatório' }, { status: 400 })
  }

  // UUID format check
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!bankAccountId || !UUID_RE.test(bankAccountId)) {
    return NextResponse.json({ error: 'bankAccountId deve ser um UUID válido' }, { status: 400 })
  }

  // T-16-30: Reject oversized files before bufferising (DoS guard)
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'Arquivo OFX excede 5MB' }, { status: 413 })
  }

  // ── 5. Ownership check via RLS (T-16-31) ────────────────────────────────────
  // RLS enforces clinic_id scoping — if the bank_account doesn't belong to the
  // user's tenant, the query returns 0 rows.
  const { data: account } = await supabase
    .from('bank_accounts')
    .select('id')
    .eq('id', bankAccountId)
    .single()

  if (!account) {
    return NextResponse.json({ error: 'Conta bancária não encontrada' }, { status: 404 })
  }

  // ── 6. Bufferise + delegate to Server Action ─────────────────────────────────
  const buffer = Buffer.from(await file.arrayBuffer())

  const result = await importOFX({ bankAccountId, filename: file.name, buffer })

  return NextResponse.json(result, { status: result.success ? 200 : 400 })
}
