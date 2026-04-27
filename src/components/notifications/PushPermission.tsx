'use client'

import { useState, useEffect } from 'react'

type PermissionStatus = 'unsupported' | 'loading' | 'default' | 'granted' | 'denied'

export default function PushPermission() {
  const [status, setStatus] = useState<PermissionStatus>('loading')

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
    setStatus(Notification.permission as PermissionStatus)
  }, [])

  const handleSubscribe = async () => {
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      console.error('[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY not set')
      return
    }
    setStatus('loading')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus(permission as PermissionStatus)
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      })
      const json = sub.toJSON()
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth },
        }),
      })
      setStatus('granted')
    } catch (err) {
      console.error('[push] subscribe error:', err)
      setStatus('default')
    }
  }

  const handleUnsubscribe = async () => {
    setStatus('loading')
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
    <button
      type="button"
      onClick={handleSubscribe}
      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm transition"
    >
      푸시 알림 허용
    </button>
  )
}
