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
  agency_type?: string
}

const COLORS = [
  { value: 'blue',   label: '파랑',  bg: 'bg-blue-500' },
  { value: 'green',  label: '초록',  bg: 'bg-green-500' },
  { value: 'red',    label: '빨강',  bg: 'bg-red-500' },
  { value: 'orange', label: '주황',  bg: 'bg-orange-500' },
  { value: 'purple', label: '보라',  bg: 'bg-purple-500' },
  { value: 'gray',   label: '회색',  bg: 'bg-gray-400' },
] as const

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

interface Props {
  event?: CalendarEvent | null
  defaultDate?: string
  canPublish?: boolean
  currentUserId?: string
  isAdmin?: boolean
  onSave: (data: Partial<CalendarEvent>) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
}

export default function EventModal({
  event,
  defaultDate,
  canPublish = false,
  currentUserId,
  isAdmin = false,
  onSave,
  onDelete,
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
  const [color,       setColor]       = useState<CalendarEvent['color']>(event?.color ?? 'blue')
  const [isPublic,    setIsPublic]    = useState(event?.is_public ?? false)
  const [saving,      setSaving]      = useState(false)
  const [deleting,    setDeleting]    = useState(false)
  const [error,       setError]       = useState('')

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

  const handleSave = async () => {
    if (!title.trim()) { setError('제목을 입력해 주세요.'); return }
    if (!startVal || !endVal) { setError('날짜를 입력해 주세요.'); return }

    const startIso = isAllday ? startVal + 'T00:00:00.000Z' : new Date(startVal).toISOString()
    const endIso   = isAllday ? endVal   + 'T23:59:59.000Z' : new Date(endVal).toISOString()

    if (new Date(startIso) > new Date(endIso)) {
      setError('종료 일시는 시작 일시 이후여야 합니다.')
      return
    }

    setSaving(true)
    setError('')
    try {
      await onSave({ title: title.trim(), description: description.trim(), start_at: startIso, end_at: endIso, is_allday: isAllday, color, is_public: isPublic })
    } catch {
      setError('저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete) return
    if (!confirm('이 일정을 삭제하시겠습니까?')) return
    setDeleting(true)
    try { await onDelete() } catch { setError('삭제 중 오류가 발생했습니다.') } finally { setDeleting(false) }
  }

  return (
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

          {/* 종일 토글 */}
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

          {/* 날짜/시간 */}
          <div className="grid grid-cols-2 gap-3">
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
          </div>

          {/* 색상 */}
          {canEdit && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">색상</label>
              <div className="flex gap-2">
                {COLORS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value as CalendarEvent['color'])}
                    title={c.label}
                    className={`w-7 h-7 rounded-full ${c.bg} transition-all ${color === c.value ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'opacity-60 hover:opacity-100'}`}
                  />
                ))}
              </div>
            </div>
          )}

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
              onClick={handleDelete}
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
  )
}
