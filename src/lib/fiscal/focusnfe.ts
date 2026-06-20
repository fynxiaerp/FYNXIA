/**
 * src/lib/fiscal/focusnfe.ts — Focus NFe adapter (OS-02)
 *
 * Gated real adapter: only instantiated when credential_enc is present in
 * integration_connectors (type='nfse'). Uses fetch — no npm SDK.
 *
 * No NEXT_PUBLIC_ credentials — apiKey injected server-side by getFiscalProvider.
 * Not exercised by tests in CI (no credentials).
 *
 * SECURITY:
 *   T-15-19: tomador_cpf sent only here over HTTPS — never stored in nfse_records.
 *   T-15-20: apiKey comes from decrypted credential_enc (server-side only).
 */

import type { FiscalProvider, NfseInput, NfseResult } from './types'

const FOCUS_BASE = 'https://api.focusnfe.com.br/v2'

type FocusStatus =
  | 'processando_autorizacao'
  | 'autorizado'
  | 'cancelado'
  | 'erro_autorizacao'

function mapFocusStatus(status: FocusStatus | string): NfseResult['status'] {
  switch (status) {
    case 'processando_autorizacao': return 'processando'
    case 'autorizado':              return 'emitida'
    case 'cancelado':               return 'cancelada'
    case 'erro_autorizacao':        return 'erro'
    default:                        return 'processando'
  }
}

export class FocusNfeFiscalProvider implements FiscalProvider {
  constructor(
    private readonly apiKey: string,
    private readonly config: Record<string, unknown> | null
  ) {}

  async emit(input: NfseInput): Promise<NfseResult> {
    const body = {
      data_emissao: new Date().toISOString(),
      natureza_operacao: input.natureza_operacao,
      optante_simples_nacional: input.optante_simples_nacional,
      regime_especial_tributacao: input.regime_especial_tributacao ?? '6',
      prestador: {
        cnpj: input.prestador_cnpj,
        inscricao_municipal: input.prestador_inscricao_municipal,
        codigo_municipio: input.prestador_codigo_municipio,
      },
      tomador: {
        cpf: input.tomador_cpf,
        razao_social: input.tomador_nome,
        ...(input.tomador_email ? { email: input.tomador_email } : {}),
      },
      servico: {
        valor_servicos: input.valor_servicos,
        iss_retido: input.iss_retido,
        aliquota: input.aliquota_iss,
        item_lista_servico: input.item_lista_servico,
        discriminacao: input.discriminacao,
        codigo_municipio: input.prestador_codigo_municipio,
        ...(input.codigo_tributario_municipio
          ? { codigo_tributario_municipio: input.codigo_tributario_municipio }
          : {}),
      },
    }

    let res: Response
    try {
      res = await fetch(
        `${FOCUS_BASE}/nfse?ref=${encodeURIComponent(input.idempotency_key)}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`${this.apiKey}:`).toString('base64')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      )
    } catch (err) {
      return {
        provider_ref: input.idempotency_key,
        status: 'erro',
        error_message: err instanceof Error ? err.message : 'Network error',
      }
    }

    if (!res.ok) {
      let errMsg = `HTTP ${res.status}`
      try {
        const errBody = await res.json() as Record<string, unknown>
        errMsg = (errBody['mensagem'] as string) ?? errMsg
      } catch { /* ignore parse error */ }
      return {
        provider_ref: input.idempotency_key,
        status: 'erro',
        error_message: errMsg,
      }
    }

    const data = await res.json() as {
      ref?: string
      status?: string
      numero_rps?: string
      serie_rps?: string
    }

    return {
      provider_ref: data.ref ?? input.idempotency_key,
      numero: data.numero_rps,
      serie: data.serie_rps,
      status: mapFocusStatus(data.status ?? ''),
    }
  }

  async query(provider_ref: string): Promise<NfseResult> {
    let res: Response
    try {
      res = await fetch(
        `${FOCUS_BASE}/nfse?ref=${encodeURIComponent(provider_ref)}`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(`${this.apiKey}:`).toString('base64')}`,
          },
        }
      )
    } catch (err) {
      return {
        provider_ref,
        status: 'erro',
        error_message: err instanceof Error ? err.message : 'Network error',
      }
    }

    if (!res.ok) {
      return { provider_ref, status: 'erro', error_message: `HTTP ${res.status}` }
    }

    const data = await res.json() as {
      ref?: string
      status?: string
      numero?: string
      serie?: string
      caminho_xml_nota_fiscal?: string
      caminho_danfse?: string
    }

    return {
      provider_ref: data.ref ?? provider_ref,
      numero: data.numero,
      serie: data.serie,
      status: mapFocusStatus(data.status ?? ''),
      xml_url: data.caminho_xml_nota_fiscal,
      pdf_url: data.caminho_danfse,
    }
  }

  async cancel(provider_ref: string, motivo: string): Promise<{ success: boolean }> {
    let res: Response
    try {
      res = await fetch(
        `${FOCUS_BASE}/nfse?ref=${encodeURIComponent(provider_ref)}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Basic ${Buffer.from(`${this.apiKey}:`).toString('base64')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ justificativa: motivo }),
        }
      )
    } catch {
      return { success: false }
    }

    return { success: res.ok }
  }
}
