import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: p } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (p?.role !== 'super_admin') return null
  return { user, admin }
}

export async function GET() {
  const ctx = await requireAdmin()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { admin } = ctx

  // 이번 주 월~일
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
      .gte('submitted_at', monday.toISOString())
      .lte('submitted_at', sunday.toISOString()),
    admin.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'revision_requested'),
    admin.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    admin.from('inquiries')
      .select('id, title, category, status, organization, created_at, author:profiles!user_id(name)')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  return NextResponse.json({
    openInquiries: openInquiries ?? 0,
    weeklyReports: weeklyReports ?? 0,
    revisionRequests: revisionRequests ?? 0,
    pendingUsers: pendingUsers ?? 0,
    recentInquiries: recentInquiries ?? [],
  })
}
