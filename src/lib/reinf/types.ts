/**
 * src/lib/reinf/types.ts — ReinfProvider abstraction (TRIB-03)
 *
 * Pure type definitions — no 'server-only' so tests and type consumers can import directly.
 * No credentials, no runtime secrets here.
 *
 * Mirrors src/lib/fiscal/types.ts pattern (OS-02).
 * See RESEARCH §"Padrão 2 ReinfProvider" lines 225-252.
 */

export interface ReinfEventInput {
  tipo: 'R2010' | 'R4020'     // eventos relevantes para esta fase
  competencia: string          // 'YYYY-MM'
  clinic_id: string
  // R-2010: retenção INSS sobre serviços tomados
  prestador_cnpj?: string
  prestador_nome?: string
  valor_bruto?: number
  valor_retencao_inss?: number
  // R-4020: IRRF/CSLL/PIS/COFINS retidos sobre PJ
  beneficiario_cnpj?: string
  valor_retencao_irrf?: number
  idempotency_key: string
}

export interface ReinfEventResult {
  provider_ref: string
  status: 'pendente' | 'transmitido' | 'erro'
  protocolo?: string
  error_message?: string
}

export interface ReinfProvider {
  transmitir(input: ReinfEventInput): Promise<ReinfEventResult>
  consultar(provider_ref: string): Promise<ReinfEventResult>
  retificar(provider_ref: string, input: ReinfEventInput): Promise<ReinfEventResult>
}
