import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

interface Attachment {
  id: string
  entity_type: 'inquiry' | 'report'
  entity_id: string
  storage_path: string
  filename: string
}

async function checkAttachmentAccess(
  attachment: Attachment,
  userId: string,
  admin: ReturnType<typeof createAdminClient>
): Promise<{ canRead: boolean; canDelete: boolean }> {
  const { data: profile } = await admin
    .from('profiles')
    .select('role, organization')
    .eq('id', userId)
    .single()

  if (profile?.role === 'super_admin') return { canRead: true, canDelete: true }

  if (attachment.entity_type === 'inquiry') {
    const { data: inquiry } = await admin
      .from('inquiries')
      .select('user_id, organization, is_public')
      .eq('id', attachment.entity_id)
      .single()
    if (!inquiry) return { canRead: false, canDelete: false }

    const isOwner = inquiry.user_id === userId
    const sameOrgPublic = inquiry.is_public === true && inquiry.organization === profile?.organization
    return { canRead: isOwner || sameOrgPublic, canDelete: isOwner }
  }

  if (attachment.entity_type === 'report') {
    const { data: report } = await admin
      .from('reports')
      .select('user_id, organization, status')
      .eq('id', attachment.entity_id)
      .single()
    if (!report) return { canRead: false, canDelete: false }

    const isOwner = report.user_id === userId
    const isSameOrg = report.organization === profile?.organization
    const isSubmitted = ['submitted', 'approved', 'revision_requested', 'resubmitted', 'revision_approved'].includes(report.status)
    return { canRead: isOwner || (isSameOrg && isSubmitted), canDelete: isOwner }
  }

  return { canRead: false, canDelete: false }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: attachment } = await admin.from('attachments').select('*').eq('id', id).single()
  if (!attachment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const access = await checkAttachmentAccess(attachment as Attachment, user.id, admin)
  if (!access.canRead) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data } = await admin.storage.from('attachments').createSignedUrl(attachment.storage_path, 60)
  if (!data?.signedUrl) return NextResponse.json({ error: 'URL 생성 실패' }, { status: 500 })

  return NextResponse.redirect(data.signedUrl)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: attachment } = await admin.from('attachments').select('*').eq('id', id).single()
  if (!attachment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const access = await checkAttachmentAccess(attachment as Attachment, user.id, admin)
  if (!access.canDelete) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await admin.storage.from('attachments').remove([attachment.storage_path])
  await admin.from('attachments').delete().eq('id', id)

  return NextResponse.json({ success: true })
}
