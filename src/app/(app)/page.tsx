import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import HomeClient from './HomeClient'

interface FeatureCard {
  href: string
  label: string
  description: string
  icon: React.ReactNode
  adminOnly?: boolean
}

const featureCards: FeatureCard[] = [
  {
    href: '/notices',
    label: '공지사항',
    description: '공지 및 안내 확인',
    icon: (
      <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 1 1 0-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 0 1-1.44-4.282m3.102.069a18.03 18.03 0 0 1-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 0 1 8.835 2.535M10.34 6.66a23.847 23.847 0 0 1 8.835-2.535m0 0A23.74 23.74 0 0 1 18.795 3c1.167 0 2.31.23 3.352.645m-3.879 14.84a23.74 23.74 0 0 0 3.879.515c1.167 0 2.31-.23 3.352-.645" />
      </svg>
    ),
  },
  {
    href: '/ai-qa',
    label: 'AI 질의응답',
    description: '규정 문서 기반 AI 답변',
    icon: (
      <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
      </svg>
    ),
  },
  {
    href: '/inquiries',
    label: '문의 게시판',
    description: '문의 작성 및 확인',
    icon: (
      <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
      </svg>
    ),
  },
  {
    href: '/reports',
    label: '리포트',
    description: '주간·월간 리포트 제출',
    icon: (
      <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    ),
  },
  {
    href: '/calendar',
    label: '캘린더',
    description: '교육 일정 관리',
    icon: (
      <svg className="w-6 h-6 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
      </svg>
    ),
  },
  {
    href: '/mypage',
    label: '내 정보',
    description: '프로필 및 설정',
    icon: (
      <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
      </svg>
    ),
  },
  {
    href: '/admin',
    label: '관리자 대시보드',
    description: '회원 승인 및 시스템 관리',
    adminOnly: true,
    icon: (
      <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
    ),
  },
]

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const adminClient = createAdminClient()
  const [{ data: profile }, { data: notices }] = await Promise.all([
    adminClient
      .from('profiles')
      .select('name, organization, role')
      .eq('id', user!.id)
      .single(),
    adminClient
      .from('notices')
      .select('id, title, is_pinned, created_at')
      .eq('is_active', true)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(3),
  ])

  const isAdmin = profile?.role === 'super_admin'
  const visibleCards = featureCards.filter(c => !c.adminOnly || isAdmin)

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto md:max-w-4xl space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-lg font-semibold text-gray-900">
          안녕하세요, {profile?.name}님
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">{profile?.organization}</p>
      </div>

      {/* Notices Section */}
      {notices && notices.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-700">공지사항</h2>
            <Link href="/notices" className="text-xs text-blue-600 hover:underline">더보기</Link>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {notices.map((n) => (
              <Link
                key={n.id}
                href="/notices"
                className="flex items-center gap-2 px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                {n.is_pinned && <span className="text-orange-500 text-xs shrink-0">📌</span>}
                <span className="text-sm text-gray-800 flex-1 truncate">{n.title}</span>
                <span className="text-xs text-gray-400 shrink-0">
                  {new Date(n.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Weekly Calendar */}
      <HomeClient />

      {/* Feature Cards */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">빠른 메뉴</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {visibleCards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3 hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center">
                {card.icon}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{card.label}</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{card.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
