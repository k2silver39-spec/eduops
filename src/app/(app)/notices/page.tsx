'use client'

import { useEffect, useState } from 'react'

interface Notice {
  id: string
  title: string
  content: string
  is_pinned: boolean
  is_active: boolean
  created_at: string
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`
}

export default function NoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Notice | null>(null)

  const limit = 10
  const totalPages = Math.ceil(total / limit)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/notices/all?page=${page}`)
      .then(r => r.json())
      .then(d => {
        setNotices(d.notices ?? [])
        setTotal(d.total ?? 0)
      })
      .finally(() => setLoading(false))
  }, [page])

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <h1 className="text-lg font-semibold text-gray-900 mb-4">공지사항</h1>

      {loading ? (
        <div className="text-sm text-gray-400 py-10 text-center">불러오는 중...</div>
      ) : notices.length === 0 ? (
        <div className="text-sm text-gray-400 py-10 text-center">공지사항이 없습니다.</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {notices.map((n) => (
            <button
              key={n.id}
              onClick={() => setSelected(n)}
              className="w-full text-left px-4 py-3.5 hover:bg-gray-50 transition-colors flex items-start gap-2"
            >
              {n.is_pinned && (
                <span className="mt-0.5 text-orange-500 text-xs font-bold shrink-0">📌</span>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{n.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{formatDate(n.created_at)}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
          >
            이전
          </button>
          <span className="text-sm text-gray-500">{page} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
          >
            다음
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white w-full max-w-lg rounded-t-2xl md:rounded-2xl shadow-xl max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
              <div>
                {selected.is_pinned && <span className="text-orange-500 text-xs mr-1">📌</span>}
                <span className="text-sm font-semibold text-gray-900">{selected.title}</span>
                <p className="text-xs text-gray-400 mt-0.5">{formatDate(selected.created_at)}</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-gray-400 hover:text-gray-600 mt-0.5 shrink-0"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-5 py-4 overflow-y-auto">
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{selected.content}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
