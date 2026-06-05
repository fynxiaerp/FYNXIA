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

export interface InviteEmailProps {
  inviterName: string
  clinicName: string
  inviteUrl: string
  role: string
  expiresInHours: number
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  dentist: 'Dentista',
  receptionist: 'Recepcionista',
  patient: 'Paciente',
  superadmin: 'Superadmin',
}

export function InviteEmail({
  inviterName,
  clinicName,
  inviteUrl,
  role,
  expiresInHours,
}: InviteEmailProps) {
  const roleLabel = ROLE_LABELS[role] ?? role

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
              ERP Odontológico
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
              Você foi convidado para {clinicName}
            </Heading>

            <Text style={{ color: '#374151', fontSize: '16px', lineHeight: '1.5' }}>
              <strong>{inviterName}</strong> convidou você para entrar na clínica{' '}
              <strong>{clinicName}</strong> como <strong>{roleLabel}</strong>.
            </Text>

            <Text style={{ color: '#374151', fontSize: '16px', lineHeight: '1.5' }}>
              Clique no botão abaixo para aceitar o convite e definir sua senha de acesso.
            </Text>

            <Section style={{ textAlign: 'center', margin: '32px 0' }}>
              <Button
                href={inviteUrl}
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
                Aceitar convite
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
              Este convite expira em <strong>{expiresInHours} horas</strong>. Se você não
              esperava receber este e-mail, pode ignorá-lo com segurança.
            </Text>

            <Text style={{ color: '#9ca3af', fontSize: '12px', marginTop: '8px' }}>
              Ou copie e cole este link no navegador:
              <br />
              <span style={{ color: '#3b82f6', wordBreak: 'break-all' }}>{inviteUrl}</span>
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
