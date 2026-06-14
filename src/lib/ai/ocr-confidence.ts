// src/lib/ai/ocr-confidence.ts
// OCR confidence gating — pure helpers (NO server-only import).
// Kept free of server imports so unit tests can import this file directly
// without loading the route (which depends on 'ai', Supabase, server-only).
//
// OCR-02: Extractions with any field below OCR_CONFIDENCE_THRESHOLD are
// routed to the pending_review queue before the data reaches the patient form.

/** Default confidence threshold. Any field below this triggers human review. */
export const OCR_CONFIDENCE_THRESHOLD = 0.80

/**
 * needsReview — returns true if ANY field's confidence is strictly below the threshold.
 *
 * @param fields   Per-field extraction map: { fieldName: { value, confidence } }
 * @param threshold  Optional override; defaults to OCR_CONFIDENCE_THRESHOLD (0.80).
 *
 * Behaviour:
 *   - all fields >= threshold → false (approved, no review needed)
 *   - any field  <  threshold → true  (route to pending_review)
 *   - empty map               → false (nothing to review)
 *   - field exactly AT threshold → false (not below, no review)
 */
export function needsReview(
  fields: Record<string, { confidence: number }>,
  threshold: number = OCR_CONFIDENCE_THRESHOLD,
): boolean {
  return Object.values(fields).some((f) => f.confidence < threshold)
}

/**
 * minConfidence — returns the lowest confidence across all fields.
 * Returns 1 (perfect) when fields is empty (no fields → no uncertainty).
 */
export function minConfidence(fields: Record<string, { confidence: number }>): number {
  const values = Object.values(fields)
  if (values.length === 0) return 1
  return Math.min(...values.map((f) => f.confidence))
}
