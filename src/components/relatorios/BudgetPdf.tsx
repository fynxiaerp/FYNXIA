/**
 * BudgetPdf — Orçamento (metas × realizado) export for @react-pdf/renderer (REP-02 / D-19/D-40).
 *
 * CRITICAL CONSTRAINTS (CLAUDE.md + 19-11-PLAN.md):
 * - Flexbox ONLY — @react-pdf/renderer does not support CSS Grid layouts
 * - Font.register with Roboto (Latin Extended) — mirrors DrePdf.tsx/ReceiboPDF.tsx exactly
 * - Node.js runtime only (route handler sets export const runtime = 'nodejs')
 * - No 'use client' — server-only module rendered inside the API route
 *
 * Pattern: landscape A4 (mirrors AnvisaReportPdf.tsx orientation) to fit 12 monthly
 * columns (conta × mês) without excessive line-wrapping. Each month cell stacks
 * Meta / Realizado / Desvio% (D-15) as 3 compact text lines.
 */
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'

import type { BudgetVsRealizadoRow } from '@/actions/budget-targets'

// ─── Font registration (idêntico a DrePdf.tsx/ReceiboPDF.tsx) ────────────────
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

const MESES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBRLCompact(amount: number): string {
  // Compact form (sem símbolo de moeda repetido em cada célula) — cabe nas colunas estreitas
  return amount.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

function formatBRL(amount: number): string {
  return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function deviationPct(realizado: number, meta: number): number {
  if (meta === 0) return realizado === 0 ? 0 : 100
  return ((realizado - meta) / meta) * 100
}

function deviationColor(realizado: number, meta: number): string {
  const pct = Math.abs(deviationPct(realizado, meta))
  if (pct < 5) return '#15803D' // verde (text-green-700)
  if (pct <= 15) return '#D97706' // amarelo (amber-600)
  return '#DC2626' // vermelho (destructive-equivalent)
}

// ─── Styles (Flexbox only — sem display:'grid') ───────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Roboto',
    fontSize: 9,
    color: '#111827',
    paddingTop: 32,
    paddingBottom: 40,
    paddingLeft: 24,
    paddingRight: 24,
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
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
  summaryRow: { flexDirection: 'row', marginBottom: 12, gap: 8 },
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

  // Table
  table: { flexDirection: 'column', borderWidth: 1, borderColor: '#E5E7EB' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tableRowLast: { borderBottomWidth: 0 },
  tableHeaderRow: { backgroundColor: '#F9FAFB' },
  cell: { padding: 3, borderRightWidth: 1, borderRightColor: '#E5E7EB', flexDirection: 'column' },
  cellLast: { borderRightWidth: 0 },
  cellHeaderText: { fontFamily: 'Roboto', fontSize: 7, fontWeight: 700, color: '#374151', textAlign: 'center' },
  colConta: { width: '16%', padding: 4 },
  colContaText: { fontFamily: 'Roboto', fontSize: 8, color: '#111827' },
  colMes: { width: `${84 / 12}%`, alignItems: 'center' },
  mesMeta: { fontFamily: 'Roboto', fontSize: 7, color: '#111827', textAlign: 'center' },
  mesRealizado: { fontFamily: 'Roboto', fontSize: 6.5, color: '#6B7280', textAlign: 'center', marginTop: 1 },
  mesDesvio: { fontFamily: 'Roboto', fontSize: 6.5, textAlign: 'center', marginTop: 1, fontWeight: 700 },

  footer: {
    position: 'absolute',
    bottom: 20,
    left: 24,
    right: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 6,
  },
  footerText: { fontFamily: 'Roboto', fontSize: 8, color: '#6B7280' },
})

// ─── Props ────────────────────────────────────────────────────────────────────

export interface BudgetPdfProps {
  clinicName: string
  ano: number
  unidadeLabel: string
  geradoEm: string
  rows: BudgetVsRealizadoRow[]
}

// ─── PDF Component ────────────────────────────────────────────────────────────

export function BudgetPdf({ clinicName, ano, unidadeLabel, geradoEm, rows }: BudgetPdfProps) {
  const geradoEmDate = new Date(geradoEm)

  const sumMeta = rows.reduce((s, r) => s + r.meses.reduce((s2, m) => s2 + m.meta, 0), 0)
  const sumRealizado = rows.reduce((s, r) => s + r.meses.reduce((s2, m) => s2 + m.realizado, 0), 0)
  const overallDeviation = deviationPct(sumRealizado, sumMeta)

  return (
    <Document
      title={`Orçamento ${ano} — ${clinicName}`}
      author={clinicName}
      subject="Orçamento — Metas × Realizado"
      creator="FYNXIA ERP"
    >
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* ── Header ─────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.clinicName}>{clinicName}</Text>
            <Text style={styles.reportTitle}>Orçamento — Metas × Realizado</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerMeta}>Ano: {ano}</Text>
            <Text style={styles.headerMeta}>Unidade: {unidadeLabel}</Text>
            <Text style={styles.headerMeta}>
              Gerado em: {geradoEmDate.toLocaleDateString('pt-BR')} às{' '}
              {geradoEmDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>

        {/* ── Resumo (Meta / Realizado / Desvio) ────────────────────── */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Meta (ano)</Text>
            <Text style={styles.summaryValue}>{formatBRL(sumMeta)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Realizado (ano)</Text>
            <Text style={styles.summaryValue}>{formatBRL(sumRealizado)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Desvio</Text>
            <Text style={[styles.summaryValue, { color: deviationColor(sumRealizado, sumMeta) }]}>
              {overallDeviation >= 0 ? '+' : ''}
              {overallDeviation.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
            </Text>
          </View>
        </View>

        {/* ── Grid de contas × meses ─────────────────────────────── */}
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeaderRow]}>
            <View style={[styles.cell, styles.colConta]}>
              <Text style={styles.cellHeaderText}>Conta contábil</Text>
            </View>
            {MESES_LABEL.map((label, i) => (
              <View key={label} style={[styles.cell, styles.colMes, i === 11 ? styles.cellLast : {}]}>
                <Text style={styles.cellHeaderText}>{label}</Text>
              </View>
            ))}
          </View>

          {rows.length === 0 ? (
            <View style={[styles.tableRow, styles.tableRowLast]}>
              <View style={styles.cell}>
                <Text style={styles.colContaText}>Nenhum orçamento cadastrado para {ano}.</Text>
              </View>
            </View>
          ) : (
            rows.map((row, index) => (
              <View
                key={row.accountId}
                style={index === rows.length - 1 ? [styles.tableRow, styles.tableRowLast] : styles.tableRow}
              >
                <View style={[styles.cell, styles.colConta]}>
                  <Text style={styles.colContaText}>{row.accountName}</Text>
                </View>
                {row.meses.map((cell, i) => (
                  <View key={cell.mes} style={[styles.cell, styles.colMes, i === 11 ? styles.cellLast : {}]}>
                    <Text style={styles.mesMeta}>{formatBRLCompact(cell.meta)}</Text>
                    <Text style={styles.mesRealizado}>{formatBRLCompact(cell.realizado)}</Text>
                    <Text style={[styles.mesDesvio, { color: deviationColor(cell.realizado, cell.meta) }]}>
                      {deviationPct(cell.realizado, cell.meta) >= 0 ? '+' : ''}
                      {deviationPct(cell.realizado, cell.meta).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%
                    </Text>
                  </View>
                ))}
              </View>
            ))
          )}
        </View>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Gerado pelo FYNXIA ERP — realizado calculado em tempo real (sem snapshot)
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
