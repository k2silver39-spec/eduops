import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const email = formData.get('email')?.toString() ?? ''
  const password = formData.get('password')?.toString() ?? ''

  const redirectUrl = new URL('/auth/login', request.url)
  redirectUrl.searchParams.set('error', '1')

  const successRedirect = new URL('/', request.url)
  const successResponse = NextResponse.redirect(successRedirect)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            successResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return NextResponse.redirect(redirectUrl)
  }

  return successResponse
}
