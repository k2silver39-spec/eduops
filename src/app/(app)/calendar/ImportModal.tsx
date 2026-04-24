'use client'

import { useState, useRef } from 'react'
import { CalendarEvent } from './EventModal'

interface ImportedEvent {
  course_name: string
  session: string
  title: string
  date_label: string
  day_of_week: string
  start_at: string
  end_at: string
  duration_hours: number
  participants: string
  is_allday: boolean
  description: string
  selected: boolean
}

interface Props {
  onImport: (events: Partial<CalendarEvent>[]) => Promise<void>
  onClose: () => void
}

export default function ImportModal({ onImport, onClose }: Props) {
  const [file,     setFile]     = useState<File | null>(null)
  const [year,     setYear]     = useState(String(new Date().getFullYear()))
  const [loading,  setLoading]  = useState(false)
  const [events,   setEvents]   = useState<ImportedEvent[]>([])
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [toast,    setToast]    = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (f: File) => {
    const name = f.name.toLowerCase()
    if (!name.endsWith('.pdf') && !name.endsWith('.docx')) {
      setError('PDF 또는 DOCX 파일만 지원합니다.')
      return
    }
    setFile(f)
    setError('')
    setEvents([])
  }

  const handleExtract = async () => {
    if (!file) return
    setLoading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('year', year)
      const res  = await fetch('/api/events/import', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? '추출 실패'); return }

      const extracted: ImportedEvent[] = (data.events ?? []).map(
        (e: Omit<ImportedEvent, 'selected'>) => ({ ...e, selected: true })
      )
      if (extracted.length === 0) {
        setError('문서에서 일정을 찾지 못했습니다.')
      } else {
        setEvents(extracted)
      }
    } catch {
      setError('처리 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // Group by course_name, preserving first-seen order
  const courseGroups = (() => {
    const seen: string[] = []
    const map: Record<string, number[]> = {}
    events.forEach((ev, i) => {
      if (!map[ev.course_name]) { seen.push(ev.course_name); map[ev.course_name] = [] }
      map[ev.course_name].push(i)
    })
    return seen.map(name => ({ name, indices: map[name] }))
  })()

  const toggleAll = (val: boolean) =>
    setEvents(evs => evs.map(e => ({ ...e, selected: val })))

  const toggleCourse = (indices: number[]) => {
    const allSel = indices.every(i => events[i].selected)
    setEvents(evs => evs.map((e, i) => indices.includes(i) ? { ...e, selected: !allSel } : e))
  }

  const toggleOne = (i: number) =>
    setEvents(evs => evs.map((e, idx) => idx === i ? { ...e, selected: !e.selected } : e))

  const selectedCount = events.filter(e => e.selected).length
  const allSelected   = events.length > 0 && selectedCount === events.length

  const handleImport = async () => {
    const selected = events.filter(e => e.selected)
    if (selected.length === 0) { setError('가져올 일정을 선택해 주세요.'); return }
    setSaving(true)
    setError('')
    try {
      await onImport(
        selected.map(({ selected: _s, course_name: _c, session: _se, date_label: _dl, day_of_week: _dw, duration_hours: _d, participants: _p, ...rest }) => ({
          ...rest,
          color:  'blue'     as const,
          source: 'document' as const,
        }))
      )
      const count = selected.length
      setToast(`${count}개 일정이 캘린더에 추가되었습니다.`)
      setTimeout(() => { setToast(''); onClose() }, 2000)
    } catch {
      setError('저장 중 오류가 발생했습니다.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-gray-900/60 backdrop-blur-sm px-0 sm:px-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[92vh] flex flex-col">

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">문서로 일정 가져오기</h2>
            <p className="text-xs text-gray-400 mt-0.5">PDF 또는 DOCX 파일에서 교육 일정을 자동 추출합니다</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* 파일 업로드 */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors
              ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
          >
            <input ref={inputRef} type="file" accept=".pdf,.docx" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
                <span className="text-sm font-medium text-gray-900 truncate max-w-xs">{file.name}</span>
              </div>
            ) : (
              <>
                <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                </svg>
                <p className="text-sm text-gray-500">클릭하거나 파일을 드래그하세요</p>
                <p className="text-xs text-gray-400 mt-1">PDF, DOCX · 최대 20MB</p>
              </>
            )}
          </div>

          {/* 기준 연도 */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-gray-600 whitespace-nowrap">기준 연도</label>
            <input type="number" value={year} onChange={e => setYear(e.target.value)} min={2020} max={2099}
              className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" />
            <p className="text-xs text-gray-400">날짜 해석에 사용됩니다</p>
          </div>

          {/* 추출 버튼 */}
          {events.length === 0 && (
            <button onClick={handleExtract} disabled={!file || loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium py-2.5 rounded-xl transition">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  AI가 일정을 추출하고 있습니다...
                </span>
              ) : '추출 시작'}
            </button>
          )}

          {/* 추출 결과 — 과정명별 그룹 */}
          {events.length > 0 && (
            <div className="space-y-3">
              {/* 전체 선택/해제 */}
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-700">총 {events.length}개 일정 추출됨</p>
                <div className="flex gap-2">
                  <button onClick={() => toggleAll(true)}  className="text-xs text-blue-600 hover:underline">전체 선택</button>
                  <button onClick={() => toggleAll(false)} className="text-xs text-gray-400 hover:underline">전체 해제</button>
                </div>
              </div>

              {/* 과정별 섹션 */}
              {courseGroups.map(group => {
                const groupAllSelected = group.indices.every(i => events[i].selected)
                const groupSomeSelected = group.indices.some(i => events[i].selected)
                return (
                  <div key={group.name} className="border border-gray-200 rounded-xl overflow-hidden">
                    {/* 과정명 헤더 */}
                    <div
                      className="flex items-center gap-2.5 px-3 py-2.5 bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => toggleCourse(group.indices)}
                    >
                      <input
                        type="checkbox"
                        checked={groupAllSelected}
                        ref={el => { if (el) el.indeterminate = groupSomeSelected && !groupAllSelected }}
                        onChange={() => toggleCourse(group.indices)}
                        onClick={e => e.stopPropagation()}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs font-semibold text-gray-800 flex-1">{group.name}</span>
                      <span className="text-xs text-gray-400">{group.indices.length}개</span>
                    </div>

                    {/* 일정 표 */}
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50/50">
                          <th className="w-8 px-3 py-1.5" />
                          <th className="text-left px-2 py-1.5 font-medium text-gray-500">제목</th>
                          <th className="text-center px-2 py-1.5 font-medium text-gray-500 whitespace-nowrap">날짜</th>
                          <th className="text-center px-2 py-1.5 font-medium text-gray-500 whitespace-nowrap">시간</th>
                          <th className="text-center px-2 py-1.5 font-medium text-gray-500 whitespace-nowrap">인원</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {group.indices.map(i => {
                          const ev = events[i]
                          return (
                            <tr
                              key={i}
                              className="hover:bg-blue-50/40 transition-colors cursor-pointer"
                              onClick={() => toggleOne(i)}
                            >
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={ev.selected}
                                  onChange={() => toggleOne(i)}
                                  onClick={e => e.stopPropagation()}
                                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                              </td>
                              <td className="px-2 py-2 text-gray-800 font-medium max-w-[180px] truncate">{ev.title}</td>
                              <td className="px-2 py-2 text-center text-gray-600 whitespace-nowrap">
                                {ev.date_label || '-'}
                              </td>
                              <td className="px-2 py-2 text-center text-gray-600 whitespace-nowrap">
                                {ev.duration_hours ? `${ev.duration_hours}시간` : '-'}
                              </td>
                              <td className="px-2 py-2 text-center text-gray-600 whitespace-nowrap">
                                {ev.participants || '-'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              })}
            </div>
          )}

          {/* 오류 */}
          {error && (
            <div className="bg-red-50 text-red-600 text-xs px-3 py-2.5 rounded-lg">{error}</div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="px-5 pb-5 pt-3 border-t border-gray-100 flex gap-2 flex-shrink-0">
          {events.length > 0 && (
            <button
              onClick={() => { setEvents([]); setFile(null); setError('') }}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              다시 선택
            </button>
          )}
          <div className="flex-1" />
          <button onClick={onClose}
            className="px-4 border border-gray-300 text-gray-600 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50 transition">
            취소
          </button>
          {events.length > 0 && (
            <button
              onClick={handleImport}
              disabled={saving || selectedCount === 0}
              className="px-5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium py-2.5 rounded-xl transition whitespace-nowrap"
            >
              {saving ? '추가 중...' : `선택한 일정 (${selectedCount}개) 캘린더에 추가`}
            </button>
          )}
        </div>
      </div>

      {/* 토스트 */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-gray-900 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-lg animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  )
}
