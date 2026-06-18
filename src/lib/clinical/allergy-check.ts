/**
 * checkMedicationAllergy — PURE function (RX-02)
 *
 * Cross-references a medication's allergen tags + name against:
 *   (a) the patient's decrypted free-text allergy field (patientAllergiesPlaintext)
 *   (b) anamnesis boolean flags (alergia_medicamento, alergia_anestesia)
 *
 * PURE — no server directives, no server-only, no Supabase import.
 * Importable by both Server Actions and (theoretically) shared contexts.
 *
 * The decrypt step happens upstream in the Server Action (Plan 04):
 *   const plaintext = await decrypt(patient.allergies)
 *   const alert = checkMedicationAllergy({ ..., patientAllergiesPlaintext: plaintext })
 *
 * Match is accent + case insensitive via NFD normalization (A3 in RESEARCH).
 * Never throws on null/empty input.
 *
 * Phase: 12-receitu-rio-teleodontologia / Plan 02
 * Requirements: RX-02
 */

/**
 * Normalize a string for tolerant comparison:
 * - NFD decompose Unicode characters (splits base char + combining diacritic)
 * - Strip combining diacritical marks (U+0300–U+036F range)
 * - Lowercase + trim
 *
 * Examples:
 *   norm('Penicilina')  → 'penicilina'
 *   norm('penicilína')  → 'penicilina'
 *   norm('AMOXICILINA') → 'amoxicilina'
 */
const norm = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export function checkMedicationAllergy(params: {
  medicationName: string
  therapeuticClass: string
  allergenTags: string[]
  patientAllergiesPlaintext: string | null
  anamnesisFlags: { alergia_medicamento: boolean; alergia_anestesia: boolean }
}): { hasAlert: boolean; reasons: string[] } {
  const {
    medicationName,
    therapeuticClass,
    allergenTags,
    patientAllergiesPlaintext,
    anamnesisFlags,
  } = params

  const reasons: string[] = []

  // (1) Anamnesis flag: patient declared general medication allergy
  if (anamnesisFlags.alergia_medicamento) {
    reasons.push('Paciente declarou alergia a medicamentos na anamnese')
  }

  // (2) Anamnesis flag: patient declared local anesthetic allergy
  //     Only triggers when the medication IS a local anesthetic
  if (anamnesisFlags.alergia_anestesia && therapeuticClass === 'anestesico_local') {
    reasons.push('Paciente declarou alergia a anestesia local na anamnese')
  }

  // (3) Text match: allergen tags against the decrypted free-text allergy field
  const allergiesNorm = patientAllergiesPlaintext ? norm(patientAllergiesPlaintext) : ''

  if (allergiesNorm) {
    for (const tag of allergenTags) {
      if (allergiesNorm.includes(norm(tag))) {
        reasons.push(`Possível alergia a ${tag} (campo de alergias do paciente)`)
      }
    }

    // (4) Text match: medication name itself against the allergy field
    if (allergiesNorm.includes(norm(medicationName))) {
      reasons.push(`Medicamento "${medicationName}" mencionado no campo de alergias`)
    }
  }

  return { hasAlert: reasons.length > 0, reasons }
}
