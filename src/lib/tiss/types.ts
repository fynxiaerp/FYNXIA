/**
 * src/lib/tiss/types.ts — TissProvider interface + shared input/result types
 *
 * CONV-02: TissProvider abstraction for TISS guide + lote operations.
 * Drive XML version from insurers.tiss_version (Pitfall 4).
 *
 * Pure types file — no 'use server', no runtime code.
 *
 * Phase: 15-faturamento-nfs-e-conv-nios-tiss / Plan 07
 * Requirements: CONV-01, CONV-02, CONV-03
 */

// ─── Guide input ──────────────────────────────────────────────────────────────

export interface GuiaInput {
  /** Internal guide ID */
  guideId: string
  /** Patient wallet number (numeroBeneficiario) */
  numeroCarteira?: string | null
  /** Patient name for XML cabeçalho */
  patientName?: string | null
  /** Insurer ANS registration number */
  registroAns?: string | null
  /** Service order ID (numeroAtendimento) */
  serviceOrderId: string
  /** Date of service (ISO date string) */
  dataAtendimento?: string | null
  /** TISS XML version (from insurers.tiss_version e.g. '3.05.00') */
  tissVersion: string
  /** Line items */
  items: GuiaItemInput[]
}

export interface GuiaItemInput {
  /** TUSS procedure code */
  tussCode?: string | null
  /** Procedure description */
  description: string
  /** Quantity */
  quantity: number
  /** Unit value (BRL) */
  valorUnitario: number
  /** Total value (BRL) */
  valorTotal: number
  /** Tooth number (FDI) */
  dente?: string | null
  /** Tooth face */
  face?: string | null
}

// ─── Lote input ───────────────────────────────────────────────────────────────

export interface LoteInput {
  /** Lote DB ID */
  loteId: string
  /** Insurer info */
  insurer: {
    id: string
    registroAns?: string | null
    tissVersion: string
    cnpj?: string | null
    name: string
  }
  /** Competência period 'YYYY-MM' */
  competencia: string
  /** Guides grouped in this lote */
  guides: GuiaInput[]
}

// ─── Lote result ──────────────────────────────────────────────────────────────

export interface LoteResult {
  /** Protocol number returned by the insurer system */
  protocolo: string
  /** Status after send (usually 'em_analise' until insurer processes) */
  status: 'em_analise' | 'processando' | 'erro'
  /** Integrity hash (optional, returned by some insurer systems) */
  hash?: string
  /** Provider-specific reference for queryLote */
  provider_ref?: string
}

// ─── Provider result for createGuia ──────────────────────────────────────────

export interface GuiaResult {
  /** Provider-assigned guide reference */
  provider_ref: string
  /** Provider-assigned guide number (may override local numero_guia) */
  numero_guia: string
}

// ─── TissProvider interface ───────────────────────────────────────────────────

export interface TissProvider {
  /**
   * Submit a single guide to the insurer system.
   * Returns provider_ref and numero_guia for storage on tiss_guides.
   */
  createGuia(input: GuiaInput): Promise<GuiaResult>

  /**
   * Submit a batch (lote) of guides to the insurer.
   * Returns protocolo for storage on tiss_lotes.
   */
  sendLote(input: LoteInput | Record<string, unknown>): Promise<LoteResult>

  /**
   * Query the status of a previously submitted lote (optional).
   */
  queryLote?(providerRef: string): Promise<{ status: string; protocolo?: string }>
}
