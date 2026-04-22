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

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireAdmin()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { admin } = ctx

  const { data, error } = await admin
    .from('reports')
    .select('id, type, period_label, content, organization, author:profiles!user_id(name)')
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireAdmin()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { admin } = ctx

  const { data: report } = await admin.from('reports').select('status').eq('id', id).single()
  if (report?.status === 'approved') {
    return NextResponse.json({ error: '승인된 보고서는 삭제할 수 없습니다.' }, { status: 403 })
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
  const ctx = await requireAdmin()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { admin } = ctx

  const body = await request.json()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.status !== undefined) updates.status = body.status
  if (body.revision_comment !== undefined) updates.revision_comment = body.revision_comment
  if (body.status === 'approved') updates.approved_at = new Date().toISOString()

  const { data, error } = await admin
    .from('reports')
    .update(updates)
    .eq('id', id)
    .select('*, author:profiles!user_id(name, agency_type)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 승인 시 캘린더 일정 자동 생성
  if (body.status === 'approved' && data) {
    const report = data as {
      id: string
      user_id: string
      organization: string
      type: string
      period_label: string
      period_start: string
      period_end: string
      author: { name: string; agency_type: string } | null
    }

    // 중복 방지: 이미 같은 source_id 일정이 있으면 스킵
    const { count } = await admin
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('source', 'report')
      .eq('source_id', report.id)

    if ((count ?? 0) === 0) {
      const authorName = (report.author as { name: string } | null)?.name ?? '작성자'
      const typeLabel  = report.type === 'weekly' ? '주간' : '월간'
      const agencyType = (report.author as { agency_type: string } | null)?.agency_type ?? ''

      await admin.from('events').insert({
        user_id:      report.user_id,
        organization: report.organization,
        agency_type:  agencyType,
        title:        `${authorName} - ${typeLabel}보고 (${report.period_label})`,
        description:  '',
        start_at:     `${report.period_start}T00:00:00.000Z`,
        end_at:       `${report.period_end}T23:59:59.000Z`,
        is_allday:    true,
        color:        'gray',
        source:       'report',
        source_id:    report.id,
        is_public:    false,
      })
    }
  }

  return NextResponse.json(data)
}
