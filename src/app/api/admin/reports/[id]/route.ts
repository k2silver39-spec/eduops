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

  // 첨부파일 스토리지 + DB 삭제
  const { data: atts } = await admin
    .from('attachments').select('storage_path')
    .eq('entity_type', 'report').eq('entity_id', id)
  if (atts && atts.length > 0) {
    await admin.storage.from('attachments').remove(atts.map((a: { storage_path: string }) => a.storage_path))
    await admin.from('attachments').delete().eq('entity_type', 'report').eq('entity_id', id)
  }

  // 승인 시 생성된 캘린더 이벤트 삭제
  await admin.from('events').delete().eq('source', 'report').eq('source_id', id)

  const { error } = await admin.from('reports').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

const ACTIVITY_LABELS = ['직무교육', '대외협력 및 홍보', '기타']

function extractDatedItems(
  text: string,
  label: string,
  refYear: number,
): { date: string; title: string }[] {
  if (!text?.trim()) return []
  const results: { date: string; title: string }[] = []
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean)

  for (const line of lines) {
    let dateStr: string | null = null
    let afterDate = ''

    let m = line.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
    if (m) {
      dateStr = `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`
      afterDate = line.slice((m.index ?? 0) + m[0].length)
    } else {
      m = line.match(/(\d{1,2})월\s*(\d{1,2})일/)
      if (m) {
        dateStr = `${refYear}-${String(m[1]).padStart(2,'0')}-${String(m[2]).padStart(2,'0')}`
        afterDate = line.slice((m.index ?? 0) + m[0].length)
      } else {
        m = line.match(/(\d{1,2})\/(\d{1,2})(?:\([가-힣]\))?/)
        if (m) {
          dateStr = `${refYear}-${String(m[1]).padStart(2,'0')}-${String(m[2]).padStart(2,'0')}`
          afterDate = line.slice((m.index ?? 0) + m[0].length)
        }
      }
    }

    if (!dateStr) continue
    const title = afterDate.trim().replace(/^[\s\-:·。]+/, '').trim()
    if (!title) continue
    results.push({ date: dateStr, title: `[${label}] ${title}` })
  }

  return results
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
      content: { activity_rows?: { current_week: string; next_week: string; note: string }[] } | null
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
      const agencyType = (report.author as { agency_type: string } | null)?.agency_type ?? ''
      const refYear    = parseInt(report.period_start.split('-')[0])

      const commonFields = {
        user_id:      report.user_id,
        organization: report.organization,
        agency_type:  agencyType,
        description:  '',
        is_allday:    true,
        color:        'gray' as const,
        source:       'report',
        source_id:    report.id,
        is_public:    false,
      }

      if (report.type === 'weekly') {
        const activityRows = report.content?.activity_rows ?? []
        const datedEvents: { date: string; title: string }[] = []

        for (let i = 0; i < activityRows.length; i++) {
          const label = ACTIVITY_LABELS[i] ?? `활동${i + 1}`
          const row = activityRows[i]
          datedEvents.push(...extractDatedItems(row.current_week, label, refYear))
          datedEvents.push(...extractDatedItems(row.next_week, label, refYear))
        }

        if (datedEvents.length > 0) {
          await admin.from('events').insert(
            datedEvents.map(ev => ({
              ...commonFields,
              title:    ev.title,
              start_at: `${ev.date}T00:00:00.000Z`,
              end_at:   `${ev.date}T14:59:59.000Z`,
            }))
          )
        } else {
          await admin.from('events').insert({
            ...commonFields,
            title:    `${authorName} - 주간보고 (${report.period_label})`,
            start_at: `${report.period_start}T00:00:00.000Z`,
            end_at:   `${report.period_end}T14:59:59.000Z`,
          })
        }
      } else {
        await admin.from('events').insert({
          ...commonFields,
          title:    `${authorName} - 월간보고 (${report.period_label})`,
          start_at: `${report.period_start}T00:00:00.000Z`,
          end_at:   `${report.period_end}T14:59:59.000Z`,
        })
      }
    }
  }

  return NextResponse.json(data)
}
