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

  // cancelCharge — DELETE /v3/payments/{id}
  async cancelCharge(chargeId: string): Promise<void> {
    await asaasFetch<unknown>(`/payments/${chargeId}`, { method: 'DELETE' })
  }
}

// ─── Singleton gateway export ────────────────────────────────────────────────
export const gateway: PaymentGateway = new AsaasAdapter()
