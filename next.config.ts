import type { NextConfig } from 'next'

// ─── SEC-06: Content Security Policy ─────────────────────────────────────────
// D-11: Static headers via next.config.ts (no nonce — avoids forced dynamic render penalty).
// unsafe-inline accepted for internal ERP context (no third-party scripts — see RESEARCH §A3).
// Pitfall 9: connect-src MUST include wss://*.supabase.co (Realtime) + both Asaas hosts.
const isDev = process.env.NODE_ENV === 'development'

const cspValue = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https://fonts.gstatic.com",
  "font-src 'self' https://fonts.gstatic.com",
  // Supabase Realtime WebSocket + Asaas REST (both sandbox and production)
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.asaas.com https://api-sandbox.asaas.com",
  // Clickjacking defense: T-3-sec06-T
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  'upgrade-insecure-requests',
].join('; ')

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/(.*)',
        headers: [
          // Anti-clickjacking (T-3-sec06-T)
          { key: 'X-Frame-Options', value: 'DENY' },
          // Prevent MIME sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Referrer control
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // HSTS — 2 years, subdomains, preload
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          // CSP — static, not nonce-based (see RESEARCH §Pattern 4 + §A3)
          { key: 'Content-Security-Policy', value: cspValue },
        ],
      },
    ]
  },
}

export default nextConfig
