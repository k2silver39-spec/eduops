'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

interface TodayEvent {
  id: string
  title: string
  start_at: string
  end_at: string
  color: string
  is_allday: boolean
}

const COLOR_DOT: Record<string, string> = {
  blue:   'bg-blue-400',
  green:  'bg-green-400',
  red:    'bg-red-400',
  orange: 'bg-orange-400',
  purple: 'bg-purple-400',
  gray:   'bg-gray-400',
}

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토']

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatHeaderDate(d: Date): string {
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAY_KO[d.getDay()]})`
}

function formatStartTime(iso: string): string {
  const d = new Date(iso)
  const h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  const ampm = h < 12 ? '오전' : '오후'
  const hh = h % 12 === 0 ? 12 : h % 12
  return `${ampm} ${hh}:${m}`
}

export default function TodayEventsClient() {
  const [events, setEvents] = useState<TodayEvent[]>([])
  const [loading, setLoading] = useState(true)
  const today = useMemo(() => new Date(), [])
  const dateKey = toDateKey(today)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/events?date=${dateKey}`)
      .then(r => r.json())
      .then(d => setEvents(Array.isArray(d) ? d : []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [dateKey])

  const sorted = [...events].sort((a, b) => {
    if (a.is_allday !== b.is_allday) return a.is_allday ? -1 : 1
    return new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
  })

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-700">오늘 일정</h2>
          <span className="text-xs text-gray-400">· {formatHeaderDate(today)}</span>
        </div>
      </div>
      <Link
        href="/calendar"
        className="block bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-gray-300 transition-colors"
      >
        {loading ? (
          <div className="py-4 text-center text-xs text-gray-400">불러오는 중...</div>
        ) : sorted.length === 0 ? (
          <div className="py-5 text-center text-xs text-gray-400">
            오늘 등록된 일정이 없습니다.
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {sorted.map(ev => (
              <li key={ev.id} className="flex items-center gap-2.5 px-4 py-2.5">
                <span className={`w-2 h-2 rounded-full shrink-0 ${COLOR_DOT[ev.color] ?? COLOR_DOT.gray}`} />
                <span className="text-xs text-gray-500 w-16 shrink-0">
                  {ev.is_allday ? '종일' : formatStartTime(ev.start_at)}
                </span>
                <span className="text-sm text-gray-800 flex-1 truncate">{ev.title}</span>
              </li>
            ))}
          </ul>
        )}
      </Link>
    </section>
  )
}
