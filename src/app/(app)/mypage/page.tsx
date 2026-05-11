'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PushPermission from '@/components/notifications/PushPermission'

interface Profile {
  email: string
  organization: string
  role: 'super_admin' | 'user'
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

  // Withdraw
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [withdrawPassword, setWithdrawPassword] = useState('')
  const [withdrawConfirmText, setWithdrawConfirmText] = useState('')
  const [withdrawLoading, setWithdrawLoading] = useState(false)
  const [withdrawError, setWithdrawError] = useState('')

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

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault()
    setWithdrawError('')

    if (withdrawConfirmText.trim() !== '탈퇴') {
      setWithdrawError('확인 문구를 정확히 입력해주세요.')
      return
    }
    if (!withdrawPassword) {
      setWithdrawError('비밀번호를 입력해주세요.')
      return
    }

    setWithdrawLoading(true)
    const res = await fetch('/api/profile', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: withdrawPassword }),
    })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      const msg =
        data.error === 'wrong_password' ? '비밀번호가 올바르지 않습니다.' :
        data.error === 'admin_cannot_withdraw' ? '관리자 계정은 직접 탈퇴할 수 없습니다.' :
        '계정 탈퇴에 실패했습니다. 잠시 후 다시 시도해주세요.'
      setWithdrawError(msg)
      setWithdrawLoading(false)
      return
    }

    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/auth/login')
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

      {/* Push Notifications */}
      <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">푸시 알림</h2>
        </div>
        <div className="px-4 py-4">
          <PushPermission />
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

      {/* Withdraw */}
      {profile?.role !== 'super_admin' && (
        <section className="bg-white border border-red-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-red-100">
            <h2 className="text-sm font-semibold text-red-600">계정 탈퇴</h2>
          </div>

          {!withdrawOpen ? (
            <div className="px-4 py-4 space-y-3">
              <p className="text-xs text-gray-500 leading-relaxed">
                계정을 탈퇴하면 작성하신 보고서·문의·첨부파일·알림 설정이 모두 영구 삭제되며 복구할 수 없습니다.
              </p>
              <button
                type="button"
                onClick={() => { setWithdrawOpen(true); setWithdrawError(''); setWithdrawPassword(''); setWithdrawConfirmText('') }}
                className="w-full border border-red-300 hover:bg-red-50 text-red-600 font-medium py-2.5 rounded-lg text-sm transition"
              >
                계정 탈퇴 진행
              </button>
            </div>
          ) : (
            <form onSubmit={handleWithdraw} className="px-4 py-4 space-y-3">
              <p className="text-xs text-red-600 leading-relaxed">
                이 작업은 되돌릴 수 없습니다. 계속하려면 비밀번호와 확인 문구를 입력하세요.
              </p>
              <div>
                <label className="text-xs text-gray-400 block mb-1">비밀번호</label>
                <input
                  type="password"
                  value={withdrawPassword}
                  onChange={(e) => setWithdrawPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">
                  확인 문구 <span className="text-red-500 font-medium">탈퇴</span> 를 입력하세요
                </label>
                <input
                  type="text"
                  value={withdrawConfirmText}
                  onChange={(e) => setWithdrawConfirmText(e.target.value)}
                  required
                  placeholder="탈퇴"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition"
                />
              </div>
              {withdrawError && <p className="text-xs text-red-600">{withdrawError}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setWithdrawOpen(false); setWithdrawError(''); setWithdrawPassword(''); setWithdrawConfirmText('') }}
                  disabled={withdrawLoading}
                  className="flex-1 border border-gray-300 hover:bg-gray-50 text-gray-600 font-medium py-2.5 rounded-lg text-sm transition disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={withdrawLoading}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium py-2.5 rounded-lg text-sm transition"
                >
                  {withdrawLoading ? '처리 중...' : '영구 탈퇴'}
                </button>
              </div>
            </form>
          )}
        </section>
      )}
    </div>
  )
}
