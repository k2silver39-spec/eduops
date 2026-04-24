'use client'

import { useEffect, useState, useCallback } from 'react'
import AdminNav from '@/components/admin/AdminNav'

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

const emptyForm = { title: '', content: '', is_pinned: false, is_active: true }

export default function AdminNoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Notice | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const limit = 10
  const totalPages = Math.ceil(total / limit)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/notices/all?page=${page}`)
      .then(r => r.json())
      .then(d => { setNotices(d.notices ?? []); setTotal(d.total ?? 0) })
      .finally(() => setLoading(false))
  }, [page])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  function openEdit(n: Notice) {
    setEditing(n)
    setForm({ title: n.title, content: n.content, is_pinned: n.is_pinned, is_active: n.is_active })
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.title.trim() || !form.content.trim()) return
    setSaving(true)
    try {
      if (editing) {
        await fetch(`/api/notices/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        showToast('공지가 수정되었습니다.')
      } else {
        await fetch('/api/notices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        showToast('공지가 등록되었습니다.')
      }
      setShowForm(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('이 공지를 삭제하시겠습니까?')) return
    await fetch(`/api/notices/${id}`, { method: 'DELETE' })
    showToast('공지가 삭제되었습니다.')
    load()
  }

  async function togglePin(n: Notice) {
    await fetch(`/api/notices/${n.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_pinned: !n.is_pinned }),
    })
    load()
  }

  async function toggleActive(n: Notice) {
    await fetch(`/api/notices/${n.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !n.is_active }),
    })
    load()
  }

  return (
    <div>
      <AdminNav />
      <div className="px-4 py-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold text-gray-900">공지사항 관리</h1>
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            + 새 공지
          </button>
        </div>

        {loading ? (
          <div className="text-sm text-gray-400 py-10 text-center">불러오는 중...</div>
        ) : notices.length === 0 ? (
          <div className="text-sm text-gray-400 py-10 text-center">등록된 공지사항이 없습니다.</div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {notices.map((n) => (
              <div key={n.id} className="px-4 py-3.5 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {n.is_pinned && <span className="text-orange-500 text-xs">📌</span>}
                    {!n.is_active && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded-full font-medium">비활성</span>
                    )}
                    <span className="text-sm font-medium text-gray-900">{n.title}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDate(n.created_at)}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => togglePin(n)}
                    title={n.is_pinned ? '핀 해제' : '상단 고정'}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-orange-500 transition-colors"
                  >
                    <svg className="w-4 h-4" fill={n.is_pinned ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16l-7-3.5L5 21V5Z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => toggleActive(n)}
                    title={n.is_active ? '비활성화' : '활성화'}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={n.is_active
                        ? 'M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z'
                        : 'M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88'
                      } />
                    </svg>
                  </button>
                  <button
                    onClick={() => openEdit(n)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(n.id)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-4">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">이전</button>
            <span className="text-sm text-gray-500">{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">다음</button>
          </div>
        )}
      </div>

      {/* Create/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40"
          onClick={() => setShowForm(false)}>
          <div className="bg-white w-full max-w-lg rounded-t-2xl md:rounded-2xl shadow-xl flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">{editing ? '공지 수정' : '새 공지 작성'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-5 py-4 flex-1 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">제목</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="공지 제목"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">내용</label>
                <textarea
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={8}
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="공지 내용을 입력하세요"
                />
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_pinned}
                    onChange={e => setForm(f => ({ ...f, is_pinned: e.target.checked }))}
                    className="rounded" />
                  <span className="text-sm text-gray-700">상단 고정</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_active}
                    onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                    className="rounded" />
                  <span className="text-sm text-gray-700">활성화</span>
                </label>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-100">
              <button
                onClick={handleSave}
                disabled={saving || !form.title.trim() || !form.content.trim()}
                className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? '저장 중...' : editing ? '수정 저장' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  )
}
