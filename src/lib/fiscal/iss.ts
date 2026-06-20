/**
 * src/lib/fiscal/iss.ts — ISS calculation helpers (D-25, Pitfall 3/7)
 *
 * Pure functions — no 'server-only', importable by tests and server-side code.
 * No NEXT_PUBLIC_ references. No external dependencies.
 *
 * SECURITY / CORRECTNESS:
 *   T-15-21: computeIss uses integer-cent math to prevent float drift
 *            (e.g., 1200 * 0.05 === 60, not 59.99999...)
 *   Pitfall 3: Math.round(Math.round(valorServicos*100) * aliquota) / 100
 *   Pitfall 7: resolveAliquota uses ?? so 0 override is respected (not falsy-checked)
 */

/**
 * Compute ISS value with integer-cent precision.
 * Pitfall 3: do NOT use valorServicos * aliquota directly (float drift).
 *
 * @param valorServicos - service total in BRL (e.g. 1200.00)
 * @param aliquota      - ISS rate as decimal (e.g. 0.05 for 5%)
 * @returns             - ISS amount rounded to 2 decimal places (e.g. 60.00)
 */
export function computeIss(valorServicos: number, aliquota: number): number {
  // Integer-cent math (Pitfall 3):
  //   1. Round valorServicos to cents to eliminate input float noise
  //   2. Multiply cents by aliquota and round to integer cents of ISS
  //   3. Convert back to BRL via toFixed(2) + parseFloat to guarantee
  //      exactly 2 decimal places with no IEEE-754 drift (e.g. 1667/100
  //      in JS can be 16.670000000000002 without the toFixed guard)
  const centavos = Math.round(valorServicos * 100)
  const issCentavos = Math.round(centavos * aliquota)
  return parseFloat((issCentavos / 100).toFixed(2))
}

/**
 * Resolve the ISS aliquota for a service item.
 * Pitfall 7: service.aliquota_iss_override takes precedence over unit default.
 * Uses ?? not || so 0% override is respected.
 *
 * @param service    - service record with optional per-service override
 * @param unitConfig - unit fiscal config with the clinic-wide default rate
 * @returns          - resolved aliquota as decimal
 */
export function resolveAliquota(
  service: { aliquota_iss_override?: number | null },
  unitConfig: { aliquota_iss_padrao: number }
): number {
  return service.aliquota_iss_override ?? unitConfig.aliquota_iss_padrao
}

/**
 * Compute valor líquido (net service value after ISS retention).
 *
 * @param valorServicos - gross service total
 * @param valorIss      - computed ISS amount
 * @param issRetido     - true if ISS is retained by the tomador (withheld)
 * @returns             - net amount the prestador receives
 */
export function computeValorLiquido(
  valorServicos: number,
  valorIss: number,
  issRetido: boolean
): number {
  return issRetido ? valorServicos - valorIss : valorServicos
}
