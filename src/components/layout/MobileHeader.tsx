'use client'

import { usePathname } from 'next/navigation'

const pageTitles: Record<string, string> = {
  '/': '홈',
  '/ai-qa': 'AI 질의응답',
  '/inquiries': '문의 게시판',
  '/reports': '업무보고',
  '/mypage': '내 정보',
  '/admin': '관리자',
}

function getTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname]
  for (const [key, value] of Object.entries(pageTitles)) {
    if (key !== '/' && pathname.startsWith(key)) return value
  }
  return '교육운영 시스템'
}

export default function MobileHeader() {
  const pathname = usePathname()
  const title = getTitle(pathname)

  return (
    <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 z-20 flex items-center px-4">
      <span className="text-sm font-semibold text-gray-900">{title}</span>
    </header>
  )
}
