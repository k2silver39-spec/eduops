'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// ─────────────────────────────────────────────────
// 첨부파일 유틸
// ─────────────────────────────────────────────────
interface PendingFile { path: string; filename: string; size: number }
interface ExistingFile { id: string; filename: string; size: number }

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}
import { useRouter } from 'next/navigation'
import ReportPreviewModal from './ReportPreviewModal'
import {
  ReportType, ReportMode,
  WeeklyContent, MonthlyContent,
  KPI_LABELS, ACTIVITY_LABELS,
  calcRate, calcBudgetRow, calcBudgetSubtotal, fmtNum,
  defaultWeekly, defaultMonthly,
} from './report-types'
// calcBudgetSubtotal은 예산 합계 계산에 사용

// ─────────────────────────────────────────────────
// 날짜 유틸
// ─────────────────────────────────────────────────

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return d
}

function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getWeekOfMonth(monday: Date): number {
  return Math.ceil(monday.getDate() / 7)
}

function calcWeeklyPeriod(weeklyDate: string) {
  const monday = getMondayOfWeek(new Date(weeklyDate + 'T00:00:00'))
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  const week = getWeekOfMonth(monday)
  return {
    period_label: `${monday.getFullYear()}년 ${monday.getMonth() + 1}월 ${week}주차 (${monday.getMonth() + 1}.${monday.getDate()}.~${sunday.getMonth() + 1}.${sunday.getDate()}.)`,
    period_start: toDateStr(monday),
    period_end:   toDateStr(sunday),
    monday,
  }
}

/** 해당 연월에 속하는 주(월요일이 해당 월인 주만) 목록 반환 */
function getWeeksInMonth(year: number, month: number): { value: string; label: string }[] {
  const result: { value: string; label: string }[] = []
  // 해당 월의 첫 월요일 찾기
  let monday = new Date(year, month - 1, 1)
  while (monday.getDay() !== 1) {
    monday.setDate(monday.getDate() + 1)
  }
  let weekNum = 1
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`
  while (monday.getFullYear() === year && monday.getMonth() + 1 === month) {
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    result.push({ value: toDateStr(monday), label: `${weekNum}주차 (${fmt(monday)}~${fmt(sunday)})` })
    weekNum++
    monday = new Date(monday)
    monday.setDate(monday.getDate() + 7)
  }
  return result
}

function calcMonthlyPeriod(year: number, month: number) {
  const lastDay = new Date(year, month, 0)
  return {
    period_label: `${year}년 ${month}월 (${month}.1.~${month}.${lastDay.getDate()}.)`,
    period_start: `${year}-${String(month).padStart(2, '0')}-01`,
    period_end:   toDateStr(lastDay),
  }
}

function getWeekHeaders(monday: Date) {
  const thisEnd   = new Date(monday); thisEnd.setDate(monday.getDate() + 6)
  const nextStart = new Date(monday); nextStart.setDate(monday.getDate() + 7)
  const nextEnd   = new Date(monday); nextEnd.setDate(monday.getDate() + 13)
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`
  return {
    thisWeek: `이번주 실적 (${fmt(monday)}~${fmt(thisEnd)})`,
    nextWeek: `다음주 계획 (${fmt(nextStart)}~${fmt(nextEnd)})`,
  }
}

function isPastDeadline(periodEnd: string) {
  return new Date().toISOString().split('T')[0] > periodEnd
}

// ─────────────────────────────────────────────────
// 로컬스토리지 키
// ─────────────────────────────────────────────────
const LS_KEY_NEW = 'eduops_report_new_v2'
const lsKeyEdit = (id: string) => `eduops_report_edit_v2_${id}`

// ─────────────────────────────────────────────────
// NumInput: 천단위 콤마 자동 표시 숫자 입력
// ─────────────────────────────────────────────────
function NumInput({
  value,
  onChange,
  className,
  placeholder = '0',
}: {
  value: string
  onChange: (v: string) => void
  className?: string
  placeholder?: string
}) {
  const [focused, setFocused] = useState(false)
  const display = focused ? value : (value ? Number(value).toLocaleString('ko-KR') : '')

  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ''))}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      className={className}
    />
  )
}

// GhostNumInput: 이전 값을 흐릿하게 표시, 입력 시 사라짐
// ─────────────────────────────────────────────────
function GhostNumInput({
  value,
  onChange,
  ghostValue,
  className,
}: {
  value: string
  onChange: (v: string) => void
  ghostValue?: string
  className?: string
}) {
  const [focused, setFocused] = useState(false)
  const display = focused ? value : (value ? Number(value).toLocaleString('ko-KR') : '')
  const showGhost = !focused && value === '' && !!ghostValue

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        value={display}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ''))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={showGhost ? '' : '0'}
        className={className}
      />
      {showGhost && (
        <div
          className="absolute inset-0 flex items-center justify-center text-xs tabular-nums pointer-events-none select-none"
          style={{ opacity: 0.35 }}
        >
          {Number(ghostValue).toLocaleString('ko-KR')}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────
// GhostTextarea: 이전 보고서 내용을 흐릿하게 표시
// ─────────────────────────────────────────────────
function GhostTextarea({
  value,
  onChange,
  ghostText,
  rows = 3,
  placeholder,
  className,
}: {
  value: string
  onChange: (v: string) => void
  ghostText?: string
  rows?: number
  placeholder?: string
  className?: string
}) {
  const [focused, setFocused] = useState(false)
  const showGhost = !focused && value === '' && !!ghostText

  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        rows={rows}
        placeholder={showGhost ? '' : placeholder}
        className={`w-full resize-none ${className ?? ''}`}
      />
      {showGhost && (
        <div
          className="absolute inset-0 px-3 py-2 text-sm text-gray-900 whitespace-pre-wrap overflow-hidden pointer-events-none leading-5"
          style={{ opacity: 0.35 }}
        >
          {ghostText}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────
// SectionCard: 섹션 카드 래퍼
// ─────────────────────────────────────────────────
function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
        <p className="text-xs font-semibold text-gray-700">{title}</p>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

// ─────────────────────────────────────────────────
// 셀 스타일
// ─────────────────────────────────────────────────
const TH_BASE = 'border border-gray-300 bg-gray-50 px-2 py-1.5 text-xs font-semibold text-gray-600'
const TD_BASE = 'border border-gray-300 px-2 py-1 text-xs text-gray-800'

// ─────────────────────────────────────────────────
// WeeklyFormBody
// ─────────────────────────────────────────────────
function WeeklyFormBody({
  value,
  onChange,
  prev,
  weeklyDate,
  mode,
}: {
  value: WeeklyContent
  onChange: (v: WeeklyContent) => void
  prev?: WeeklyContent
  weeklyDate: string
  mode: ReportMode
}) {
  const [autoFillMsg, setAutoFillMsg] = useState('')
  const autoFillDone = useRef(false)

  // 이전 주간보고의 연간목표 자동입력 (create 모드, target이 비어있을 때)
  useEffect(() => {
    if (mode !== 'create' || autoFillDone.current || !prev) return
    const isEmpty = value.kpi_rows.every(r => !r.target)
    if (!isEmpty) { autoFillDone.current = true; return }
    autoFillDone.current = true
    onChange({
      ...value,
      kpi_rows: value.kpi_rows.map((r, i) => ({ ...r, target: prev.kpi_rows[i]?.target ?? r.target })),
    })
    setAutoFillMsg('이전 주간보고의 연간목표 값을 자동으로 불러왔습니다.')
    setTimeout(() => setAutoFillMsg(''), 6000)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, prev])

  const monday = getMondayOfWeek(new Date(weeklyDate + 'T00:00:00'))
  const { thisWeek, nextWeek } = getWeekHeaders(monday)

  const setOrgInfo = (patch: Partial<WeeklyContent['org_info']>) =>
    onChange({ ...value, org_info: { ...value.org_info, ...patch } })

  const setKpi = (i: number, patch: Partial<typeof value.kpi_rows[0]>) =>
    onChange({ ...value, kpi_rows: value.kpi_rows.map((r, idx) => idx === i ? { ...r, ...patch } : r) })

  const setActivity = (i: number, patch: Partial<typeof value.activity_rows[0]>) =>
    onChange({ ...value, activity_rows: value.activity_rows.map((r, idx) => idx === i ? { ...r, ...patch } : r) })

  const inputCls = 'w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white'
  const readonlyCls = 'w-full px-2 py-1.5 bg-gray-50 border border-gray-100 rounded text-xs text-gray-600 cursor-default'
  const numCls = 'w-full px-2 py-1.5 border border-gray-200 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white tabular-nums'
  const textareaCls = 'w-full px-3 py-2 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white resize-none leading-relaxed'

  return (
    <div className="space-y-4">
      {/* ── 1. 수행기관 정보 ── */}
      <SectionCard title="1. 수행기관 정보">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <tbody>
              {value.org_info.agency_type && (
                <tr>
                  <td className={`${TH_BASE} w-36 text-center`}>기관구분</td>
                  <td className={TD_BASE}>
                    <input readOnly value={value.org_info.agency_type} className={readonlyCls} />
                  </td>
                </tr>
              )}
              <tr>
                <td className={`${TH_BASE} w-36 text-center`}>기관명</td>
                <td className={TD_BASE}>
                  <input readOnly value={value.org_info.operator} className={readonlyCls} />
                </td>
              </tr>
              <tr>
                <td className={`${TH_BASE} text-center`}>실무담당자</td>
                <td className={TD_BASE}>
                  <input
                    value={value.org_info.operator_name}
                    onChange={(e) => onChange({ ...value, org_info: { ...value.org_info, operator_name: e.target.value } })}
                    placeholder="성명 입력"
                    className={inputCls}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* ── 2. 성과지표 달성 현황 ── */}
      <SectionCard title="2. 성과지표 달성 현황">
        {autoFillMsg && (
          <p className="text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded px-2 py-1.5 mb-3">
            ✓ {autoFillMsg}
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[560px]">
            <thead>
              <tr>
                <th className={`${TH_BASE} w-28 text-center`}>지표명</th>
                <th className={`${TH_BASE} w-24 text-center`}>연간목표(A)</th>
                <th className={`${TH_BASE} w-24 text-center`}>누적실적(B)</th>
                <th className={`${TH_BASE} w-20 text-center`}>달성률</th>
                <th className={`${TH_BASE} w-28 text-center`}>비고</th>
              </tr>
            </thead>
            <tbody>
              {KPI_LABELS.map((label, i) => {
                const row = value.kpi_rows[i]
                const prevRow = prev?.kpi_rows[i]
                return (
                  <tr key={label}>
                    <td className={`${TH_BASE} text-center font-medium`}>{label}</td>
                    <td className={`${TD_BASE} p-0.5`}>
                      <NumInput
                        value={row.target}
                        onChange={(v) => setKpi(i, { target: v })}
                        className={numCls}
                        placeholder={prevRow?.target ? fmtNum(prevRow.target) : '0'}
                      />
                    </td>
                    <td className={`${TD_BASE} p-0.5`}>
                      <GhostNumInput
                        value={row.actual}
                        onChange={(v) => setKpi(i, { actual: v })}
                        ghostValue={prevRow?.actual}
                        className={numCls}
                      />
                    </td>
                    <td className={`${TD_BASE} text-center font-semibold text-blue-600 tabular-nums`}>
                      {calcRate(row.target, row.actual)}
                    </td>
                    <td className={`${TD_BASE} p-0.5`}>
                      <input
                        type="text"
                        value={row.note ?? ''}
                        onChange={(e) => setKpi(i, { note: e.target.value })}
                        placeholder="비고 입력"
                        className={inputCls}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* ── 3. 주간 실적 및 계획 ── */}
      <SectionCard title="3. 주간 실적 및 계획">
        {prev && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded px-2 py-1.5 mb-3">
            ※ 지난주 리포트 내용을 참고용으로 표시합니다.
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[560px]">
            <thead>
              <tr>
                <th className={`${TH_BASE} w-20 text-center`}>구분</th>
                <th className={`${TH_BASE} text-center`}>{thisWeek}</th>
                <th className={`${TH_BASE} text-center`}>{nextWeek}</th>
                <th className={`${TH_BASE} w-24 text-center`}>비고</th>
              </tr>
            </thead>
            <tbody>
              {ACTIVITY_LABELS.map((label, i) => {
                const row = value.activity_rows[i]
                const prevRow = prev?.activity_rows[i]
                return (
                  <tr key={label}>
                    <td className={`${TH_BASE} text-center font-medium`}>{label}</td>
                    <td className={`${TD_BASE} p-0.5`}>
                      <GhostTextarea
                        value={row.current_week}
                        onChange={(v) => setActivity(i, { current_week: v })}
                        ghostText={prevRow?.current_week}
                        rows={3}
                        placeholder="이번주 실적 입력"
                        className={textareaCls}
                      />
                    </td>
                    <td className={`${TD_BASE} p-0.5`}>
                      <GhostTextarea
                        value={row.next_week}
                        onChange={(v) => setActivity(i, { next_week: v })}
                        ghostText={prevRow?.next_week}
                        rows={3}
                        placeholder="다음주 계획 입력"
                        className={textareaCls}
                      />
                    </td>
                    <td className={`${TD_BASE} p-0.5`}>
                      <textarea
                        value={row.note}
                        onChange={(e) => setActivity(i, { note: e.target.value })}
                        rows={3}
                        placeholder="비고"
                        className={textareaCls}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}

// ─────────────────────────────────────────────────
// OrgWeeklyReports: 월간보고 내 기관 주간보고 현황
// ─────────────────────────────────────────────────
const STATUS_LABELS: Record<string, { text: string; color: string }> = {
  submitted:          { text: '제출됨',   color: 'bg-blue-100 text-blue-700' },
  approved:           { text: '승인됨',   color: 'bg-green-100 text-green-700' },
  revision_requested: { text: '수정요청', color: 'bg-red-100 text-red-700' },
  resubmitted:        { text: '재제출됨', color: 'bg-purple-100 text-purple-700' },
  revision_approved:  { text: '재승인됨', color: 'bg-teal-100 text-teal-700' },
}

interface OrgReport {
  id: string
  period_label: string
  period_start: string
  status: string
  content: WeeklyContent
  author: { email: string; organization: string } | null
}

function OrgWeeklyReports({ year, month }: { year: number; month: number }) {
  const [reports, setReports] = useState<OrgReport[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/reports/org?year=${year}&month=${month}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { setReports(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => { setReports([]); setLoading(false) })
  }, [year, month])

  const st = (s: string) => STATUS_LABELS[s] ?? { text: s, color: 'bg-gray-100 text-gray-600' }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between bg-gray-50 border-b border-gray-200 px-4 py-2.5 text-left"
      >
        <p className="text-xs font-semibold text-gray-700">
          이번 달 기관 주간 리포트 현황
          {!loading && <span className="ml-1.5 text-gray-400 font-normal">({reports.length}건)</span>}
        </p>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="p-4">
          {loading ? (
            <p className="text-xs text-gray-400 text-center py-3">불러오는 중...</p>
          ) : reports.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3">이번 달 제출된 주간 리포트가 없습니다.</p>
          ) : (
            <div className="space-y-1.5">
              {reports.map(r => (
                <div key={r.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                    className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-gray-800 font-medium truncate">{r.period_label}</span>
                      {(r.author?.email || r.author?.organization) && (
                        <span className="text-xs text-gray-500 flex-shrink-0">{r.author?.email ?? r.author?.organization ?? '-'}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${st(r.status).color}`}>
                        {st(r.status).text}
                      </span>
                      <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${expandedId === r.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                      </svg>
                    </div>
                  </button>

                  {expandedId === r.id && r.content?.version === 2 && (
                    <div className="border-t border-gray-100 px-3 py-3 bg-gray-50 space-y-3">
                      {/* KPI 요약 */}
                      <div>
                        <p className="text-[10px] font-semibold text-gray-500 mb-1">성과지표 달성 현황</p>
                        <table className="w-full border-collapse text-[10px]">
                          <thead>
                            <tr>
                              <th className="border border-gray-300 bg-gray-100 px-1.5 py-1 text-left font-semibold text-gray-600">지표명</th>
                              <th className="border border-gray-300 bg-gray-100 px-1.5 py-1 text-center font-semibold text-gray-600 w-16">목표</th>
                              <th className="border border-gray-300 bg-gray-100 px-1.5 py-1 text-center font-semibold text-gray-600 w-16">실적</th>
                              <th className="border border-gray-300 bg-gray-100 px-1.5 py-1 text-center font-semibold text-gray-600 w-14">달성률</th>
                            </tr>
                          </thead>
                          <tbody>
                            {KPI_LABELS.map((label, i) => {
                              const row = r.content.kpi_rows[i] ?? { target: '', actual: '' }
                              return (
                                <tr key={label}>
                                  <td className="border border-gray-300 px-1.5 py-1 text-gray-700">{label}</td>
                                  <td className="border border-gray-300 px-1.5 py-1 text-center tabular-nums text-gray-700">{fmtNum(row.target) || '—'}</td>
                                  <td className="border border-gray-300 px-1.5 py-1 text-center tabular-nums text-gray-700">{fmtNum(row.actual) || '—'}</td>
                                  <td className="border border-gray-300 px-1.5 py-1 text-center text-blue-600 font-medium">{calcRate(row.target, row.actual)}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                      {/* 활동 요약 */}
                      <div>
                        <p className="text-[10px] font-semibold text-gray-500 mb-1">주간 실적 및 계획</p>
                        <div className="space-y-1.5">
                          {ACTIVITY_LABELS.map((label, i) => {
                            const row = r.content.activity_rows[i] ?? { current_week: '', next_week: '', note: '' }
                            if (!row.current_week && !row.next_week) return null
                            return (
                              <div key={label} className="text-[10px]">
                                <span className="font-semibold text-gray-600">{label}:&nbsp;</span>
                                {row.current_week && <span className="text-gray-700">{row.current_week}</span>}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────
// MonthlyFormBody
// ─────────────────────────────────────────────────
function MonthlyFormBody({
  value,
  onChange,
  prev,
  year,
  month,
  mode,
}: {
  value: MonthlyContent
  onChange: (v: MonthlyContent) => void
  prev?: MonthlyContent
  year: number
  month: number
  mode: ReportMode
}) {
  const [autoFillMsg, setAutoFillMsg] = useState('')
  const autoFillDone = useRef(false)

  // 최근 보고서 연간목표 자동입력 (create 모드, target이 비어있을 때)
  useEffect(() => {
    if (mode !== 'create' || autoFillDone.current) return
    const isEmpty = !value.kpi_rows || value.kpi_rows.every(r => !r.target)
    if (!isEmpty) { autoFillDone.current = true; return }
    const ny = month === 12 ? year + 1 : year
    const nm = month === 12 ? 1 : month + 1
    const before = `${ny}-${String(nm).padStart(2, '0')}-01`
    fetch(`/api/reports/previous?before=${before}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.content?.version === 2 && Array.isArray(data.content.kpi_rows)) {
          autoFillDone.current = true
          onChange({
            ...value,
            kpi_rows: value.kpi_rows.map((r, i) => ({
              ...r,
              target: data.content.kpi_rows[i]?.target ?? r.target,
            })),
          })
          setAutoFillMsg(`최근 리포트(${data.period_label}) 연간목표 값을 자동으로 불러왔습니다.`)
          setTimeout(() => setAutoFillMsg(''), 6000)
        }
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, year, month])

  const setKpi = (i: number, patch: Partial<typeof value.kpi_rows[0]>) =>
    onChange({ ...value, kpi_rows: value.kpi_rows.map((r, idx) => idx === i ? { ...r, ...patch } : r) })

  const setQual = (patch: Partial<typeof value.qualitative>) =>
    onChange({ ...value, qualitative: { ...value.qualitative, ...patch } })

  const setBudget = (key: keyof typeof value.budget, patch: Partial<typeof value.budget.operator_gov>) =>
    onChange({ ...value, budget: { ...value.budget, [key]: { ...value.budget[key], ...patch } } })

  const opGov  = calcBudgetRow(value.budget.operator_gov)
  const opSelf = calcBudgetRow(value.budget.operator_self)
  const total  = calcBudgetSubtotal(value.budget.operator_gov, value.budget.operator_self)

  const readonlyCls = 'w-full px-2 py-1.5 bg-gray-50 border border-gray-100 rounded text-xs text-gray-600 cursor-default'
  const inputCls = 'w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white'
  const numCls = 'w-full px-2 py-1.5 border border-gray-200 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white tabular-nums'
  const autoNumCls = 'w-full px-2 py-1.5 bg-gray-50 text-xs text-center tabular-nums text-gray-600 cursor-default'
  const textareaCls = 'w-full px-3 py-2 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white resize-none leading-relaxed'

  // 이전 월간보고의 정량실적 (ghost용)
  const prevKpi = (prev as any)?.kpi_rows as typeof value.kpi_rows | undefined

  return (
    <div className="space-y-4">
      {/* ── 1. 수행기관 정보 ── */}
      <SectionCard title="1. 수행기관 정보">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <tbody>
              {value.org_info.agency_type && (
                <tr>
                  <td className={`${TH_BASE} w-24 text-center`}>기관구분</td>
                  <td className={TD_BASE} colSpan={3}>
                    <input readOnly value={value.org_info.agency_type} className={readonlyCls} />
                  </td>
                </tr>
              )}
              <tr>
                <td className={`${TH_BASE} w-24 text-center`}>기관명</td>
                <td className={TD_BASE} colSpan={3}>
                  <input readOnly value={value.org_info.operator} className={readonlyCls} />
                </td>
              </tr>
              <tr>
                <td className={`${TH_BASE} w-24 text-center`}>사업책임자</td>
                <td className={TD_BASE}>
                  <input
                    value={value.org_info.project_manager ?? ''}
                    onChange={(e) => onChange({ ...value, org_info: { ...value.org_info, project_manager: e.target.value } })}
                    placeholder="성명 입력"
                    className={inputCls}
                  />
                </td>
                <td className={`${TH_BASE} w-24 text-center`}>실무담당자</td>
                <td className={TD_BASE}>
                  <input
                    value={value.org_info.operator_name}
                    onChange={(e) => onChange({ ...value, org_info: { ...value.org_info, operator_name: e.target.value } })}
                    placeholder="성명 입력"
                    className={inputCls}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* ── 2. 정량 및 정성 실적 ── */}
      <SectionCard title="2. 정량 및 정성 실적">
        {prev && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded px-2 py-1.5 mb-3">
            ※ 전월 리포트 내용을 참고용으로 표시합니다.
          </p>
        )}
        {autoFillMsg && (
          <p className="text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded px-2 py-1.5 mb-3">
            ✓ {autoFillMsg}
          </p>
        )}

        {/* 정량실적 */}
        <p className="text-xs font-semibold text-gray-600 mb-1.5">정량실적</p>
        <div className="overflow-x-auto mb-4">
          <table className="w-full border-collapse min-w-[420px]">
            <thead>
              <tr>
                <th className={`${TH_BASE} w-32 text-center`}>지표명</th>
                <th className={`${TH_BASE} text-center`}>연간목표(A)</th>
                <th className={`${TH_BASE} text-center`}>누적실적(B)</th>
                <th className={`${TH_BASE} w-20 text-center`}>달성률</th>
              </tr>
            </thead>
            <tbody>
              {KPI_LABELS.map((label, i) => {
                const row = value.kpi_rows?.[i] ?? { target: '', actual: '' }
                const prevRow = prevKpi?.[i]
                return (
                  <tr key={label}>
                    <td className={`${TH_BASE} text-center font-medium`}>{label}</td>
                    <td className={`${TD_BASE} p-0.5`}>
                      <NumInput
                        value={row.target}
                        onChange={(v) => setKpi(i, { target: v })}
                        className={numCls}
                        placeholder={prevRow?.target ? fmtNum(prevRow.target) : '0'}
                      />
                    </td>
                    <td className={`${TD_BASE} p-0.5`}>
                      <GhostNumInput
                        value={row.actual}
                        onChange={(v) => setKpi(i, { actual: v })}
                        ghostValue={prevRow?.actual}
                        className={numCls}
                      />
                    </td>
                    <td className={`${TD_BASE} text-center font-semibold text-blue-600 tabular-nums`}>
                      {calcRate(row.target, row.actual)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* 정성실적 */}
        <p className="text-xs font-semibold text-gray-600 mb-1.5">정성실적</p>
        <div className="overflow-x-auto mb-4">
          <table className="w-full border-collapse min-w-[420px]">
            <thead>
              <tr>
                <th className={`${TH_BASE} text-center`}>목표</th>
                <th className={`${TH_BASE} text-center`}>실적</th>
                <th className={`${TH_BASE} w-20 text-center`}>달성률</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={`${TD_BASE} p-0.5`}>
                  <GhostTextarea
                    value={value.qualitative.target ?? ''}
                    onChange={(v) => setQual({ target: v })}
                    ghostText={(prev?.qualitative as any)?.target}
                    rows={3}
                    placeholder="정성 목표 입력"
                    className={textareaCls}
                  />
                </td>
                <td className={`${TD_BASE} p-0.5`}>
                  <GhostTextarea
                    value={value.qualitative.actual ?? ''}
                    onChange={(v) => setQual({ actual: v })}
                    ghostText={(prev?.qualitative as any)?.actual}
                    rows={3}
                    placeholder="정성 실적 입력"
                    className={textareaCls}
                  />
                </td>
                <td className={`${TD_BASE} p-0.5 align-top`}>
                  <input
                    type="text"
                    value={value.qualitative.rate ?? ''}
                    onChange={(e) => setQual({ rate: e.target.value })}
                    placeholder="예: 85%"
                    className={numCls}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 향후목표 달성계획 */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">향후목표 달성계획</label>
          <GhostTextarea
            value={value.achievement_plan}
            onChange={(v) => onChange({ ...value, achievement_plan: v })}
            ghostText={prev?.achievement_plan}
            rows={3}
            placeholder="향후목표 달성계획을 입력하세요"
            className={textareaCls}
          />
        </div>
      </SectionCard>

      {/* ── 3. 예산 집행현황 ── */}
      <SectionCard title="3. 예산 집행현황">
        <div className="overflow-x-auto mb-3">
          <table className="w-full border-collapse table-fixed min-w-[480px]">
            <thead>
              <tr>
                <th className={`${TH_BASE} w-24 text-center`}>구분</th>
                <th className={`${TH_BASE} text-center`}>예산</th>
                <th className={`${TH_BASE} text-center`}>집행액</th>
                <th className={`${TH_BASE} text-center`}>집행잔액</th>
                <th className={`${TH_BASE} w-16 text-center`}>집행률</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={`${TH_BASE} text-center`}>국고보조금</td>
                <td className={`${TD_BASE} p-0.5`}>
                  <NumInput value={value.budget.operator_gov.budget} onChange={(v) => setBudget('operator_gov', { budget: v })} className={numCls} />
                </td>
                <td className={`${TD_BASE} p-0.5`}>
                  <NumInput value={value.budget.operator_gov.executed} onChange={(v) => setBudget('operator_gov', { executed: v })} className={numCls} />
                </td>
                <td className={`${TD_BASE} p-0.5`}>
                  <div className={autoNumCls}>{opGov.budget ? opGov.remaining.toLocaleString('ko-KR') : '—'}</div>
                </td>
                <td className={`${TD_BASE} text-center font-medium text-blue-600`}>{opGov.rate}</td>
              </tr>
              <tr>
                <td className={`${TH_BASE} text-center`}>자기부담금</td>
                <td className={`${TD_BASE} p-0.5`}>
                  <NumInput value={value.budget.operator_self.budget} onChange={(v) => setBudget('operator_self', { budget: v })} className={numCls} />
                </td>
                <td className={`${TD_BASE} p-0.5`}>
                  <NumInput value={value.budget.operator_self.executed} onChange={(v) => setBudget('operator_self', { executed: v })} className={numCls} />
                </td>
                <td className={`${TD_BASE} p-0.5`}>
                  <div className={autoNumCls}>{opSelf.budget ? opSelf.remaining.toLocaleString('ko-KR') : '—'}</div>
                </td>
                <td className={`${TD_BASE} text-center font-medium text-blue-600`}>{opSelf.rate}</td>
              </tr>
              <tr className="bg-blue-50">
                <td className={`${TH_BASE} text-center font-bold text-blue-700`}>합계</td>
                <td className={`${TD_BASE} p-0.5`}>
                  <div className="w-full px-2 py-1.5 bg-blue-50 text-xs text-center tabular-nums font-semibold text-blue-700">{total.budget ? total.budget.toLocaleString('ko-KR') : '—'}</div>
                </td>
                <td className={`${TD_BASE} p-0.5`}>
                  <div className="w-full px-2 py-1.5 bg-blue-50 text-xs text-center tabular-nums font-semibold text-blue-700">{total.executed ? total.executed.toLocaleString('ko-KR') : '—'}</div>
                </td>
                <td className={`${TD_BASE} p-0.5`}>
                  <div className="w-full px-2 py-1.5 bg-blue-50 text-xs text-center tabular-nums font-semibold text-blue-700">{total.budget ? total.remaining.toLocaleString('ko-KR') : '—'}</div>
                </td>
                <td className={`${TD_BASE} text-center font-bold text-blue-700`}>{total.rate}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">향후예산 활용계획</label>
          <GhostTextarea
            value={value.budget_plan}
            onChange={(v) => onChange({ ...value, budget_plan: v })}
            ghostText={prev?.budget_plan}
            rows={3}
            placeholder="향후예산 활용계획을 입력하세요"
            className={textareaCls}
          />
        </div>
      </SectionCard>
    </div>
  )
}

// ─────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────
interface UserProfile {
  organization: string
  agency_type?: string
}

interface ReportFormProps {
  mode: ReportMode
  reportId?: string
  initialType?: ReportType
  initialWeeklyDate?: string
  initialMonthlyYear?: number
  initialMonthlyMonth?: number
  initialWeeklyContent?: WeeklyContent
  initialMonthlyContent?: MonthlyContent
  forceAllowSubmit?: boolean
  userProfile: UserProfile
  existingReports?: { id: string; type: string; period_start: string }[]
  initialAttachments?: ExistingFile[]
}

// ─────────────────────────────────────────────────
// Main ReportForm
// ─────────────────────────────────────────────────
export default function ReportForm({
  mode,
  reportId,
  initialType,
  initialWeeklyDate,
  initialMonthlyYear,
  initialMonthlyMonth,
  initialWeeklyContent,
  initialMonthlyContent,
  forceAllowSubmit = false,
  userProfile,
  existingReports,
  initialAttachments = [],
}: ReportFormProps) {
  const router = useRouter()
  const today = new Date()
  const defaultMonday = getMondayOfWeek(today)

  const [type, setType] = useState<ReportType>(initialType ?? 'weekly')
  const [weeklyDate, setWeeklyDate] = useState(initialWeeklyDate ?? toDateStr(defaultMonday))
  const [weeklyDisplayYear, setWeeklyDisplayYear] = useState(() => {
    const d = new Date((initialWeeklyDate ?? toDateStr(defaultMonday)) + 'T00:00:00')
    return d.getFullYear()
  })
  const [weeklyDisplayMonth, setWeeklyDisplayMonth] = useState(() => {
    const d = new Date((initialWeeklyDate ?? toDateStr(defaultMonday)) + 'T00:00:00')
    return d.getMonth() + 1
  })
  const [monthlyYear, setMonthlyYear] = useState(initialMonthlyYear ?? today.getFullYear())
  const [monthlyMonth, setMonthlyMonth] = useState(initialMonthlyMonth ?? (today.getMonth() + 1))

  const [weekly, setWeekly] = useState<WeeklyContent>(
    initialWeeklyContent ?? defaultWeekly(userProfile.organization, userProfile.agency_type)
  )
  const [monthly, setMonthly] = useState<MonthlyContent>(
    initialMonthlyContent ?? defaultMonthly(userProfile.organization, userProfile.agency_type)
  )

  const [prevWeekly, setPrevWeekly] = useState<WeeklyContent | undefined>()
  const [prevMonthly, setPrevMonthly] = useState<MonthlyContent | undefined>()
  const [prevLabel, setPrevLabel] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showRestorePrompt, setShowRestorePrompt] = useState(false)
  const [restored, setRestored] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [dupReportId, setDupReportId] = useState<string | null>(null)

  // ── 첨부파일
  const [existingFiles, setExistingFiles] = useState<ExistingFile[]>(initialAttachments)
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [removedIds, setRemovedIds] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    if (!selected.length) return
    e.target.value = ''
    setUploading(true)
    for (const file of selected) {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok) {
        setPendingFiles(prev => [...prev, { path: data.path, filename: data.filename, size: data.size }])
      } else {
        setError(data.error ?? '파일 업로드 실패')
      }
    }
    setUploading(false)
  }

  const removeExisting = (id: string) => {
    setExistingFiles(prev => prev.filter(f => f.id !== id))
    setRemovedIds(prev => [...prev, id])
  }

  const removePending = (idx: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== idx))
  }

  const autoSaveTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const lsKey = mode === 'create' ? LS_KEY_NEW : (reportId ? lsKeyEdit(reportId) : LS_KEY_NEW)

  // ── 복원 프롬프트 (create 모드)
  useEffect(() => {
    if (mode === 'create' && localStorage.getItem(lsKey)) {
      setShowRestorePrompt(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── 30초 자동저장
  useEffect(() => {
    const save = () => {
      const draft = { type, weeklyDate, monthlyYear, monthlyMonth, weekly, monthly }
      localStorage.setItem(lsKey, JSON.stringify(draft))
    }
    autoSaveTimer.current = setInterval(save, 30000)
    return () => { if (autoSaveTimer.current) clearInterval(autoSaveTimer.current) }
  }, [type, weeklyDate, monthlyYear, monthlyMonth, weekly, monthly, lsKey])

  // ── 이전 보고서 불러오기 (기간 변경 시)
  const fetchPrev = useCallback(async (t: ReportType, before: string) => {
    try {
      const res = await fetch(`/api/reports/previous?type=${t}&before=${before}`)
      if (!res.ok) { setPrevWeekly(undefined); setPrevMonthly(undefined); return }
      const data = await res.json()
      if (!data) { setPrevWeekly(undefined); setPrevMonthly(undefined); return }
      setPrevLabel(data.period_label ?? '')
      if (t === 'weekly' && data.content?.version === 2) {
        setPrevWeekly(data.content as WeeklyContent)
      } else if (t === 'monthly' && data.content?.version === 2) {
        setPrevMonthly(data.content as MonthlyContent)
      } else {
        setPrevWeekly(undefined); setPrevMonthly(undefined)
      }
    } catch {
      setPrevWeekly(undefined); setPrevMonthly(undefined)
    }
  }, [])

  useEffect(() => {
    if (mode !== 'create') return
    if (type === 'weekly') {
      const { period_start } = calcWeeklyPeriod(weeklyDate)
      fetchPrev('weekly', period_start)
    } else {
      const { period_start } = calcMonthlyPeriod(monthlyYear, monthlyMonth)
      fetchPrev('monthly', period_start)
    }
  }, [mode, type, weeklyDate, monthlyYear, monthlyMonth, fetchPrev])

  // ── 중복 보고서 감지 (create 모드)
  useEffect(() => {
    if (mode !== 'create' || !existingReports) return
    const { period_start } = type === 'weekly'
      ? calcWeeklyPeriod(weeklyDate)
      : calcMonthlyPeriod(monthlyYear, monthlyMonth)
    const found = existingReports.find(r => r.type === type && r.period_start === period_start)
    setDupReportId(found?.id ?? null)
  }, [mode, type, weeklyDate, monthlyYear, monthlyMonth, existingReports])

  const handleRestore = () => {
    const saved = localStorage.getItem(lsKey)
    if (!saved) return
    try {
      const d = JSON.parse(saved)
      if (d.type) setType(d.type)
      if (d.weeklyDate) {
        setWeeklyDate(d.weeklyDate)
        const wd = new Date(d.weeklyDate + 'T00:00:00')
        setWeeklyDisplayYear(wd.getFullYear())
        setWeeklyDisplayMonth(wd.getMonth() + 1)
      }
      if (d.monthlyYear) setMonthlyYear(d.monthlyYear)
      if (d.monthlyMonth) setMonthlyMonth(d.monthlyMonth)
      if (d.weekly) setWeekly(d.weekly)
      if (d.monthly) setMonthly(d.monthly)
      setRestored(true)
    } catch { /* ignore */ }
    setShowRestorePrompt(false)
  }

  const handleDiscard = () => {
    localStorage.removeItem(lsKey)
    setShowRestorePrompt(false)
  }

  // ── 기간 정보
  const { period_label, period_start, period_end, ..._rest } = type === 'weekly'
    ? calcWeeklyPeriod(weeklyDate)
    : { ...calcMonthlyPeriod(monthlyYear, monthlyMonth), monday: undefined }
  const pastDeadline = isPastDeadline(period_end)
  const canSubmit = (!pastDeadline || forceAllowSubmit) && !dupReportId

  // ── 저장/제출
  const doSave = async (saveStatus: 'draft' | 'submitted' | 'resubmitted') => {
    if (saveStatus === 'submitted' && !canSubmit) {
      setError('마감일이 지나 제출할 수 없습니다.')
      return
    }
    if (saveStatus === 'draft' && pastDeadline) {
      setError('마감일이 지나 임시저장할 수 없습니다.')
      return
    }

    setLoading(true)
    setError('')

    const content = type === 'weekly' ? weekly : monthly

    let res: Response
    if (mode === 'create') {
      res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type, period_label, period_start, period_end, content, status: saveStatus,
          attachments: pendingFiles,
        }),
      })
    } else {
      res = await fetch(`/api/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content, status: saveStatus,
          addAttachments: pendingFiles,
          removeAttachmentIds: removedIds,
        }),
      })
    }

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? '오류가 발생했습니다.')
      setLoading(false)
      return
    }

    localStorage.removeItem(lsKey)
    router.push(`/reports/${mode === 'create' ? data.id : reportId}`)
  }

  // ── 미리보기 콘텐츠
  const previewContent = type === 'weekly' ? weekly : monthly
  const submitLabel = mode === 'resubmit' ? '재제출' : mode === 'edit' ? '저장' : '제출'
  const showDraftBtn = mode !== 'edit'

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-10">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="text-base font-semibold text-gray-900">
          {mode === 'create' ? '리포트 작성' : mode === 'edit' ? '리포트 수정' : '리포트 재제출'}
        </h1>
      </div>

      {/* 복원 프롬프트 */}
      {showRestorePrompt && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-medium text-amber-800 mb-1">임시저장된 내용이 있습니다</p>
          <p className="text-xs text-amber-600 mb-3">이전에 작성하던 리포트를 불러오시겠습니까?</p>
          <div className="flex gap-2">
            <button onClick={handleRestore} className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-lg transition-colors">불러오기</button>
            <button onClick={handleDiscard} className="px-3 py-1.5 border border-amber-300 text-amber-700 text-xs font-medium rounded-lg hover:bg-amber-100 transition-colors">새로 작성</button>
          </div>
        </div>
      )}

      {restored && (
        <div className="mb-4 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
          <p className="text-xs text-blue-600">임시저장 내용을 불러왔습니다.</p>
        </div>
      )}

      {prevLabel && mode === 'create' && (
        <div className="mb-4 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
          </svg>
          <p className="text-xs text-gray-500">참고: <span className="font-medium text-gray-700">{prevLabel}</span> 리포트 내용이 입력칸에 회색으로 표시됩니다.</p>
        </div>
      )}

      <div className="space-y-4">
        {/* 보고서 유형 */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-2">리포트 유형</label>
          <div className="flex gap-2">
            {(['weekly', 'monthly'] as ReportType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { if (mode === 'create') setType(t) }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  type === t ? 'bg-blue-600 text-white' :
                  mode === 'create' ? 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50' :
                  'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {t === 'weekly' ? '주간 리포트' : '월간 리포트'}
              </button>
            ))}
          </div>
        </div>

        {/* 기간 선택 */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <label className="block text-xs font-medium text-gray-500 mb-3">리포트 기간</label>
          {mode === 'create' ? (
            type === 'weekly' ? (() => {
              const weeks = getWeeksInMonth(weeklyDisplayYear, weeklyDisplayMonth)
              const selectCls = 'px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'
              return (
                <div className="flex gap-2 flex-wrap items-center">
                  <select value={weeklyDisplayYear} onChange={(e) => {
                    const ny = Number(e.target.value)
                    setWeeklyDisplayYear(ny)
                    const nw = getWeeksInMonth(ny, weeklyDisplayMonth)
                    if (nw.length > 0) setWeeklyDate(nw[0].value)
                  }} className={selectCls}>
                    {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}년</option>)}
                  </select>
                  <select value={weeklyDisplayMonth} onChange={(e) => {
                    const nm = Number(e.target.value)
                    setWeeklyDisplayMonth(nm)
                    const nw = getWeeksInMonth(weeklyDisplayYear, nm)
                    if (nw.length > 0) setWeeklyDate(nw[0].value)
                  }} className={selectCls}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}월</option>)}
                  </select>
                  <select value={weeklyDate} onChange={(e) => setWeeklyDate(e.target.value)} className={selectCls}>
                    {weeks.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
                  </select>
                </div>
              )
            })() : (
              <div className="flex gap-2 flex-wrap">
                <select
                  value={monthlyYear}
                  onChange={(e) => setMonthlyYear(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}년</option>)}
                </select>
                <select
                  value={monthlyMonth}
                  onChange={(e) => setMonthlyMonth(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}월</option>)}
                </select>
                <p className="text-xs text-gray-500 self-center">{period_label}</p>
              </div>
            )
          ) : (
            <p className="text-sm font-medium text-gray-800">{period_label}</p>
          )}

          {pastDeadline && !forceAllowSubmit && (
            <p className="mt-2 text-xs text-red-500">마감일이 지난 기간입니다.</p>
          )}
          {dupReportId && (
            <div className="mt-2 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <svg className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              <div>
                <p className="text-xs font-medium text-amber-700">해당 기간에 이미 작성된 리포트가 있습니다.</p>
                <a href={`/reports/${dupReportId}`} className="text-xs text-amber-600 underline">기존 리포트 수정하기 →</a>
              </div>
            </div>
          )}
        </div>

        {/* 보고서 본문 */}
        {type === 'weekly' ? (
          <WeeklyFormBody
            value={weekly}
            onChange={setWeekly}
            prev={prevWeekly}
            weeklyDate={weeklyDate}
            mode={mode}
          />
        ) : (
          <MonthlyFormBody
            value={monthly}
            onChange={setMonthly}
            prev={prevMonthly}
            year={monthlyYear}
            month={monthlyMonth}
            mode={mode}
          />
        )}

        {/* ── 첨부파일 ── */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-700 mb-3">
            첨부파일 <span className="text-gray-400 font-normal">(선택, 파일당 10MB 이하)</span>
          </p>
          <div className="space-y-2">
            {/* 기존 첨부파일 (수정 모드) */}
            {existingFiles.map((f) => (
              <div key={f.id} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
                </svg>
                <a
                  href={`/api/attachments/${f.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline flex-1 truncate"
                >
                  {f.filename}
                </a>
                <span className="text-xs text-gray-400 flex-shrink-0">{formatSize(f.size)}</span>
                <button type="button" onClick={() => removeExisting(f.id)} className="p-0.5 text-gray-400 hover:text-red-500 flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
            {/* 새로 추가된 파일 */}
            {pendingFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
                </svg>
                <span className="text-sm text-gray-700 flex-1 truncate">{f.filename}</span>
                <span className="text-xs text-gray-400 flex-shrink-0">{formatSize(f.size)}</span>
                <button type="button" onClick={() => removePending(i)} className="p-0.5 text-gray-400 hover:text-red-500 flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors w-full disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              {uploading ? '업로드 중...' : '파일 추가'}
            </button>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileAdd} />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-3 py-2.5 rounded-xl">{error}</div>
        )}

        {/* 액션 버튼 */}
        <div className="flex gap-2 pt-2">
          {showDraftBtn && (
            <button
              type="button"
              onClick={() => doSave('draft')}
              disabled={loading || pastDeadline || !!dupReportId}
              className="flex-1 border border-gray-300 text-gray-700 font-medium py-3 rounded-xl text-sm transition-colors hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              임시저장
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className="flex-1 border border-gray-300 text-gray-700 font-medium py-3 rounded-xl text-sm transition-colors hover:bg-gray-50"
          >
            미리보기
          </button>
          <button
            type="button"
            onClick={() => doSave(mode === 'resubmit' ? 'resubmitted' : 'submitted')}
            disabled={loading || !canSubmit}
            className="flex-[2] font-medium py-3 rounded-xl text-sm transition-colors bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white"
          >
            {loading ? '저장 중...' : submitLabel}
          </button>
        </div>
      </div>

      {/* 미리보기 모달 */}
      {showPreview && (
        <ReportPreviewModal
          type={type}
          periodLabel={period_label}
          content={previewContent}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  )
}
