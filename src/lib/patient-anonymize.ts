// ─── buildAnonymizedPatch ────────────────────────────────────────────────────
// Pure deterministic helper (NOT a Server Action) — used in tests and in the
// anonymizePatient Server Action. Lives in lib/ (not in a 'use server' module)
// because Next.js requires every export of a 'use server' file to be an async
// function; this pure builder must stay importable from both server and tests.
// D-08: LGPD anonymization — name/CPF/phone/email replaced with generic values;
// address and health fields set to null. Preserves medical_records/dental_records/anamneses.
export function buildAnonymizedPatch() {
  return {
    full_name: 'Paciente Excluído',
    cpf: '000.000.000-00',
    phone: '(00) 00000-0000',
    email: 'anonimizado@excluido.local',
    address: null,
    medical_history: null,
    allergies: null,
    medications: null,
    is_anonymized: true,
    deleted_at: new Date().toISOString(),
  }
}
