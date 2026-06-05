/**
 * ProntuarioPDF — prontuário layout for @react-pdf/renderer
 *
 * CRITICAL CONSTRAINTS (CLAUDE.md + 02-RESEARCH.md Pitfall 6):
 * - Flexbox ONLY — no CSS Grid (not supported by @react-pdf/renderer)
 * - Font.register with Roboto (Latin Extended) before use — required for ã/ç/ê/õ
 * - Node.js runtime only (route handler sets export const runtime = 'nodejs')
 * - No 'use client' — this is a server-only module
 */
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'

// ─── Font registration ────────────────────────────────────────────────────────
// Pitfall 6: built-in fonts (Helvetica) do not support Latin Extended.
// Roboto from Google Fonts includes full Latin Extended (ã, ç, ê, õ, etc.)
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

// ─── Styles ───────────────────────────────────────────────────────────────────
// PDF Layout Contract (02-UI-SPEC):
// - A4, margins: 40pt top/bottom, 48pt left/right
// - Body: 11pt/400, Section heading: 14pt/700, Metadata: 9pt #6B7280
// - Colors: text #111827, section headers #374151, dividers #E5E7EB
// - Flexbox only — no display: 'grid'

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
  clinicName: {
    fontFamily: 'Roboto',
    fontSize: 14,
    fontWeight: 700,
    color: '#374151',
  },
  headerDate: {
    fontFamily: 'Roboto',
    fontSize: 9,
    color: '#6B7280',
    textAlign: 'right',
  },
  // Patient info block
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
  patientInfoRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  patientInfoLabel: {
    fontFamily: 'Roboto',
    fontSize: 9,
    color: '#6B7280',
    width: 80,
    fontWeight: 700,
  },
  patientInfoValue: {
    fontFamily: 'Roboto',
    fontSize: 11,
    color: '#111827',
    flex: 1,
  },
  // Medical record card
  recordCard: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  recordMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  recordDate: {
    fontFamily: 'Roboto',
    fontSize: 9,
    color: '#6B7280',
  },
  recordDentist: {
    fontFamily: 'Roboto',
    fontSize: 9,
    color: '#6B7280',
  },
  recordFieldLabel: {
    fontFamily: 'Roboto',
    fontSize: 9,
    fontWeight: 700,
    color: '#374151',
    textTransform: 'uppercase',
    marginBottom: 2,
    marginTop: 6,
  },
  recordFieldValue: {
    fontFamily: 'Roboto',
    fontSize: 11,
    color: '#111827',
    lineHeight: 1.5,
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
  emptyState: {
    fontFamily: 'Roboto',
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 24,
  },
})

// ─── Types ────────────────────────────────────────────────────────────────────

interface PatientData {
  full_name: string
  cpf: string
  date_of_birth: string | null
  phone: string | null
  email: string | null
}

interface MedicalRecordData {
  id: string
  created_at: string
  diagnosis: string | null
  treatment_plan: string | null
  prescription: string | null
  dentist: { full_name: string } | null
}

interface ProntuarioPDFProps {
  patient: PatientData
  records: MedicalRecordData[]
  clinicName: string
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
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ─── PDF Component ────────────────────────────────────────────────────────────

export function ProntuarioPDF({
  patient,
  records,
  clinicName,
}: ProntuarioPDFProps) {
  const generatedAt = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <Document
      title={`Prontuário — ${patient.full_name}`}
      author={clinicName}
      subject="Prontuário Odontológico"
      creator="FYNXIA ERP"
    >
      <Page size="A4" style={styles.page}>
        {/* ── Header ────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.clinicName}>{clinicName}</Text>
          <Text style={styles.headerDate}>
            Gerado em: {generatedAt}
          </Text>
        </View>

        {/* ── Patient info block ─────────────────────────────────── */}
        <Text style={styles.sectionHeading}>Dados do Paciente</Text>
        <View style={styles.divider} />

        <View style={styles.patientInfoRow}>
          <Text style={styles.patientInfoLabel}>Nome</Text>
          <Text style={styles.patientInfoValue}>{patient.full_name}</Text>
        </View>

        <View style={styles.patientInfoRow}>
          <Text style={styles.patientInfoLabel}>CPF</Text>
          {/* CPF is plaintext in PDF — privileged operation per PDF Layout Contract */}
          <Text style={styles.patientInfoValue}>{patient.cpf}</Text>
        </View>

        {patient.date_of_birth && (
          <View style={styles.patientInfoRow}>
            <Text style={styles.patientInfoLabel}>Nascimento</Text>
            <Text style={styles.patientInfoValue}>
              {formatDate(patient.date_of_birth)}
            </Text>
          </View>
        )}

        {patient.phone && (
          <View style={styles.patientInfoRow}>
            <Text style={styles.patientInfoLabel}>Telefone</Text>
            <Text style={styles.patientInfoValue}>{patient.phone}</Text>
          </View>
        )}

        {/* ── Medical records (chronological) ────────────────────── */}
        <Text style={styles.sectionHeading}>
          Histórico de Atendimentos ({records.length})
        </Text>
        <View style={styles.divider} />

        {records.length === 0 ? (
          <Text style={styles.emptyState}>
            Nenhum prontuário registrado para este paciente.
          </Text>
        ) : (
          records.map((record) => (
            <View key={record.id} style={styles.recordCard}>
              {/* Record metadata row — Flexbox, not table */}
              <View style={styles.recordMeta}>
                <Text style={styles.recordDate}>
                  {formatDateTime(record.created_at)}
                </Text>
                <Text style={styles.recordDentist}>
                  Dr(a). {record.dentist?.full_name ?? 'Dentista'}
                </Text>
              </View>

              {record.diagnosis && (
                <>
                  <Text style={styles.recordFieldLabel}>Diagnóstico</Text>
                  <Text style={styles.recordFieldValue}>{record.diagnosis}</Text>
                </>
              )}

              {record.treatment_plan && (
                <>
                  <Text style={styles.recordFieldLabel}>Plano de Tratamento</Text>
                  <Text style={styles.recordFieldValue}>{record.treatment_plan}</Text>
                </>
              )}

              {record.prescription && (
                <>
                  <Text style={styles.recordFieldLabel}>Prescrição</Text>
                  <Text style={styles.recordFieldValue}>{record.prescription}</Text>
                </>
              )}
            </View>
          ))
        )}

        {/* ── Footer ────────────────────────────────────────────── */}
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
