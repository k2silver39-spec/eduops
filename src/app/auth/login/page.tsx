'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

const LS_ATTEMPTS = 'eduops_login_attempts'
const LS_LOCK     = 'eduops_login_lock'
const MAX_ATTEMPTS = 5
const LOCK_MS      = 3 * 60 * 1000  // 3분

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  ) : (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  )
}

function fmt(secs: number) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return m > 0 ? `${m}분 ${s}초` : `${s}초`
}

function LoginForm() {
  const searchParams = useSearchParams()
  const isTimeout = searchParams.get('reason') === 'timeout'
  const hasError  = searchParams.get('error') === '1'

  const [formData, setFormData] = useState({ email: '', password: '' })
  const [showPw, setShowPw]     = useState(false)
  const [error, setError]       = useState(
    isTimeout ? '보안을 위해 자동 로그아웃되었습니다.' :
    hasError  ? '이메일 또는 비밀번호가 올바르지 않습니다.' : ''
  )
  const [loading, setLoading]   = useState(false)

  // 잠금 상태
  const [failCount, setFailCount]   = useState(0)
  const [lockUntil, setLockUntil]   = useState<number | null>(null)
  const [countdown, setCountdown]   = useState(0)

  // 마운트 시 기존 잠금 정보 복원
  useEffect(() => {
    const count = parseInt(localStorage.getItem(LS_ATTEMPTS) ?? '0')
    const lock  = parseInt(localStorage.getItem(LS_LOCK) ?? '0')
    setFailCount(count)
    if (lock > Date.now()) setLockUntil(lock)
  }, [])

  // 잠금 중 카운트다운
  useEffect(() => {
    if (!lockUntil) return
    const tick = () => {
      const rem = lockUntil - Date.now()
      if (rem <= 0) {
        setLockUntil(null)
        setFailCount(0)
        setCountdown(0)
        localStorage.removeItem(LS_ATTEMPTS)
        localStorage.removeItem(LS_LOCK)
      } else {
        setCountdown(Math.ceil(rem / 1000))
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [lockUntil])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData({ ...formData, [e.target.name]: e.target.value })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (lockUntil) return
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, password: formData.password }),
      })

      if (!res.ok) {
        const newCount = failCount + 1
        setFailCount(newCount)
        localStorage.setItem(LS_ATTEMPTS, newCount.toString())

        if (newCount >= MAX_ATTEMPTS) {
          const lockTime = Date.now() + LOCK_MS
          setLockUntil(lockTime)
          localStorage.setItem(LS_LOCK, lockTime.toString())
          setError('로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.')
        } else {
          setError('이메일 또는 비밀번호가 올바르지 않습니다.')
        }
        setLoading(false)
        return
      }

      // 성공 시 실패 카운트 초기화
      localStorage.removeItem(LS_ATTEMPTS)
      localStorage.removeItem(LS_LOCK)
      window.location.href = '/'
    } catch {
      setError('네트워크 오류가 발생했습니다.')
      setLoading(false)
    }
  }

  const isLocked = !!lockUntil

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900">로그인</h1>
            <p className="mt-2 text-sm text-gray-500">의료AI 사업관리시스템</p>
          </div>

          <form onSubmit={handleSubmit} method="POST" action="/api/auth/login-form" className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
              <input
                id="email" name="email" type="email" required
                value={formData.email} onChange={handleChange}
                placeholder="example@email.com"
                disabled={isLocked}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
              <div className="relative">
                <input
                  id="password" name="password"
                  type={showPw ? 'text' : 'password'} required
                  value={formData.password} onChange={handleChange}
                  placeholder="비밀번호 입력"
                  disabled={isLocked}
                  className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition disabled:bg-gray-50 disabled:text-gray-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                >
                  <EyeIcon open={showPw} />
                </button>
              </div>
            </div>

            {error && (
              <div className={`text-sm px-3 py-2.5 rounded-lg ${isTimeout ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'}`}>
                {error}
                {isLocked && countdown > 0 && (
                  <span className="block mt-0.5 font-medium">{fmt(countdown)} 후 재시도 가능</span>
                )}
              </div>
            )}

            {isLocked && !error && countdown > 0 && (
              <div className="bg-red-50 text-red-600 text-sm px-3 py-2.5 rounded-lg">
                로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.
                <span className="block mt-0.5 font-medium">{fmt(countdown)} 후 재시도 가능</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || isLocked}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-medium py-2.5 px-4 rounded-lg text-sm transition mt-2"
            >
              {loading ? '로그인 중...' : isLocked ? `잠금 중 (${fmt(countdown)})` : '로그인'}
            </button>
          </form>

          <div className="mt-6 flex flex-col items-center gap-2 text-sm text-gray-500">
            <Link href="/auth/forgot-password" className="text-blue-600 hover:text-blue-700 font-medium">
              비밀번호를 잊으셨나요?
            </Link>
            <p>
              계정이 없으신가요?{' '}
              <Link href="/auth/signup" className="text-blue-600 hover:text-blue-700 font-medium">
                회원가입
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
