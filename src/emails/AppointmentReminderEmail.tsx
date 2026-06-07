/**
 * AppointmentReminderEmail — react-email template for appointment reminders
 *
 * COMMS-02: Sent by the Vercel Cron endpoint (src/app/api/cron/reminder-dispatch/route.ts)
 * 24h before the appointment (daily batch at ~08:00 BRT).
 *
 * Pattern: mirrors CollectionReminderEmail.tsx (Html/Head/Body/Container/Heading/Text/Button)
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

export interface AppointmentReminderEmailProps {
  patientName: string
  clinicName: string
  appointmentDate: string   // formatted date string, e.g. '15/06/2026'
  appointmentTime: string   // formatted time string, e.g. '14:00'
  dentistName: string
}

export function AppointmentReminderEmail({
  patientName,
  clinicName,
  appointmentDate,
  appointmentTime,
  dentistName,
}: AppointmentReminderEmailProps) {
  const subject = `Lembrete: sua consulta é amanhã — ${clinicName}`

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
              backgroundColor: '#0f172a',
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
              Lembrete: sua consulta é amanhã
            </Heading>

            <Text style={{ color: '#374151', fontSize: '16px', lineHeight: '1.5' }}>
              Olá, {patientName}! Lembramos que você tem uma consulta agendada para amanhã
              na {clinicName}. Confirme sua presença ou entre em contato caso precise remarcar.
            </Text>

            {/* Appointment details card */}
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
                Detalhes da consulta
              </Text>
              <Text style={{ color: '#374151', fontSize: '14px', margin: '4px 0' }}>
                <strong>Data:</strong> {appointmentDate}
              </Text>
              <Text style={{ color: '#374151', fontSize: '14px', margin: '4px 0' }}>
                <strong>Horário:</strong> {appointmentTime}
              </Text>
              <Text style={{ color: '#374151', fontSize: '14px', margin: '4px 0' }}>
                <strong>Dentista:</strong> {dentistName}
              </Text>
              <Text style={{ color: '#374151', fontSize: '14px', margin: '4px 0' }}>
                <strong>Clínica:</strong> {clinicName}
              </Text>
            </Section>

            <Section style={{ textAlign: 'center', margin: '32px 0' }}>
              <Button
                href="https://app.fynxia.com/clinica/agenda"
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
                Ver minha agenda
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
              Se precisar remarcar ou cancelar sua consulta, entre em contato diretamente
              com a clínica.
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
