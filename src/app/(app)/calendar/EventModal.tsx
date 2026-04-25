'use client'

import { useState, useEffect } from 'react'

export interface CalendarEvent {
  id?: string
  title: string
  description: string
  start_at: string
  end_at: string
  is_allday: boolean
  color: 'blue' | 'green' | 'red' | 'orange' | 'purple' | 'gray'
  is_public: boolean
  source?: string
  source_id?: string
  user_id?: string
  organization?: string
  repeat_group_id?: string
}

const COLORS = [
  { value: 'blue',   label: '파랑',  bg: 'bg-blue-500' },
  { value: 'green',  label: '초록',  bg: 'bg-green-500' },
  { value: 'red',    label: '빨강',  bg: 'bg-red-500' },
  { value: 'orange', label: '주황',  bg: 'bg-orange-500' },
  { value: 'purple', label: '보라',  bg: 'bg-purple-500' },
  { value: 'gray',   label: '회색',  bg: 'bg-gray-400' },
] as const

export type RepeatType = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly'
export type EndType    = 'count' | 'date'

const REPEAT_OPTIONS: { value: RepeatType; label: string }[] = [
  { value: 'none',     label: '반복 없음' },
  { value: 'daily',    label: '매일' },
  { value: 'weekly',   label: '매주' },
  { value: 'biweekly', label: '격주' },
  { value: 'monthly',  label: '매월' },
]
const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const
const MIN_COUNT = 2
const MAX_COUNT = 366

function toLocalDatetime(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toLocalDate(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
}

interface BuildOccurrencesArgs {
  firstStart: string; firstEnd: string
  repeatType: RepeatType; weekdays: number[]
  endType: EndType; repeatCount: number; repeatUntil: string; isAllday: boolean
}
interface Occurrence { start_at: string; end_at: string }

function buildOccurrences(a: BuildOccurrencesArgs): Occurrence[] {
  const firstStartD = new Date(a.firstStart)
  const firstEndD   = new Date(a.firstEnd)
  const durationMs  = firstEndD.getTime() - firstStartD.getTime()
  const limit = a.endType === 'count'
    ? { type: 'count' as const, n: a.repeatCount }
    : { type: 'date' as const, until: new Date(a.repeatUntil + 'T23:59:59') }

  const toIso = (d: Date): Occurrence => ({
    start_at: d.toISOString(),
    end_at:   new Date(d.getTime() + durationMs).toISOString(),
  })
  const results: Occurrence[] = []
  const pushIfOk = (start: Date) => {
    if (limit.type === 'date' && start > limit.until) return false
    results.push(toIso(start))
    if (limit.type === 'count' && results.length >= limit.n) return false
    return true
  }
  if (!pushIfOk(new Date(firstStartD))) return results

  const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
  const addMonths = (d: Date, n: number) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x }
  const SAFETY = 500

  if (a.repeatType === 'daily') {
    let cursor = addDays(firstStartD, 1)
    for (let i = 0; i < SAFETY; i++) {
      if (!pushIfOk(cursor)) break
      cursor = addDays(cursor, 1)
    }
  } else if (a.repeatType === 'weekly' || a.repeatType === 'biweekly') {
    const step = a.repeatType === 'weekly' ? 7 : 14
    const sorted = [...a.weekdays].sort((x, y) => x - y)
    const weekAnchor = (() => {
      const d = new Date(firstStartD)
      d.setDate(d.getDate() - d.getDay())
      d.setHours(firstStartD.getHours(), firstStartD.getMinutes(), firstStartD.getSeconds(), 0)
      return d
    })()
    let anchor = new Date(weekAnchor)
    for (let i = 0; i < SAFETY; i++) {
      for (const wd of sorted) {
        const occ = addDays(anchor, wd)
        if (occ.getTime() <= firstStartD.getTime()) continue
        if (!pushIfOk(occ)) return results
      }
      anchor = addDays(anchor, step)
    }
  } else if (a.repeatType === 'monthly') {
    const origDay = firstStartD.getDate()
    for (let i = 1; i < SAFETY; i++) {
      const next = addMonths(firstStartD, i)
      if (next.getDate() !== origDay) next.setDate(0)
      if (!pushIfOk(next)) break
    }
  }
  return results
}

interface Props {
  event?: CalendarEvent | null
  defaultDate?: string
  defaultColor?: CalendarEvent['color']
  canPublish?: boolean
  currentUserId?: string
  isAdmin?: boolean
  onSave: (data: Partial<CalendarEvent> | Partial<CalendarEvent>[]) => Promise<void>
  onDelete?: () => Promise<void>
  onDeleteAll?: () => Promise<void>
  onClose: () => void
}

export default function EventModal({
  event,
  defaultDate,
  defaultColor,
  canPublish = false,
  currentUserId,
  isAdmin = false,
  onSave,
  onDelete,
  onDeleteAll,
  onClose,
}: Props) {
  const isEdit   = !!event?.id
  const canEdit  = !isEdit || event?.user_id === currentUserId || isAdmin
  const isReport = event?.source === 'report'

  const initStart = event?.start_at
    ? (event.is_allday ? toLocalDate(event.start_at) : toLocalDatetime(event.start_at))
    : (defaultDate ?? toLocalDate(new Date().toISOString()))
  const initEnd = event?.end_at
    ? (event.is_allday ? toLocalDate(event.end_at) : toLocalDatetime(event.end_at))
    : initStart

  const [title,       setTitle]       = useState(event?.title ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [isAllday,    setIsAllday]    = useState(event?.is_allday ?? false)
  const [startVal,    setStartVal]    = useState(initStart)
  const [endVal,      setEndVal]      = useState(initEnd)
  const [color,       setColor]       = useState<CalendarEvent['color']>(event?.color ?? defaultColor ?? 'blue')
  const [isPublic,    setIsPublic]    = useState(event?.is_public ?? false)
  const [repeatType,  setRepeatType]  = useState<RepeatType>('none')
  const [weekdays,    setWeekdays]    = useState<number[]>([])
  const [endType,     setEndType]     = useState<EndType>('count')
  const [repeatCount, setRepeatCount] = useState<number>(4)
  const [repeatUntil, setRepeatUntil] = useState<string>('')
  const [repeatStartDate, setRepeatStartDate] = useState(
    event?.start_at ? toLocalDate(event.start_at) : (defaultDate ?? toLocalDate(new Date().toISOString()))
  )
  const [startTime, setStartTime] = useState(
    event?.start_at && !event?.is_allday ? toLocalDatetime(event.start_at).slice(11, 16) : '09:00'
  )
  const [endTime, setEndTime] = useState(
    event?.end_at && !event?.is_allday ? toLocalDatetime(event.end_at).slice(11, 16) : '18:00'
  )
  const [saving,             setSaving]             = useState(false)
  const [deleting,           setDeleting]           = useState(false)
  const [showDeleteConfirm,  setShowDeleteConfirm]  = useState(false)
  const [error,              setError]              = useState('')

  // 종일 토글 시 포맷 변환
  useEffect(() => {
    if (isAllday) {
      setStartVal(v => v.includes('T') ? v.split('T')[0] : v)
      setEndVal(v   => v.includes('T') ? v.split('T')[0] : v)
    } else {
      setStartVal(v => !v.includes('T') ? v + 'T09:00' : v)
      setEndVal(v   => !v.includes('T') ? v + 'T18:00' : v)
    }
  }, [isAllday])

  const isRepeating = !isEdit && repeatType !== 'none'

  const handleSave = async () => {
    if (!title.trim()) { setError('제목을 입력해 주세요.'); return }

    let firstStart = '', firstEnd = ''

    if (isRepeating) {
      if (!repeatStartDate) { setError('반복 시작일을 입력해 주세요.'); return }
      if (!repeatUntil) { setError('반복 종료일을 입력해 주세요.'); return }
      if (repeatUntil < repeatStartDate) { setError('반복 종료일은 시작일 이후여야 합니다.'); return }
      if ((repeatType === 'weekly' || repeatType === 'biweekly') && weekdays.length === 0) {
        setError('반복 요일을 1개 이상 선택해 주세요.'); return
      }
      if (isAllday) {
        firstStart = new Date(repeatStartDate + 'T00:00:00').toISOString()
        firstEnd   = new Date(repeatStartDate + 'T23:59:59').toISOString()
      } else {
        if (!startTime || !endTime) { setError('시작/종료 시간을 입력해 주세요.'); return }
        firstStart = new Date(repeatStartDate + 'T' + startTime + ':00').toISOString()
        firstEnd   = new Date(repeatStartDate + 'T' + endTime   + ':00').toISOString()
        if (new Date(firstStart) >= new Date(firstEnd)) {
          setError('종료 시간은 시작 시간 이후여야 합니다.'); return
        }
      }
    } else {
      if (!startVal || !endVal) { setError('날짜를 입력해 주세요.'); return }
      const toIsoStart = (v: string) =>
        isAllday ? new Date(v + 'T00:00:00').toISOString() : new Date(v).toISOString()
      const toIsoEnd = (v: string) =>
        isAllday ? new Date(v + 'T23:59:59').toISOString() : new Date(v).toISOString()
      firstStart = toIsoStart(startVal)
      firstEnd   = toIsoEnd(endVal)
      if (new Date(firstStart) > new Date(firstEnd)) {
        setError('종료 일시는 시작 일시 이후여야 합니다.'); return
      }
    }

    setSaving(true); setError('')
    try {
      const base: Partial<CalendarEvent> = {
        title: title.trim(), description: description.trim(),
        is_allday: isAllday, color, is_public: isPublic,
      }
      if (!isRepeating) {
        await onSave({ ...base, start_at: firstStart, end_at: firstEnd })
      } else {
        const occurrences = buildOccurrences({
          firstStart, firstEnd, repeatType, weekdays,
          endType: 'date', repeatCount: MIN_COUNT, repeatUntil, isAllday,
        })
        if (occurrences.length === 0) {
          setError('반복 조건으로 생성된 일정이 없습니다.'); setSaving(false); return
        }
        await onSave(occurrences.map(o => ({ ...base, start_at: o.start_at, end_at: o.end_at })))
      }
    } catch {
      setError('저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete) return
    setDeleting(true)
    try { await onDelete() } catch { setError('삭제 중 오류가 발생했습니다.') } finally { setDeleting(false) }
  }

  const handleDeleteAll = async () => {
    if (!onDeleteAll) return
    setDeleting(true)
    try { await onDeleteAll() } catch { setError('삭제 중 오류가 발생했습니다.') } finally { setDeleting(false) }
  }

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true)
  }

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-gray-900/60 backdrop-blur-sm px-0 sm:px-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">
            {isEdit ? (canEdit ? '일정 수정' : '일정 상세') : '일정 추가'}
          </h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {isReport && (
            <div className="bg-gray-50 text-xs text-gray-500 px-3 py-2 rounded-lg">
              보고서에서 자동 생성된 일정입니다.
            </div>
          )}

          {/* 제목 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">제목 <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              disabled={!canEdit}
              placeholder="일정 제목"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500 transition"
            />
          </div>

          {/* 종일 토글 — 반복 모드 아닐 때만 최상단에 표시 */}
          {(isEdit || repeatType === 'none') && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600">종일</span>
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => setIsAllday(v => !v)}
                className={`relative w-10 h-5 rounded-full transition-colors disabled:opacity-50 ${isAllday ? 'bg-blue-600' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${isAllday ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          )}

          {/* 반복 설정 — 신규 등록에서만 표시 */}
          {!isEdit && canEdit && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-600">반복</label>
              <select
                value={repeatType}
                onChange={e => setRepeatType(e.target.value as RepeatType)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {REPEAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>

              {(repeatType === 'weekly' || repeatType === 'biweekly') && (
                <div className="flex gap-1">
                  {WEEKDAY_LABELS.map((label, idx) => {
                    const active = weekdays.includes(idx)
                    return (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => setWeekdays(ws => active ? ws.filter(w => w !== idx) : [...ws, idx])}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                      >{label}</button>
                    )
                  })}
                </div>
              )}

              {repeatType !== 'none' && (
                <div className="bg-gray-50 rounded-lg px-3 py-2.5 space-y-2">
                  {/* 반복 기간 (날짜) */}
                  <p className="text-xs font-medium text-gray-600">반복 기간</p>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <p className="text-[10px] text-gray-400 mb-1">시작일 <span className="text-red-400">*</span></p>
                      <input
                        type="date"
                        value={repeatStartDate}
                        onChange={e => setRepeatStartDate(e.target.value)}
                        className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                    </div>
                    <span className="text-gray-400 pb-2">~</span>
                    <div className="flex-1">
                      <p className="text-[10px] text-gray-400 mb-1">종료일 <span className="text-red-400">*</span></p>
                      <input
                        type="date"
                        value={repeatUntil}
                        min={repeatStartDate || undefined}
                        onChange={e => setRepeatUntil(e.target.value)}
                        className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                    </div>
                  </div>

                  {/* 종일 토글 (반복 모드 내) */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-gray-500">종일</span>
                    <button
                      type="button"
                      onClick={() => setIsAllday(v => !v)}
                      className={`relative w-9 h-4.5 rounded-full transition-colors ${isAllday ? 'bg-blue-600' : 'bg-gray-300'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${isAllday ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  {/* 반복 시간 (종일이 아닐 때) */}
                  {!isAllday && (
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <p className="text-[10px] text-gray-400 mb-1">시작 시간</p>
                        <input
                          type="time"
                          value={startTime}
                          onChange={e => setStartTime(e.target.value)}
                          className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                      </div>
                      <span className="text-gray-400 pb-2">~</span>
                      <div className="flex-1">
                        <p className="text-[10px] text-gray-400 mb-1">종료 시간</p>
                        <input
                          type="time"
                          value={endTime}
                          onChange={e => setEndTime(e.target.value)}
                          className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 날짜/시간 — 반복 모드일 때는 반복 섹션 내에서 입력하므로 숨김 */}
          {(isEdit || repeatType === 'none') && <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">시작</label>
              <input
                type={isAllday ? 'date' : 'datetime-local'}
                value={startVal}
                onChange={e => setStartVal(e.target.value)}
                disabled={!canEdit}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">종료</label>
              <input
                type={isAllday ? 'date' : 'datetime-local'}
                value={endVal}
                onChange={e => setEndVal(e.target.value)}
                disabled={!canEdit}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500 transition"
              />
            </div>
          </div>}

          {/* 상세 내용 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">상세 내용</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              disabled={!canEdit}
              placeholder="일정에 대한 설명 (선택)"
              rows={3}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500 resize-none transition"
            />
          </div>

          {/* 전체 공개 (주관기관만) */}
          {canEdit && canPublish && (
            <div className="flex items-center justify-between bg-blue-50 px-3 py-2.5 rounded-lg">
              <div>
                <p className="text-xs font-medium text-blue-900">전체 공개</p>
                <p className="text-xs text-blue-600 mt-0.5">모든 기관 사용자에게 표시됩니다</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPublic(v => !v)}
                className={`relative w-10 h-5 rounded-full transition-colors ${isPublic ? 'bg-blue-600' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${isPublic ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-600 text-xs px-3 py-2.5 rounded-lg">{error}</div>
          )}
        </div>

        {/* 버튼 */}
        <div className="px-5 pb-5 flex gap-2">
          {isEdit && canEdit && onDelete && (
            <button
              onClick={handleDeleteClick}
              disabled={deleting}
              className="px-4 py-2.5 border border-red-200 text-red-600 text-sm font-medium rounded-xl hover:bg-red-50 disabled:opacity-50 transition"
            >
              {deleting ? '삭제 중...' : '삭제'}
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-600 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50 transition"
          >
            {canEdit ? '취소' : '닫기'}
          </button>
          {canEdit && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium py-2.5 rounded-xl transition"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          )}
        </div>
      </div>
    </div>

    {showDeleteConfirm && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/50 px-4">
        <div className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-xs">
          <p className="text-sm font-semibold text-gray-900 mb-1">일정 삭제</p>
          {onDeleteAll ? (
            <>
              <p className="text-xs text-gray-500 mb-4">
                {event?.repeat_group_id
                  ? '반복 일정 전체를 삭제하시겠습니까, 아니면 이 일정만 삭제하시겠습니까?'
                  : '동일한 제목으로 작성된 일정을 모두 삭제하시겠습니까, 아니면 이 일정만 삭제하시겠습니까?'}
              </p>
              <div className="space-y-2">
                <button
                  onClick={async () => { setShowDeleteConfirm(false); await handleDeleteAll() }}
                  disabled={deleting}
                  className="w-full py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-xl disabled:opacity-50 transition"
                >
                  {event?.repeat_group_id ? '반복 일정 전체 삭제' : '동일 제목 일정 전체 삭제'}
                </button>
                <button
                  onClick={async () => { setShowDeleteConfirm(false); await handleDelete() }}
                  disabled={deleting}
                  className="w-full py-2.5 border border-red-200 text-red-600 text-sm font-medium rounded-xl hover:bg-red-50 disabled:opacity-50 transition"
                >
                  이 일정만 삭제
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="w-full py-2.5 border border-gray-300 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition"
                >
                  취소
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-gray-500 mb-4">이 일정을 삭제하시겠습니까?</p>
              <div className="space-y-2">
                <button
                  onClick={async () => { setShowDeleteConfirm(false); await handleDelete() }}
                  disabled={deleting}
                  className="w-full py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-xl disabled:opacity-50 transition"
                >
                  삭제
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="w-full py-2.5 border border-gray-300 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition"
                >
                  취소
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    )}
    </>
  )
}
