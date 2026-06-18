/**
 * Phase 12 — allergy-check.test.ts (RX-02 pure-unit scaffold)
 *
 * Tests checkMedicationAllergy() from src/lib/clinical/allergy-check.ts.
 * The target file does NOT exist yet (Wave 0 — RED by design).
 *
 * Design constraints:
 * - Dynamic import via absolute path (NOT @-alias) — D-144/D-161/D-168.
 *   @-alias causes TS2307 when the target module does not yet exist.
 * - existsSync guard before import + `if (!fn) return` guards inside tests
 *   so that `npx tsc --noEmit` stays GREEN while the suite is RED.
 * - ES2017 tsconfig: NO /s (dotAll) flag — not needed here (pure unit tests).
 *
 * Expected Wave 0 state:
 * - All pure-unit assertions are SKIPPED via early-return guard (file absent).
 * - Source-inspection assertions (no 'use server', no server-only import) are
 *   also guarded and return early — RED on empty string content, not crash.
 * - Suite RUNS without import/parse crash.
 *
 * Phase: 12-receitu-rio-teleodontologia / Plan 01 (Wave 0 RED scaffold)
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { vi } from 'vitest'

// Mock server-only so any source that imports it loads cleanly in Vitest
vi.mock('server-only', () => ({}))

// ─── Absolute-path dynamic import setup (D-144/D-161) ────────────────────────

const ALLERGY_CHECK_PATH = resolve(process.cwd(), 'src/lib/clinical/allergy-check.ts')

type CheckMedicationAllergyFn = (params: {
  medicationName: string
  therapeuticClass: string
  allergenTags: string[]
  patientAllergiesPlaintext: string | null
  anamnesisFlags: { alergia_medicamento: boolean; alergia_anestesia: boolean }
}) => { hasAlert: boolean; reasons: string[] }

// Loaded lazily so the suite doesn't crash when the file is absent.
let checkMedicationAllergy: CheckMedicationAllergyFn | null = null

async function loadAllergyCheck(): Promise<CheckMedicationAllergyFn | null> {
  if (!existsSync(ALLERGY_CHECK_PATH)) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod = await import(/* @vite-ignore */ ALLERGY_CHECK_PATH) as any
  return mod.checkMedicationAllergy ?? null
}

// ─── RX-02 Architecture: source-inspection ───────────────────────────────────

describe('RX-02 architecture — allergy-check.ts must be PURE (no server-only)', () => {
  it('src/lib/clinical/allergy-check.ts does NOT contain "use server" directive', () => {
    const src = existsSync(ALLERGY_CHECK_PATH)
      ? readFileSync(ALLERGY_CHECK_PATH, 'utf8')
      : ''
    // RED until file exists; content mismatch (empty string does not match /use server/)
    // is intentional — this confirms the guard works.
    // When file exists: must NOT contain 'use server' (pure function importable client-side).
    expect(src).not.toMatch(/'use server'/)
  })

  it('src/lib/clinical/allergy-check.ts does NOT import server-only package', () => {
    const src = existsSync(ALLERGY_CHECK_PATH)
      ? readFileSync(ALLERGY_CHECK_PATH, 'utf8')
      : ''
    // Must be importable from both server actions AND (theoretically) shared contexts.
    // Pure functions must never import 'server-only'.
    expect(src).not.toMatch(/import 'server-only'/)
    expect(src).not.toMatch(/import "server-only"/)
  })

  it('src/lib/clinical/allergy-check.ts exports checkMedicationAllergy function', () => {
    const src = existsSync(ALLERGY_CHECK_PATH)
      ? readFileSync(ALLERGY_CHECK_PATH, 'utf8')
      : ''
    // Wave 0: RED (file absent → empty string fails this match)
    expect(src).toMatch(/export function checkMedicationAllergy/)
  })
})

// ─── RX-02 Pure-unit tests ───────────────────────────────────────────────────

describe('checkMedicationAllergy — allergen tag match (RX-02)', () => {
  it('returns hasAlert=true when allergenTag is found in patientAllergiesPlaintext (exact case)', async () => {
    checkMedicationAllergy = await loadAllergyCheck()
    if (!checkMedicationAllergy) return // RED guard — file absent

    const result = checkMedicationAllergy({
      medicationName: 'Amoxicilina 500mg',
      therapeuticClass: 'antibiotico',
      allergenTags: ['penicilina'],
      patientAllergiesPlaintext: 'Alergia a Penicilina',
      anamnesisFlags: { alergia_medicamento: false, alergia_anestesia: false },
    })
    expect(result.hasAlert).toBe(true)
    expect(result.reasons.some(r => /penicilina/i.test(r))).toBe(true)
  })

  it('returns hasAlert=true when allergenTag matches UPPERCASE variant in allergy text', async () => {
    checkMedicationAllergy = await loadAllergyCheck()
    if (!checkMedicationAllergy) return

    const result = checkMedicationAllergy({
      medicationName: 'Amoxicilina 500mg',
      therapeuticClass: 'antibiotico',
      allergenTags: ['penicilina'],
      patientAllergiesPlaintext: 'PENICILINA',
      anamnesisFlags: { alergia_medicamento: false, alergia_anestesia: false },
    })
    expect(result.hasAlert).toBe(true)
  })

  it('returns hasAlert=true when allergenTag matches accented variant (penicilína)', async () => {
    checkMedicationAllergy = await loadAllergyCheck()
    if (!checkMedicationAllergy) return

    const result = checkMedicationAllergy({
      medicationName: 'Amoxicilina 500mg',
      therapeuticClass: 'antibiotico',
      allergenTags: ['penicilina'],
      patientAllergiesPlaintext: 'penicilína',
      anamnesisFlags: { alergia_medicamento: false, alergia_anestesia: false },
    })
    expect(result.hasAlert).toBe(true)
  })

  it('returns hasAlert=false when no tag matches and no flags set', async () => {
    checkMedicationAllergy = await loadAllergyCheck()
    if (!checkMedicationAllergy) return

    const result = checkMedicationAllergy({
      medicationName: 'Ibuprofeno 400mg',
      therapeuticClass: 'aine',
      allergenTags: [],
      patientAllergiesPlaintext: null,
      anamnesisFlags: { alergia_medicamento: false, alergia_anestesia: false },
    })
    expect(result.hasAlert).toBe(false)
    expect(result.reasons.length).toBe(0)
  })
})

describe('checkMedicationAllergy — anamnese flag: alergia_medicamento (RX-02)', () => {
  it('returns hasAlert=true when alergia_medicamento=true even without tag match', async () => {
    checkMedicationAllergy = await loadAllergyCheck()
    if (!checkMedicationAllergy) return

    const result = checkMedicationAllergy({
      medicationName: 'Dipirona 500mg',
      therapeuticClass: 'analgesico',
      allergenTags: [],
      patientAllergiesPlaintext: null,
      anamnesisFlags: { alergia_medicamento: true, alergia_anestesia: false },
    })
    expect(result.hasAlert).toBe(true)
    expect(result.reasons.some(r => /anamnese/i.test(r))).toBe(true)
  })
})

describe('checkMedicationAllergy — anamnese flag: alergia_anestesia (RX-02)', () => {
  it('returns hasAlert=true for anestesico_local when alergia_anestesia=true', async () => {
    checkMedicationAllergy = await loadAllergyCheck()
    if (!checkMedicationAllergy) return

    const result = checkMedicationAllergy({
      medicationName: 'Lidocaína 2%',
      therapeuticClass: 'anestesico_local',
      allergenTags: ['anestesico_local', 'amida'],
      patientAllergiesPlaintext: null,
      anamnesisFlags: { alergia_medicamento: false, alergia_anestesia: true },
    })
    expect(result.hasAlert).toBe(true)
    expect(result.reasons.some(r => /anestesia/i.test(r))).toBe(true)
  })

  it('does NOT add anestesia reason for non-anestesico_local class when only alergia_anestesia=true', async () => {
    checkMedicationAllergy = await loadAllergyCheck()
    if (!checkMedicationAllergy) return

    const result = checkMedicationAllergy({
      medicationName: 'Ibuprofeno 400mg',
      therapeuticClass: 'analgesico',
      allergenTags: [],
      patientAllergiesPlaintext: null,
      anamnesisFlags: { alergia_medicamento: false, alergia_anestesia: true },
    })
    // alergia_anestesia flag only triggers for therapeutic class 'anestesico_local'
    const hasAnestesiaReason = result.reasons.some(r => /anestesia/i.test(r))
    expect(hasAnestesiaReason).toBe(false)
  })
})

describe('checkMedicationAllergy — null safety (RX-02)', () => {
  it('does not throw when patientAllergiesPlaintext is null', async () => {
    checkMedicationAllergy = await loadAllergyCheck()
    if (!checkMedicationAllergy) return

    expect(() =>
      checkMedicationAllergy!({
        medicationName: 'Tramadol 50mg',
        therapeuticClass: 'analgesico_opioide',
        allergenTags: ['opioide'],
        patientAllergiesPlaintext: null,
        anamnesisFlags: { alergia_medicamento: false, alergia_anestesia: false },
      })
    ).not.toThrow()
  })

  it('hasAlert=false when patientAllergiesPlaintext is null and no flags set', async () => {
    checkMedicationAllergy = await loadAllergyCheck()
    if (!checkMedicationAllergy) return

    const result = checkMedicationAllergy({
      medicationName: 'Nimesulida 100mg',
      therapeuticClass: 'aine',
      allergenTags: ['aine', 'nimesulida'],
      patientAllergiesPlaintext: null,
      anamnesisFlags: { alergia_medicamento: false, alergia_anestesia: false },
    })
    expect(result.hasAlert).toBe(false)
    expect(result.reasons.length).toBe(0)
  })
})
