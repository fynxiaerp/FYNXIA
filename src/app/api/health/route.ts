// Public health check endpoint — stays public via isApiRoute in middleware.
// Must use Node.js runtime (not Edge) per CLAUDE.md anti-patterns:
// DB-touching routes need TCP connections; Edge Runtime has no `net` module.
export const runtime = 'nodejs'

export async function GET() {
  return Response.json({ status: 'ok', ts: new Date().toISOString() })
}
