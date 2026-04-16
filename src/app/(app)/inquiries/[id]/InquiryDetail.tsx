'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Reply {
  id: string
  content: string
  created_at: string
  admin: { name: string } | null
}

interface Inquiry {
  id: string
  user_id: string
  title: string
  content: string
  category: string
  is_public: boolean
  status: string
  organization: string
  created_at: string
  updated_at: string
  author: { name: string } | null
}

function maskName(name: string | null | undefined): string {
  if (!name) return '알 수 없음'
  if (name.length <= 1) return name
  return name[0] + '*'.repeat(name.length - 1)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

const CATEGORY_COLORS: Record<string, string> = {
  '수업': 'bg-blue-50 text-blue-600',
  '행정': 'bg-purple-50 text-purple-600',
  '시설': 'bg-orange-50 text-orange-600',
  '기타': 'bg-gray-100 text-gray-600',
}

export default function InquiryDetail({
  inquiry: initial,
  replies: initialReplies,
  currentUserId,
  isAdmin,
}: {
  inquiry: Inquiry
  replies: Reply[]
  currentUserId: string
  isAdmin: boolean
}) {
  const router = useRouter()
  const [inquiry, setInquiry] = useState(initial)
  const [replies, setReplies] = useState(initialReplies)

  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ title: inquiry.title, content: inquiry.content })
  const [editLoading, setEditLoading] = useState(false)

  const [replyContent, setReplyContent] = useState('')
  const [replyLoading, setReplyLoading] = useState(false)
  const [replyEditId, setReplyEditId] = useState<string | null>(null)
  const [replyEditContent, setReplyEditContent] = useState('')

  const isOwner = inquiry.user_id === currentUserId
  const hasReply = replies.length > 0
  const canEdit = isOwner && !hasReply

  const apiBase = `/api/inquiries/${inquiry.id}`

  // 문의 삭제
  const handleDelete = async () => {
    if (!confirm('문의를 삭제하시겠습니까?')) return
    const res = await fetch(apiBase, { method: 'DELETE' })
    if (res.ok) router.push('/inquiries')
  }

  // 문의 수정 저장
  const handleEditSave = async () => {
    if (!editForm.title.trim() || !editForm.content.trim()) return
    setEditLoading(true)
    const res = await fetch(apiBase, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editForm.title.trim(), content: editForm.content.trim() }),
    })
    if (res.ok) {
      const data = await res.json()
      setInquiry((prev) => ({ ...prev, ...data }))
      setEditing(false)
    }
    setEditLoading(false)
  }

  // 상태 변경 (admin)
  const handleStatusChange = async (newStatus: string) => {
    const res = await fetch(apiBase, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      const data = await res.json()
      setInquiry((prev) => ({ ...prev, status: data.status }))
    }
  }

  // 답변 등록
  const handleReplySubmit = async () => {
    if (!replyContent.trim()) return
    setReplyLoading(true)
    const res = await fetch(`${apiBase}/replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: replyContent.trim() }),
    })
    if (res.ok) {
      const data = await res.json()
      setReplies((prev) => [...prev, data as Reply])
      setReplyContent('')
      await handleStatusChange('closed')
    }
    setReplyLoading(false)
  }

  // 답변 수정
  const handleReplyEditSave = async (replyId: string) => {
    if (!replyEditContent.trim()) return
    const res = await fetch(`${apiBase}/replies/${replyId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: replyEditContent.trim() }),
    })
    if (res.ok) {
      const data = await res.json()
      setReplies((prev) => prev.map((r) => r.id === replyId ? data as Reply : r))
    }
    setReplyEditId(null)
  }

  // 답변 삭제
  const handleReplyDelete = async (replyId: string) => {
    if (!confirm('답변을 삭제하시겠습니까?')) return
    const res = await fetch(`${apiBase}/replies/${replyId}`, { method: 'DELETE' })
    if (res.ok) {
      setReplies((prev) => prev.filter((r) => r.id !== replyId))
      if (replies.length === 1) await handleStatusChange('open')
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="text-base font-semibold text-gray-900">문의 상세</h1>
      </div>

      {/* Inquiry Card */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="p-5">
          {/* Meta */}
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${CATEGORY_COLORS[inquiry.category] ?? 'bg-gray-100 text-gray-600'}`}>
              {inquiry.category}
            </span>
            {!inquiry.is_public && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
                비공개
              </span>
            )}
            <span className={`ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              inquiry.status === 'closed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
            }`}>
              {inquiry.status === 'closed' ? '답변완료' : '답변대기'}
            </span>
          </div>

          {/* Title & Content */}
          {editing ? (
            <div className="space-y-3">
              <input
                type="text"
                value={editForm.title}
                onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <textarea
                value={editForm.content}
                onChange={(e) => setEditForm((f) => ({ ...f, content: e.target.value }))}
                rows={6}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleEditSave}
                  disabled={editLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {editLoading ? '저장 중...' : '저장'}
                </button>
                <button
                  onClick={() => { setEditing(false); setEditForm({ title: inquiry.title, content: inquiry.content }) }}
                  className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-base font-semibold text-gray-900 mb-3">{inquiry.title}</h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{inquiry.content}</p>
            </>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              {isAdmin || isOwner ? (inquiry.author?.name ?? '알 수 없음') : maskName(inquiry.author?.name)} · {formatDate(inquiry.created_at)}
            </p>
            <div className="flex items-center gap-2">
              {isAdmin && !editing && (
                <select
                  value={inquiry.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="open">답변대기</option>
                  <option value="in_progress">처리중</option>
                  <option value="closed">답변완료</option>
                </select>
              )}
              {canEdit && !editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                >
                  수정
                </button>
              )}
              {(isOwner || isAdmin) && !editing && (
                <button
                  onClick={handleDelete}
                  className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                >
                  삭제
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Reply Section */}
      <div className="mt-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs text-gray-400 font-medium">답변</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        {replies.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
            <p className="text-sm text-gray-400">아직 답변이 등록되지 않았습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {replies.map((reply) => (
              <div key={reply.id} className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                {replyEditId === reply.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={replyEditContent}
                      onChange={(e) => setReplyEditContent(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReplyEditSave(reply.id)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        저장
                      </button>
                      <button
                        onClick={() => setReplyEditId(null)}
                        className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-white transition-colors"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{reply.content}</p>
                    <div className="flex items-center justify-between mt-3">
                      <p className="text-xs text-blue-500 font-medium">
                        {reply.admin?.name ?? '관리자'} · {formatDate(reply.created_at)}
                      </p>
                      {isAdmin && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => { setReplyEditId(reply.id); setReplyEditContent(reply.content) }}
                            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-blue-100 transition-colors"
                          >
                            수정
                          </button>
                          <button
                            onClick={() => handleReplyDelete(reply.id)}
                            className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                          >
                            삭제
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {isAdmin && (
          <div className="mt-3 bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs font-medium text-gray-500 mb-2">답변 {replies.length > 0 ? '추가' : '등록'}</p>
            <textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="답변 내용을 입력하세요"
              rows={4}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <button
              onClick={handleReplySubmit}
              disabled={replyLoading || !replyContent.trim()}
              className="mt-2 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
            >
              {replyLoading ? '등록 중...' : '답변 등록'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
