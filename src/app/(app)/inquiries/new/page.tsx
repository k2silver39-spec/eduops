'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

const CATEGORIES = ['교육', '사업', '예산', '기타'] as const
type Category = typeof CATEGORIES[number]

interface PendingFile {
  path: string
  filename: string
  size: number
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

export default function NewInquiryPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    category: '교육' as Category,
    title: '',
    content: '',
    is_public: true,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [files, setFiles] = useState<PendingFile[]>([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    if (!selected.length) return
    e.target.value = ''
    setUploading(true)
    for (const file of selected) {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok) {
        setFiles(prev => [...prev, { path: data.path, filename: data.filename, size: data.size }])
      } else {
        setError(data.error ?? '파일 업로드 실패')
      }
    }
    setUploading(false)
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.content.trim()) return
    setLoading(true)
    setError('')

    const res = await fetch('/api/inquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title.trim(),
        content: form.content.trim(),
        category: form.category,
        is_public: form.is_public,
        attachments: files,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError('문의 등록 중 오류가 발생했습니다.')
      setLoading(false)
      return
    }

    router.push(`/inquiries/${data.id}`)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="text-base font-semibold text-gray-900">문의 작성</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Category */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-2">카테고리</label>
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setForm((f) => ({ ...f, category: cat }))}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  form.category === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">제목</label>
          <input
            type="text"
            required
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="문의 제목을 입력하세요"
            maxLength={100}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Content */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">내용</label>
          <textarea
            required
            value={form.content}
            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            placeholder="문의 내용을 자세히 입력해 주세요"
            rows={8}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>

        {/* File upload */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">첨부파일 <span className="text-gray-300 font-normal">(선택, 파일당 10MB 이하)</span></label>
          <div className="space-y-2">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
                </svg>
                <span className="text-sm text-gray-700 flex-1 truncate">{f.filename}</span>
                <span className="text-xs text-gray-400 flex-shrink-0">{formatSize(f.size)}</span>
                <button type="button" onClick={() => removeFile(i)} className="p-0.5 text-gray-400 hover:text-red-500 flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors w-full disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              {uploading ? '업로드 중...' : '파일 추가'}
            </button>
            <input ref={fileRef} type="file" multiple className="hidden" onChange={handleFileChange} />
          </div>
        </div>

        {/* Public toggle */}
        <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
          <div>
            <p className="text-sm font-medium text-gray-900">공개 문의</p>
            <p className="text-xs text-gray-400 mt-0.5">모든 구성원과 관리자가 열람할 수 있습니다</p>
          </div>
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, is_public: !f.is_public }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              form.is_public ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                form.is_public ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-3 py-2.5 rounded-xl">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || uploading || !form.title.trim() || !form.content.trim()}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 rounded-xl text-sm transition-colors"
        >
          {loading ? '등록 중...' : '문의 등록'}
        </button>
      </form>
    </div>
  )
}
