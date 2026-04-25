'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface Inquiry {
  id: string
  title: string
  category: string
  status: string
  organization: string
  created_at: string
  author: { email: string; organization: string } | null
}

const STATUS_BADGE: Record<string, string> = {
  open:        'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-blue-100 text-blue-700',
  closed:      'bg-green-100 text-green-700',
}
const STATUS_LABEL: Record<string, string> = {
  open: '답변대기', in_progress: '처리중', closed: '답변완료',
}
const CAT_COLORS: Record<string, string> = {
  '교육': 'bg-blue-100 text-blue-700',
  '사업': 'bg-emerald-100 text-emerald-700',
  '예산': 'bg-amber-100 text-amber-700',
  '기타': 'bg-gray-100 text-gray-500',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })
    .replace('. ', '.').replace(/\.$/, '')
}

const PAGE_SIZE = 20

export default function AdminInquiriesPage() {
  const searchParams = useSearchParams()

  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState(searchParams.get('status') ?? 'all')
  const [category, setCategory] = useState('all')
  const [org, setOrg] = useState('all')
  const [sort, setSort] = useState('date')
  const [orgs, setOrgs] = useState<string[]>([])
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchInquiries = useCallback(async (p: number) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p), status, category, organization: org, sort })
    if (debouncedSearch) params.set('search', debouncedSearch)
    const res = await fetch(`/api/admin/inquiries?${params}`)
    const data = await res.json()
    setInquiries(data.inquiries ?? [])
    setTotal(data.total ?? 0)
    setLoading(false)
  }, [status, category, org, sort, debouncedSearch])

  // 기관 목록 로드
  useEffect(() => {
    fetch('/api/admin/users?tab=all')
      .then(r => r.json())
      .then(data => {
        const unique = Array.from(new Set((data as { organization: string }[]).map(u => u.organization))).sort()
        setOrgs(unique as string[])
      })
  }, [])

  useEffect(() => { setPage(0) }, [status, category, org, sort, debouncedSearch])
  useEffect(() => { fetchInquiries(page) }, [fetchInquiries, page])

  const handleSearch = (v: string) => {
    setSearch(v)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => setDebouncedSearch(v), 400)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="px-4 py-6 max-w-6xl mx-auto">
      <h1 className="text-lg font-semibold text-gray-900 mb-4">문의 관리</h1>

      {/* 필터 바 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 space-y-3">
        <div className="flex gap-2 flex-wrap items-center">
          {/* 검색 */}
          <div className="relative flex-1 min-w-48">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="제목 검색"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 상태 */}
          <select value={status} onChange={e => setStatus(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">전체 상태</option>
            <option value="open">답변대기</option>
            <option value="closed">답변완료</option>
          </select>

          {/* 카테고리 */}
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">전체 카테고리</option>
            {['교육', '사업', '예산', '기타'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* 기관 */}
          <select value={org} onChange={e => setOrg(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">전체 기관</option>
            {orgs.map(o => <option key={o} value={o}>{o}</option>)}
          </select>

          {/* 정렬 */}
          <select value={sort} onChange={e => setSort(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="date">최신순</option>
            <option value="open">미답변 우선</option>
          </select>
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">기관</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">제목</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">작성자</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">카테고리</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">상태</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">작성일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">불러오는 중...</td></tr>
              ) : inquiries.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">문의가 없습니다.</td></tr>
              ) : inquiries.map((q) => (
                <tr key={q.id} className="hover:bg-gray-50 transition-colors cursor-pointer">
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{q.organization}</td>
                  <td className="px-4 py-3">
                    <Link href={`/inquiries/${q.id}`} className="text-gray-900 hover:text-blue-600 font-medium line-clamp-1">
                      {q.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{q.author?.email ?? '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${CAT_COLORS[q.category] ?? 'bg-gray-100 text-gray-600'}`}>
                      {q.category}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[q.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABEL[q.status] ?? q.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(q.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">이전</button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
            const n = Math.max(0, Math.min(page - 2, totalPages - 5)) + i
            return (
              <button key={n} onClick={() => setPage(n)}
                className={`w-8 h-8 text-sm rounded-lg ${n === page ? 'bg-blue-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {n + 1}
              </button>
            )
          })}
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">다음</button>
        </div>
      )}
    </div>
  )
}
