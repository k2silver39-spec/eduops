'use client'

import { useSearchParams } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Suspense, useState } from 'react'

function PendingContent() {
  const searchParams = useSearchParams()
  const isNew = searchParams.get('new') === 'true'
  const router = useRouter()
  const [checking, setChecking] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')

  const handleCheckStatus = async () => {
    setChecking(true)
    setStatusMsg('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setStatusMsg('세션이 만료되었습니다. 다시 로그인해 주세요.')
      setChecking(false)
      return
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('status')
      .eq('id', user.id)
      .single()

    if (profile?.status === 'approved') {
      router.push('/')
    } else {
      setStatusMsg(`현재 상태: ${profile?.status ?? '알 수 없음'} — 아직 승인되지 않았습니다.`)
      setChecking(false)
    }
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              {isNew ? '가입이 완료되었습니다' : '승인 대기 중'}
            </h1>
            <p className="text-gray-500 text-sm leading-relaxed">
              {isNew
                ? '가입이 완료되었습니다.\n관리자 승인 후 이용 가능합니다.'
                : '현재 관리자 승인 대기 중입니다.\n승인 완료 후 서비스를 이용하실 수 있습니다.'}
            </p>
          </div>

          <div className="bg-yellow-50 rounded-lg px-4 py-3 mb-6">
            <p className="text-yellow-700 text-sm">
              승인 여부는 등록하신 이메일로 안내드립니다.
            </p>
          </div>

          <button
            onClick={handleCheckStatus}
            disabled={checking}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 px-4 rounded-lg text-sm transition mb-2"
          >
            {checking ? '확인 중...' : '승인 상태 확인'}
          </button>

          {statusMsg && (
            <p className="text-sm text-red-600 mb-2">{statusMsg}</p>
          )}

          <button
            onClick={handleLogout}
            className="w-full border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2.5 px-4 rounded-lg text-sm transition"
          >
            로그아웃
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PendingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-gray-400 text-sm">로딩 중...</div></div>}>
      <PendingContent />
    </Suspense>
  )
}
