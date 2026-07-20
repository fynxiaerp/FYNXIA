/**
 * DrePdf — Demonstração de Resultado (DRE) export for @react-pdf/renderer (REP-01 / D-07).
 *
 * CRITICAL CONSTRAINTS (CLAUDE.md + 19-10-PLAN.md):
 * - Flexbox ONLY — @react-pdf/renderer does not support CSS Grid layouts
 * - Font.register with Roboto (Latin Extended) — required for ã/ç/ê/õ, mirrors
 *   ReceiboPDF.tsx / RpaPDF.tsx exactly
 * - Node.js runtime only (route handler sets export const runtime = 'nodejs')
 * - No 'use client' — server-only module rendered inside the API route
 *
 * Pattern: mirrors AnvisaReportPdf.tsx's table layout (header/table/footer),
 * with Font.register per ReceiboPDF.tsx/RpaPDF.tsx (D-07 read_first note).
 */
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'

import type { DreResult } from '@/lib/financeiro/dre-math'

// ─── Font registration (idêntico a ReceiboPDF.tsx/RpaPDF.tsx) ────────────────
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

function formatPct(v: number): string {
  return `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
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

  // KPI summary row
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
  cellTextMuted: { fontFamily: 'Roboto', fontSize: 8, color: '#6B7280' },
  colConta: { width: '55%' },
  colTipo: { width: '15%' },
  colValor: { width: '18%', textAlign: 'right' },
  colPct: { width: '12%', textAlign: 'right', borderRightWidth: 0 },

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

export interface DrePdfProps {
  clinicName: string
  periodoLabel: string
  unidadeLabel: string
  geradoEm: string
  dre: DreResult
}

// ─── PDF Component ────────────────────────────────────────────────────────────

export function DrePdf({ clinicName, periodoLabel, unidadeLabel, geradoEm, dre }: DrePdfProps) {
  const geradoEmDate = new Date(geradoEm)

  return (
    <Document
      title={`DRE — ${clinicName}`}
      author={clinicName}
      subject="Demonstração de Resultado (DRE)"
      creator="FYNXIA ERP"
    >
      <Page size="A4" style={styles.page}>
        {/* ── Header ─────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.clinicName}>{clinicName}</Text>
            <Text style={styles.reportTitle}>Demonstração de Resultado (DRE)</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerMeta}>Período: {periodoLabel}</Text>
            <Text style={styles.headerMeta}>Unidade: {unidadeLabel}</Text>
            <Text style={styles.headerMeta}>
              Gerado em: {geradoEmDate.toLocaleDateString('pt-BR')} às{' '}
              {geradoEmDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>

        {/* ── Resumo (Faturamento/Despesa/Resultado/Margem) ─────────── */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Faturamento</Text>
            <Text style={styles.summaryValue}>{formatBRL(dre.receitaTotal)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Despesa</Text>
            <Text style={styles.summaryValue}>{formatBRL(dre.despesaTotal)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Resultado</Text>
            <Text style={styles.summaryValue}>{formatBRL(dre.resultado)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Margem</Text>
            <Text style={styles.summaryValue}>{formatPct(dre.margem)}</Text>
          </View>
        </View>

        {/* ── Linhas do DRE ──────────────────────────────────────── */}
        <Text style={styles.sectionHeading}>Contas</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeaderRow]}>
            <View style={[styles.cell, styles.colConta]}>
              <Text style={styles.cellHeaderText}>Conta</Text>
            </View>
            <View style={[styles.cell, styles.colTipo]}>
              <Text style={styles.cellHeaderText}>Tipo</Text>
            </View>
            <View style={[styles.cell, styles.colValor]}>
              <Text style={styles.cellHeaderText}>Valor (R$)</Text>
            </View>
            <View style={[styles.cell, styles.cellLast, styles.colPct]}>
              <Text style={styles.cellHeaderText}>% Receita</Text>
            </View>
          </View>

          {dre.lines.length === 0 ? (
            <View style={[styles.tableRow, styles.tableRowLast]}>
              <View style={styles.cell}>
                <Text style={styles.cellText}>Nenhum lançamento no período selecionado.</Text>
              </View>
            </View>
          ) : (
            dre.lines.map((line, index) => (
              <View
                key={line.account_id ?? `unclassified-${index}`}
                style={index === dre.lines.length - 1 ? [styles.tableRow, styles.tableRowLast] : styles.tableRow}
              >
                <View style={[styles.cell, styles.colConta]}>
                  <Text style={styles.cellText}>{line.account_name}</Text>
                </View>
                <View style={[styles.cell, styles.colTipo]}>
                  <Text style={styles.cellTextMuted}>
                    {line.type === 'receita' ? 'Receita' : 'Despesa'}
                  </Text>
                </View>
                <View style={[styles.cell, styles.colValor]}>
                  <Text style={styles.cellText}>{formatBRL(line.total)}</Text>
                </View>
                <View style={[styles.cell, styles.cellLast, styles.colPct]}>
                  <Text style={styles.cellTextMuted}>{formatPct(line.pctReceita)}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Gerado pelo FYNXIA ERP — DRE recalculada em tempo real (sem snapshot)
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
