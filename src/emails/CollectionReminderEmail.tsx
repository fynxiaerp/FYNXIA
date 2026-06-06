/**
 * CollectionReminderEmail — react-email template for collection ruler reminders
 *
 * FIN-07 / D-10: Sent by the Vercel Cron endpoint (src/app/api/cron/collection-ruler/route.ts)
 * when a receivable hits a due_date or overdue_N milestone.
 *
 * Pattern: mirrors InviteEmail.tsx (Html/Head/Body/Container/Heading/Text/Button)
 * Language: Brazilian Portuguese (pt-BR)
 */
import {
  Html,
  Head,
  Body,
  Container,
  Heading,
  Text,
  Button,
  Section,
  Hr,
} from '@react-email/components'

export interface CollectionReminderEmailProps {
  patientName: string
  clinicName: string
  chargeDescription: string
  amount: number
  dueDate: string     // formatted date string, e.g. '15/06/2026'
  isOverdue: boolean
}

/** Format amount as BRL — used server-side in email template */
function formatBRL(amount: number): string {
  return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function CollectionReminderEmail({
  patientName,
  clinicName,
  chargeDescription,
  amount,
  dueDate,
  isOverdue,
}: CollectionReminderEmailProps) {
  const subject = isOverdue
    ? `Cobrança em atraso — ${clinicName}`
    : `Lembrete de vencimento — ${clinicName}`

  const headingText = isOverdue
    ? 'Você tem uma cobrança em atraso'
    : 'Lembrete: cobrança com vencimento hoje'

  const bodyText = isOverdue
    ? `Olá, ${patientName}. Identificamos que a seguinte cobrança da ${clinicName} está em atraso. Por favor, regularize o quanto antes para evitar acúmulo de valores.`
    : `Olá, ${patientName}. Lembramos que a seguinte cobrança da ${clinicName} vence hoje.`

  return (
    <Html lang="pt-BR">
      <Head />
      <Body
        style={{
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          backgroundColor: '#f9fafb',
          margin: 0,
          padding: 0,
        }}
      >
        <Container
          style={{
            maxWidth: '600px',
            margin: '40px auto',
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          {/* Header */}
          <Section
            style={{
              backgroundColor: isOverdue ? '#7f1d1d' : '#0f172a',
              padding: '24px 32px',
            }}
          >
            <Heading
              style={{
                color: '#ffffff',
                fontSize: '24px',
                fontWeight: '700',
                margin: 0,
                letterSpacing: '-0.5px',
              }}
            >
              FYNXIA
            </Heading>
            <Text
              style={{
                color: '#94a3b8',
                fontSize: '12px',
                margin: '4px 0 0',
              }}
            >
              {subject}
            </Text>
          </Section>

          {/* Body */}
          <Section style={{ padding: '32px' }}>
            <Heading
              as="h2"
              style={{
                color: '#0f172a',
                fontSize: '20px',
                fontWeight: '600',
                marginTop: 0,
              }}
            >
              {headingText}
            </Heading>

            <Text style={{ color: '#374151', fontSize: '16px', lineHeight: '1.5' }}>
              {bodyText}
            </Text>

            {/* Charge details card */}
            <Section
              style={{
                backgroundColor: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                padding: '16px 20px',
                margin: '24px 0',
              }}
            >
              <Text
                style={{
                  color: '#374151',
                  fontSize: '14px',
                  fontWeight: '600',
                  margin: '0 0 8px',
                }}
              >
                Detalhes da cobrança
              </Text>
              <Text style={{ color: '#374151', fontSize: '14px', margin: '4px 0' }}>
                <strong>Descrição:</strong> {chargeDescription}
              </Text>
              <Text style={{ color: '#374151', fontSize: '14px', margin: '4px 0' }}>
                <strong>Valor:</strong> {formatBRL(amount)}
              </Text>
              <Text style={{ color: '#374151', fontSize: '14px', margin: '4px 0' }}>
                <strong>Vencimento:</strong> {dueDate}
              </Text>
            </Section>

            <Section style={{ textAlign: 'center', margin: '32px 0' }}>
              <Button
                href={`https://app.fynxia.com/clinica/financeiro/contas-a-receber`}
                style={{
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  padding: '14px 28px',
                  borderRadius: '6px',
                  fontSize: '16px',
                  fontWeight: '600',
                  textDecoration: 'none',
                  display: 'inline-block',
                }}
              >
                Ver detalhes da cobrança
              </Button>
            </Section>

            <Hr style={{ borderColor: '#e5e7eb', margin: '24px 0' }} />

            <Text
              style={{
                color: '#6b7280',
                fontSize: '13px',
                lineHeight: '1.5',
              }}
            >
              Este é um lembrete automático enviado por {clinicName} via FYNXIA ERP.
              Se você já efetuou o pagamento, por favor desconsidere esta mensagem.
            </Text>
          </Section>

          {/* Footer */}
          <Section
            style={{
              backgroundColor: '#f9fafb',
              padding: '16px 32px',
              borderTop: '1px solid #e5e7eb',
            }}
          >
            <Text style={{ color: '#9ca3af', fontSize: '12px', margin: 0 }}>
              FYNXIA — ERP Odontológico SaaS &bull; Brasil
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
