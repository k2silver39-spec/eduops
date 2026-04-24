'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

interface CalEvent {
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

const COLOR_PILL: Record<string, string> = {
  blue:   'bg-blue-50 text-blue-700',
  green:  'bg-green-50 text-green-700',
  red:    'bg-red-50 text-red-700',
  orange: 'bg-orange-50 text-orange-700',
  purple: 'bg-purple-50 text-purple-700',
  gray:   'bg-gray-100 text-gray-600',
}

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일']

function getMondayOf(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export default function HomeClient() {
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOf(new Date()))
  const [events, setEvents] = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(false)

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })

  const todayKey = toDateKey(new Date())

  const load = useCallback(() => {
    const start = toDateKey(weekDays[0])
    const end = toDateKey(weekDays[6])
    setLoading(true)
    fetch(`/api/events?start=${start}&end=${end}`)
      .then(r => r.json())
      .then(d => setEvents(Array.isArray(d) ? d : []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart])

  useEffect(() => { load() }, [load])

  const eventsByDay: Record<string, CalEvent[]> = {}
  for (const ev of events) {
    const key = ev.start_at.slice(0, 10)
    if (!eventsByDay[key]) eventsByDay[key] = []
    eventsByDay[key].push(ev)
  }

  const weekLabel = (() => {
    const s = weekDays[0]
    const e = weekDays[6]
    if (s.getMonth() === e.getMonth()) {
      return `${s.getFullYear()}년 ${s.getMonth() + 1}월`
    }
    return `${s.getFullYear()}년 ${s.getMonth() + 1}월 – ${e.getMonth() + 1}월`
  })()

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-700">이번 주 일정</h2>
          <span className="text-xs text-gray-400">{weekLabel}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekStart(d => { const nd = new Date(d); nd.setDate(nd.getDate() - 7); return nd })}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <button
            onClick={() => setWeekStart(getMondayOf(new Date()))}
            className="text-xs px-2 py-1 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          >
            오늘
          </button>
          <button
            onClick={() => setWeekStart(d => { const nd = new Date(d); nd.setDate(nd.getDate() + 7); return nd })}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </div>

      <Link href="/calendar" className="block bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-gray-300 transition-colors">
        {/* Day header */}
        <div className="grid grid-cols-7 border-b border-gray-100">
          {weekDays.map((d, i) => {
            const key = toDateKey(d)
            const isToday = key === todayKey
            const isSat = i === 5
            const isSun = i === 6
            return (
              <div key={key} className="flex flex-col items-center py-2 gap-0.5">
                <span className={`text-[10px] font-medium ${isSat ? 'text-blue-500' : isSun ? 'text-red-500' : 'text-gray-400'}`}>
                  {DAY_LABELS[i]}
                </span>
                <span className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full ${
                  isToday ? 'bg-blue-600 text-white' : isSat ? 'text-blue-600' : isSun ? 'text-red-500' : 'text-gray-800'
                }`}>
                  {d.getDate()}
                </span>
              </div>
            )
          })}
        </div>

        {/* Events row */}
        {loading ? (
          <div className="py-4 text-center text-xs text-gray-400">불러오는 중...</div>
        ) : (
          <div className="grid grid-cols-7 min-h-[56px]">
            {weekDays.map((d, i) => {
              const key = toDateKey(d)
              const dayEvs = eventsByDay[key] ?? []
              const shown = dayEvs.slice(0, 2)
              const overflow = dayEvs.length - 2

              return (
                <div key={key} className={`p-1 flex flex-col gap-0.5 ${i < 6 ? 'border-r border-gray-50' : ''}`}>
                  {/* Desktop: event pills */}
                  <div className="hidden md:flex flex-col gap-0.5">
                    {shown.map(ev => (
                      <div
                        key={ev.id}
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded truncate ${COLOR_PILL[ev.color] ?? COLOR_PILL.gray}`}
                        title={ev.title}
                      >
                        {ev.title}
                      </div>
                    ))}
                    {overflow > 0 && (
                      <div className="text-[10px] text-gray-400 pl-1">+{overflow}</div>
                    )}
                  </div>
                  {/* Mobile: color dots only */}
                  <div className="md:hidden flex flex-wrap gap-0.5 pt-1 justify-center">
                    {dayEvs.slice(0, 3).map(ev => (
                      <span key={ev.id} className={`w-1.5 h-1.5 rounded-full ${COLOR_DOT[ev.color] ?? COLOR_DOT.gray}`} />
                    ))}
                    {dayEvs.length > 3 && (
                      <span className="text-[9px] text-gray-400">+{dayEvs.length - 3}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Link>
    </section>
  )
}
