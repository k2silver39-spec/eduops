'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const CATEGORIES = ['수업', '행정', '시설', '기타'] as const
type Category = typeof CATEGORIES[number]

export default function NewInquiryPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    category: '수업' as Category,
    title: '',
    content: '',
    is_public: true,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

        {/* Public toggle */}
        <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
          <div>
            <p className="text-sm font-medium text-gray-900">공개 문의</p>
            <p className="text-xs text-gray-400 mt-0.5">같은 기관의 다른 구성원이 볼 수 있습니다</p>
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
          disabled={loading || !form.title.trim() || !form.content.trim()}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 rounded-xl text-sm transition-colors"
        >
          {loading ? '등록 중...' : '문의 등록'}
        </button>
      </form>
    </div>
  )
}
