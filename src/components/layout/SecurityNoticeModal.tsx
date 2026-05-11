'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'eduops_security_notice_v1_seen'

export default function SecurityNoticeModal() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY)
      if (!seen) setOpen(true)
    } catch {
      // localStorage 불가 환경 — 노출하지 않음
    }
  }, [])

  const handleClose = () => {
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString())
    } catch { /* 무시 */ }
    setOpen(false)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="security-notice-title"
    >
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 id="security-notice-title" className="text-lg font-semibold text-gray-900">
            보안 안내
          </h2>
        </div>
        <div className="space-y-3 px-6 py-5 text-sm leading-6 text-gray-700">
          <p>본 시스템은 교육운영 업무를 위한 내부 서비스입니다. 다음 사항을 반드시 준수해 주세요.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>개인정보, 비밀번호 등 민감정보를 AI 질의응답에 입력하지 마세요.</li>
            <li>업무 관련 문서/보고서 외 자료를 첨부·업로드하지 마세요.</li>
            <li>로그인 정보는 타인에게 공유하지 마세요. 의심스러운 활동 감지 시 즉시 관리자에게 문의하세요.</li>
            <li>AI 답변은 참고용이며, 실제 업무 적용 전 반드시 원문 규정을 확인하세요.</li>
            <li>모든 AI 호출 및 첨부파일 접근은 감사 로그로 기록됩니다.</li>
          </ul>
          <p className="text-xs text-gray-500">본 안내는 최초 1회 표시되며, 확인 후 다시 나타나지 않습니다.</p>
        </div>
        <div className="flex justify-end border-t border-gray-200 px-6 py-3">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            확인했습니다
          </button>
        </div>
      </div>
    </div>
  )
}
