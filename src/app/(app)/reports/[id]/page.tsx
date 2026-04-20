import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import ReportDetail from './ReportDetail'

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const admin = createAdminClient()
  const [{ data: report }, { data: profile }, { data: attachments }] = await Promise.all([
    admin
      .from('reports')
      .select('*, author:profiles!user_id(name)')
      .eq('id', id)
      .single(),
    admin
      .from('profiles')
      .select('role, organization')
      .eq('id', user.id)
      .single(),
    admin
      .from('attachments')
      .select('id, filename, size, created_at')
      .eq('entity_type', 'report')
      .eq('entity_id', id)
      .order('created_at', { ascending: true }),
  ])

  if (!report) notFound()

  const isAdmin = profile?.role === 'super_admin'
  const isOwner = report.user_id === user.id
  const isSameOrg = profile?.organization === report.organization
  // draft 포함 — 같은 기관이면 임시저장 문서도 열람 가능
  if (!isAdmin && !isOwner && !isSameOrg) notFound()

  return (
    <ReportDetail
      report={report}
      attachments={attachments ?? []}
      currentUserId={user.id}
      isAdmin={isAdmin}
    />
  )
}
