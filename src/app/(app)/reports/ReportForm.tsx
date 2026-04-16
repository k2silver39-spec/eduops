'use client'

import { useState, useEffect, useRef, useCallback, useId } from 'react'
import { useRouter } from 'next/navigation'

export type ReportType = 'weekly' | 'monthly'

export interface InProgressItem {
  task: string
  progress: number
}

export interface GoalItem {
  goal: string
  achievement_rate: number
}

export interface WeeklyContent {
  completed: string
  in_progress: InProgressItem[]
  next_plan: string
  issues: string
}

export interface MonthlyContent {
  achievements: string
  goals: GoalItem[]
  next_month_plan: string
  issues: string
}

export type ReportMode = 'create' | 'edit' | 'resubmit'

interface PendingFile {
  path: string
  filename: string
  size: number
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
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
  // 'resubmit' 모드에서 마감일 이후여도 제출 가능
  forceAllowSubmit?: boolean
}

// ──────────────────────────────────────────────
// 날짜 유틸
// ──────────────────────────────────────────────

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

function toDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getWeekOfMonth(monday: Date): number {
  return Math.ceil(monday.getDate() / 7)
}

function isPastDeadline(periodEnd: string): boolean {
  const today = new Date().toISOString().split('T')[0]
  return today > periodEnd
}

// ──────────────────────────────────────────────
// 기간 계산
// ──────────────────────────────────────────────

interface PeriodInfo {
  period_label: string
  period_start: string
  period_end: string
}

function calcWeeklyPeriod(weeklyDate: string): PeriodInfo {
  const monday = getMondayOfWeek(new Date(weeklyDate + 'T00:00:00'))
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  const week = getWeekOfMonth(monday)
  const sM = monday.getMonth() + 1, sD = monday.getDate()
  const eM = sunday.getMonth() + 1, eD = sunday.getDate()
  return {
    period_label: `${monday.getFullYear()}년 ${monday.getMonth() + 1}월 ${week}주차 (${sM}.${sD}.~${eM}.${eD}.)`,
    period_start: toDateStr(monday),
    period_end: toDateStr(sunday),
  }
}

function calcMonthlyPeriod(year: number, month: number): PeriodInfo {
  const lastDay = new Date(year, month, 0)
  return {
    period_label: `${year}년 ${month}월 (${month}.1.~${month}.${lastDay.getDate()}.)`,
    period_start: `${year}-${String(month).padStart(2, '0')}-01`,
    period_end: toDateStr(lastDay),
  }
}

// ──────────────────────────────────────────────
// 로컬스토리지 키
// ──────────────────────────────────────────────

const LS_KEY_NEW = 'eduops_report_new'
function lsKeyEdit(id: string) { return `eduops_report_edit_${id}` }

// ──────────────────────────────────────────────
// 슬라이더 아이템
// ──────────────────────────────────────────────

function SliderItem({
  label,
  value,
  onLabelChange,
  onValueChange,
  onRemove,
  removable,
  labelPlaceholder,
}: {
  label: string
  value: number
  onLabelChange: (v: string) => void
  onValueChange: (v: number) => void
  onRemove: () => void
  removable: boolean
  labelPlaceholder: string
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-3">
        <input
          type="text"
          value={label}
          onChange={(e) => onLabelChange(e.target.value)}
          placeholder={labelPlaceholder}
          className="flex-1 px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {removable && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={value}
          onChange={(e) => onValueChange(Number(e.target.value))}
          className="flex-1 h-2.5 accent-blue-600 cursor-pointer"
        />
        <span className="text-sm font-semibold text-blue-600 w-12 text-right tabular-nums">
          {value}%
        </span>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// 메인 컴포넌트
// ──────────────────────────────────────────────

const DEFAULT_WEEKLY: WeeklyContent = {
  completed: '',
  in_progress: [{ task: '', progress: 50 }],
  next_plan: '',
  issues: '',
}

const DEFAULT_MONTHLY: MonthlyContent = {
  achievements: '',
  goals: [{ goal: '', achievement_rate: 80 }],
  next_month_plan: '',
  issues: '',
}

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
}: ReportFormProps) {
  const router = useRouter()
  const today = new Date()
  const defaultMonday = getMondayOfWeek(today)

  const [type, setType] = useState<ReportType>(initialType ?? 'weekly')
  const [weeklyDate, setWeeklyDate] = useState(initialWeeklyDate ?? toDateStr(defaultMonday))
  const [monthlyYear, setMonthlyYear] = useState(initialMonthlyYear ?? today.getFullYear())
  const [monthlyMonth, setMonthlyMonth] = useState(initialMonthlyMonth ?? (today.getMonth() + 1))
  const [weekly, setWeekly] = useState<WeeklyContent>(initialWeeklyContent ?? DEFAULT_WEEKLY)
  const [monthly, setMonthly] = useState<MonthlyContent>(initialMonthlyContent ?? DEFAULT_MONTHLY)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showRestorePrompt, setShowRestorePrompt] = useState(false)
  const [restored, setRestored] = useState(false)
  const autoSaveTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const [files, setFiles] = useState<PendingFile[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputId = useId()
  const fileRef = useRef<HTMLInputElement>(null)

  const lsKey = mode === 'create' ? LS_KEY_NEW : (reportId ? lsKeyEdit(reportId) : LS_KEY_NEW)

  // 마운트 시 로컬스토리지 확인 (create 모드에서만)
  useEffect(() => {
    if (mode === 'create' && localStorage.getItem(lsKey)) {
      setShowRestorePrompt(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 30초마다 로컬스토리지 자동저장
  useEffect(() => {
    const save = () => {
      const draft = { type, weeklyDate, monthlyYear, monthlyMonth, weekly, monthly }
      localStorage.setItem(lsKey, JSON.stringify(draft))
    }
    autoSaveTimer.current = setInterval(save, 30000)
    return () => { if (autoSaveTimer.current) clearInterval(autoSaveTimer.current) }
  }, [type, weeklyDate, monthlyYear, monthlyMonth, weekly, monthly, lsKey])

  const handleRestore = () => {
    const saved = localStorage.getItem(lsKey)
    if (!saved) return
    try {
      const d = JSON.parse(saved)
      if (d.type) setType(d.type)
      if (d.weeklyDate) setWeeklyDate(d.weeklyDate)
      if (d.monthlyYear) setMonthlyYear(d.monthlyYear)
      if (d.monthlyMonth) setMonthlyMonth(d.monthlyMonth)
      if (d.weekly) setWeekly(d.weekly)
      if (d.monthly) setMonthly(d.monthly)
      setRestored(true)
    } catch {}
    setShowRestorePrompt(false)
  }

  const handleDiscard = () => {
    localStorage.removeItem(lsKey)
    setShowRestorePrompt(false)
  }

  // 현재 기간 정보
  const periodInfo: PeriodInfo = type === 'weekly'
    ? calcWeeklyPeriod(weeklyDate)
    : calcMonthlyPeriod(monthlyYear, monthlyMonth)

  const { period_label, period_start, period_end } = periodInfo
  const pastDeadline = isPastDeadline(period_end)
  const canSubmit = !pastDeadline || forceAllowSubmit

  const validate = useCallback(() => {
    if (type === 'weekly') return weekly.completed.trim() !== '' && weekly.next_plan.trim() !== ''
    return monthly.achievements.trim() !== '' && monthly.next_month_plan.trim() !== ''
  }, [type, weekly, monthly])

  const doSave = async (saveStatus: 'draft' | 'submitted') => {
    if (!validate()) {
      setError('필수 항목을 모두 입력해주세요.')
      return
    }

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

    const body = {
      type,
      period_label,
      period_start,
      period_end,
      content: type === 'weekly' ? weekly : monthly,
      status: saveStatus,
    }

    let res: Response
    if (mode === 'create') {
      res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, attachments: files }),
      })
    } else {
      // edit or resubmit: PATCH existing report
      res = await fetch(`/api/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: body.content,
          status: saveStatus,
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
    const targetId = mode === 'create' ? data.id : reportId
    router.push(`/reports/${targetId}`)
  }

  // ── 주간 항목 조작 ──
  const addInProgress = () =>
    setWeekly((w) => ({ ...w, in_progress: [...w.in_progress, { task: '', progress: 50 }] }))
  const removeInProgress = (i: number) =>
    setWeekly((w) => ({ ...w, in_progress: w.in_progress.filter((_, idx) => idx !== i) }))
  const updateInProgressLabel = (i: number, v: string) =>
    setWeekly((w) => ({ ...w, in_progress: w.in_progress.map((x, idx) => idx === i ? { ...x, task: v } : x) }))
  const updateInProgressValue = (i: number, v: number) =>
    setWeekly((w) => ({ ...w, in_progress: w.in_progress.map((x, idx) => idx === i ? { ...x, progress: v } : x) }))

  // ── 월간 항목 조작 ──
  const addGoal = () =>
    setMonthly((m) => ({ ...m, goals: [...m.goals, { goal: '', achievement_rate: 80 }] }))
  const removeGoal = (i: number) =>
    setMonthly((m) => ({ ...m, goals: m.goals.filter((_, idx) => idx !== i) }))
  const updateGoalLabel = (i: number, v: string) =>
    setMonthly((m) => ({ ...m, goals: m.goals.map((x, idx) => idx === i ? { ...x, goal: v } : x) }))
  const updateGoalValue = (i: number, v: number) =>
    setMonthly((m) => ({ ...m, goals: m.goals.map((x, idx) => idx === i ? { ...x, achievement_rate: v } : x) }))

  const submitLabel = mode === 'resubmit' ? '재제출' : mode === 'edit' ? '저장' : '제출'
  const showDraftBtn = mode !== 'edit'

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="text-base font-semibold text-gray-900">
          {mode === 'create' ? '보고서 작성' : mode === 'edit' ? '보고서 수정' : '보고서 재제출'}
        </h1>
      </div>

      {/* 복원 프롬프트 */}
      {showRestorePrompt && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-medium text-amber-800 mb-1">임시저장된 내용이 있습니다</p>
          <p className="text-xs text-amber-600 mb-3">이전에 작성하던 보고서를 불러오시겠습니까?</p>
          <div className="flex gap-2">
            <button
              onClick={handleRestore}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-lg transition-colors"
            >
              불러오기
            </button>
            <button
              onClick={handleDiscard}
              className="px-3 py-1.5 border border-amber-300 text-amber-700 text-xs font-medium rounded-lg hover:bg-amber-100 transition-colors"
            >
              새로 작성
            </button>
          </div>
        </div>
      )}

      {restored && (
        <div className="mb-4 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
          <p className="text-xs text-blue-600">임시저장 내용을 불러왔습니다.</p>
        </div>
      )}

      <div className="space-y-4 pb-8">
        {/* 보고서 유형 (create 모드에서만 변경 가능) */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-2">보고서 유형</label>
          <div className="flex gap-2">
            {(['weekly', 'monthly'] as ReportType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { if (mode === 'create') setType(t) }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  type === t
                    ? 'bg-blue-600 text-white'
                    : mode === 'create'
                      ? 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {t === 'weekly' ? '주간보고' : '월간보고'}
              </button>
            ))}
          </div>
        </div>

        {/* 기간 선택 (create 모드에서만 변경 가능) */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <label className="block text-xs font-medium text-gray-500 mb-3">기간</label>
          {mode === 'create' ? (
            type === 'weekly' ? (
              <div>
                <input
                  type="date"
                  value={weeklyDate}
                  onChange={(e) => { if (e.target.value) setWeeklyDate(e.target.value) }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-2 text-xs text-gray-500">
                  선택한 날짜가 속한 주: <span className="font-medium text-gray-700">{period_label}</span>
                </p>
              </div>
            ) : (
              <div className="flex gap-2">
                <select
                  value={monthlyYear}
                  onChange={(e) => setMonthlyYear(Number(e.target.value))}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <option key={y} value={y}>{y}년</option>
                  ))}
                </select>
                <select
                  value={monthlyMonth}
                  onChange={(e) => setMonthlyMonth(Number(e.target.value))}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>{m}월</option>
                  ))}
                </select>
              </div>
            )
          ) : (
            <p className="text-sm font-medium text-gray-800">{period_label}</p>
          )}

          {pastDeadline && !forceAllowSubmit && (
            <p className="mt-2 text-xs text-red-500">마감일이 지난 기간입니다. 임시저장도 불가합니다.</p>
          )}
        </div>

        {/* ── 주간 보고 폼 ── */}
        {type === 'weekly' && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                이번 주 완료 업무 <span className="text-red-400">*</span>
              </label>
              <textarea
                value={weekly.completed}
                onChange={(e) => setWeekly((w) => ({ ...w, completed: e.target.value }))}
                placeholder="이번 주에 완료한 업무를 작성해 주세요"
                rows={4}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-500">진행 중 업무</label>
                <button
                  type="button"
                  onClick={addInProgress}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  항목 추가
                </button>
              </div>
              <div className="space-y-3">
                {weekly.in_progress.map((item, i) => (
                  <SliderItem
                    key={i}
                    label={item.task}
                    value={item.progress}
                    onLabelChange={(v) => updateInProgressLabel(i, v)}
                    onValueChange={(v) => updateInProgressValue(i, v)}
                    onRemove={() => removeInProgress(i)}
                    removable={weekly.in_progress.length > 1}
                    labelPlaceholder="업무명"
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                다음 주 계획 <span className="text-red-400">*</span>
              </label>
              <textarea
                value={weekly.next_plan}
                onChange={(e) => setWeekly((w) => ({ ...w, next_plan: e.target.value }))}
                placeholder="다음 주 계획을 작성해 주세요"
                rows={3}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                이슈 및 건의사항 <span className="text-gray-300 font-normal">(선택)</span>
              </label>
              <textarea
                value={weekly.issues}
                onChange={(e) => setWeekly((w) => ({ ...w, issues: e.target.value }))}
                placeholder="이슈 또는 건의사항이 있으면 입력해 주세요"
                rows={2}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </>
        )}

        {/* ── 월간 보고 폼 ── */}
        {type === 'monthly' && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                월간 주요 성과 <span className="text-red-400">*</span>
              </label>
              <textarea
                value={monthly.achievements}
                onChange={(e) => setMonthly((m) => ({ ...m, achievements: e.target.value }))}
                placeholder="이번 달 주요 성과를 작성해 주세요"
                rows={4}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-500">목표 달성도</label>
                <button
                  type="button"
                  onClick={addGoal}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  항목 추가
                </button>
              </div>
              <div className="space-y-3">
                {monthly.goals.map((item, i) => (
                  <SliderItem
                    key={i}
                    label={item.goal}
                    value={item.achievement_rate}
                    onLabelChange={(v) => updateGoalLabel(i, v)}
                    onValueChange={(v) => updateGoalValue(i, v)}
                    onRemove={() => removeGoal(i)}
                    removable={monthly.goals.length > 1}
                    labelPlaceholder="목표명"
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                다음 달 목표 <span className="text-red-400">*</span>
              </label>
              <textarea
                value={monthly.next_month_plan}
                onChange={(e) => setMonthly((m) => ({ ...m, next_month_plan: e.target.value }))}
                placeholder="다음 달 목표를 작성해 주세요"
                rows={3}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                특이사항/건의 <span className="text-gray-300 font-normal">(선택)</span>
              </label>
              <textarea
                value={monthly.issues}
                onChange={(e) => setMonthly((m) => ({ ...m, issues: e.target.value }))}
                placeholder="특이사항이나 건의사항이 있으면 입력해 주세요"
                rows={2}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </>
        )}

        {/* 첨부파일 */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">첨부파일 <span className="text-gray-300 font-normal">(선택, 파일당 10MB 이하)</span></label>
          <div className="space-y-2">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
                </svg>
                <span className="text-sm text-gray-700 flex-1 truncate">{f.filename}</span>
                <span className="text-xs text-gray-400 flex-shrink-0">{formatSize(f.size)}</span>
                <button type="button" onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} className="p-0.5 text-gray-400 hover:text-red-500 flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors w-full disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              {uploading ? '업로드 중...' : '파일 추가'}
            </button>
            <input
              ref={fileRef}
              id={fileInputId}
              type="file"
              multiple
              className="hidden"
              onChange={async (e) => {
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
                    setFiles(prev => [...prev, { path: data.path, filename: data.filename, size: data.size }])
                  } else {
                    setError(data.error ?? '파일 업로드 실패')
                  }
                }
                setUploading(false)
              }}
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-3 py-2.5 rounded-xl">{error}</div>
        )}

        {/* 버튼 */}
        <div className="flex gap-2 pt-2">
          {showDraftBtn && (
            <button
              type="button"
              onClick={() => doSave('draft')}
              disabled={loading || pastDeadline}
              className="flex-1 border border-gray-300 text-gray-700 font-medium py-3 rounded-xl text-sm transition-colors hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              임시저장
            </button>
          )}
          <button
            type="button"
            onClick={() => doSave('submitted')}
            disabled={loading || !canSubmit}
            className={`font-medium py-3 rounded-xl text-sm transition-colors bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white ${
              showDraftBtn ? 'flex-[2]' : 'flex-1'
            }`}
          >
            {loading ? '저장 중...' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
