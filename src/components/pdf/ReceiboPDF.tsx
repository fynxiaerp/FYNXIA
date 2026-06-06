/**
 * ReceiboPDF — payment receipt layout for @react-pdf/renderer
 *
 * CRITICAL CONSTRAINTS (CLAUDE.md + 03-RESEARCH.md Pitfall 7):
 * - Flexbox ONLY — no CSS Grid (not supported by @react-pdf/renderer)
 * - Font.register with Roboto (Latin Extended) before use — required for ã/ç/ê/õ
 * - Node.js runtime only (route handler sets export const runtime = 'nodejs')
 * - No 'use client' — this is a server-only module
 *
 * Pattern: mirrors ProntuarioPDF.tsx exactly (same Font.register, same A4 margins).
 * PDF Layout Contract (03-UI-SPEC §PDF Layout Contract):
 *   Sections: header → patient info → charge details → footer
 *   Role gate enforced in the route: admin / dentist / receptionist (ROADMAP SC-4)
 */
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'

// ─── Font registration ─────────────────────────────────────────────────────────
// Identical to ProntuarioPDF — Roboto supports full Latin Extended (ã, ç, ê, õ, etc.)
Font.register({
  family: 'Roboto',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxK.woff2',
      fontWeight: 400,
    },
    {
      src: 'https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmEU9fBBc4.woff2',
      fontWeight: 700,
    },
  ],
})

// ─── Helper: format BRL currency ─────────────────────────────────────────────
// 03-UI-SPEC Money Formatting Contract: use toLocaleString('pt-BR', ...) everywhere
function formatBRL(amount: number): string {
  return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ─── Helper: format date to pt-BR ────────────────────────────────────────────
function formatDate(isoString: string): string {
  const d = new Date(isoString)
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatDateTime(isoString: string): string {
  const d = new Date(isoString)
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ─── Styles ───────────────────────────────────────────────────────────────────
// PDF Layout Contract (03-UI-SPEC §PDF Layout Contract):
// - A4, margins: 40pt top/bottom, 48pt left/right
// - Body: 11pt/400, Section heading: 14pt/700, Metadata: 9pt #6B7280
// - Colors: text #111827, section headers #374151, dividers #E5E7EB
// - Flexbox only (CSS Grid is not supported by @react-pdf/renderer)
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Roboto',
    fontSize: 11,
    color: '#111827',
    paddingTop: 40,
    paddingBottom: 40,
    paddingLeft: 48,
    paddingRight: 48,
    flexDirection: 'column',
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: {
    flexDirection: 'column',
  },
  clinicName: {
    fontFamily: 'Roboto',
    fontSize: 14,
    fontWeight: 700,
    color: '#374151',
  },
  receiptTitle: {
    fontFamily: 'Roboto',
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
  },
  headerDate: {
    fontFamily: 'Roboto',
    fontSize: 9,
    color: '#6B7280',
    textAlign: 'right',
  },
  // Section headings
  sectionHeading: {
    fontFamily: 'Roboto',
    fontSize: 14,
    fontWeight: 700,
    color: '#374151',
    marginBottom: 8,
    marginTop: 16,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 12,
    marginTop: 4,
  },
  // Info rows
  infoRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  infoLabel: {
    fontFamily: 'Roboto',
    fontSize: 9,
    color: '#6B7280',
    width: 100,
    fontWeight: 700,
  },
  infoValue: {
    fontFamily: 'Roboto',
    fontSize: 11,
    color: '#111827',
    flex: 1,
  },
  // Amount emphasis (03-UI-SPEC: 12pt weight 700)
  amountRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  amountLabel: {
    fontFamily: 'Roboto',
    fontSize: 9,
    color: '#6B7280',
    width: 100,
    fontWeight: 700,
  },
  amountValue: {
    fontFamily: 'Roboto',
    fontSize: 12,
    fontWeight: 700,
    color: '#111827',
    flex: 1,
  },
  // Charge detail card
  chargeCard: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 8,
  },
  footerText: {
    fontFamily: 'Roboto',
    fontSize: 9,
    color: '#6B7280',
  },
})

// ─── Types ────────────────────────────────────────────────────────────────────

const BILLING_TYPE_LABELS: Record<string, string> = {
  PIX: 'PIX',
  BOLETO: 'Boleto Bancário',
  CREDIT_CARD: 'Cartão de Crédito',
}

export interface ReceiboPDFProps {
  clinicName: string
  patientName: string
  patientCpf: string
  billingType: string
  amount: number
  paidAt: string
  providerChargeId: string | null | undefined
}

// ─── PDF Component ────────────────────────────────────────────────────────────

export function ReceiboPDF({
  clinicName,
  patientName,
  patientCpf,
  billingType,
  amount,
  paidAt,
  providerChargeId,
}: ReceiboPDFProps) {
  const generatedAt = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const billingLabel = BILLING_TYPE_LABELS[billingType] ?? billingType

  return (
    <Document
      title={`Recibo de Pagamento — ${patientName}`}
      author={clinicName}
      subject="Recibo de Pagamento"
      creator="FYNXIA ERP"
    >
      <Page size="A4" style={styles.page}>
        {/* ── Header ─────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.clinicName}>{clinicName}</Text>
            <Text style={styles.receiptTitle}>Recibo de Pagamento</Text>
          </View>
          <Text style={styles.headerDate}>
            Gerado em: {generatedAt}
          </Text>
        </View>

        {/* ── Patient block ──────────────────────────────────────── */}
        <Text style={styles.sectionHeading}>Dados do Paciente</Text>
        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Nome</Text>
          <Text style={styles.infoValue}>{patientName}</Text>
        </View>

        <View style={styles.infoRow}>
          {/* CPF plaintext — privileged PDF operation: route gates to admin/dentist/receptionist (ROADMAP SC-4) */}
          <Text style={styles.infoLabel}>CPF</Text>
          <Text style={styles.infoValue}>{patientCpf}</Text>
        </View>

        {/* ── Charge details ─────────────────────────────────────── */}
        <Text style={styles.sectionHeading}>Detalhes do Pagamento</Text>
        <View style={styles.divider} />

        <View style={styles.chargeCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Método</Text>
            <Text style={styles.infoValue}>{billingLabel}</Text>
          </View>

          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Valor Pago</Text>
            {/* formatBRL uses toLocaleString('pt-BR') — 03-UI-SPEC Money Formatting Contract */}
            <Text style={styles.amountValue}>{formatBRL(amount)}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Data do Pagamento</Text>
            <Text style={styles.infoValue}>{formatDateTime(paidAt)}</Text>
          </View>

          {providerChargeId && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>ID Asaas</Text>
              <Text style={styles.infoValue}>{providerChargeId}</Text>
            </View>
          )}
        </View>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            FYNXIA ERP — Documento confidencial
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `Página ${pageNumber} de ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  )
}
