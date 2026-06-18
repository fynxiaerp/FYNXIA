/**
 * ExamePDF — PDF component for solicitação de exame
 *
 * Mirrors DocumentoPDF.tsx (Phase 8): Roboto font, Flexbox only (no CSS Grid),
 * deterministic generatedAt from row.created_at (Pitfall 1 prevention).
 *
 * CRITICAL CONSTRAINTS (CLAUDE.md + 12-RESEARCH):
 *   - Flexbox ONLY — no CSS Grid (not supported by @react-pdf/renderer)
 *   - Font.register with Roboto (same URLs as DocumentoPDF.tsx)
 *   - Node.js runtime only — caller action sets runtime = 'nodejs'
 *   - Server-only module — DO NOT add 'use client' directive
 *   - generatedAt MUST come from row.created_at (NOT new Date() inside component)
 *
 * Phase: 12-receitu-rio-teleodontologia (RX-01/RX-03)
 */
import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'

// ─── Font registration ─────────────────────────────────────────────────────────
// Same two Google Fonts URLs as DocumentoPDF.tsx — full Latin Extended for pt-BR.
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

// ─── Styles (Flexbox only — CSS grid layout not supported by @react-pdf/renderer) ──
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Roboto',
    fontSize: 11,
    color: '#111827',
    paddingTop: 40,
    paddingBottom: 60,
    paddingLeft: 48,
    paddingRight: 48,
    flexDirection: 'column',
  },
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
    flex: 1,
  },
  clinicName: {
    fontFamily: 'Roboto',
    fontSize: 14,
    fontWeight: 700,
    color: '#374151',
  },
  documentTitle: {
    fontFamily: 'Roboto',
    fontSize: 12,
    fontWeight: 400,
    color: '#6B7280',
    marginTop: 4,
  },
  headerRight: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  headerMeta: {
    fontFamily: 'Roboto',
    fontSize: 9,
    color: '#6B7280',
    textAlign: 'right',
  },
  body: {
    flexDirection: 'column',
    flex: 1,
    marginBottom: 16,
  },
  patientRow: {
    flexDirection: 'row',
    marginTop: 8,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  patientLabel: {
    fontFamily: 'Roboto',
    fontSize: 10,
    fontWeight: 700,
    color: '#374151',
    width: 72,
  },
  patientValue: {
    fontFamily: 'Roboto',
    fontSize: 10,
    color: '#111827',
    flex: 1,
  },
  solicitacaoLabel: {
    fontFamily: 'Roboto',
    fontSize: 11,
    fontWeight: 700,
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  solicitacaoText: {
    fontFamily: 'Roboto',
    fontSize: 11,
    color: '#111827',
    lineHeight: 1.7,
  },
  professionalBlock: {
    flexDirection: 'column',
    marginTop: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    alignItems: 'flex-end',
  },
  professionalName: {
    fontFamily: 'Roboto',
    fontSize: 10,
    fontWeight: 700,
    color: '#374151',
  },
  professionalCro: {
    fontFamily: 'Roboto',
    fontSize: 9,
    color: '#6B7280',
  },
  // Draft watermark (unsigned)
  draftLabel: {
    marginTop: 24,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 4,
    flexDirection: 'row',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  draftText: {
    fontFamily: 'Roboto',
    fontSize: 10,
    fontWeight: 700,
    color: '#B45309',
  },
  // Signature block (signed)
  signatureBlock: {
    marginTop: 24,
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 12,
    paddingRight: 12,
    borderTopWidth: 1,
    borderTopColor: '#10B981',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 4,
    backgroundColor: '#F0FDF4',
    flexDirection: 'column',
  },
  signatureTitle: {
    fontFamily: 'Roboto',
    fontSize: 10,
    fontWeight: 700,
    color: '#065F46',
    marginBottom: 6,
  },
  signatureRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  signatureLabel: {
    fontFamily: 'Roboto',
    fontSize: 8,
    fontWeight: 700,
    color: '#374151',
    width: 80,
  },
  signatureValue: {
    fontFamily: 'Roboto',
    fontSize: 8,
    color: '#111827',
    flex: 1,
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
    paddingTop: 6,
  },
  footerText: {
    fontFamily: 'Roboto',
    fontSize: 9,
    color: '#6B7280',
  },
})

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ExamePDFProps {
  clinicName: string
  professionalName: string
  professionalCro: string
  patientName: string
  solicitacao: string
  documentNumber: string
  /** ISO 8601 string — MUST be row.created_at (deterministic, Pitfall 1) */
  generatedAt: string
  signatureBlock?: {
    signerCn: string
    signedAt: string
    thumbprintSha1: string
    sha256Hex: string
  }
}

// ─── Helper: format ISO to pt-BR datetime ────────────────────────────────────

function formatPtBR(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return isoString
  }
}

// ─── PDF Component ────────────────────────────────────────────────────────────

export const ExamePDF: React.FC<ExamePDFProps> = ({
  clinicName,
  professionalName,
  professionalCro,
  patientName,
  solicitacao,
  documentNumber,
  generatedAt,
  signatureBlock,
}) => {
  const title = 'Solicitação de Exame'

  return (
    <Document title={title} author={clinicName} subject={title} creator="FYNXIA ERP">
      <Page size="A4" style={styles.page}>
        {/* ── Header ───────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.clinicName}>{clinicName}</Text>
            <Text style={styles.documentTitle}>{title}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerMeta}>N.º {documentNumber}</Text>
            <Text style={styles.headerMeta}>
              Gerado em: {formatPtBR(generatedAt)}
            </Text>
          </View>
        </View>

        {/* ── Body ─────────────────────────────────────────────────── */}
        <View style={styles.body}>
          {/* Patient */}
          <View style={styles.patientRow}>
            <Text style={styles.patientLabel}>Paciente:</Text>
            <Text style={styles.patientValue}>{patientName}</Text>
          </View>

          {/* Exames solicitados */}
          <Text style={styles.solicitacaoLabel}>Exames solicitados:</Text>
          <Text style={styles.solicitacaoText}>{solicitacao}</Text>

          {/* Professional info */}
          <View style={styles.professionalBlock}>
            <Text style={styles.professionalName}>{professionalName}</Text>
            <Text style={styles.professionalCro}>CRO: {professionalCro}</Text>
          </View>

          {/* Draft label OR Signature block */}
          {signatureBlock ? (
            <View style={styles.signatureBlock}>
              <Text style={styles.signatureTitle}>
                Assinado digitalmente com certificado ICP-Brasil
              </Text>
              <View style={styles.signatureRow}>
                <Text style={styles.signatureLabel}>Assinante:</Text>
                <Text style={styles.signatureValue}>{signatureBlock.signerCn}</Text>
              </View>
              <View style={styles.signatureRow}>
                <Text style={styles.signatureLabel}>Data:</Text>
                <Text style={styles.signatureValue}>
                  {formatPtBR(signatureBlock.signedAt)}
                </Text>
              </View>
              <View style={styles.signatureRow}>
                <Text style={styles.signatureLabel}>Certificado:</Text>
                <Text style={styles.signatureValue}>
                  {signatureBlock.thumbprintSha1}
                </Text>
              </View>
              <View style={styles.signatureRow}>
                <Text style={styles.signatureLabel}>SHA-256:</Text>
                <Text style={styles.signatureValue}>{signatureBlock.sha256Hex}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.draftLabel}>
              <Text style={styles.draftText}>RASCUNHO — não assinado</Text>
            </View>
          )}
        </View>

        {/* ── Footer ───────────────────────────────────────────────── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>FYNXIA ERP — Documento confidencial</Text>
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
