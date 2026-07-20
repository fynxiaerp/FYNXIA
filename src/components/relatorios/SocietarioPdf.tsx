/**
 * SocietarioPdf — Societário distribution export for @react-pdf/renderer (REP-03 / D-40).
 *
 * CRITICAL CONSTRAINTS (CLAUDE.md + 19-12-PLAN.md):
 * - Flexbox ONLY — @react-pdf/renderer does not support CSS Grid layouts
 * - Font.register with Roboto (Latin Extended) — mirrors DrePdf.tsx / ReceiboPDF.tsx /
 *   RpaPDF.tsx exactly
 * - Node.js runtime only (route handler sets export const runtime = 'nodejs')
 * - No 'use client' — server-only module rendered inside the API route
 *
 * Negative valores (D-27) render in the same red tone used for the destructive
 * token elsewhere in the app — sign is never hidden/zeroed (Intl currency
 * formatting already prepends the leading minus).
 */
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'

import type { PartnerDistributionRow } from '@/actions/partner-shares'

// ─── Font registration (idêntico a DrePdf.tsx/ReceiboPDF.tsx/RpaPDF.tsx) ─────
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBRL(amount: number): string {
  return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatPct(percentual: number): string {
  return `${(percentual * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
}

// ─── Styles (Flexbox only — sem display:'grid') ───────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Roboto',
    fontSize: 10,
    color: '#111827',
    paddingTop: 40,
    paddingBottom: 40,
    paddingLeft: 40,
    paddingRight: 40,
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: { flexDirection: 'column' },
  clinicName: { fontFamily: 'Roboto', fontSize: 14, fontWeight: 700, color: '#374151' },
  reportTitle: { fontFamily: 'Roboto', fontSize: 11, color: '#6B7280', marginTop: 4 },
  headerRight: { flexDirection: 'column', alignItems: 'flex-end' },
  headerMeta: { fontFamily: 'Roboto', fontSize: 8, color: '#6B7280', textAlign: 'right', marginTop: 2 },

  // Resultado summary card
  summaryRow: { flexDirection: 'row', marginBottom: 16, gap: 8 },
  summaryCard: {
    flex: 1,
    padding: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  summaryLabel: { fontFamily: 'Roboto', fontSize: 8, color: '#6B7280', marginBottom: 2 },
  summaryValue: { fontFamily: 'Roboto', fontSize: 12, fontWeight: 700, color: '#111827' },
  summaryValueNegative: { fontFamily: 'Roboto', fontSize: 12, fontWeight: 700, color: '#DC2626' },

  sectionHeading: {
    fontFamily: 'Roboto',
    fontSize: 12,
    fontWeight: 700,
    color: '#374151',
    marginBottom: 6,
  },

  // Table
  table: { flexDirection: 'column', borderWidth: 1, borderColor: '#E5E7EB' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tableRowLast: { borderBottomWidth: 0 },
  tableHeaderRow: { backgroundColor: '#F9FAFB' },
  cell: { padding: 5, borderRightWidth: 1, borderRightColor: '#E5E7EB' },
  cellLast: { borderRightWidth: 0 },
  cellHeaderText: { fontFamily: 'Roboto', fontSize: 8, fontWeight: 700, color: '#374151' },
  cellText: { fontFamily: 'Roboto', fontSize: 9, color: '#111827' },
  cellTextNegative: { fontFamily: 'Roboto', fontSize: 9, color: '#DC2626' },
  colSocio: { width: '50%' },
  colPercentual: { width: '20%', textAlign: 'right' },
  colValor: { width: '30%', textAlign: 'right', borderRightWidth: 0 },

  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 6,
  },
  footerText: { fontFamily: 'Roboto', fontSize: 8, color: '#6B7280' },
})

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SocietarioPdfProps {
  clinicName: string
  periodoLabel: string
  geradoEm: string
  resultado: number
  distribution: PartnerDistributionRow[]
}

// ─── PDF Component ────────────────────────────────────────────────────────────

export function SocietarioPdf({ clinicName, periodoLabel, geradoEm, resultado, distribution }: SocietarioPdfProps) {
  const geradoEmDate = new Date(geradoEm)
  const resultadoNegative = resultado < 0

  return (
    <Document
      title={`Societário — ${clinicName}`}
      author={clinicName}
      subject="Distribuição de Resultado Societário"
      creator="FYNXIA ERP"
    >
      <Page size="A4" style={styles.page}>
        {/* ── Header ─────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.clinicName}>{clinicName}</Text>
            <Text style={styles.reportTitle}>Distribuição de Resultado Societário</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerMeta}>Período: {periodoLabel}</Text>
            <Text style={styles.headerMeta}>
              Gerado em: {geradoEmDate.toLocaleDateString('pt-BR')} às{' '}
              {geradoEmDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>

        {/* ── Resultado consolidado ──────────────────────────────── */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Resultado do período (consolidado)</Text>
            <Text style={resultadoNegative ? styles.summaryValueNegative : styles.summaryValue}>
              {formatBRL(resultado)}
            </Text>
          </View>
        </View>

        {/* ── Distribuição por sócio ─────────────────────────────── */}
        <Text style={styles.sectionHeading}>Distribuição por sócio</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeaderRow]}>
            <View style={[styles.cell, styles.colSocio]}>
              <Text style={styles.cellHeaderText}>Sócio</Text>
            </View>
            <View style={[styles.cell, styles.colPercentual]}>
              <Text style={styles.cellHeaderText}>Percentual</Text>
            </View>
            <View style={[styles.cell, styles.cellLast, styles.colValor]}>
              <Text style={styles.cellHeaderText}>Valor (R$)</Text>
            </View>
          </View>

          {distribution.length === 0 ? (
            <View style={[styles.tableRow, styles.tableRowLast]}>
              <View style={styles.cell}>
                <Text style={styles.cellText}>Nenhuma cota societária cadastrada.</Text>
              </View>
            </View>
          ) : (
            distribution.map((row, index) => (
              <View
                key={row.userId}
                style={index === distribution.length - 1 ? [styles.tableRow, styles.tableRowLast] : styles.tableRow}
              >
                <View style={[styles.cell, styles.colSocio]}>
                  <Text style={styles.cellText}>{row.name}</Text>
                </View>
                <View style={[styles.cell, styles.colPercentual]}>
                  <Text style={styles.cellText}>{formatPct(row.percentual)}</Text>
                </View>
                <View style={[styles.cell, styles.cellLast, styles.colValor]}>
                  <Text style={row.valor < 0 ? styles.cellTextNegative : styles.cellText}>
                    {formatBRL(row.valor)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Gerado pelo FYNXIA ERP — distribuição meramente informativa, sem lançamento financeiro (D-26)
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  )
}
