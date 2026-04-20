'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  WeeklyContent, MonthlyContent,
  KPI_LABELS, ACTIVITY_LABELS,
  calcRate, calcBudgetRow, calcBudgetSubtotal, fmtNum,
  ReportStatus,
} from '../report-types'
// calcBudgetSubtotal used for totals

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  draft:              { label: '임시저장',   cls: 'bg-gray-100 text-gray-600' },
  submitted:          { label: '제출완료',   cls: 'bg-green-100 text-green-700' },
  approved:           { label: '승인',       cls: 'bg-emerald-100 text-emerald-700' },
  revision_requested: { label: '정정요청',   cls: 'bg-red-100 text-red-600' },
  resubmitted:        { label: '재제출',     cls: 'bg-blue-100 text-blue-700' },
  revision_approved:  { label: '재제출 필요', cls: 'bg-amber-100 text-amber-600' },
}

function isPastDeadline(periodEnd: string) {
  return new Date().toISOString().split('T')[0] > periodEnd
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

interface Report {
  id: string
  user_id: string
  type: 'weekly' | 'monthly'
  period_label: string
  period_start: string
  period_end: string
  content: WeeklyContent | MonthlyContent
  status: ReportStatus
  revision_reason: string | null
  revision_comment: string | null
  submitted_at: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
  author: { name: string } | null
}

interface Attachment {
  id: string; filename: string; size: number; created_at: string
}

// ─────────────────────────────────────────────────
// 테이블 셀
// ─────────────────────────────────────────────────
const TH = 'border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 text-center'
const TD = 'border border-gray-200 px-3 py-2 text-xs text-gray-800'
const TDC = `${TD} text-center`
const TDR = `${TD} text-right tabular-nums`

// ─────────────────────────────────────────────────
// Weekly 상세 뷰
// ─────────────────────────────────────────────────
function WeeklyDetail({ content }: { content: WeeklyContent }) {
  const { org_info, kpi_rows, activity_rows } = content

  return (
    <div className="space-y-5">
      {/* 수행기관 정보 */}
      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">수행기관 정보</h3>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full border-collapse">
            <tbody>
              {org_info.agency_type && (
                <tr>
                  <td className={`${TH} w-36`}>기관구분</td>
                  <td className={TD}>{org_info.agency_type}</td>
                </tr>
              )}
              <tr>
                <td className={`${TH} w-36`}>기관명</td>
                <td className={TD}>{org_info.operator || '—'}</td>
              </tr>
              <tr>
                <td className={TH}>실무담당자</td>
                <td className={TD}>{org_info.operator_name || '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* KPI */}
      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">성과지표 달성 현황</h3>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full border-collapse min-w-[360px]">
            <thead>
              <tr>
                <th className={`${TH} w-28`}>지표명</th>
                <th className={`${TH}`}>연간목표(A)</th>
                <th className={`${TH}`}>누적실적(B)</th>
                <th className={`${TH} w-20`}>달성률</th>
              </tr>
            </thead>
            <tbody>
              {KPI_LABELS.map((label, i) => {
                const row = kpi_rows[i] ?? { target: '', actual: '' }
                return (
                  <tr key={label}>
                    <td className={`${TH} font-medium`}>{label}</td>
                    <td className={TDC}>{fmtNum(row.target) || '—'}</td>
                    <td className={TDC}>{fmtNum(row.actual) || '—'}</td>
                    <td className={`${TDC} font-semibold text-blue-600`}>{calcRate(row.target, row.actual)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 주간 실적 및 계획 */}
      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">주간 실적 및 계획</h3>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full border-collapse min-w-[480px]">
            <thead>
              <tr>
                <th className={`${TH} w-20`}>구분</th>
                <th className={TH}>이번주 실적</th>
                <th className={TH}>다음주 계획</th>
                <th className={`${TH} w-24`}>비고</th>
              </tr>
            </thead>
            <tbody>
              {ACTIVITY_LABELS.map((label, i) => {
                const row = activity_rows[i] ?? { current_week: '', next_week: '', note: '' }
                return (
                  <tr key={label}>
                    <td className={`${TH} font-medium`}>{label}</td>
                    <td className={`${TD} whitespace-pre-wrap align-top`}>{row.current_week || '—'}</td>
                    <td className={`${TD} whitespace-pre-wrap align-top`}>{row.next_week || '—'}</td>
                    <td className={TD}>{row.note || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

// ─────────────────────────────────────────────────
// Monthly 상세 뷰
// ─────────────────────────────────────────────────
function MonthlyDetail({ content }: { content: MonthlyContent }) {
  const { org_info, achievement_plan, budget, budget_plan } = content
  // 신규 포맷(kpi_rows) vs 구형 포맷(quantitative) 호환
  const c = content as any
  const kpi_rows: { target: string; actual: string }[] | null = Array.isArray(c.kpi_rows) ? c.kpi_rows : null
  const qualTarget: string = c.qualitative?.target ?? ''
  const qualActual: string = c.qualitative?.actual ?? ''
  const qualRate: string = c.qualitative?.rate ?? ''

  const opGov  = calcBudgetRow(budget.operator_gov)
  const opSelf = calcBudgetRow(budget.operator_self)
  const total  = calcBudgetSubtotal(budget.operator_gov, budget.operator_self)

  return (
    <div className="space-y-5">
      {/* 수행기관 정보 */}
      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">수행기관 정보</h3>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full border-collapse">
            <tbody>
              {org_info.agency_type && (
                <tr>
                  <td className={`${TH} w-24`}>기관구분</td>
                  <td className={TD} colSpan={3}>{org_info.agency_type}</td>
                </tr>
              )}
              <tr>
                <td className={`${TH} w-24`}>기관명</td>
                <td className={TD} colSpan={3}>{org_info.operator || '—'}</td>
              </tr>
              <tr>
                <td className={`${TH} w-24`}>사업책임자</td>
                <td className={TD}>{org_info.project_manager || '—'}</td>
                <td className={`${TH} w-24`}>실무담당자</td>
                <td className={TD}>{org_info.operator_name || '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 정량/정성 실적 */}
      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">정량 및 정성 실적</h3>

        {/* 정량실적 */}
        <p className="text-xs font-medium text-gray-500 mb-1.5">정량실적</p>
        <div className="overflow-x-auto rounded-lg border border-gray-200 mb-3">
          <table className="w-full border-collapse min-w-[360px]">
            <thead>
              <tr>
                <th className={`${TH} w-32`}>지표명</th>
                <th className={TH}>연간목표(A)</th>
                <th className={TH}>누적실적(B)</th>
                <th className={`${TH} w-20`}>달성률</th>
              </tr>
            </thead>
            <tbody>
              {kpi_rows
                ? KPI_LABELS.map((label, i) => {
                    const row = kpi_rows[i] ?? { target: '', actual: '' }
                    return (
                      <tr key={label}>
                        <td className={TH}>{label}</td>
                        <td className={TDC}>{fmtNum(row.target) || '—'}</td>
                        <td className={TDC}>{fmtNum(row.actual) || '—'}</td>
                        <td className={`${TDC} font-semibold text-blue-600`}>{calcRate(row.target, row.actual)}</td>
                      </tr>
                    )
                  })
                : <tr><td colSpan={4} className={`${TD} text-center`}>—</td></tr>
              }
            </tbody>
          </table>
        </div>

        {/* 정성실적 */}
        <p className="text-xs font-medium text-gray-500 mb-1.5">정성실적</p>
        <div className="overflow-x-auto rounded-lg border border-gray-200 mb-3">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={TH}>목표</th>
                <th className={TH}>실적</th>
                <th className={`${TH} w-20`}>달성률</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={`${TD} whitespace-pre-wrap align-top`}>{qualTarget || '—'}</td>
                <td className={`${TD} whitespace-pre-wrap align-top`}>{qualActual || '—'}</td>
                <td className={`${TDC} font-semibold text-blue-600`}>{qualRate || '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {achievement_plan && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">향후목표 달성계획</p>
            <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-xl px-4 py-3">{achievement_plan}</p>
          </div>
        )}
      </section>

      {/* 예산 집행현황 */}
      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">예산 집행현황</h3>
        <div className="overflow-x-auto rounded-lg border border-gray-200 mb-3">
          <table className="w-full border-collapse min-w-[360px]">
            <thead>
              <tr>
                <th className={`${TH} w-32`}>구분</th>
                <th className={TH}>예산</th>
                <th className={TH}>집행액</th>
                <th className={TH}>집행잔액</th>
                <th className={`${TH} w-16`}>집행률</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={`${TH} font-medium`}>국고보조금</td>
                <td className={TDR}>{fmtNum(budget.operator_gov.budget) || '—'}</td>
                <td className={TDR}>{fmtNum(budget.operator_gov.executed) || '—'}</td>
                <td className={TDR}>{opGov.budget ? opGov.remaining.toLocaleString('ko-KR') : '—'}</td>
                <td className={`${TDC} font-medium text-blue-600`}>{opGov.rate}</td>
              </tr>
              <tr>
                <td className={`${TH} font-medium`}>자기부담금</td>
                <td className={TDR}>{fmtNum(budget.operator_self.budget) || '—'}</td>
                <td className={TDR}>{fmtNum(budget.operator_self.executed) || '—'}</td>
                <td className={TDR}>{opSelf.budget ? opSelf.remaining.toLocaleString('ko-KR') : '—'}</td>
                <td className={`${TDC} font-medium text-blue-600`}>{opSelf.rate}</td>
              </tr>
              <tr className="bg-blue-50">
                <td className={`${TH} font-bold text-blue-700`}>합계</td>
                <td className={`${TDR} font-semibold text-blue-700`}>{total.budget ? total.budget.toLocaleString('ko-KR') : '—'}</td>
                <td className={`${TDR} font-semibold text-blue-700`}>{total.executed ? total.executed.toLocaleString('ko-KR') : '—'}</td>
                <td className={`${TDR} font-semibold text-blue-700`}>{total.budget ? total.remaining.toLocaleString('ko-KR') : '—'}</td>
                <td className={`${TDC} font-bold text-blue-700`}>{total.rate}</td>
              </tr>
            </tbody>
          </table>
        </div>
        {budget_plan && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">향후예산 활용계획</p>
            <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-xl px-4 py-3">{budget_plan}</p>
          </div>
        )}
      </section>
    </div>
  )
}

// ─────────────────────────────────────────────────
// 월간보고 조회 시 기관 주간보고 목록
// ─────────────────────────────────────────────────
const STATUS_BADGE: Record<string, { text: string; cls: string }> = {
  submitted:          { text: '제출됨',   cls: 'bg-blue-100 text-blue-700' },
  approved:           { text: '승인됨',   cls: 'bg-green-100 text-green-700' },
  revision_requested: { text: '수정요청', cls: 'bg-red-100 text-red-700' },
  resubmitted:        { text: '재제출됨', cls: 'bg-purple-100 text-purple-700' },
  revision_approved:  { text: '재승인됨', cls: 'bg-teal-100 text-teal-700' },
}

interface OrgWeekly {
  id: string
  period_label: string
  status: string
  content: WeeklyContent
  author: { name: string } | null
}

function OrgWeeklySection({ periodStart }: { periodStart: string }) {
  const [list, setList] = useState<OrgWeekly[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    const d = new Date(periodStart + 'T00:00:00')
    const year = d.getFullYear()
    const month = d.getMonth() + 1
    fetch(`/api/reports/org?year=${year}&month=${month}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { setList(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => { setList([]); setLoading(false) })
  }, [periodStart])

  const badge = (s: string) => STATUS_BADGE[s] ?? { text: s, cls: 'bg-gray-100 text-gray-600' }

  if (loading) return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <p className="text-xs text-gray-400">기관 주간보고 불러오는 중...</p>
    </div>
  )

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
        이번 달 기관 주간보고 <span className="normal-case font-normal text-gray-400">({list.length}건)</span>
      </p>

      {list.length === 0 ? (
        <p className="text-sm text-gray-400">이번 달 제출된 주간보고가 없습니다.</p>
      ) : (
        <div className="space-y-1.5">
          {list.map(r => {
            const b = badge(r.status)
            const expanded = expandedId === r.id
            return (
              <div key={r.id} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : r.id)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-gray-800 truncate">{r.period_label}</span>
                    {r.author?.name && (
                      <span className="text-xs text-gray-400 flex-shrink-0">{r.author.name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${b.cls}`}>{b.text}</span>
                    <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  </div>
                </button>

                {expanded && r.content?.version === 2 && (
                  <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 space-y-4">
                    {/* KPI */}
                    <section>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">성과지표 달성 현황</p>
                      <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="w-full border-collapse min-w-[340px]">
                          <thead>
                            <tr>
                              <th className={`${TH} w-28`}>지표명</th>
                              <th className={TH}>연간목표(A)</th>
                              <th className={TH}>누적실적(B)</th>
                              <th className={`${TH} w-20`}>달성률</th>
                              <th className={`${TH} w-24`}>비고</th>
                            </tr>
                          </thead>
                          <tbody>
                            {KPI_LABELS.map((label, i) => {
                              const row = r.content.kpi_rows[i] ?? { target: '', actual: '' }
                              return (
                                <tr key={label}>
                                  <td className={`${TH} font-medium`}>{label}</td>
                                  <td className={TDC}>{fmtNum(row.target) || '—'}</td>
                                  <td className={TDC}>{fmtNum(row.actual) || '—'}</td>
                                  <td className={`${TDC} font-semibold text-blue-600`}>{calcRate(row.target, row.actual)}</td>
                                  <td className={TD}>{(row as { note?: string }).note || '—'}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </section>

                    {/* 주간 실적 */}
                    <section>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">주간 실적 및 계획</p>
                      <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="w-full border-collapse min-w-[480px]">
                          <thead>
                            <tr>
                              <th className={`${TH} w-20`}>구분</th>
                              <th className={TH}>이번주 실적</th>
                              <th className={TH}>다음주 계획</th>
                              <th className={`${TH} w-24`}>비고</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ACTIVITY_LABELS.map((label, i) => {
                              const row = r.content.activity_rows[i] ?? { current_week: '', next_week: '', note: '' }
                              return (
                                <tr key={label}>
                                  <td className={`${TH} font-medium`}>{label}</td>
                                  <td className={`${TD} whitespace-pre-wrap align-top`}>{row.current_week || '—'}</td>
                                  <td className={`${TD} whitespace-pre-wrap align-top`}>{row.next_week || '—'}</td>
                                  <td className={TD}>{row.note || '—'}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────
// 구버전(v1) fallback
// ─────────────────────────────────────────────────
function LegacyDetail({ content, type }: { content: Record<string, unknown>; type: 'weekly' | 'monthly' }) {
  if (type === 'weekly') {
    return (
      <div className="space-y-4 text-sm text-gray-700">
        {!!content.completed && <div><p className="text-xs font-semibold text-gray-400 mb-1">완료 업무</p><p className="whitespace-pre-wrap bg-gray-50 rounded-xl px-4 py-3">{String(content.completed)}</p></div>}
        {!!content.next_plan && <div><p className="text-xs font-semibold text-gray-400 mb-1">다음주 계획</p><p className="whitespace-pre-wrap bg-gray-50 rounded-xl px-4 py-3">{String(content.next_plan)}</p></div>}
        {!!content.issues && <div><p className="text-xs font-semibold text-gray-400 mb-1">이슈</p><p className="whitespace-pre-wrap bg-gray-50 rounded-xl px-4 py-3">{String(content.issues)}</p></div>}
      </div>
    )
  }
  return (
    <div className="space-y-4 text-sm text-gray-700">
      {!!content.achievements && <div><p className="text-xs font-semibold text-gray-400 mb-1">주요 성과</p><p className="whitespace-pre-wrap bg-gray-50 rounded-xl px-4 py-3">{String(content.achievements)}</p></div>}
      {!!content.next_month_plan && <div><p className="text-xs font-semibold text-gray-400 mb-1">다음 달 목표</p><p className="whitespace-pre-wrap bg-gray-50 rounded-xl px-4 py-3">{String(content.next_month_plan)}</p></div>}
    </div>
  )
}

// ─────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────
export default function ReportDetail({
  report: initial,
  attachments,
  currentUserId,
  isAdmin,
}: {
  report: Report
  attachments: Attachment[]
  currentUserId: string
  isAdmin: boolean
}) {
  const router = useRouter()
  const [report, setReport] = useState(initial)
  const [actionLoading, setActionLoading] = useState(false)
  // 관리자 정정요청 모달
  const [showRevisionModal, setShowRevisionModal] = useState(false)
  const [revisionComment, setRevisionComment] = useState('')
  // 삭제 확인 모달
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const isOwner = report.user_id === currentUserId
  const pastDeadline = isPastDeadline(report.period_end)
  const cfg = STATUS_CONFIG[report.status] ?? { label: report.status, cls: 'bg-gray-100 text-gray-600' }

  const content = report.content as unknown as Record<string, unknown>
  const isV2 = content?.version === 2

  // 삭제
  const handleDelete = async () => {
    setDeleteLoading(true)
    const url = isAdmin ? `/api/admin/reports/${report.id}` : `/api/reports/${report.id}`
    const res = await fetch(url, { method: 'DELETE' })
    if (res.ok) {
      router.replace('/reports')
    } else {
      const data = await res.json()
      alert(data.error ?? '삭제에 실패했습니다.')
      setDeleteLoading(false)
      setShowDeleteConfirm(false)
    }
  }

  // 관리자: 승인
  const handleApprove = async () => {
    setActionLoading(true)
    const res = await fetch(`/api/admin/reports/${report.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    })
    if (res.ok) setReport(await res.json())
    setActionLoading(false)
  }

  // 관리자: 정정요청
  const handleAdminRevisionRequest = async () => {
    if (!revisionComment.trim()) return
    setActionLoading(true)
    const res = await fetch(`/api/admin/reports/${report.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'revision_requested', revision_comment: revisionComment.trim() }),
    })
    if (res.ok) {
      setReport(await res.json())
      setShowRevisionModal(false)
      setRevisionComment('')
    }
    setActionLoading(false)
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="text-base font-semibold text-gray-900">보고서 상세</h1>
      </div>

      {/* 메타 카드 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${report.type === 'weekly' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                {report.type === 'weekly' ? '주간' : '월간'}
              </span>
              <p className="text-base font-semibold text-gray-900">{report.period_label}</p>
            </div>
            <p className="text-xs text-gray-400">
              {report.author?.name}
              {report.submitted_at ? ` · 제출: ${formatDate(report.submitted_at)}` : ''}
            </p>
          </div>
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${cfg.cls}`}>
            {cfg.label}
          </span>
        </div>

        {report.status === 'revision_requested' && (report.revision_comment || report.revision_reason) && (
          <div className="mt-4 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
            <p className="text-xs font-medium text-red-600 mb-1">정정요청 코멘트</p>
            <p className="text-sm text-red-700">{report.revision_comment || report.revision_reason}</p>
          </div>
        )}
        {report.status === 'approved' && (
          <div className="mt-4 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2.5 flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <p className="text-xs font-medium text-emerald-700">
              승인 완료{report.approved_at ? ` · ${formatDate(report.approved_at)}` : ''}
            </p>
          </div>
        )}
      </div>

      {/* 보고서 내용 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        {isV2
          ? report.type === 'weekly'
            ? <WeeklyDetail content={report.content as WeeklyContent} />
            : <MonthlyDetail content={report.content as MonthlyContent} />
          : <LegacyDetail content={content} type={report.type} />
        }
      </div>

      {/* 기관 주간보고 (월간보고 조회 시) */}
      {report.type === 'monthly' && (
        <OrgWeeklySection periodStart={report.period_start} />
      )}

      {/* 첨부파일 */}
      {attachments.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">첨부파일 ({attachments.length})</p>
          <div className="space-y-1.5">
            {attachments.map((a) => (
              <a key={a.id} href={`/api/attachments/${a.id}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 rounded-lg transition-colors group">
                <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
                </svg>
                <span className="text-sm text-gray-700 group-hover:text-blue-700 flex-1 truncate">{a.filename}</span>
                <span className="text-xs text-gray-400 flex-shrink-0">{formatSize(a.size)}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ── 사용자 액션 버튼 ── */}
      {isOwner && (
        <div className="space-y-2">
          {report.status === 'draft' && (
            <>
              <button onClick={() => router.push(`/reports/${report.id}/edit`)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl text-sm transition-colors">
                이어서 작성
              </button>
              <button onClick={() => setShowDeleteConfirm(true)}
                className="w-full bg-white border border-red-200 text-red-500 font-medium py-3 rounded-xl text-sm hover:bg-red-50 transition-colors">
                삭제
              </button>
            </>
          )}
          {report.status === 'submitted' && !pastDeadline && (
            <button onClick={() => router.push(`/reports/${report.id}/edit`)}
              className="w-full bg-white border border-gray-300 text-gray-700 font-medium py-3 rounded-xl text-sm hover:bg-gray-50 transition-colors">
              수정하기
            </button>
          )}
          {(report.status === 'revision_requested' || report.status === 'revision_approved') && (
            <button onClick={() => router.push(`/reports/${report.id}/edit?resubmit=1`)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl text-sm transition-colors">
              수정 후 재제출
            </button>
          )}
        </div>
      )}

      {/* ── 관리자 액션 버튼 ── */}
      {isAdmin && (
        <div className="space-y-2">
          {(report.status === 'submitted' || report.status === 'resubmitted') && (
            <>
              <div className="flex gap-2">
                <button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-medium py-3 rounded-xl text-sm transition-colors"
                >
                  {actionLoading ? '처리 중...' : '승인'}
                </button>
                <button
                  onClick={() => setShowRevisionModal(true)}
                  disabled={actionLoading}
                  className="flex-1 bg-white border border-red-300 text-red-600 font-medium py-3 rounded-xl text-sm hover:bg-red-50 disabled:opacity-40 transition-colors"
                >
                  정정요청
                </button>
              </div>
              {report.status === 'resubmitted' && (
                <p className="text-xs text-center text-blue-600 font-medium">정정 재제출된 보고서입니다</p>
              )}
            </>
          )}
          {report.status !== 'approved' && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full bg-white border border-red-200 text-red-500 font-medium py-2.5 rounded-xl text-sm hover:bg-red-50 transition-colors"
            >
              보고서 삭제
            </button>
          )}
        </div>
      )}

      {/* ── 삭제 확인 모달 ── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-4.5 h-4.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">보고서 삭제</p>
                <p className="text-xs text-gray-500">이 작업은 되돌릴 수 없습니다.</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              <span className="font-medium text-gray-900">{report.period_label}</span> 보고서를 삭제하시겠습니까?
              {attachments.length > 0 && (
                <span className="block mt-1 text-xs text-gray-400">첨부파일 {attachments.length}개도 함께 삭제됩니다.</span>
              )}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteLoading}
                className="flex-1 border border-gray-200 text-gray-600 font-medium py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors disabled:opacity-40"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
              >
                {deleteLoading ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 관리자 정정요청 모달 ── */}
      {showRevisionModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-4 pb-4 md:pb-0">
          <div className="bg-white rounded-2xl w-full max-w-md p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-1">정정요청</h2>
            <p className="text-xs text-gray-400 mb-4">수정이 필요한 내용을 구체적으로 작성해 주세요. 작성자에게 전달됩니다.</p>
            <textarea
              value={revisionComment}
              onChange={(e) => setRevisionComment(e.target.value)}
              placeholder="정정 요청 코멘트를 입력하세요"
              rows={4}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none mb-3"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setShowRevisionModal(false); setRevisionComment('') }}
                className="flex-1 border border-gray-200 text-gray-600 font-medium py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleAdminRevisionRequest}
                disabled={actionLoading || !revisionComment.trim()}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
              >
                {actionLoading ? '전송 중...' : '정정요청 전송'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
