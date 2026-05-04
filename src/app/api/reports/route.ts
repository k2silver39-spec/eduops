import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyAdmins } from '@/lib/notifications/notify'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('organization, role')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })

  const [{ data: myReports }, { data: orgReports }] = await Promise.all([
    admin
      .from('reports')
      .select('id, type, period_label, period_start, period_end, status, submitted_at, created_at, updated_at')
      .eq('user_id', user.id)
      .order('period_start', { ascending: false }),
    admin
      .from('reports')
      .select('id, type, period_label, period_start, period_end, status, submitted_at, created_at, author:profiles!user_id(id, email, organization)')
      .eq('organization', profile.organization)
      .neq('user_id', user.id)
      .order('period_start', { ascending: false }),
  ])

  return NextResponse.json({
    myReports: myReports ?? [],
    orgReports: orgReports ?? [],
  })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('organization, status')
    .eq('id', user.id)
    .single()

  if (!profile || profile.status !== 'approved') {
    return NextResponse.json({ error: 'Not approved' }, { status: 403 })
  }

  const body = await request.json()
  const { type, period_label, period_start, period_end, content, status, attachments } = body

  if (!type || !period_label || !period_start || !period_end || !content || !status) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  if (!['weekly', 'monthly'].includes(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }

  if (!['draft', 'submitted'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  // 기관+유형+기간 중복 확인
  const { data: existing } = await admin
    .from('reports')
    .select('id')
    .eq('organization', profile.organization)
    .eq('type', type)
    .eq('period_start', period_start)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: '해당 기간에 이미 작성된 보고서가 있습니다. 기존 보고서를 수정해 주세요.' },
      { status: 409 }
    )
  }

  const insertData: Record<string, unknown> = {
    user_id: user.id,
    organization: profile.organization,
    type,
    period_label,
    period_start,
    period_end,
    content,
    status,
  }

  if (status === 'submitted') {
    insertData.submitted_at = new Date().toISOString()
  }

  const { data, error } = await admin
    .from('reports')
    .insert(insertData)
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (Array.isArray(attachments) && attachments.length > 0) {
    await admin.from('attachments').insert(
      attachments.map((a: { path: string; filename: string; size: number }) => ({
        entity_type: 'report',
        entity_id: data.id,
        filename: a.filename,
        storage_path: a.path,
        size: a.size,
      }))
    )
  }

  // 주간보고 최초 제출 시 캘린더 일정 생성
  if (status === 'submitted' && type === 'weekly') {
    const refYear = parseInt(period_start.split('-')[0])
    const LABELS = ['직무교육', '대외협력 및 홍보', '기타']
    const activityRows = (content as { activity_rows?: { current_week: string; next_week: string }[] }).activity_rows ?? []
    const datedEvents: { date: string; title: string }[] = []

    function extractDated(text: string, label: string): void {
      if (!text?.trim()) return
      const lines = text.split(/[\n·•]/).map((s: string) => s.trim()).filter(Boolean)
      for (const raw of lines) {
        let dateStr: string | null = null
        let matchIdx = 0; let matchLen = 0
        let m: RegExpMatchArray | null

        m = raw.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
        if (m) { dateStr = `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`; matchIdx = m.index ?? 0; matchLen = m[0].length }

        if (!dateStr) {
          m = raw.match(/(\d{1,2})월\s*(\d{1,2})일/)
          if (m) { dateStr = `${refYear}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`; matchIdx = m.index ?? 0; matchLen = m[0].length }
        }
        if (!dateStr) {
          m = raw.match(/(\d{1,2})\/(\d{1,2})(?:\([가-힣]+\))?/)
          if (m) { const mon = parseInt(m[1]), day = parseInt(m[2]); if (mon >= 1 && mon <= 12 && day >= 1 && day <= 31) { dateStr = `${refYear}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`; matchIdx = m.index ?? 0; matchLen = m[0].length } }
        }
        if (!dateStr) {
          m = raw.match(/(\d{1,2})\.\s*(\d{1,2})\.?/)
          if (m) { const mon = parseInt(m[1]), day = parseInt(m[2]); if (mon >= 1 && mon <= 12 && day >= 1 && day <= 31) { dateStr = `${refYear}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`; matchIdx = m.index ?? 0; matchLen = m[0].length } }
        }
        if (!dateStr) {
          m = raw.match(/(?<!\d)(\d{1,2})-(\d{1,2})(?!\d)/)
          if (m) { const mon = parseInt(m[1]), day = parseInt(m[2]); if (mon >= 1 && mon <= 12 && day >= 1 && day <= 31) { dateStr = `${refYear}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`; matchIdx = m.index ?? 0; matchLen = m[0].length } }
        }

        if (!dateStr) continue
        const beforeRaw = raw.slice(0, matchIdx)
        const afterRaw  = raw.slice(matchIdx + matchLen)
        const cleanAfter  = afterRaw.replace(/^[\s\)\]\.,~]+/, '').trim()
        const cleanBefore = beforeRaw.replace(/[\s\(\[~\-:]+$/, '').trim()
        let title = ''
        if (cleanAfter && !/^[%℃㎞㎡㎏]/.test(cleanAfter)) { title = cleanAfter }
        else if (cleanBefore) { title = cleanBefore }
        if (!title) continue
        datedEvents.push({ date: dateStr, title: `[${label}] ${title}` })
      }
    }

    for (let i = 0; i < activityRows.length; i++) {
      const label = LABELS[i] ?? `활동${i + 1}`
      extractDated(activityRows[i].current_week ?? '', label)
      extractDated(activityRows[i].next_week ?? '', label)
    }

    if (datedEvents.length > 0) {
      await admin.from('events').insert(
        datedEvents.map(ev => ({
          user_id:      user.id,
          organization: profile.organization,
          title:        ev.title,
          description:  '',
          start_at:     `${ev.date}T00:00:00.000Z`,
          end_at:       `${ev.date}T14:59:59.000Z`,
          is_allday:    true,
          color:        'gray' as const,
          source:       'report',
          source_id:    data.id,
          is_public:    false,
        }))
      )
    }
  }

  if (status === 'submitted') {
    const reportTypeLabel = type === 'weekly' ? '주간보고' : '월간보고'
    notifyAdmins(
      'new_report',
      '새 ' + reportTypeLabel + ' 제출: ' + period_label,
      '[' + (profile.organization ?? '') + '] ' + reportTypeLabel + ' 제출 (' + period_start + ' ~ ' + period_end + ')',
      data.id
    ).catch((err) => console.error('[notify new_report]', err))
  }

  return NextResponse.json({ id: data.id })
}
