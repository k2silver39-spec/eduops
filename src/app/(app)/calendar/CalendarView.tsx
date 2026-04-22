'use client'

import { useState, useEffect, useCallback } from 'react'
import EventModal, { CalendarEvent } from './EventModal'
import ImportModal from './ImportModal'

const COLOR_BG: Record<string, string> = {
  blue:   'bg-blue-500',
  green:  'bg-green-500',
  red:    'bg-red-500',
  orange: 'bg-orange-500',
  purple: 'bg-purple-500',
  gray:   'bg-gray-400',
}
const COLOR_LIGHT: Record<string, string> = {
  blue:   'bg-blue-100 text-blue-800',
  green:  'bg-green-100 text-green-800',
  red:    'bg-red-100 text-red-800',
  orange: 'bg-orange-100 text-orange-800',
  purple: 'bg-purple-100 text-purple-800',
  gray:   'bg-gray-100 text-gray-600',
}

const DAYS_KO = ['일', '월', '화', '수', '목', '금', '토']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

function pad(n: number) { return String(n).padStart(2, '0') }
function toDateStr(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` }
function fmtTime(iso: string) {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface Profile {
  id: string
  role: string
  agency_type: string
  organization: string
}

interface Props {
  profile: Profile
  organizations?: string[]
}

export default function CalendarView({ profile, organizations = [] }: Props) {
  const today = new Date()
  const [year,       setYear]       = useState(today.getFullYear())
  const [month,      setMonth]      = useState(today.getMonth() + 1)
  const [view,       setView]       = useState<'month' | 'week'>('month')
  const [weekStart,  setWeekStart]  = useState(() => {
    const d = new Date(today)
    d.setDate(d.getDate() - d.getDay())
    return d
  })
  const [events,     setEvents]     = useState<CalendarEvent[]>([])
  const [loading,    setLoading]    = useState(false)
  const [orgFilter,  setOrgFilter]  = useState('all')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [modalEvent,   setModalEvent]   = useState<CalendarEvent | null | undefined>(undefined)
  const [showImport,   setShowImport]   = useState(false)

  const isAdmin     = profile.role === 'super_admin'
  const canPublish  = profile.agency_type === '주관기관' || isAdmin

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const apiBase = isAdmin ? '/api/admin/events' : '/api/events'
      const params  = new URLSearchParams({ year: String(year), month: String(month) })
      if (isAdmin && orgFilter !== 'all') params.set('organization', orgFilter)
      const res = await fetch(`${apiBase}?${params}`)
      if (res.ok) setEvents(await res.json())
    } finally {
      setLoading(false)
    }
  }, [year, month, isAdmin, orgFilter])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const eventsOnDate = (dateStr: string) =>
    events.filter(e => {
      const s = toDateStr(new Date(e.start_at))
      const end = toDateStr(new Date(e.end_at))
      return dateStr >= s && dateStr <= end
    })

  // ── 일정 저장 ──
  const saveEvent = async (data: Partial<CalendarEvent>) => {
    if (modalEvent?.id) {
      const res = await fetch(`/api/events/${modalEvent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
    } else {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
    }
    setModalEvent(undefined)
    fetchEvents()
  }

  const deleteEvent = async () => {
    if (!modalEvent?.id) return
    const res = await fetch(`/api/events/${modalEvent.id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error()
    setModalEvent(undefined)
    fetchEvents()
  }

  const importEvents = async (evts: Partial<CalendarEvent>[]) => {
    await Promise.all(evts.map(e =>
      fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(e),
      })
    ))
    setShowImport(false)
    fetchEvents()
  }

  // ── 월간 그리드 날짜 생성 ──
  const buildMonthGrid = () => {
    const first = new Date(year, month - 1, 1)
    const last  = new Date(year, month, 0)
    const cells: (Date | null)[] = []
    for (let i = 0; i < first.getDay(); i++) cells.push(null)
    for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, month - 1, d))
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }

  // ── 주간 날짜 생성 ──
  const buildWeekDays = () =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      return d
    })

  const prevMonth = () => { if (month === 1) { setYear(y => y-1); setMonth(12) } else setMonth(m => m-1) }
  const nextMonth = () => { if (month === 12) { setYear(y => y+1); setMonth(1) }  else setMonth(m => m+1) }
  const prevWeek  = () => { const d = new Date(weekStart); d.setDate(d.getDate()-7); setWeekStart(d) }
  const nextWeek  = () => { const d = new Date(weekStart); d.setDate(d.getDate()+7); setWeekStart(d) }
  const goToday   = () => {
    setYear(today.getFullYear()); setMonth(today.getMonth()+1)
    const d = new Date(today); d.setDate(d.getDate()-d.getDay()); setWeekStart(d)
  }

  const monthGrid = buildMonthGrid()
  const weekDays  = buildWeekDays()

  const todayStr = toDateStr(today)

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="px-4 pt-4 pb-3 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          {/* 이전/다음 */}
          <button onClick={view === 'month' ? prevMonth : prevWeek}
            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>

          <button onClick={goToday}
            className="text-xs font-medium text-gray-600 border border-gray-300 px-2.5 py-1 rounded-lg hover:bg-gray-50 transition-colors">
            오늘
          </button>

          <button onClick={view === 'month' ? nextMonth : nextWeek}
            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>

          <h2 className="text-base font-bold text-gray-900 flex-1">
            {view === 'month'
              ? `${year}년 ${month}월`
              : `${weekDays[0].getMonth()+1}. ${weekDays[0].getDate()} ~ ${weekDays[6].getMonth()+1}. ${weekDays[6].getDate()}`
            }
          </h2>

          {/* 뷰 전환 */}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden text-xs">
            <button onClick={() => setView('month')}
              className={`px-2.5 py-1.5 font-medium transition-colors ${view === 'month' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              월
            </button>
            <button onClick={() => setView('week')}
              className={`px-2.5 py-1.5 font-medium transition-colors ${view === 'week' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              주
            </button>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {isAdmin && organizations.length > 0 && (
            <select
              value={orgFilter}
              onChange={e => setOrgFilter(e.target.value)}
              className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="all">전체 기관</option>
              {organizations.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          )}
          <div className="flex-1" />
          <button
            onClick={() => setShowImport(true)}
            className="text-xs border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            문서 가져오기
          </button>
          <button
            onClick={() => { setSelectedDate(null); setModalEvent(null) }}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            일정 추가
          </button>
        </div>
      </div>

      {/* 로딩 */}
      {loading && (
        <div className="text-center py-2">
          <span className="text-xs text-gray-400">불러오는 중...</span>
        </div>
      )}

      {/* ── 월간 보기 ── */}
      {view === 'month' && (
        <div className="flex-1 overflow-auto px-4 pb-4">
          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS_KO.map((d, i) => (
              <div key={d} className={`text-center text-xs font-medium py-1.5 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-500'}`}>{d}</div>
            ))}
          </div>

          {/* 날짜 그리드 */}
          <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-xl overflow-hidden">
            {monthGrid.map((date, idx) => {
              if (!date) return <div key={idx} className="bg-gray-50 min-h-[80px]" />
              const dateStr = toDateStr(date)
              const dayEvts = eventsOnDate(dateStr)
              const isToday = dateStr === todayStr
              const isSun = date.getDay() === 0
              const isSat = date.getDay() === 6
              const isSelected = selectedDate === dateStr

              return (
                <div
                  key={dateStr}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  className={`bg-white min-h-[80px] p-1.5 cursor-pointer transition-colors hover:bg-gray-50 ${isSelected ? 'ring-2 ring-inset ring-blue-400' : ''}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full
                      ${isToday ? 'bg-blue-600 text-white' : isSun ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-gray-700'}`}>
                      {date.getDate()}
                    </span>
                  </div>

                  {/* 일정 바 */}
                  <div className="space-y-0.5">
                    {dayEvts.slice(0, 3).map(ev => (
                      <button
                        key={ev.id}
                        onClick={e => { e.stopPropagation(); setModalEvent(ev) }}
                        className={`w-full text-left rounded px-1 py-0.5 text-[10px] font-medium truncate flex items-center gap-1 ${COLOR_LIGHT[ev.color]}`}
                      >
                        {ev.agency_type === '주관기관' && ev.is_public && (
                          <span className="flex-shrink-0">📌</span>
                        )}
                        {ev.source === 'report' && (
                          <span className="flex-shrink-0">📋</span>
                        )}
                        {!ev.is_allday && (
                          <span className="flex-shrink-0 opacity-70">{fmtTime(ev.start_at)}</span>
                        )}
                        <span className="truncate">{ev.title}</span>
                      </button>
                    ))}
                    {dayEvts.length > 3 && (
                      <p className="text-[10px] text-gray-400 px-1">+{dayEvts.length - 3}개</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* 선택한 날짜 일정 패널 */}
          {selectedDate && (
            <div className="mt-3 bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-900">
                  {selectedDate.replace(/-/g, '. ').replace(/\. (\d)$/, '. 0$1')} 일정
                </h3>
                <button
                  onClick={() => { setSelectedDate(selectedDate); setModalEvent(null) }}
                  className="text-xs text-blue-600 hover:underline"
                >
                  + 일정 추가
                </button>
              </div>
              {eventsOnDate(selectedDate).length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-3">등록된 일정이 없습니다.</p>
              ) : (
                <div className="space-y-1.5">
                  {eventsOnDate(selectedDate).map(ev => (
                    <button
                      key={ev.id}
                      onClick={() => setModalEvent(ev)}
                      className="w-full flex items-start gap-2.5 text-left p-2.5 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      <span className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${COLOR_BG[ev.color]}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{ev.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {ev.is_allday ? (
                            <span className="text-xs text-gray-400">종일</span>
                          ) : (
                            <span className="text-xs text-gray-400">{fmtTime(ev.start_at)} ~ {fmtTime(ev.end_at)}</span>
                          )}
                          {ev.agency_type === '주관기관' && ev.is_public && (
                            <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">주관</span>
                          )}
                          {ev.source === 'report' && (
                            <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">보고서</span>
                          )}
                          {isAdmin && ev.organization && (
                            <span className="text-[10px] text-gray-400 truncate">{ev.organization}</span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 주간 보기 ── */}
      {view === 'week' && (
        <div className="flex-1 overflow-auto px-4 pb-4">
          <div className="min-w-[560px]">
            {/* 요일 헤더 */}
            <div className="grid grid-cols-8 border-b border-gray-200 sticky top-0 bg-white z-10">
              <div className="py-2 pr-2 text-right text-xs text-gray-400" />
              {weekDays.map((d, i) => {
                const ds = toDateStr(d)
                const isToday = ds === todayStr
                return (
                  <div key={i} className="py-2 text-center">
                    <span className={`text-xs font-medium ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-500'}`}>
                      {DAYS_KO[i]}
                    </span>
                    <div className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full mx-auto mt-0.5 ${isToday ? 'bg-blue-600 text-white' : 'text-gray-900'}`}>
                      {d.getDate()}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 종일 영역 */}
            {weekDays.some(d => eventsOnDate(toDateStr(d)).some(e => e.is_allday)) && (
              <div className="grid grid-cols-8 border-b border-gray-100 bg-gray-50">
                <div className="py-1 pr-2 text-right text-[10px] text-gray-400 self-center">종일</div>
                {weekDays.map((d, i) => {
                  const dayEvts = eventsOnDate(toDateStr(d)).filter(e => e.is_allday)
                  return (
                    <div key={i} className="py-1 px-0.5 space-y-0.5 min-h-[28px]">
                      {dayEvts.map(ev => (
                        <button key={ev.id} onClick={() => setModalEvent(ev)}
                          className={`w-full text-left rounded px-1.5 py-0.5 text-[10px] font-medium truncate ${COLOR_LIGHT[ev.color]}`}>
                          {ev.title}
                        </button>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}

            {/* 시간대 */}
            <div className="relative">
              {HOURS.map(h => (
                <div key={h} className="grid grid-cols-8 border-b border-gray-100" style={{ minHeight: '48px' }}>
                  <div className="pr-2 pt-1 text-right text-[10px] text-gray-400 leading-none">{pad(h)}:00</div>
                  {weekDays.map((d, i) => {
                    const dayEvts = eventsOnDate(toDateStr(d)).filter(e => {
                      if (e.is_allday) return false
                      const sh = new Date(e.start_at).getHours()
                      return sh === h
                    })
                    return (
                      <div key={i} className={`border-l border-gray-100 px-0.5 py-0.5 relative ${toDateStr(d) === todayStr ? 'bg-blue-50/30' : ''}`}>
                        {dayEvts.map(ev => (
                          <button key={ev.id} onClick={() => setModalEvent(ev)}
                            className={`w-full text-left rounded px-1 py-0.5 text-[10px] font-medium mb-0.5 ${COLOR_LIGHT[ev.color]}`}>
                            <span className="opacity-70">{fmtTime(ev.start_at)}</span>{' '}
                            <span className="truncate block">{ev.title}</span>
                          </button>
                        ))}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 일정 모달 */}
      {modalEvent !== undefined && (
        <EventModal
          event={modalEvent}
          defaultDate={selectedDate ?? toDateStr(today)}
          canPublish={canPublish}
          currentUserId={profile.id}
          isAdmin={isAdmin}
          onSave={saveEvent}
          onDelete={modalEvent?.id ? deleteEvent : undefined}
          onClose={() => { setModalEvent(undefined) }}
        />
      )}

      {/* 문서 가져오기 모달 */}
      {showImport && (
        <ImportModal
          onImport={importEvents}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  )
}
