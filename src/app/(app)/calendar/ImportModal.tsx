'use client'

import { useState, useRef } from 'react'
import { CalendarEvent } from './EventModal'

interface ImportedEvent {
  title: string
  start_at: string
  end_at: string
  is_allday: boolean
  description: string
  selected: boolean
}

interface Props {
  onImport: (events: Partial<CalendarEvent>[]) => Promise<void>
  onClose: () => void
}

function fmt(iso: string, isAllday: boolean) {
  try {
    const d = new Date(iso)
    if (isAllday) {
      return `${d.getFullYear()}. ${d.getMonth()+1}. ${d.getDate()}.`
    }
    return `${d.getFullYear()}. ${d.getMonth()+1}. ${d.getDate()}. ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  } catch {
    return iso
  }
}

export default function ImportModal({ onImport, onClose }: Props) {
  const [file,      setFile]      = useState<File | null>(null)
  const [year,      setYear]      = useState(String(new Date().getFullYear()))
  const [loading,   setLoading]   = useState(false)
  const [events,    setEvents]    = useState<ImportedEvent[]>([])
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const [dragOver,  setDragOver]  = useState(false)
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

      const res = await fetch('/api/events/import', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? '추출 실패'); return }

      const extracted: ImportedEvent[] = (data.events ?? []).map((e: Omit<ImportedEvent, 'selected'>) => ({
        ...e,
        selected: true,
      }))

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

  const toggleAll = (val: boolean) => setEvents(ev => ev.map(e => ({ ...e, selected: val })))
  const toggleOne = (i: number) => setEvents(ev => ev.map((e, idx) => idx === i ? { ...e, selected: !e.selected } : e))

  const handleImport = async () => {
    const selected = events.filter(e => e.selected)
    if (selected.length === 0) { setError('가져올 일정을 선택해 주세요.'); return }
    setSaving(true)
    setError('')
    try {
      await onImport(selected.map(({ selected: _, ...rest }) => ({ ...rest, color: 'blue' as const, source: 'document' as const })))
    } catch {
      setError('저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const allSelected  = events.length > 0 && events.every(e => e.selected)
  const someSelected = events.some(e => e.selected)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-gray-900/60 backdrop-blur-sm px-0 sm:px-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">문서로 일정 가져오기</h2>
            <p className="text-xs text-gray-400 mt-0.5">PDF 또는 DOCX 파일에서 일정을 자동 추출합니다</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* 파일 업로드 */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.docx"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
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
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                </svg>
                <p className="text-sm text-gray-500">클릭하거나 파일을 드래그하세요</p>
                <p className="text-xs text-gray-400 mt-1">PDF, DOCX · 최대 20MB</p>
              </>
            )}
          </div>

          {/* 기준 연도 */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-gray-600 whitespace-nowrap">기준 연도</label>
            <input
              type="number"
              value={year}
              onChange={e => setYear(e.target.value)}
              min={2020}
              max={2099}
              className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
            <p className="text-xs text-gray-400">날짜 해석에 사용됩니다</p>
          </div>

          {/* 추출 버튼 */}
          {events.length === 0 && (
            <button
              onClick={handleExtract}
              disabled={!file || loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium py-2.5 rounded-xl transition"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  AI가 일정을 추출하고 있습니다...
                </span>
              ) : '추출 시작'}
            </button>
          )}

          {/* 추출 결과 */}
          {events.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-700">{events.length}개 일정 추출됨</p>
                <div className="flex gap-2">
                  <button onClick={() => toggleAll(true)}  className="text-xs text-blue-600 hover:underline">전체 선택</button>
                  <button onClick={() => toggleAll(false)} className="text-xs text-gray-400 hover:underline">선택 해제</button>
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100 max-h-60 overflow-y-auto">
                {events.map((ev, i) => (
                  <label key={i} className="flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={ev.selected}
                      onChange={() => toggleOne(i)}
                      className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{ev.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {fmt(ev.start_at, ev.is_allday)}
                        {ev.start_at !== ev.end_at && ` ~ ${fmt(ev.end_at, ev.is_allday)}`}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-600 text-xs px-3 py-2.5 rounded-lg">{error}</div>
          )}
        </div>

        <div className="px-5 pb-5 flex gap-2">
          <button
            onClick={() => { setEvents([]); setFile(null); setError('') }}
            className={events.length > 0 ? '' : 'hidden'}
          >
            <span className="text-sm text-gray-400 hover:text-gray-600">다시 선택</span>
          </button>
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 border border-gray-300 text-gray-600 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50 transition">
            취소
          </button>
          {events.length > 0 && (
            <button
              onClick={handleImport}
              disabled={saving || !someSelected}
              className="px-5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium py-2.5 rounded-xl transition"
            >
              {saving ? '추가 중...' : `선택한 ${events.filter(e=>e.selected).length}개 추가`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
