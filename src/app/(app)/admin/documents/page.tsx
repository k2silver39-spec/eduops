'use client'

import { useEffect, useState, useRef } from 'react'

interface Document {
  id: string
  filename: string
  status: string
  chunk_count: number
  created_at: string
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  processing: { label: '처리 중', cls: 'bg-yellow-100 text-yellow-700' },
  ready:      { label: '준비 완료', cls: 'bg-green-100 text-green-700' },
  error:      { label: '오류', cls: 'bg-red-100 text-red-600' },
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
    .replace(/\. /g, '.').replace(/\.$/, '')
}

interface UploadItem {
  name: string
  status: 'uploading' | 'embedding' | 'done' | 'error'
  error?: string
}

export default function AdminDocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [reembedding, setReembedding] = useState(false)
  const [reembedProgress, setReembedProgress] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchDocs = async () => {
    const res = await fetch('/api/admin/documents')
    const data = await res.json()
    setDocuments(data)
    setLoading(false)
  }

  useEffect(() => { fetchDocs() }, [])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    e.target.value = ''

    const initialUploads: UploadItem[] = files.map(f => ({ name: f.name, status: 'uploading' }))
    setUploads(initialUploads)

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      try {
        // 1) 업로드
        const formData = new FormData()
        formData.append('file', file)
        const uploadRes = await fetch('/api/admin/documents', { method: 'POST', body: formData })
        if (!uploadRes.ok) throw new Error('업로드 실패')
        const doc = await uploadRes.json()

        // 2) 임베딩
        setUploads(prev => prev.map((u, idx) => idx === i ? { ...u, status: 'embedding' } : u))
        const embedRes = await fetch('/api/admin/embed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: doc.id }),
        })
        if (!embedRes.ok) throw new Error('임베딩 실패')

        setUploads(prev => prev.map((u, idx) => idx === i ? { ...u, status: 'done' } : u))
      } catch (err) {
        setUploads(prev => prev.map((u, idx) => idx === i ? { ...u, status: 'error', error: String(err) } : u))
      }
    }

    await fetchDocs()
    setTimeout(() => setUploads([]), 3000)
  }

  const handleReembedAll = async () => {
    const targets = documents.filter(d => d.status === 'ready' || d.status === 'error')
    if (targets.length === 0) return
    setReembedding(true)
    for (let i = 0; i < targets.length; i++) {
      const doc = targets[i]
      setReembedProgress(`(${i + 1}/${targets.length}) ${doc.filename} 처리 중...`)
      await fetch('/api/admin/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: doc.id }),
      })
    }
    setReembedProgress('전체 재임베딩 완료!')
    await fetchDocs()
    setReembedding(false)
    setTimeout(() => setReembedProgress(''), 3000)
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleteLoading(true)
    await fetch(`/api/admin/documents/${deleteId}`, { method: 'DELETE' })
    setDeleteId(null)
    setDeleteLoading(false)
    fetchDocs()
  }

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-semibold text-gray-900">RAG 문서 관리</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReembedAll}
            disabled={reembedding || documents.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {reembedding ? (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            )}
            전체 재임베딩
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
            PDF 업로드
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* 재임베딩 진행 상태 */}
      {reembedProgress && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
          {reembedding && (
            <svg className="animate-spin w-4 h-4 text-purple-600 flex-shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          )}
          <p className="text-sm text-purple-700">{reembedProgress}</p>
        </div>
      )}

      {/* 업로드 진행 상태 */}
      {uploads.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 space-y-2">
          <p className="text-xs font-semibold text-gray-500 mb-3">업로드 진행 중</p>
          {uploads.map((u, i) => (
            <div key={i} className="flex items-center gap-3">
              {u.status === 'uploading' || u.status === 'embedding' ? (
                <svg className="animate-spin w-4 h-4 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              ) : u.status === 'done' ? (
                <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              )}
              <span className="text-sm text-gray-700 truncate flex-1">{u.name}</span>
              <span className="text-xs text-gray-400 flex-shrink-0">
                {u.status === 'uploading' ? '업로드 중...'
                  : u.status === 'embedding' ? '임베딩 처리 중...'
                  : u.status === 'done' ? '완료'
                  : `오류: ${u.error}`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 문서 목록 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">파일명</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">업로드일</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">청크 수</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">상태</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">불러오는 중...</td></tr>
              ) : documents.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">등록된 문서가 없습니다.</td></tr>
              ) : documents.map((doc) => {
                const cfg = STATUS_CONFIG[doc.status] ?? { label: doc.status, cls: 'bg-gray-100 text-gray-600' }
                return (
                  <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-900 font-medium">{doc.filename}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(doc.created_at)}</td>
                    <td className="px-4 py-3 text-gray-600">{doc.chunk_count > 0 ? doc.chunk_count : '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setDeleteId(doc.id)}
                        className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5">
            <p className="text-sm font-medium text-gray-900 mb-2">문서를 삭제하시겠습니까?</p>
            <p className="text-xs text-gray-400 mb-5">삭제된 문서와 관련 벡터 데이터는 복구할 수 없습니다.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)} className="flex-1 border border-gray-200 text-gray-600 font-medium py-2.5 rounded-xl text-sm hover:bg-gray-50">취소</button>
              <button onClick={handleDelete} disabled={deleteLoading}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white font-medium py-2.5 rounded-xl text-sm transition-colors">
                {deleteLoading ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
