import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  // CRITICAL (H-4): Create response first so we can write cookies to BOTH
  // request AND response — prevents JWT refresh token race condition
  const supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            // Must write to BOTH request and response (H-4 prevention)
            request.cookies.set(name, value)
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // CRITICAL (C-4): Always getUser(), NEVER getSession()
  // getUser() validates the JWT against the Supabase Auth server
  // getSession() only validates format — allows forged JWTs to pass
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { user, supabaseResponse }
}
