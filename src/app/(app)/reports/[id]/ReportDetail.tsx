'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type ReportStatus = 'draft' | 'submitted' | 'revision_requested' | 'revision_approved'

interface InProgressItem { task: string; progress: number }
interface GoalItem { goal: string; achievement_rate: number }

interface WeeklyContent {
  completed: string
  in_progress: InProgressItem[]
  next_plan: string
  issues?: string
}

interface MonthlyContent {
  achievements: string
  goals: GoalItem[]
  next_month_plan: string
  issues?: string
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

const STATUS_CONFIG: Record<ReportStatus, { label: string; cls: string }> = {
  draft:              { label: '임시저장', cls: 'bg-gray-100 text-gray-600' },
  submitted:          { label: '제출완료', cls: 'bg-green-100 text-green-700' },
  revision_requested: { label: '수정요청', cls: 'bg-red-100 text-red-600' },
  revision_approved:  { label: '수정승인', cls: 'bg-blue-100 text-blue-700' },
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function isPastDeadline(periodEnd: string): boolean {
  return new Date().toISOString().split('T')[0] > periodEnd
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-sm font-semibold text-blue-600 w-10 text-right tabular-nums">{value}%</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{title}</h3>
      {children}
    </div>
  )
}

function WeeklyView({ content }: { content: WeeklyContent }) {
  return (
    <div className="space-y-5">
      <Section title="이번 주 완료 업무">
        <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-xl px-4 py-3">
          {content.completed || <span className="text-gray-400">-</span>}
        </p>
      </Section>

      {content.in_progress.length > 0 && (
        <Section title="진행 중 업무">
          <div className="space-y-3">
            {content.in_progress.map((item, i) => (
              <div key={i} className="bg-gray-50 rounded-xl px-4 py-3">
                <p className="text-sm font-medium text-gray-800 mb-2">{item.task || '(업무명 없음)'}</p>
                <ProgressBar value={item.progress} />
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="다음 주 계획">
        <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-xl px-4 py-3">
          {content.next_plan || <span className="text-gray-400">-</span>}
        </p>
      </Section>

      {content.issues && (
        <Section title="이슈 및 건의사항">
          <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-xl px-4 py-3">
            {content.issues}
          </p>
        </Section>
      )}
    </div>
  )
}

function MonthlyView({ content }: { content: MonthlyContent }) {
  return (
    <div className="space-y-5">
      <Section title="월간 주요 성과">
        <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-xl px-4 py-3">
          {content.achievements || <span className="text-gray-400">-</span>}
        </p>
      </Section>

      {content.goals.length > 0 && (
        <Section title="목표 달성도">
          <div className="space-y-3">
            {content.goals.map((item, i) => (
              <div key={i} className="bg-gray-50 rounded-xl px-4 py-3">
                <p className="text-sm font-medium text-gray-800 mb-2">{item.goal || '(목표명 없음)'}</p>
                <ProgressBar value={item.achievement_rate} />
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="다음 달 목표">
        <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-xl px-4 py-3">
          {content.next_month_plan || <span className="text-gray-400">-</span>}
        </p>
      </Section>

      {content.issues && (
        <Section title="특이사항/건의">
          <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-xl px-4 py-3">
            {content.issues}
          </p>
        </Section>
      )}
    </div>
  )
}

export default function ReportDetail({
  report: initial,
  currentUserId,
  isAdmin,
}: {
  report: Report
  currentUserId: string
  isAdmin: boolean
}) {
  const router = useRouter()
  const [report, setReport] = useState(initial)

  // 수정 요청 모달
  const [showRevisionModal, setShowRevisionModal] = useState(false)
  const [revisionReason, setRevisionReason] = useState('')
  const [revisionLoading, setRevisionLoading] = useState(false)

  const isOwner = report.user_id === currentUserId
  const pastDeadline = isPastDeadline(report.period_end)
  const cfg = STATUS_CONFIG[report.status]

  const handleRevisionRequest = async () => {
    if (!revisionReason.trim()) return
    setRevisionLoading(true)
    const res = await fetch(`/api/reports/${report.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'revision_requested', revision_reason: revisionReason.trim() }),
    })
    if (res.ok) {
      const data = await res.json()
      setReport(data)
      setShowRevisionModal(false)
      setRevisionReason('')
    }
    setRevisionLoading(false)
  }

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
        <h1 className="text-base font-semibold text-gray-900">보고서 상세</h1>
      </div>

      {/* 메타 카드 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-gray-900">{report.period_label}</p>
            <p className="text-xs text-gray-400 mt-1">
              {report.author?.name}
              {report.submitted_at ? ` · 제출: ${formatDate(report.submitted_at)}` : ''}
            </p>
          </div>
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${cfg.cls}`}>
            {cfg.label}
          </span>
        </div>

        {/* 수정 요청 사유 */}
        {report.status === 'revision_requested' && report.revision_reason && (
          <div className="mt-4 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
            <p className="text-xs font-medium text-red-600 mb-1">수정 요청 사유</p>
            <p className="text-sm text-red-700">{report.revision_reason}</p>
          </div>
        )}
      </div>

      {/* 보고서 내용 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        {report.type === 'weekly'
          ? <WeeklyView content={report.content as WeeklyContent} />
          : <MonthlyView content={report.content as MonthlyContent} />
        }
      </div>

      {/* 액션 버튼 (본인 보고서) */}
      {isOwner && (
        <div className="space-y-2">
          {/* submitted + 마감 전 → 수정하기 */}
          {report.status === 'submitted' && !pastDeadline && (
            <button
              onClick={() => router.push(`/reports/${report.id}/edit`)}
              className="w-full bg-white border border-gray-300 text-gray-700 font-medium py-3 rounded-xl text-sm hover:bg-gray-50 transition-colors"
            >
              수정하기
            </button>
          )}

          {/* submitted + 마감 후 → 수정 요청 */}
          {report.status === 'submitted' && pastDeadline && (
            <button
              onClick={() => setShowRevisionModal(true)}
              className="w-full bg-white border border-red-200 text-red-600 font-medium py-3 rounded-xl text-sm hover:bg-red-50 transition-colors"
            >
              수정 요청
            </button>
          )}

          {/* revision_approved → 재제출하기 */}
          {report.status === 'revision_approved' && (
            <button
              onClick={() => router.push(`/reports/${report.id}/edit?resubmit=1`)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl text-sm transition-colors"
            >
              재제출하기
            </button>
          )}

          {/* draft → 이어서 작성 */}
          {report.status === 'draft' && (
            <button
              onClick={() => router.push(`/reports/${report.id}/edit`)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl text-sm transition-colors"
            >
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
              <button
                onClick={() => { setShowRevisionModal(false); setRevisionReason('') }}
                className="flex-1 border border-gray-200 text-gray-600 font-medium py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleRevisionRequest}
                disabled={revisionLoading || !revisionReason.trim()}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
              >
                {revisionLoading ? '요청 중...' : '요청 전송'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
