// IN-03: DEFERRED — branded password-reset template, not yet wired into any action.
// Phase 1 uses Supabase's built-in recovery email (see `sendPasswordReset` in
// `src/actions/auth.ts`). To activate this template in a future phase: generate the
// recovery link with the admin client (`admin.auth.admin.generateLink({ type: 'recovery' })`)
// and send it via Resend (`resend.emails.send`), mirroring the invite email flow.
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

export interface PasswordResetEmailProps {
  resetUrl: string
  expiresInHours: number
}

export function PasswordResetEmail({ resetUrl, expiresInHours }: PasswordResetEmailProps) {
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
              Redefinição de senha
            </Heading>

            <Text style={{ color: '#374151', fontSize: '16px', lineHeight: '1.5' }}>
              Recebemos uma solicitação para redefinir a senha da sua conta FYNXIA.
            </Text>

            <Text style={{ color: '#374151', fontSize: '16px', lineHeight: '1.5' }}>
              Clique no botão abaixo para criar uma nova senha:
            </Text>

            <Section style={{ textAlign: 'center', margin: '32px 0' }}>
              <Button
                href={resetUrl}
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
                Redefinir senha
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
              Este link expira em <strong>{expiresInHours} horas</strong>. Se você não
              solicitou a redefinição de senha, ignore este e-mail — sua conta permanece segura.
            </Text>

            <Text style={{ color: '#9ca3af', fontSize: '12px', marginTop: '8px' }}>
              Ou copie e cole este link no navegador:
              <br />
              <span style={{ color: '#3b82f6', wordBreak: 'break-all' }}>{resetUrl}</span>
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
