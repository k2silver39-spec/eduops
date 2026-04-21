'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const IDLE_TIMEOUT = 2 * 60 * 60 * 1000  // 2시간
const WARN_BEFORE  = 5 * 60 * 1000        // 만료 5분 전 경고
const LS_KEY = 'eduops_last_activity'

export default function SessionGuard() {
  const [showBanner, setShowBanner] = useState(false)
  const [remaining, setRemaining] = useState(0)

  const logout = useCallback(() => {
    localStorage.removeItem(LS_KEY)
    const supabase = createClient()
    supabase.auth.signOut().then(() => {
      window.location.href = '/auth/login?reason=timeout'
    })
  }, [])

  // 사용자 활동 시 타임스탬프 갱신
  useEffect(() => {
    const update = () => localStorage.setItem(LS_KEY, Date.now().toString())
    if (!localStorage.getItem(LS_KEY)) update()
    const events = ['mousemove', 'click', 'keydown', 'touchstart'] as const
    events.forEach(e => window.addEventListener(e, update, { passive: true }))
    return () => events.forEach(e => window.removeEventListener(e, update))
  }, [])

  // 1분마다 만료 여부 체크
  useEffect(() => {
    const check = () => {
      const last = parseInt(localStorage.getItem(LS_KEY) ?? '0') || Date.now()
      const rem = IDLE_TIMEOUT - (Date.now() - last)
      if (rem <= 0) { logout(); return }
      setShowBanner(rem <= WARN_BEFORE)
    }
    check()
    const id = setInterval(check, 60 * 1000)
    return () => clearInterval(id)
  }, [logout])

  // 배너 표시 중 1초마다 카운트다운 갱신
  useEffect(() => {
    if (!showBanner) return
    const id = setInterval(() => {
      const last = parseInt(localStorage.getItem(LS_KEY) ?? '0') || Date.now()
      const rem = IDLE_TIMEOUT - (Date.now() - last)
      if (rem <= 0) { logout(); return }
      if (rem > WARN_BEFORE) { setShowBanner(false); return }
      setRemaining(Math.ceil(rem / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [showBanner, logout])

  const extendSession = () => {
    localStorage.setItem(LS_KEY, Date.now().toString())
    setShowBanner(false)
  }

  const fmt = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return m > 0 ? `${m}분 ${s}초` : `${s}초`
  }

  if (!showBanner) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white px-4 py-3 flex items-center justify-between gap-4 shadow-lg">
      <p className="text-sm font-medium">
        <span className="font-bold">{fmt(remaining)}</span> 후 자동 로그아웃됩니다. 계속 이용하시려면 클릭하세요.
      </p>
      <button
        onClick={extendSession}
        className="flex-shrink-0 bg-white text-amber-600 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-colors"
      >
        연장하기
      </button>
    </div>
  )
}
