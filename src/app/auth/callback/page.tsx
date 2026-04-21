'use client'

import { useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Suspense } from 'react'

function CallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const next = searchParams.get('next') ?? '/auth/reset-password'
    const code = searchParams.get('code')
    const errorCode = searchParams.get('error_code')
    const errorDesc = searchParams.get('error_description')
    const accessToken = searchParams.get('access_token')

    // 에러 파라미터가 있으면 로그인 페이지로
    if (errorCode || errorDesc) {
      router.replace('/auth/login?error=1')
      return
    }

    const supabase = createClient()

    // 1. code 파라미터가 있으면 PKCE 방식으로 세션 교환
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          router.replace('/auth/login?error=1')
        } else {
          router.replace(next)
        }
      })
      return
    }

    // 2. access_token이 있으면 직접 설정
    if (accessToken) {
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: searchParams.get('refresh_token') || '',
      }).then(({ error }) => {
        if (error) {
          router.replace('/auth/login?error=1')
        } else {
          router.replace(next)
        }
      })
      return
    }

    // 3. 그 외: 세션 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace(next)
      } else {
        router.replace('/auth/login?error=1')
      }
    })
  }, [router, searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-500">인증 처리 중입니다...</p>
      </div>
    </div>
  )
}

export default function CallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  )
}
