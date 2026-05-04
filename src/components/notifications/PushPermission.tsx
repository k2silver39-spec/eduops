'use client'

import { useState, useEffect } from 'react'

type PermissionStatus = 'unsupported' | 'loading' | 'default' | 'granted' | 'denied'

function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const buffer = new ArrayBuffer(rawData.length)
  const view = new Uint8Array(buffer)
  for (let i = 0; i < rawData.length; i++) {
    view[i] = rawData.charCodeAt(i)
  }
  return buffer
}

export default function PushPermission() {
  const [status, setStatus] = useState<PermissionStatus>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('Notification' in window) ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window)
    ) {
      setStatus('unsupported')
      return
    }

    const browserPerm = Notification.permission as PermissionStatus
    if (browserPerm !== 'granted') {
      setStatus(browserPerm)
      return
    }

    // 브라우저 권한이 granted여도 실제 구독이 DB에 있는지 확인
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        // 구독 객체가 없으면 재구독 유도
        setStatus(sub ? 'granted' : 'default')
      })
      .catch(() => {
        setStatus(browserPerm)
      })
  }, [])

  const handleSubscribe = async () => {
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      console.error('[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY not set')
      return
    }
    setStatus('loading')
    setErrorMsg('')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus(permission as PermissionStatus)
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToArrayBuffer(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
      })
      const json = sub.toJSON()
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth },
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        console.error('[push] subscribe API error:', data)
        // 브라우저 구독은 제거해 상태 일관성 유지
        await sub.unsubscribe()
        setStatus('default')
        setErrorMsg('구독 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.')
        return
      }
      setStatus('granted')
    } catch (err) {
      console.error('[push] subscribe error:', err)
      setStatus('default')
      setErrorMsg('푸시 구독 중 오류가 발생했습니다.')
    }
  }

  const handleUnsubscribe = async () => {
    setStatus('loading')
    setErrorMsg('')
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setStatus('default')
    } catch (err) {
      console.error('[push] unsubscribe error:', err)
      setStatus('granted')
    }
  }

  if (status === 'unsupported') return null

  if (status === 'loading') {
    return (
      <button disabled className="w-full bg-blue-400 text-white font-medium py-2.5 rounded-lg text-sm">
        처리 중...
      </button>
    )
  }

  if (status === 'denied') {
    return (
      <p className="text-sm text-gray-500">
        푸시 알림이 차단되어 있습니다. 브라우저 설정에서 알림을 허용해주세요.
      </p>
    )
  }

  if (status === 'granted') {
    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
          <span className="text-sm text-gray-700">푸시 알림이 활성화되어 있습니다</span>
        </div>
        <button
          type="button"
          onClick={handleUnsubscribe}
          className="text-xs text-gray-500 border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition"
        >
          알림 해제
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleSubscribe}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm transition"
      >
        푸시 알림 허용
      </button>
      {errorMsg && (
        <p className="text-xs text-red-500 text-center">{errorMsg}</p>
      )}
    </div>
  )
}
