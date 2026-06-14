/**
 * DocumentoPDF — generic document PDF component for @react-pdf/renderer
 *
 * Renders filled template content with an optional ICP-Brasil signature block
 * at the bottom, or a "RASCUNHO — não assinado" label for unsigned drafts.
 *
 * CRITICAL CONSTRAINTS (CLAUDE.md + 08-RESEARCH Pattern 3):
 *   - Flexbox ONLY — no CSS Grid (not supported by @react-pdf/renderer)
 *   - Font.register with Roboto (Latin Extended) — required for ã/ç/ê/õ (pt-BR)
 *   - Node.js runtime only (caller route must set export const runtime = 'nodejs')
 *   - Server-only module — DO NOT add the use client directive
 *   - font URLs copied verbatim from ProntuarioPDF.tsx (same Google Fonts CDN)
 *
 * Props contract (locked by Plan 01 documento.test.ts):
 *   DocumentoPDFProps as defined in 08-RESEARCH Pattern 3 interfaces.
 *
 * Phase: 08-documentos-assinatura-icp-brasil (DOC-01/02)
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
// Pitfall 6: built-in fonts do not support Latin Extended.
// Roboto (Google Fonts) has full Latin Extended for pt-BR diacritics (ã, ç, ê, õ).
// URLs copied verbatim from ProntuarioPDF.tsx — same CDN, same font weights.
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

// ─── Styles (Flexbox only — CSS grid layout is not supported by @react-pdf/renderer) ──

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
  // Body
  body: {
    flexDirection: 'column',
    flex: 1,
    marginBottom: 16,
  },
  contentLine: {
    fontFamily: 'Roboto',
    fontSize: 11,
    color: '#111827',
    lineHeight: 1.6,
    marginBottom: 2,
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
// Locked by Plan 01 (08-02-PLAN.md interfaces block + documento.test.ts).

export interface DocumentoPDFProps {
  clinicName: string
  title: string
  content: string          // filled template content ({{vars}} already replaced)
  documentNumber: string
  generatedAt: string      // ISO 8601 string
  signatureBlock?: {       // undefined = unsigned draft
    signerCn: string
    signedAt: string       // ISO 8601 string
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

export const DocumentoPDF: React.FC<DocumentoPDFProps> = ({
  clinicName,
  title,
  content,
  documentNumber,
  generatedAt,
  signatureBlock,
}) => {
  // Split content on newlines so each line renders as a separate Text element.
  // This preserves paragraph breaks and Portuguese accents in the PDF body.
  const contentLines = content.split('\n')

  return (
    <Document
      title={title}
      author={clinicName}
      subject={title}
      creator="FYNXIA ERP"
    >
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

        {/* ── Body: filled template content ────────────────────────── */}
        <View style={styles.body}>
          {contentLines.map((line, index) => (
            <Text key={index} style={styles.contentLine}>
              {line}
            </Text>
          ))}

          {/* ── Draft label OR Signature block ───────────────────── */}
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
