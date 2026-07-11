/**
 * AnvisaReportPdf — relatório de rastreabilidade ANVISA de implantes para
 * @react-pdf/renderer (EST-03 / D-12/D-13).
 *
 * CRITICAL CONSTRAINTS (CLAUDE.md + 17-UI-SPEC.md §"PDF exportado"):
 * - Layout Flexbox exclusivamente — a biblioteca não suporta layout em
 *   colunas/linhas via CSS declarativo estilo tabela HTML nativa
 * - Fonte Helvetica padrão (built-in do @react-pdf/renderer) — sem
 *   Font.register/fonte customizada nesta fase (UI-SPEC explícito; Helvetica
 *   com WinAnsiEncoding já cobre acentuação pt-BR básica)
 * - Node.js runtime only (route handler define export const runtime = 'nodejs')
 * - No 'use client' — módulo server-only, renderizado dentro da API route
 *
 * Pattern: mirrors ReceiboPDF.tsx (Document>Page>View, StyleSheet.create,
 * header/footer fixed), mas em orientação landscape para acomodar as 9
 * colunas do relatório sem quebra de linha excessiva.
 */
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

import type { AnvisaRow } from '@/actions/stock-draws'

// ─── Helpers: format date / datetime to pt-BR ────────────────────────────────

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ─── Styles ───────────────────────────────────────────────────────────────────
// Layout Flexbox exclusivamente (limitação da biblioteca @react-pdf/renderer).
const styles = StyleSheet.create({
  page: {
    fontSize: 9,
    color: '#111827',
    paddingTop: 32,
    paddingBottom: 40,
    paddingLeft: 32,
    paddingRight: 32,
    flexDirection: 'column',
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: {
    flexDirection: 'column',
  },
  clinicName: {
    fontSize: 14,
    fontWeight: 700,
    color: '#374151',
  },
  reportTitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
  },
  headerRight: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  headerMeta: {
    fontSize: 8,
    color: '#6B7280',
    textAlign: 'right',
    marginTop: 2,
  },
  // Table
  table: {
    flexDirection: 'column',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  tableHeaderRow: {
    backgroundColor: '#F9FAFB',
  },
  cell: {
    padding: 5,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  cellLast: {
    borderRightWidth: 0,
  },
  cellHeaderText: {
    fontSize: 8,
    fontWeight: 700,
    color: '#374151',
  },
  cellText: {
    fontSize: 8,
    color: '#111827',
  },
  // Column widths (soma 100%)
  colData: { width: '9%' },
  colPaciente: { width: '15%' },
  colProfissional: { width: '13%' },
  colProcedimento: { width: '14%' },
  colProduto: { width: '16%' },
  colLote: { width: '10%' },
  colAnvisa: { width: '10%' },
  colValidade: { width: '9%' },
  colQtd: { width: '4%', borderRightWidth: 0 },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 32,
    right: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 6,
  },
  footerText: {
    fontSize: 8,
    color: '#6B7280',
  },
})

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnvisaReportPdfProps {
  clinicName: string
  periodoLabel: string
  geradoEm: string
  rows: AnvisaRow[]
}

// ─── PDF Component ────────────────────────────────────────────────────────────

export function AnvisaReportPdf({ clinicName, periodoLabel, geradoEm, rows }: AnvisaReportPdfProps) {
  return (
    <Document
      title={`Relatório ANVISA — ${clinicName}`}
      author={clinicName}
      subject="Rastreabilidade ANVISA de Implantes"
      creator="FYNXIA ERP"
    >
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* ── Header ─────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.clinicName}>{clinicName}</Text>
            <Text style={styles.reportTitle}>Relatório de Rastreabilidade ANVISA — Implantes</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerMeta}>Período: {periodoLabel}</Text>
            <Text style={styles.headerMeta}>Gerado em: {formatDate(geradoEm)}</Text>
          </View>
        </View>

        {/* ── Tabela ─────────────────────────────────────────────── */}
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeaderRow]}>
            <View style={[styles.cell, styles.colData]}>
              <Text style={styles.cellHeaderText}>Data Procedimento</Text>
            </View>
            <View style={[styles.cell, styles.colPaciente]}>
              <Text style={styles.cellHeaderText}>Paciente</Text>
            </View>
            <View style={[styles.cell, styles.colProfissional]}>
              <Text style={styles.cellHeaderText}>Profissional</Text>
            </View>
            <View style={[styles.cell, styles.colProcedimento]}>
              <Text style={styles.cellHeaderText}>Procedimento</Text>
            </View>
            <View style={[styles.cell, styles.colProduto]}>
              <Text style={styles.cellHeaderText}>Produto (Implante)</Text>
            </View>
            <View style={[styles.cell, styles.colLote]}>
              <Text style={styles.cellHeaderText}>Nº Lote</Text>
            </View>
            <View style={[styles.cell, styles.colAnvisa]}>
              <Text style={styles.cellHeaderText}>Nº ANVISA</Text>
            </View>
            <View style={[styles.cell, styles.colValidade]}>
              <Text style={styles.cellHeaderText}>Validade</Text>
            </View>
            <View style={[styles.cell, styles.colQtd]}>
              <Text style={styles.cellHeaderText}>Qtd</Text>
            </View>
          </View>

          {rows.length === 0 ? (
            <View style={[styles.tableRow, styles.tableRowLast]}>
              <View style={styles.cell}>
                <Text style={styles.cellText}>Nenhum implante rastreado no período selecionado.</Text>
              </View>
            </View>
          ) : (
            rows.map((row, index) => (
              <View
                key={row.id}
                style={index === rows.length - 1 ? [styles.tableRow, styles.tableRowLast] : styles.tableRow}
              >
                <View style={[styles.cell, styles.colData]}>
                  <Text style={styles.cellText}>{formatDate(row.data)}</Text>
                </View>
                <View style={[styles.cell, styles.colPaciente]}>
                  <Text style={styles.cellText}>{row.paciente || '—'}</Text>
                </View>
                <View style={[styles.cell, styles.colProfissional]}>
                  <Text style={styles.cellText}>{row.profissional || '—'}</Text>
                </View>
                <View style={[styles.cell, styles.colProcedimento]}>
                  <Text style={styles.cellText}>{row.procedimento || '—'}</Text>
                </View>
                <View style={[styles.cell, styles.colProduto]}>
                  <Text style={styles.cellText}>{row.produto}</Text>
                </View>
                <View style={[styles.cell, styles.colLote]}>
                  <Text style={styles.cellText}>{row.numero_lote ?? '—'}</Text>
                </View>
                <View style={[styles.cell, styles.colAnvisa]}>
                  <Text style={styles.cellText}>{row.numero_anvisa ?? '—'}</Text>
                </View>
                <View style={[styles.cell, styles.colValidade]}>
                  <Text style={styles.cellText}>{row.data_validade ? formatDate(row.data_validade) : '—'}</Text>
                </View>
                <View style={[styles.cell, styles.colQtd]}>
                  <Text style={styles.cellText}>{row.qtd}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <View style={styles.footer} fixed>
          <Text
            style={styles.footerText}
            render={() => `Gerado pelo FYNXIA ERP em ${formatDate(geradoEm)} às ${formatTime(geradoEm)}`}
          />
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  )
}
