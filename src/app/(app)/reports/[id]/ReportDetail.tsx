'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  WeeklyContent, MonthlyContent,
  KPI_LABELS, ACTIVITY_LABELS,
  calcRate, calcBudgetRow, calcBudgetSubtotal, fmtNum,
  ReportStatus,
} from '../report-types'
// calcBudgetSubtotal used for totals

const STATUS_CONFIG: Record<ReportStatus, { label: string; cls: string }> = {
  draft:              { label: '임시저장',  cls: 'bg-gray-100 text-gray-600' },
  submitted:          { label: '제출완료',  cls: 'bg-green-100 text-green-700' },
  revision_requested: { label: '수정요청',  cls: 'bg-red-100 text-red-600' },
  revision_approved:  { label: '수정승인',  cls: 'bg-blue-100 text-blue-700' },
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
  submitted_at: string | null
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
  const { org_info, quantitative, qualitative, achievement_plan, budget, budget_plan } = content

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
                  <td className={`${TH} w-36`}>기관구분</td>
                  <td className={TD}>{org_info.agency_type}</td>
                </tr>
              )}
              <tr>
                <td className={`${TH} w-36`}>기관명</td>
                <td className={TD}>{org_info.operator || '—'}</td>
              </tr>
              <tr>
                <td className={TH}>사업책임자</td>
                <td className={TD}>{org_info.operator_name || '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 정량/정성 실적 */}
      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">정량 및 정성 실적</h3>
        <div className="overflow-x-auto rounded-lg border border-gray-200 mb-3">
          <table className="w-full border-collapse min-w-[320px]">
            <thead>
              <tr>
                <th className={`${TH} w-24`}>구분</th>
                <th className={TH}>연간목표(A)</th>
                <th className={TH}>누적실적(B)</th>
                <th className={`${TH} w-20`}>달성률</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={`${TH} font-medium`}>정량실적</td>
                <td className={TDC}>{fmtNum(quantitative.target) || '—'}</td>
                <td className={TDC}>{fmtNum(quantitative.actual) || '—'}</td>
                <td className={`${TDC} font-semibold text-blue-600`}>{calcRate(quantitative.target, quantitative.actual)}</td>
              </tr>
              <tr>
                <td className={`${TH} font-medium`}>정성실적</td>
                <td className={TDC}>{fmtNum(qualitative.target) || '—'}</td>
                <td className={TDC}>{fmtNum(qualitative.actual) || '—'}</td>
                <td className={`${TDC} font-semibold text-blue-600`}>{calcRate(qualitative.target, qualitative.actual)}</td>
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
  const [showRevisionModal, setShowRevisionModal] = useState(false)
  const [revisionReason, setRevisionReason] = useState('')
  const [revisionLoading, setRevisionLoading] = useState(false)

  const isOwner = report.user_id === currentUserId
  const pastDeadline = isPastDeadline(report.period_end)
  const cfg = STATUS_CONFIG[report.status]

  const content = report.content as unknown as Record<string, unknown>
  const isV2 = content?.version === 2

  const handleRevisionRequest = async () => {
    if (!revisionReason.trim()) return
    setRevisionLoading(true)
    const res = await fetch(`/api/reports/${report.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'revision_requested', revision_reason: revisionReason.trim() }),
    })
    if (res.ok) {
      setReport(await res.json())
      setShowRevisionModal(false)
      setRevisionReason('')
    }
    setRevisionLoading(false)
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

        {report.status === 'revision_requested' && report.revision_reason && (
          <div className="mt-4 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
            <p className="text-xs font-medium text-red-600 mb-1">수정 요청 사유</p>
            <p className="text-sm text-red-700">{report.revision_reason}</p>
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

      {/* 액션 버튼 (본인) */}
      {isOwner && (
        <div className="space-y-2">
          {report.status === 'submitted' && !pastDeadline && (
            <button onClick={() => router.push(`/reports/${report.id}/edit`)}
              className="w-full bg-white border border-gray-300 text-gray-700 font-medium py-3 rounded-xl text-sm hover:bg-gray-50 transition-colors">
              수정하기
            </button>
          )}
          {report.status === 'submitted' && pastDeadline && (
            <button onClick={() => setShowRevisionModal(true)}
              className="w-full bg-white border border-red-200 text-red-600 font-medium py-3 rounded-xl text-sm hover:bg-red-50 transition-colors">
              수정 요청
            </button>
          )}
          {report.status === 'revision_approved' && (
            <button onClick={() => router.push(`/reports/${report.id}/edit?resubmit=1`)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl text-sm transition-colors">
              재제출하기
            </button>
          )}
          {report.status === 'draft' && (
            <button onClick={() => router.push(`/reports/${report.id}/edit`)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl text-sm transition-colors">
              이어서 작성
            </button>
          )}
        </div>
      )}

      {/* 수정 요청 모달 */}
      {showRevisionModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-4 pb-4 md:pb-0">
          <div className="bg-white rounded-2xl w-full max-w-md p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-1">수정 요청</h2>
            <p className="text-xs text-gray-400 mb-4">수정이 필요한 이유를 입력해 주세요. 관리자가 검토 후 승인합니다.</p>
            <textarea
              value={revisionReason}
              onChange={(e) => setRevisionReason(e.target.value)}
              placeholder="수정 요청 사유를 입력하세요"
              rows={4}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-3"
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => { setShowRevisionModal(false); setRevisionReason('') }}
                className="flex-1 border border-gray-200 text-gray-600 font-medium py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors">취소</button>
              <button onClick={handleRevisionRequest} disabled={revisionLoading || !revisionReason.trim()}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white font-medium py-2.5 rounded-xl text-sm transition-colors">
                {revisionLoading ? '요청 중...' : '요청 전송'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
