/**
 * BiPdf — BI KPI summary export for @react-pdf/renderer (BI-01/BI-02 / D-40).
 *
 * CRITICAL CONSTRAINTS (CLAUDE.md + 19-13-PLAN.md):
 * - Flexbox ONLY — @react-pdf/renderer does not support CSS Grid layouts
 * - Font.register with Roboto (Latin Extended) — mirrors DrePdf.tsx / SocietarioPdf.tsx exactly
 * - Node.js runtime only (route handler sets export const runtime = 'nodejs')
 * - No 'use client' — server-only module rendered inside the API route
 *
 * Presentational only: receives one dimension's already-formatted rows
 * (label + atual + meta, per the plan's "KPI summary per dimension" contract) —
 * all pt-BR/BRL/percentage formatting decisions are made by the route
 * (src/app/api/bi/pdf/route.ts), since the "Profissionais" dimension needs a
 * composite atual string (faturamento + procedimentos) that doesn't fit a
 * single numeric formatter shared with the other 3 dimensions.
 */
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'

// ─── Font registration (idêntico a DrePdf.tsx/SocietarioPdf.tsx) ─────────────
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
  colLabel: { width: '50%' },
  colAtual: { width: '25%', textAlign: 'right' },
  colMeta: { width: '25%', textAlign: 'right', borderRightWidth: 0 },

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

export interface BiPdfRow {
  label: string
  atual: string
  meta: string
}

export interface BiPdfProps {
  clinicName: string
  dimensionLabel: string
  periodoLabel: string
  unidadeLabel: string
  geradoEm: string
  rows: BiPdfRow[]
}

// ─── PDF Component ────────────────────────────────────────────────────────────

export function BiPdf({ clinicName, dimensionLabel, periodoLabel, unidadeLabel, geradoEm, rows }: BiPdfProps) {
  const geradoEmDate = new Date(geradoEm)

  return (
    <Document
      title={`BI — ${dimensionLabel} — ${clinicName}`}
      author={clinicName}
      subject={`Indicadores de BI — ${dimensionLabel}`}
      creator="FYNXIA ERP"
    >
      <Page size="A4" style={styles.page}>
        {/* ── Header ─────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.clinicName}>{clinicName}</Text>
            <Text style={styles.reportTitle}>BI — {dimensionLabel}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerMeta}>Unidade: {unidadeLabel}</Text>
            <Text style={styles.headerMeta}>Período: {periodoLabel}</Text>
            <Text style={styles.headerMeta}>
              Gerado em: {geradoEmDate.toLocaleDateString('pt-BR')} às{' '}
              {geradoEmDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>

        {/* ── KPI summary ─────────────────────────────────────────── */}
        <Text style={styles.sectionHeading}>Indicadores — {dimensionLabel}</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeaderRow]}>
            <View style={[styles.cell, styles.colLabel]}>
              <Text style={styles.cellHeaderText}>Indicador</Text>
            </View>
            <View style={[styles.cell, styles.colAtual]}>
              <Text style={styles.cellHeaderText}>Atual</Text>
            </View>
            <View style={[styles.cell, styles.cellLast, styles.colMeta]}>
              <Text style={styles.cellHeaderText}>Meta</Text>
            </View>
          </View>

          {rows.length === 0 ? (
            <View style={[styles.tableRow, styles.tableRowLast]}>
              <View style={styles.cell}>
                <Text style={styles.cellText}>Nenhum dado disponível para este período.</Text>
              </View>
            </View>
          ) : (
            rows.map((row, index) => (
              <View
                key={`${row.label}-${index}`}
                style={index === rows.length - 1 ? [styles.tableRow, styles.tableRowLast] : styles.tableRow}
              >
                <View style={[styles.cell, styles.colLabel]}>
                  <Text style={styles.cellText}>{row.label}</Text>
                </View>
                <View style={[styles.cell, styles.colAtual]}>
                  <Text style={styles.cellText}>{row.atual}</Text>
                </View>
                <View style={[styles.cell, styles.cellLast, styles.colMeta]}>
                  <Text style={styles.cellText}>{row.meta}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Gerado pelo FYNXIA ERP — indicadores de BI (BI-01/BI-02)</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  )
}
