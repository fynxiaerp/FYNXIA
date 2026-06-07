/**
 * Asaas REST API — shared TypeScript types
 * Source: https://docs.asaas.com/
 */

// ─── Asaas domain objects ────────────────────────────────────────────────────

export interface AsaasCustomer {
  id: string
  name: string
  cpfCnpj: string
  email?: string | null
  mobilePhone?: string | null
  externalReference?: string | null
}

export interface AsaasPayment {
  id: string
  status: string
  bankSlipUrl?: string | null
  invoiceUrl?: string | null   // public hosted invoice/payment page (asaas.com/i/...)
  dueDate: string
  value: number
  installment?: string | null  // installment group ID (inst_xxx)
}

export interface AsaasPixQrCode {
  encodedImage: string   // base64 PNG QR code
  payload: string        // copia e cola string
  expirationDate: string // "YYYY-MM-DD HH:mm:ss"
}

export interface AsaasWebhookPayment {
  id: string
  installment?: string | null
  status: string
  value: number
  dueDate: string
  customer: string
}

export interface AsaasWebhookEvent {
  id: string
  event: string
  dateCreated?: string
  payment: AsaasWebhookPayment
}

export interface AsaasInstallmentPayments {
  data: AsaasPayment[]
}

// ─── Gateway param/result types (D-01) ──────────────────────────────────────

export interface CreateCustomerParams {
  name: string
  cpfCnpj: string        // digits only
  email?: string | null
  mobilePhone?: string | null
  externalReference?: string  // patient UUID
}

export interface CreateChargeParams {
  customer: string         // Asaas customer ID (cus_xxx)
  billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD'
  /** Single charge amount. Use instead of totalValue for non-installment charges. */
  value?: number
  /** Total amount for installment charges. */
  totalValue?: number
  dueDate: string          // YYYY-MM-DD
  description?: string
  installmentCount?: number // 1 = single; 2-21 = installment
}

export interface ChargeResult {
  chargeId: string
  installmentId?: string | null
  bankSlipUrl?: string | null
  status: string
  dueDate: string
  value?: number
}
