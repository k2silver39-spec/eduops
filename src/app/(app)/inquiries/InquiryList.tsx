'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'

interface Inquiry {
  id: string
  title: string
  category: string
  is_public: boolean
  status: string
  organization: string
  created_at: string
  author: { email: string; organization: string } | null
}

type StatusFilter = 'all' | 'open' | 'closed'
type CategoryFilter = 'all' | '교육' | '사업' | '예산' | '기타'

const PAGE_SIZE = 20

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
    .replace(/\. /g, '.').replace(/\.$/, '')
}

function StatusBadge({ status }: { status: string }) {
  const closed = status === 'closed'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
      closed ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
    }`}>
      {closed ? '답변완료' : '답변대기'}
    </span>
  )
}

function CategoryBadge({ category }: { category: string }) {
  const colors: Record<string, string> = {
    '교육': 'bg-blue-100 text-blue-700',
    '사업': 'bg-emerald-100 text-emerald-700',
    '예산': 'bg-amber-100 text-amber-700',
    '기타': 'bg-gray-100 text-gray-500',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${colors[category] ?? 'bg-gray-100 text-gray-600'}`}>
      {category}
    </span>
  )
}

export default function InquiryList() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const fetchInquiries = useCallback(async (currentPage: number) => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(currentPage),
      status: statusFilter,
      category: categoryFilter,
    })
    if (debouncedSearch) params.set('search', debouncedSearch)

    const res = await fetch(`/api/inquiries?${params}`)
    const data = await res.json()
    setInquiries(data.inquiries ?? [])
    setTotalCount(data.total ?? 0)
    setLoading(false)
  }, [debouncedSearch, statusFilter, categoryFilter])

  useEffect(() => {
    setPage(0)
  }, [debouncedSearch, statusFilter, categoryFilter])

  useEffect(() => {
    fetchInquiries(page)
  }, [fetchInquiries, page])

  const handleSearchChange = (value: string) => {
    setSearch(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => setDebouncedSearch(value), 400)
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  const statusTabs: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: '전체' },
    { key: 'open', label: '답변대기' },
    { key: 'closed', label: '답변완료' },
  ]
  const categories: CategoryFilter[] = ['all', '교육', '사업', '예산', '기타']

  return (
    <div className="max-w-2xl mx-auto md:max-w-3xl pb-24">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-gray-50 pt-4 pb-2 px-4">
        {/* Search */}
        <div className="relative mb-3">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="제목 또는 내용 검색"
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Status tabs */}
        <div className="flex gap-1 mb-2">
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-500 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Category filters */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                categoryFilter === cat
                  ? 'bg-gray-800 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {cat === 'all' ? '전체' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="px-4 mt-2 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-sm text-gray-400">불러오는 중...</div>
          </div>
        ) : inquiries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
              </svg>
            </div>
            <p className="text-sm text-gray-500">문의가 없습니다</p>
          </div>
        ) : (
          inquiries.map((inquiry, index) => (
            <Link
              key={inquiry.id}
              href={`/inquiries/${inquiry.id}`}
              className="block bg-white border border-gray-200 rounded-xl p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  <span className="text-xs font-medium text-gray-300 flex-shrink-0">
                    {totalCount - page * PAGE_SIZE - index}
                  </span>
                  <CategoryBadge category={inquiry.category} />
                  {!inquiry.is_public && (
                    <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                  )}
                </div>
                <StatusBadge status={inquiry.status} />
              </div>
              <p className="mt-2 text-sm font-medium text-gray-900 line-clamp-1">{inquiry.title}</p>
              <p className="mt-1 text-xs text-gray-400">
                {inquiry.author?.organization ?? '—'} · {formatDate(inquiry.created_at)}
              </p>
            </Link>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-4 px-4">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            이전
          </button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
            const pageNum = Math.max(0, Math.min(page - 2, totalPages - 5)) + i
            return (
              <button
                key={pageNum}
                onClick={() => setPage(pageNum)}
                className={`w-8 h-8 text-sm rounded-lg ${
                  pageNum === page ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                {pageNum + 1}
              </button>
            )
          })}
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            다음
          </button>
        </div>
      )}

      {/* FAB */}
      <Link
        href="/inquiries/new"
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-colors z-20"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </Link>
    </div>
  )
}
