import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

async function getAuthContext(reportId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const [{ data: profile }, { data: report }] = await Promise.all([
    admin.from('profiles').select('role, organization').eq('id', user.id).single(),
    admin.from('reports').select('*, author:profiles!user_id(name)').eq('id', reportId).single(),
  ])

  return { user, profile, report, admin }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getAuthContext(id)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { user, profile, report } = ctx
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isAdmin = profile?.role === 'super_admin'
  const isOwner = report.user_id === user.id
  const isSameOrg = profile?.organization === report.organization
  const isSubmitted = ['submitted', 'approved', 'revision_requested', 'resubmitted', 'revision_approved'].includes(report.status)

  if (!isAdmin && !isOwner && !(isSameOrg && isSubmitted)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json(report)
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getAuthContext(id)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { user, report, admin } = ctx
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (report.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (report.status !== 'draft') {
    return NextResponse.json({ error: '임시저장 상태의 보고서만 삭제할 수 있습니다.' }, { status: 403 })
  }

  // 첨부파일 스토리지 + DB 삭제
  const { data: atts } = await admin
    .from('attachments').select('storage_path')
    .eq('entity_type', 'report').eq('entity_id', id)
  if (atts && atts.length > 0) {
    await admin.storage.from('attachments').remove(atts.map((a: { storage_path: string }) => a.storage_path))
    await admin.from('attachments').delete().eq('entity_type', 'report').eq('entity_id', id)
  }

  const { error } = await admin.from('reports').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getAuthContext(id)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { user, profile, report, admin } = ctx
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isAdmin = profile?.role === 'super_admin'
  const isOwner = report.user_id === user.id

  if (!isAdmin && !isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.content !== undefined) updates.content = body.content
  if (body.revision_reason !== undefined) updates.revision_reason = body.revision_reason

  if (body.status !== undefined) {
    updates.status = body.status
    if (body.status === 'submitted' || body.status === 'resubmitted') {
      updates.submitted_at = new Date().toISOString()
    }
  }

  const { data, error } = await admin
    .from('reports')
    .update(updates)
    .eq('id', id)
    .select('*, author:profiles!user_id(name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 첨부파일 삭제
  const removeIds: string[] = Array.isArray(body.removeAttachmentIds) ? body.removeAttachmentIds : []
  if (removeIds.length > 0) {
    const { data: toRemove } = await admin
      .from('attachments').select('storage_path').in('id', removeIds)
    if (toRemove && toRemove.length > 0) {
      await admin.storage.from('attachments').remove(toRemove.map((a: { storage_path: string }) => a.storage_path))
    }
    await admin.from('attachments').delete().in('id', removeIds)
  }

  // 첨부파일 추가
  const addFiles: { path: string; filename: string; size: number }[] =
    Array.isArray(body.addAttachments) ? body.addAttachments : []
  if (addFiles.length > 0) {
    await admin.from('attachments').insert(
      addFiles.map((a) => ({
        entity_type: 'report',
        entity_id: id,
        filename: a.filename,
        storage_path: a.path,
        size: a.size,
      }))
    )
  }

  return NextResponse.json(data)
}
