'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { downloadReportExcel, printReportPdf, type ReportDownloadData } from '@/lib/reportDownload'

type PageTab = 'list' | 'pending' | 'summary'

interface Report {
  id: string
  type: string
  period_label: string
  status: string
  revision_reason: string | null
  revision_comment: string | null
  submitted_at: string | null
  created_at: string
  organization: string
  author: { id: string; email: string; organization: string } | null
}

const STATUS_BADGE: Record<string, string> = {
  draft:              'bg-gray-100 text-gray-600',
  submitted:          'bg-green-100 text-green-700',
  approved:           'bg-emerald-100 text-emerald-700',
  revision_requested: 'bg-red-100 text-red-600',
  resubmitted:        'bg-blue-100 text-blue-700',
  revision_approved:  'bg-amber-100 text-amber-600',
}
const STATUS_LABEL: Record<string, string> = {
  draft: '임시저장',
  submitted: '제출완료',
  approved: '승인',
  revision_requested: '정정요청',
  resubmitted: '재제출',
  revision_approved: '재제출 필요',
}

function formatDate(d: string | null) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })
    .replace('. ', '.').replace(/\.$/, '')
}

interface SummaryResult {
  overall: string
  individuals: Array<{ organization: string; completed: string; issues: string }>
}

export default function AdminReportsPage() {
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<PageTab>((searchParams.get('tab') as PageTab) ?? 'list')

  // 목록 탭 상태
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [orgFilter, setOrgFilter] = useState('all')
  const [orgs, setOrgs] = useState<string[]>([])

  // 승인 대기 탭 상태
  const [pending, setPending] = useState<Report[]>([])
  const [pendLoading, setPendLoading] = useState(false)
  const [confirm, setConfirm] = useState<{ id: string; action: 'approve'; email: string } | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // 다운로드 상태
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [dropdownId, setDropdownId] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  // AI 요약 탭 상태
  const [sumStartDate, setSumStartDate] = useState('')
  const [sumEndDate, setSumEndDate] = useState('')
  const [sumOrg, setSumOrg] = useState('all')
  const [sumLoading, setSumLoading] = useState(false)
  const [sumResult, setSumResult] = useState<SummaryResult | null>(null)
  const [sumError, setSumError] = useState('')

  // 드롭다운 외부 클릭 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // 다운로드 공통 fetch
  const fetchReportData = async (id: string): Promise<ReportDownloadData | null> => {
    setDownloadingId(id)
    try {
      const res = await fetch(`/api/admin/reports/${id}`)
      if (!res.ok) return null
      const data = await res.json()
      return {
        type: data.type,
        period_label: data.period_label,
        content: data.content,
        organization: data.organization,
      }
    } finally {
      setDownloadingId(null)
      setDropdownId(null)
    }
  }

  const handleExcel = async (id: string) => {
    const d = await fetchReportData(id)
    if (d) downloadReportExcel(d)
  }

  const handlePdf = async (id: string) => {
    const d = await fetchReportData(id)
    if (d) printReportPdf(d)
  }

  // 기관 목록
  useEffect(() => {
    fetch('/api/admin/users?tab=all')
      .then(r => r.json())
      .then(data => {
        const unique = Array.from(new Set((data as { organization: string }[]).map(u => u.organization))).sort()
        setOrgs(unique as string[])
      })
  }, [])

  // 목록 탭
  const fetchReports = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams({ status: statusFilter, type: typeFilter, organization: orgFilter })
    const res = await fetch(`/api/admin/reports?${p}`)
    const data = await res.json()
    setReports(data)
    setLoading(false)
  }, [statusFilter, typeFilter, orgFilter])

  useEffect(() => { if (tab === 'list') fetchReports() }, [tab, fetchReports])

  // 승인 대기 탭 (submitted + resubmitted)
  const fetchPending = useCallback(async () => {
    setPendLoading(true)
    const [r1, r2] = await Promise.all([
      fetch('/api/admin/reports?status=submitted').then(r => r.json()),
      fetch('/api/admin/reports?status=resubmitted').then(r => r.json()),
    ])
    const merged: Report[] = [...(Array.isArray(r1) ? r1 : []), ...(Array.isArray(r2) ? r2 : [])]
    merged.sort((a, b) => (b.submitted_at ?? b.created_at).localeCompare(a.submitted_at ?? a.created_at))
    setPending(merged)
    setPendLoading(false)
  }, [])

  useEffect(() => { if (tab === 'pending') fetchPending() }, [tab, fetchPending])

  const doApprove = async () => {
    if (!confirm) return
    setActionLoading(true)
    await fetch(`/api/admin/reports/${confirm.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    })
    setConfirm(null)
    setActionLoading(false)
    fetchPending()
  }

  const doSummary = async () => {
    setSumError('')
    setSumResult(null)
    setSumLoading(true)
    const res = await fetch('/api/admin/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate: sumStartDate, endDate: sumEndDate, organization: sumOrg }),
    })
    const data = await res.json()
    if (!res.ok) setSumError(data.error ?? '오류가 발생했습니다.')
    else setSumResult(data)
    setSumLoading(false)
  }

  return (
    <div className="px-4 py-6 max-w-6xl mx-auto">
      <h1 className="text-lg font-semibold text-gray-900 mb-4">보고서 관리</h1>

      {/* 탭 */}
      <div className="flex gap-1 mb-5">
        {([['list', '보고서 목록'], ['pending', '승인 대기'], ['summary', 'AI 요약']] as [PageTab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-200'}`}>
            {label}
            {t === 'pending' && pending.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold">{pending.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── 목록 탭 ── */}
      {tab === 'list' && (
        <>
          <div className="flex gap-2 flex-wrap mb-4">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="all">전체 상태</option>
              <option value="submitted">제출완료</option>
              <option value="approved">승인</option>
              <option value="revision_requested">정정요청</option>
              <option value="resubmitted">재제출</option>
              <option value="draft">임시저장</option>
            </select>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="all">전체 유형</option>
              <option value="weekly">주간</option>
              <option value="monthly">월간</option>
            </select>
            <select value={orgFilter} onChange={e => setOrgFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="all">전체 기관</option>
              {orgs.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">기관</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">작성자</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">유형</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">기간</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">상태</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">제출일</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">다운로드</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">불러오는 중...</td></tr>
                  ) : reports.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">보고서가 없습니다.</td></tr>
                  ) : reports.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.organization}</td>
                      <td className="px-4 py-3 text-gray-900 whitespace-nowrap">{r.author?.email ?? '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${r.type === 'weekly' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                          {r.type === 'weekly' ? '주간' : '월간'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/reports/${r.id}`} className="text-gray-800 hover:text-blue-600 font-medium whitespace-nowrap">
                          {r.period_label}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {STATUS_LABEL[r.status] ?? r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(r.submitted_at)}</td>
                      <td className="px-4 py-3">
                        <div className="relative" ref={dropdownId === r.id ? dropdownRef : null}>
                          <button
                            onClick={() => setDropdownId(prev => prev === r.id ? null : r.id)}
                            disabled={downloadingId === r.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                          >
                            {downloadingId === r.id ? (
                              <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                              </svg>
                            )}
                            다운로드
                          </button>
                          {dropdownId === r.id && (
                            <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden w-36">
                              <button
                                onClick={() => handleExcel(r.id)}
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                              >
                                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                                </svg>
                                Excel 다운로드
                              </button>
                              <button
                                onClick={() => handlePdf(r.id)}
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors border-t border-gray-100"
                              >
                                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                                </svg>
                                PDF 저장
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── 승인 대기 탭 ── */}
      {tab === 'pending' && (
        <div className="space-y-3">
          {pendLoading ? (
            <div className="text-center py-10 text-sm text-gray-400">불러오는 중...</div>
          ) : pending.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-400">
              승인 대기 중인 보고서가 없습니다.
            </div>
          ) : pending.map((r) => (
            <div key={r.id} className={`bg-white border rounded-xl p-4 ${r.status === 'resubmitted' ? 'border-blue-200' : 'border-gray-200'}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${r.type === 'weekly' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                      {r.type === 'weekly' ? '주간' : '월간'}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                    <Link href={`/reports/${r.id}`} className="text-sm font-medium text-gray-900 hover:text-blue-600">
                      {r.period_label}
                    </Link>
                  </div>
                  <p className="text-xs text-gray-500">
                    {r.author?.email} · {r.organization} · 제출 {formatDate(r.submitted_at)}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Link
                    href={`/reports/${r.id}`}
                    className="px-3 py-1.5 border border-gray-300 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    검토
                  </Link>
                  <button
                    onClick={() => setConfirm({ id: r.id, action: 'approve', email: r.author?.email ?? '' })}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    승인
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── AI 요약 탭 ── */}
      {tab === 'summary' && (
        <div className="max-w-2xl">
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">요약 조건 설정</h2>
            <div className="space-y-3">
              <div className="flex gap-3 flex-wrap">
                <div className="flex-1 min-w-36">
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">시작일</label>
                  <input type="date" value={sumStartDate} onChange={e => setSumStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex-1 min-w-36">
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">종료일</label>
                  <input type="date" value={sumEndDate} onChange={e => setSumEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">기관</label>
                <select value={sumOrg} onChange={e => setSumOrg(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="all">전체 기관</option>
                  {orgs.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              {sumError && <p className="text-sm text-red-600">{sumError}</p>}
              <button
                onClick={doSummary}
                disabled={sumLoading || !sumStartDate || !sumEndDate}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
              >
                {sumLoading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    AI 분석 중...
                  </>
                ) : 'AI 요약 생성'}
              </button>
            </div>
          </div>

          {sumResult && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-blue-800 mb-2">전체 종합 요약</h3>
                <p className="text-sm text-blue-900 leading-relaxed">{sumResult.overall}</p>
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">개인별 요약</h3>
                {sumResult.individuals.map((ind, i) => (
                  <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-sm font-semibold text-gray-900">{ind.organization}</p>
                    </div>
                    <div className="space-y-1.5">
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-0.5">완료 업무</p>
                        <p className="text-sm text-gray-700">{ind.completed || '-'}</p>
                      </div>
                      {ind.issues && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-0.5">이슈사항</p>
                          <p className="text-sm text-gray-700">{ind.issues}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 승인 확인 모달 */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5">
            <p className="text-sm font-medium text-gray-900 mb-5">
              {confirm.email} 보고서를 승인하시겠습니까?
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirm(null)} className="flex-1 border border-gray-200 text-gray-600 font-medium py-2.5 rounded-xl text-sm hover:bg-gray-50">취소</button>
              <button onClick={doApprove} disabled={actionLoading}
                className="flex-1 font-medium py-2.5 rounded-xl text-sm text-white transition-colors bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400">
                {actionLoading ? '처리 중...' : '승인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
