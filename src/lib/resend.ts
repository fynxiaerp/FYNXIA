import 'server-only'
import { Resend } from 'resend'

export const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? 'FYNXIA <onboarding@resend.dev>'

// Lazy singleton — defer instantiation until first use so that missing
// RESEND_API_KEY during `next build` static analysis does not throw.
// At runtime the env var is always present (set in Vercel project settings).
let _resend: Resend | null = null

export function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY)
  }
  return _resend
}

/** @deprecated Use getResend() instead to avoid build-time init errors. */
export const resend = {
  emails: {
    send: (...args: Parameters<Resend['emails']['send']>) =>
      getResend().emails.send(...args),
  },
}
