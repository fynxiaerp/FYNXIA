// src/lib/asaas/gateway.ts
// PaymentGateway interface (D-01) + AsaasAdapter implementation
import 'server-only'

import { asaasFetch } from './client'
import type {
  AsaasCustomer,
  AsaasPayment,
  AsaasPixQrCode,
  AsaasInstallmentPayments,
  CreateCustomerParams,
  CreateChargeParams,
  ChargeResult,
} from './types'

// ─── PaymentGateway interface (D-01) ────────────────────────────────────────
// Provider-agnostic contract. Future adapters (Stripe, PagSeguro, etc.) only
// need to implement this interface — no changes to Server Actions or schema.

export interface PaymentGateway {
  createCustomer(params: CreateCustomerParams): Promise<{ customerId: string }>
  createCharge(params: CreateChargeParams): Promise<ChargeResult>
  getPixQrCode(chargeId: string): Promise<{ encodedImage: string; payload: string; expirationDate: string }>
  getInstallmentCharges(installmentId: string): Promise<ChargeResult[]>
  /**
   * Fetches the live public invoice/payment URL for a charge (GET /payments/{id} → invoiceUrl).
   * Returns null if Asaas does not return one (e.g. charge not found / no hosted page).
   * Used by the collection ruler (WR-01) to avoid shipping a guessed `asaas.com/i/{id}` link.
   */
  getInvoiceUrl(chargeId: string): Promise<string | null>
  cancelCharge(chargeId: string): Promise<void>
}

// ─── AsaasAdapter ─────────────────────────────────────────────────────────────
// Implements PaymentGateway by calling Asaas REST API v3.
// Auth: access_token header (set via ASAAS_API_KEY env var in asaasFetch).

export class AsaasAdapter implements PaymentGateway {
  // createCustomer — POST /v3/customers
  // Stores returned id as asaas_customer_id on the patient (Pitfall 8 — dedup)
  async createCustomer(params: CreateCustomerParams): Promise<{ customerId: string }> {
    const res = await asaasFetch<AsaasCustomer>('/customers', {
      method: 'POST',
      body: JSON.stringify({
        name: params.name,
        cpfCnpj: params.cpfCnpj,
        ...(params.email ? { email: params.email } : {}),
        ...(params.mobilePhone ? { mobilePhone: params.mobilePhone } : {}),
        ...(params.externalReference ? { externalReference: params.externalReference } : {}),
      }),
    })
    return { customerId: res.id }
  }

  // createCharge — POST /v3/payments
  // Single: use `value`. Installment: use `totalValue` + `installmentCount`.
  // Returns installmentId when installmentCount > 1 (Pitfall 4).
  async createCharge(params: CreateChargeParams): Promise<ChargeResult> {
    const body: Record<string, unknown> = {
      customer: params.customer,
      billingType: params.billingType,
      dueDate: params.dueDate,
    }

    if (params.installmentCount && params.installmentCount > 1) {
      body.installmentCount = params.installmentCount
      body.totalValue = params.totalValue
    } else {
      body.value = params.value
    }

    if (params.description) {
      body.description = params.description
    }

    const res = await asaasFetch<AsaasPayment>('/payments', {
      method: 'POST',
      body: JSON.stringify(body),
    })

    return {
      chargeId: res.id,
      installmentId: res.installment ?? null,
      bankSlipUrl: res.bankSlipUrl ?? null,
      status: res.status,
      dueDate: res.dueDate,
      value: res.value,
    }
  }

  // getPixQrCode — GET /v3/payments/{id}/pixQrCode
  // Must be called after createCharge (PIX QR data is not in the charge response — Pitfall 3)
  async getPixQrCode(chargeId: string): Promise<{ encodedImage: string; payload: string; expirationDate: string }> {
    const res = await asaasFetch<AsaasPixQrCode>(`/payments/${chargeId}/pixQrCode`)
    return {
      encodedImage: res.encodedImage,
      payload: res.payload,
      expirationDate: res.expirationDate,
    }
  }

  // getInstallmentCharges — GET /v3/installments/{id}/payments
  // Returns all parcels for an installment plan (Pitfall 4 — only first parcel in creation response)
  async getInstallmentCharges(installmentId: string): Promise<ChargeResult[]> {
    const res = await asaasFetch<AsaasInstallmentPayments>(`/installments/${installmentId}/payments`)
    return res.data.map((p) => ({
      chargeId: p.id,
      installmentId: installmentId,
      bankSlipUrl: p.bankSlipUrl ?? null,
      status: p.status,
      dueDate: p.dueDate,
      value: p.value,
    }))
  }

  // getInvoiceUrl — GET /v3/payments/{id} → invoiceUrl (WR-01)
  // The hosted invoice URL is the verified, clickable payment page. We fetch it live
  // at send time rather than guessing the `asaas.com/i/{id}` pattern. Returns null on
  // any error or when no invoiceUrl is present so the caller can skip the send.
  async getInvoiceUrl(chargeId: string): Promise<string | null> {
    try {
      const res = await asaasFetch<AsaasPayment>(`/payments/${chargeId}`)
      return res.invoiceUrl ?? null
    } catch {
      return null
    }
  }

  // cancelCharge — DELETE /v3/payments/{id}
  async cancelCharge(chargeId: string): Promise<void> {
    await asaasFetch<unknown>(`/payments/${chargeId}`, { method: 'DELETE' })
  }
}

// ─── Singleton gateway export ────────────────────────────────────────────────
export const gateway: PaymentGateway = new AsaasAdapter()
