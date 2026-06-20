/**
 * src/lib/fiscal/types.ts — FiscalProvider abstraction (OS-02)
 *
 * Pure type definitions — no 'server-only' so tests and client-facing type
 * consumers can import without issues. No NEXT_PUBLIC_ credentials here.
 *
 * SECURITY:
 *   T-15-19: tomador_cpf is sent only to aggregator over HTTPS (in provider.emit),
 *            never stored in nfse_records or returned to the client.
 *   T-15-21: aliquota_iss sourced from unit_fiscal_config/service override only —
 *            never from user-supplied input.
 */

export interface NfseInput {
  // Emitente (from unit fiscal config)
  prestador_cnpj: string
  prestador_inscricao_municipal: string
  prestador_codigo_municipio: string   // IBGE code (7 digits)
  // Tomador (from patient — CPF sent only to aggregator, NEVER stored)
  tomador_cpf: string
  tomador_nome: string
  tomador_email?: string
  // Serviço
  discriminacao: string                // full description of services
  valor_servicos: number               // NUMERIC(12,2)
  item_lista_servico: string           // e.g. "11.02" (dental services LC 116)
  codigo_tributario_municipio?: string
  aliquota_iss: number                 // e.g. 0.05 for 5%
  iss_retido: boolean
  // Control
  natureza_operacao: '1' | '2' | '3' | '4' | '5' | '6'
  optante_simples_nacional: boolean
  regime_especial_tributacao?: string
  // Idempotency
  idempotency_key: string              // `nfse:os:${service_order_id}`
}

export interface NfseResult {
  provider_ref: string                 // aggregator's reference id
  numero?: string                      // assigned number (null while processando)
  serie?: string
  status: 'processando' | 'emitida' | 'cancelada' | 'erro'
  xml_url?: string                     // available after emitida
  pdf_url?: string
  error_message?: string
}

export interface FiscalProvider {
  emit(input: NfseInput): Promise<NfseResult>
  query(provider_ref: string): Promise<NfseResult>
  cancel(provider_ref: string, motivo: string): Promise<{ success: boolean }>
}
