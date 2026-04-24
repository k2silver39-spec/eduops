import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

async function getAuthContext(reportId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const [{ data: profile }, { data: report }] = await Promise.all([
    admin.from('profiles').select('role, organization, agency_type').eq('id', user.id).single(),
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

  // 주간보고 제출 시 캘린더 일정 생성/갱신
  if ((body.status === 'submitted' || body.status === 'resubmitted') && data && (data as { type?: string }).type === 'weekly') {
    const rep = data as {
      type: string; period_start: string
      content: { activity_rows?: { current_week: string; next_week: string }[] } | null
    }
    const refYear = parseInt(rep.period_start.split('-')[0])
    const agencyType = (profile as { agency_type?: string } | null)?.agency_type ?? ''

    // 기존 이벤트 삭제 후 재생성 (재제출 시 내용 갱신 반영)
    await admin.from('events').delete().eq('source', 'report').eq('source_id', id)

    const LABELS = ['직무교육', '대외협력 및 홍보', '기타']
    const activityRows = rep.content?.activity_rows ?? []
    const datedEvents: { date: string; title: string }[] = []

    function extractDated(text: string, label: string): void {
      if (!text?.trim()) return
      // 줄바꿈 및 한국어 불릿·쉼표로 분리
      const lines = text.split(/[\n·•]/).map(s => s.trim()).filter(Boolean)

      for (const raw of lines) {
        let dateStr: string | null = null
        let matchIdx = 0
        let matchLen = 0
        let m: RegExpMatchArray | null

        // YYYY-MM-DD
        m = raw.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
        if (m) {
          dateStr = `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`
          matchIdx = m.index ?? 0; matchLen = m[0].length
        }

        // M월 D일
        if (!dateStr) {
          m = raw.match(/(\d{1,2})월\s*(\d{1,2})일/)
          if (m) {
            dateStr = `${refYear}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`
            matchIdx = m.index ?? 0; matchLen = m[0].length
          }
        }

        // M/D(요일) 또는 M/D — 괄호 안 요일은 매치에 포함
        if (!dateStr) {
          m = raw.match(/(\d{1,2})\/(\d{1,2})(?:\([가-힣]+\))?/)
          if (m) {
            const mon = parseInt(m[1]), day = parseInt(m[2])
            if (mon >= 1 && mon <= 12 && day >= 1 && day <= 31) {
              dateStr = `${refYear}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`
              matchIdx = m.index ?? 0; matchLen = m[0].length
            }
          }
        }

        // M.D. 또는 M. D. (점 사이 공백 허용, 예: 4.23. / 4. 23.)
        if (!dateStr) {
          m = raw.match(/(\d{1,2})\.\s*(\d{1,2})\.?/)
          if (m) {
            const mon = parseInt(m[1]), day = parseInt(m[2])
            if (mon >= 1 && mon <= 12 && day >= 1 && day <= 31) {
              dateStr = `${refYear}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`
              matchIdx = m.index ?? 0; matchLen = m[0].length
            }
          }
        }

        // M-D (연도 없이 하이픈, 예: 4-23)
        if (!dateStr) {
          m = raw.match(/(?<!\d)(\d{1,2})-(\d{1,2})(?!\d)/)
          if (m) {
            const mon = parseInt(m[1]), day = parseInt(m[2])
            if (mon >= 1 && mon <= 12 && day >= 1 && day <= 31) {
              dateStr = `${refYear}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`
              matchIdx = m.index ?? 0; matchLen = m[0].length
            }
          }
        }

        if (!dateStr) continue

        // 날짜 앞뒤 텍스트 추출
        const beforeRaw = raw.slice(0, matchIdx)
        const afterRaw  = raw.slice(matchIdx + matchLen)

        // 뒤쪽: 닫는 괄호·공백·구분자 제거
        const cleanAfter  = afterRaw.replace(/^[\s\)\]\.,~]+/, '').trim()
        // 앞쪽: 열린 괄호·공백·~·구분자 제거
        const cleanBefore = beforeRaw.replace(/[\s\(\[~\-:]+$/, '').trim()

        // 제목 결정: 뒤에 의미 있는 텍스트가 있으면 뒤, 없으면 앞 사용
        // (%·단위 기호로 시작하면 수치이므로 제외)
        let title = ''
        if (cleanAfter && !/^[%℃㎞㎡㎏]/.test(cleanAfter)) {
          title = cleanAfter
        } else if (cleanBefore) {
          title = cleanBefore
        }

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
          organization: profile?.organization ?? '',
          agency_type:  agencyType,
          title:        ev.title,
          description:  '',
          start_at:     `${ev.date}T00:00:00.000Z`,
          end_at:       `${ev.date}T14:59:59.000Z`,
          is_allday:    true,
          color:        'gray' as const,
          source:       'report',
          source_id:    id,
          is_public:    false,
        }))
      )
    }
  }

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
