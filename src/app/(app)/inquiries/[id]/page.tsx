import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import InquiryDetail from './InquiryDetail'

export default async function InquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const admin = createAdminClient()

  const [{ data: inquiry }, { data: profile }] = await Promise.all([
    admin
      .from('inquiries')
      .select('*, author:profiles!user_id(name)')
      .eq('id', id)
      .single(),
    admin
      .from('profiles')
      .select('role, organization')
      .eq('id', user.id)
      .single(),
  ])

  if (!inquiry) notFound()

  const isAdmin = profile?.role === 'super_admin'
  const isOwner = inquiry.user_id === user.id
  const isSameOrg = profile?.organization === inquiry.organization

  // 접근 권한 체크: 비공개 글은 본인/관리자만
  if (!isAdmin && !isOwner && !inquiry.is_public) notFound()

  const [{ data: replies }, { data: attachments }] = await Promise.all([
    admin
      .from('inquiry_replies')
      .select('*, admin:profiles!admin_id(name)')
      .eq('inquiry_id', id)
      .order('created_at', { ascending: true }),
    admin
      .from('attachments')
      .select('id, filename, size, created_at')
      .eq('entity_type', 'inquiry')
      .eq('entity_id', id)
      .order('created_at', { ascending: true }),
  ])

  return (
    <InquiryDetail
      inquiry={inquiry}
      replies={replies ?? []}
      attachments={attachments ?? []}
      currentUserId={user.id}
      isAdmin={isAdmin}
    />
  )
}
