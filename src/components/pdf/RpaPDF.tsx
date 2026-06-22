/**
 * RpaPDF — Recibo de Pagamento a Autônomo (RPA) para @react-pdf/renderer
 * Phase 16 / Plan 08 — TRIB-02
 *
 * CRITICAL CONSTRAINTS (CLAUDE.md + Phase 16 Pitfall 7):
 * - Flexbox ONLY — sem CSS Grid (não suportado pelo @react-pdf/renderer)
 * - Font.register com Roboto (Latin Extended) — necessário para ã/ç/ê/õ
 * - Node.js runtime only (server-only; rota usa export const runtime = 'nodejs')
 * - Sem 'use client' — módulo server-only
 *
 * Espelha ReceiboPDF.tsx exatamente (Document/Page/View/Text, StyleSheet Flexbox, fontes).
 */
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'

// ─── Font registration (idêntico ao ReceiboPDF.tsx) ──────────────────────────
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

// ─── Helper: formatar BRL ─────────────────────────────────────────────────────
function formatBRL(amount: number): string {
  return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ─── Helper: formatar data pt-BR ─────────────────────────────────────────────
function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// ─── Styles (Flexbox only — sem display:'grid') ───────────────────────────────
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
  docTitle: {
    fontFamily: 'Roboto',
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
  },
  rpaNumero: {
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
    width: 130,
    fontWeight: 700,
  },
  infoValue: {
    fontFamily: 'Roboto',
    fontSize: 11,
    color: '#111827',
    flex: 1,
  },
  // Retenções card
  retencoesCard: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  // Valores destacados
  amountRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  amountLabel: {
    fontFamily: 'Roboto',
    fontSize: 9,
    color: '#6B7280',
    width: 130,
    fontWeight: 700,
  },
  amountValue: {
    fontFamily: 'Roboto',
    fontSize: 12,
    fontWeight: 700,
    color: '#111827',
    flex: 1,
  },
  amountValueLiquido: {
    fontFamily: 'Roboto',
    fontSize: 13,
    fontWeight: 700,
    color: '#059669',
    flex: 1,
  },
  // Separador leve entre linhas de retenção
  retencaoRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  retencaoLabel: {
    fontFamily: 'Roboto',
    fontSize: 9,
    color: '#6B7280',
    width: 130,
  },
  retencaoValue: {
    fontFamily: 'Roboto',
    fontSize: 11,
    color: '#DC2626',
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
    paddingTop: 8,
  },
  footerText: {
    fontFamily: 'Roboto',
    fontSize: 9,
    color: '#6B7280',
  },
})

// ─── Props ────────────────────────────────────────────────────────────────────

export interface RpaPDFProps {
  numero: string
  competencia: string
  prestadorNome: string
  prestadorDoc: string
  valorBruto: number
  valorInss: number
  valorIrrf: number
  valorIss: number
  valorLiquido: number
  dataPagamento: string  // YYYY-MM-DD
  clinicaNome: string
}

// ─── PDF Component ────────────────────────────────────────────────────────────

export function RpaPDF({
  numero,
  competencia,
  prestadorNome,
  prestadorDoc,
  valorBruto,
  valorInss,
  valorIrrf,
  valorIss,
  valorLiquido,
  dataPagamento,
  clinicaNome,
}: RpaPDFProps) {
  const generatedAt = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const [compYear, compMonth] = competencia.split('-')
  const competenciaFormatada = `${compMonth}/${compYear}`

  return (
    <Document
      title={`RPA ${numero} — ${prestadorNome}`}
      author={clinicaNome}
      subject="Recibo de Pagamento a Autônomo"
      creator="FYNXIA ERP"
    >
      <Page size="A4" style={styles.page}>
        {/* ── Header ─────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.clinicName}>{clinicaNome}</Text>
            <Text style={styles.docTitle}>Recibo de Pagamento a Autônomo (RPA)</Text>
          </View>
          <View>
            <Text style={styles.rpaNumero}>{numero}</Text>
            <Text style={styles.rpaNumero}>Gerado em: {generatedAt}</Text>
          </View>
        </View>

        {/* ── Dados do Prestador ─────────────────────────────────── */}
        <Text style={styles.sectionHeading}>Dados do Prestador</Text>
        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Nome / Razão Social</Text>
          <Text style={styles.infoValue}>{prestadorNome}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>CPF / CNPJ</Text>
          <Text style={styles.infoValue}>{prestadorDoc}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Competência</Text>
          <Text style={styles.infoValue}>{competenciaFormatada}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Data de Pagamento</Text>
          <Text style={styles.infoValue}>{formatDate(dataPagamento)}</Text>
        </View>

        {/* ── Valores e Retenções ────────────────────────────────── */}
        <Text style={styles.sectionHeading}>Valores e Retenções</Text>
        <View style={styles.divider} />

        <View style={styles.retencoesCard}>
          {/* Valor Bruto */}
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Valor Bruto</Text>
            <Text style={styles.amountValue}>{formatBRL(valorBruto)}</Text>
          </View>

          {/* INSS */}
          <View style={styles.retencaoRow}>
            <Text style={styles.retencaoLabel}>(−) INSS Retido</Text>
            <Text style={styles.retencaoValue}>{formatBRL(valorInss)}</Text>
          </View>

          {/* IRRF */}
          <View style={styles.retencaoRow}>
            <Text style={styles.retencaoLabel}>(−) IRRF Retido</Text>
            <Text style={styles.retencaoValue}>{formatBRL(valorIrrf)}</Text>
          </View>

          {/* ISS */}
          {valorIss > 0 && (
            <View style={styles.retencaoRow}>
              <Text style={styles.retencaoLabel}>(−) ISS Retido</Text>
              <Text style={styles.retencaoValue}>{formatBRL(valorIss)}</Text>
            </View>
          )}

          {/* Separador */}
          <View style={styles.divider} />

          {/* Valor Líquido */}
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Valor Líquido a Pagar</Text>
            <Text style={styles.amountValueLiquido}>{formatBRL(valorLiquido)}</Text>
          </View>
        </View>

        {/* ── Observações ────────────────────────────────────────── */}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Observação</Text>
          <Text style={styles.infoValue}>
            Documento gerado eletronicamente. As retenções acima foram calculadas conforme
            legislação vigente (INSS — contribuinte individual; IRRF — base = Bruto − INSS;
            ISS — conforme alíquota municipal).
          </Text>
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
