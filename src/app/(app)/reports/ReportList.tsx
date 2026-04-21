'use client'

import Link from 'next/link'
import { useState } from 'react'

type ReportType = 'weekly' | 'monthly'
type ReportStatus = string

interface Report {
  id: string
  type: ReportType
  period_label: string
  period_start: string
  period_end: string
  status: ReportStatus
  submitted_at: string | null
  created_at: string
  updated_at?: string
  author?: { name: string } | null
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  draft:              { label: '임시저장',   cls: 'bg-gray-100 text-gray-600' },
  submitted:          { label: '제출완료',   cls: 'bg-green-100 text-green-700' },
  approved:           { label: '승인',       cls: 'bg-emerald-100 text-emerald-700' },
  revision_requested: { label: '정정요청',   cls: 'bg-red-100 text-red-600' },
  resubmitted:        { label: '재제출',     cls: 'bg-blue-100 text-blue-700' },
  revision_approved:  { label: '재제출 필요', cls: 'bg-amber-100 text-amber-600' },
}

function StatusBadge({ status }: { status: ReportStatus }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

function formatDate(dateStr: string) {
  return new Date(dateStr)
    .toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
    .replace(/\. /g, '.').replace(/\.$/, '')
}

export default function ReportList({
  myReports,
  orgReports,
}: {
  myReports: Report[]
  orgReports: Report[]
}) {
  const [tab, setTab] = useState<ReportType>('weekly')

  const filteredMy = myReports.filter((r) => r.type === tab)
  const filteredOrg = orgReports.filter((r) => r.type === tab)

  return (
    <div className="max-w-2xl mx-auto md:max-w-3xl pb-24">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-gray-50 pt-4 pb-2 px-4">
        <div className="flex gap-1">
          {(['weekly', 'monthly'] as ReportType[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-200'
              }`}
            >
              {t === 'weekly' ? '주간 리포트' : '월간 리포트'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 mt-4 space-y-6">
        {/* 내 보고서 */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">내 리포트</h2>
          {filteredMy.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
              <p className="text-sm text-gray-400">작성된 리포트가 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredMy.map((report) => (
                <Link
                  key={report.id}
                  href={`/reports/${report.id}`}
                  className="block bg-white border border-gray-200 rounded-xl p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900">{report.period_label}</p>
                    <StatusBadge status={report.status} />
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    {report.submitted_at
                      ? `제출: ${formatDate(report.submitted_at)}`
                      : `최종수정: ${formatDate(report.updated_at ?? report.created_at)}`}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* 우리 기관 보고서 */}
        {filteredOrg.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">우리 기관 리포트</h2>
            <div className="space-y-2">
              {filteredOrg.map((report) => (
                <Link
                  key={report.id}
                  href={`/reports/${report.id}`}
                  className="block bg-white border border-gray-200 rounded-xl p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900">{report.period_label}</p>
                    <StatusBadge status={report.status} />
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    {report.author?.name}
                    {report.submitted_at ? ` · ${formatDate(report.submitted_at)}` : ''}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* FAB */}
      <Link
        href="/reports/new"
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-colors z-20"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </Link>
    </div>
  )
}
