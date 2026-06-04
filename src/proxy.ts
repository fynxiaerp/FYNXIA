import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  const { user, supabaseResponse } = await updateSession(request)

  const pathname = request.nextUrl.pathname

  const isAuthRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/forgot-password')

  // API routes are public — health check and future webhook endpoints
  const isApiRoute = pathname.startsWith('/api')

  // Unauthenticated user accessing a protected route → redirect to login
  if (!user && !isAuthRoute && !isApiRoute) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirectedFrom', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Authenticated user accessing auth pages → redirect to dashboard
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/clinica', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
