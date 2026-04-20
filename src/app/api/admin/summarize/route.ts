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

export async function POST(request: Request) {
  const ctx = await requireAdmin()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { admin } = ctx

  const { startDate, endDate, organization } = await request.json()
  if (!startDate || !endDate) {
    return NextResponse.json({ error: '기간을 선택해주세요.' }, { status: 400 })
  }

  let query = admin
    .from('reports')
    .select('type, period_label, content, organization, author:profiles!user_id(name)')
    .lte('period_start', endDate)
    .gte('period_end', startDate)
    .neq('status', 'draft')
    .order('period_start', { ascending: true })

  if (organization && organization !== 'all') query = query.eq('organization', organization)

  const { data: reports, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!reports || reports.length === 0) {
    return NextResponse.json({ error: '해당 기간에 제출된 보고서가 없습니다.' }, { status: 404 })
  }

  // 보고서 텍스트 포맷 (v2 content 기준)
  const KPI_LABELS = ['프로그램 개발(건)', '전문인력 양성(명)', '수료율(%)', '만족도 점수(점)', '지역확산(건)', '홍보(건)']
  const ACTIVITY_LABELS = ['직무교육', '대외협력 및 홍보', '기타']

  const formatted = reports.map((r) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = r.content as any
    const typeLbl = r.type === 'weekly' ? '주간' : '월간'
    const author = (r.author as unknown as { name: string } | null)?.name ?? '알 수 없음'
    let body = ''

    if (c?.version === 2) {
      if (r.type === 'weekly') {
        const kpiLines = KPI_LABELS.map((label, i) => {
          const row = c.kpi_rows?.[i] ?? {}
          return `${label}: 목표 ${row.target || '-'}, 실적 ${row.actual || '-'}`
        }).join(' / ')
        const actLines = ACTIVITY_LABELS.map((label, i) => {
          const row = c.activity_rows?.[i] ?? {}
          return `[${label}] 이번주: ${row.current_week || '-'} / 다음주: ${row.next_week || '-'}`
        }).join('\n')
        body = `성과지표: ${kpiLines}\n${actLines}`
      } else {
        const kpiLines = KPI_LABELS.map((label, i) => {
          const row = c.kpi_rows?.[i] ?? {}
          return `${label}: 목표 ${row.target || '-'}, 실적 ${row.actual || '-'}`
        }).join(' / ')
        const qual = c.qualitative ?? {}
        body = `성과지표: ${kpiLines}\n정성목표: ${qual.target || '-'}\n정성실적: ${qual.actual || '-'} (달성률 ${qual.rate || '-'})\n향후계획: ${c.achievement_plan || '-'}`
      }
    } else {
      // 구버전 fallback
      if (r.type === 'weekly') {
        body = `완료업무: ${c?.completed || '-'}\n다음주계획: ${c?.next_plan || '-'}`
      } else {
        body = `주요성과: ${c?.achievements || '-'}\n다음달목표: ${c?.next_month_plan || '-'}`
      }
    }
    return `[${typeLbl}보고 | ${r.period_label} | ${author} / ${r.organization}]\n${body}`
  }).join('\n\n---\n\n')

  const prompt = `다음은 ${startDate}~${endDate} 기간의 업무보고입니다.\n\n${formatted}\n\n위 내용을 분석해 아래 JSON 형식으로 응답하세요. 반드시 JSON만 반환:\n{\n  "overall": "전체 종합 요약 (200자 내외)",\n  "individuals": [\n    {\n      "name": "이름",\n      "organization": "소속",\n      "completed": "주요 실적 및 완료 업무 핵심 요약",\n      "issues": "이슈/건의사항 (없으면 빈 문자열)"\n    }\n  ]\n}`

  const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: '업무보고서를 요약하는 보조자입니다. JSON만 반환하세요.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    }),
  })

  if (!aiRes.ok) return NextResponse.json({ error: 'AI 요약 요청 실패' }, { status: 500 })

  const aiData = await aiRes.json()
  const result = JSON.parse(aiData.choices[0].message.content)
  return NextResponse.json(result)
}
