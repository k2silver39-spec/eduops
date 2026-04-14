import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  // 세션 관리용 (anon key + cookies)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 프로필 조회용 (service role key — RLS 우회)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // 비로그인 사용자가 /auth/* 또는 /api/* 외 경로 접근 시 로그인으로 리다이렉트
  // (API 라우트는 자체적으로 인증을 처리)
  if (!user && !pathname.startsWith('/auth') && !pathname.startsWith('/api')) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // 로그인 사용자에 대한 처리
  if (user) {
    const getProfile = async () => {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('status, role')
        .eq('id', user.id)
        .single()
      return data
    }

    // /auth/login, /auth/signup, /auth/pending 접근 시 상태에 따라 리다이렉트
    if (pathname === '/auth/login' || pathname === '/auth/signup' || pathname === '/auth/pending') {
      const profile = await getProfile()

      if (profile) {
        if (profile.status === 'pending') {
          return NextResponse.redirect(new URL('/auth/pending', request.url))
        } else if (profile.status === 'rejected') {
          return NextResponse.redirect(new URL('/auth/rejected', request.url))
        } else if (profile.status === 'approved') {
          return NextResponse.redirect(new URL('/', request.url))
        }
      }
    }

    // pending/rejected 사용자 접근 제한
    if (!pathname.startsWith('/auth')) {
      const profile = await getProfile()

      if (profile) {
        if (profile.status === 'pending') {
          return NextResponse.redirect(new URL('/auth/pending', request.url))
        }
        if (profile.status === 'rejected') {
          return NextResponse.redirect(new URL('/auth/rejected', request.url))
        }

        // /admin/* 경로는 super_admin만 접근 가능
        if (pathname.startsWith('/admin') && profile.role !== 'super_admin') {
          return NextResponse.redirect(new URL('/', request.url))
        }
      }
    }
  }

  return supabaseResponse
}
