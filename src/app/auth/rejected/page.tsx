'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function RejectedPage() {
  const router = useRouter()

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
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">가입이 거절되었습니다</h1>
            <p className="text-gray-500 text-sm leading-relaxed">
              가입이 거절되었습니다.<br />
              관리자에게 문의하세요.
            </p>
          </div>

          <div className="bg-red-50 rounded-lg px-4 py-3 mb-6">
            <p className="text-red-700 text-sm">
              가입 관련 문의는 관리자에게 직접 연락 바랍니다.
            </p>
          </div>

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
