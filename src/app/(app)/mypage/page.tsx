'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Profile {
  email: string
  organization: string
}

export default function MyPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  // Password change
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwLoading, setPwLoading] = useState(false)
  const [pwMsg, setPwMsg] = useState('')
  const [pwError, setPwError] = useState('')

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/profile')
      if (res.status === 401) return router.push('/auth/login')
      if (res.ok) {
        const data = await res.json()
        setProfile(data)
      }
      setLoading(false)
    }
    load()
  }, [router])

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwError('')
    setPwMsg('')

    if (pwForm.next !== pwForm.confirm) {
      setPwError('새 비밀번호가 일치하지 않습니다.')
      return
    }
    if (pwForm.next.length < 6) {
      setPwError('새 비밀번호는 6자 이상이어야 합니다.')
      return
    }

    setPwLoading(true)

    const res = await fetch('/api/profile/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }),
    })
    const data = await res.json()

    if (!res.ok) {
      setPwError(data.error === 'wrong_password' ? '현재 비밀번호가 올바르지 않습니다.' : '비밀번호 변경에 실패했습니다.')
    } else {
      setPwMsg('비밀번호가 변경되었습니다.')
      setPwForm({ current: '', next: '', confirm: '' })
    }
    setPwLoading(false)
    setTimeout(() => setPwMsg(''), 3000)
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-sm text-gray-400">불러오는 중...</div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-4">

      {/* Profile Info */}
      <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">프로필 정보</h2>
        </div>
        <div className="px-4 py-4 space-y-3">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">이메일</p>
            <p className="text-sm text-gray-700">{profile?.email}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">소속 기관</p>
            <p className="text-sm text-gray-700">{profile?.organization || '—'}</p>
          </div>
        </div>
      </section>

      {/* Password Change */}
      <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">비밀번호 변경</h2>
        </div>
        <form onSubmit={handlePasswordChange} className="px-4 py-4 space-y-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">현재 비밀번호</label>
            <input
              type="password"
              value={pwForm.current}
              onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">새 비밀번호</label>
            <input
              type="password"
              value={pwForm.next}
              onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })}
              required
              placeholder="6자 이상"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">새 비밀번호 확인</label>
            <input
              type="password"
              value={pwForm.confirm}
              onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>

          {pwError && <p className="text-xs text-red-600">{pwError}</p>}
          {pwMsg && <p className="text-xs text-blue-600">{pwMsg}</p>}

          <button
            type="submit"
            disabled={pwLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-lg text-sm transition"
          >
            {pwLoading ? '변경 중...' : '비밀번호 변경'}
          </button>
        </form>
      </section>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full border border-gray-300 hover:bg-gray-50 text-gray-600 font-medium py-2.5 rounded-xl text-sm transition"
      >
        로그아웃
      </button>
    </div>
  )
}
