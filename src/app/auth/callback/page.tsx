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

    const next = searchParams.get('next') ?? '/'
    const code = searchParams.get('code')

    const supabase = createClient()

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

    // implicit flow: wait for onAuthStateChange to fire with SIGNED_IN
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        subscription.unsubscribe()
        router.replace(next)
      } else if (event === 'SIGNED_OUT') {
        subscription.unsubscribe()
        router.replace('/auth/login?error=1')
      }
    })

    // fallback: if nothing fires in 5s, redirect to login
    const timer = setTimeout(() => {
      subscription.unsubscribe()
      router.replace('/auth/login?error=1')
    }, 5000)

    return () => {
      clearTimeout(timer)
      subscription.unsubscribe()
    }
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
