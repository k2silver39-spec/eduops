'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type NotificationType =
  | 'signup_approved'
  | 'inquiry_reply'
  | 'report_revision'
  | 'report_reminder'
  | 'new_inquiry'
  | 'new_report'

interface Notification {
  id: string
  type: NotificationType
  title: string
  body: string
  reference_id: string | null
  is_read: boolean
  created_at: string
}

interface NotificationBellProps {
  isAdmin?: boolean
}

function formatTime(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function buildHref(n: Notification): string {
  switch (n.type) {
    case 'signup_approved':
      return '/'
    case 'inquiry_reply':
      return n.reference_id ? `/inquiries/${n.reference_id}` : '/inquiries'
    case 'report_revision':
      return n.reference_id ? `/reports/${n.reference_id}` : '/reports'
    case 'report_reminder':
      return '/reports'
    case 'new_inquiry':
      return n.reference_id ? `/admin/inquiries/${n.reference_id}` : '/admin/inquiries'
    case 'new_report':
      return n.reference_id ? `/admin/reports/${n.reference_id}` : '/admin/reports'
    default:
      return '/'
  }
}

export default function NotificationBell({ isAdmin = false }: NotificationBellProps) {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const apiBase = isAdmin ? '/api/admin/notifications' : '/api/notifications'

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(apiBase, { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json()
      setNotifications(json.notifications ?? [])
      setUnreadCount(json.unreadCount ?? 0)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [apiBase])

  // 폴링 (5초)
  useEffect(() => {
    fetchNotifications()
    const intervalId = setInterval(fetchNotifications, 5000)
    return () => clearInterval(intervalId)
  }, [fetchNotifications])

  // 외부 클릭 감지
  useEffect(() => {
    if (!isOpen) return
    const handleMouseDown = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [isOpen])

  const handleNotificationClick = (n: Notification) => {
    if (!n.is_read) {
      // 낙관적 업데이트: 즉시 로컬 상태 반영
      setNotifications((prev) =>
        prev.map((item) => item.id === n.id ? { ...item, is_read: true } : item)
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
      fetch(apiBase, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: n.id }),
        cache: 'no-store',
      }).catch(() => {})
    }
    setIsOpen(false)
    router.push(buildHref(n))
  }

  const handleMarkAllRead = async () => {
    try {
      await fetch(apiBase, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
        cache: 'no-store',
      })
      await fetchNotifications()
    } catch {
      // silent
    }
  }

  const badgeText = unreadCount > 99 ? '99+' : String(unreadCount)

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label="알림"
        className="relative inline-flex items-center justify-center w-9 h-9 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {badgeText}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-[480px] bg-white border border-gray-200 rounded-lg shadow-lg z-50 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">알림</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                모두 읽음
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                새 알림이 없습니다
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {notifications.map((n) => {
                  const unread = !n.is_read
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => handleNotificationClick(n)}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                          unread ? 'bg-blue-50/40' : ''
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {unread && (
                            <span className="mt-1.5 inline-block w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                          )}
                          <div className={`flex-1 min-w-0 ${unread ? '' : 'pl-4'}`}>
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {n.title}
                            </p>
                            <p className="mt-0.5 text-xs text-gray-600 line-clamp-2">
                              {n.body}
                            </p>
                            <p className="mt-1 text-[11px] text-gray-400">
                              {formatTime(n.created_at)}
                            </p>
                          </div>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
