import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })
    .replace('. ', '.').replace('.', '.')
}

const STATUS_BADGE: Record<string, string> = {
  open:        'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-blue-100 text-blue-700',
  closed:      'bg-green-100 text-green-700',
}
const STATUS_LABEL: Record<string, string> = {
  open: '답변대기', in_progress: '처리중', closed: '답변완료',
}

export default async function AdminDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()

  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  const [
    { count: openInquiries },
    { count: weeklyReports },
    { count: revisionRequests },
    { count: pendingUsers },
    { data: recentInquiries },
  ] = await Promise.all([
    admin.from('inquiries').select('id', { count: 'exact', head: true }).in('status', ['open', 'in_progress']),
    admin.from('reports').select('id', { count: 'exact', head: true })
      .gte('submitted_at', monday.toISOString()).lte('submitted_at', sunday.toISOString()),
    admin.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'revision_requested'),
    admin.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    admin.from('inquiries')
      .select('id, title, category, status, organization, created_at, author:profiles!user_id(name)')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const statCards = [
    {
      label: '미답변 문의',
      value: openInquiries ?? 0,
      color: 'bg-yellow-50 border-yellow-200',
      valueColor: 'text-yellow-700',
      href: '/admin/inquiries?status=open',
    },
    {
      label: '이번 주 보고서',
      value: weeklyReports ?? 0,
      color: 'bg-blue-50 border-blue-200',
      valueColor: 'text-blue-700',
      href: '/admin/reports',
    },
    {
      label: '수정 요청 대기',
      value: revisionRequests ?? 0,
      color: 'bg-red-50 border-red-200',
      valueColor: 'text-red-700',
      href: '/admin/reports?tab=revision',
    },
    {
      label: '가입 승인 대기',
      value: pendingUsers ?? 0,
      color: 'bg-purple-50 border-purple-200',
      valueColor: 'text-purple-700',
      href: '/admin/users?tab=pending',
    },
  ]

  return (
    <div className="px-4 py-6 max-w-5xl mx-auto">
      <h1 className="text-lg font-semibold text-gray-900 mb-5">관리자 대시보드</h1>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {statCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className={`border rounded-xl p-4 hover:opacity-80 transition-opacity ${card.color}`}
          >
            <p className="text-xs font-medium text-gray-500 mb-2">{card.label}</p>
            <p className={`text-3xl font-bold ${card.valueColor}`}>{card.value}</p>
          </Link>
        ))}
      </div>

      {/* 최근 문의 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">최근 문의</h2>
          <Link href="/admin/inquiries" className="text-xs text-blue-600 hover:underline">전체 보기</Link>
        </div>
        {!recentInquiries || recentInquiries.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">문의가 없습니다.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentInquiries.map((q) => (
              <Link
                key={q.id}
                href={`/inquiries/${q.id}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors"
              >
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${STATUS_BADGE[q.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {STATUS_LABEL[q.status] ?? q.status}
                </span>
                <p className="text-sm text-gray-800 flex-1 truncate">{q.title}</p>
                <span className="text-xs text-gray-400 flex-shrink-0">{q.organization}</span>
                <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(q.created_at)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
