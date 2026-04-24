import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import pdfParse from 'pdf-parse'

export interface ExtractedEvent {
  course_name: string
  session: string
  title: string
  start_at: string
  end_at: string
  duration_hours: number
  participants: string
  is_allday: boolean
  description: string
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const parsed = await pdfParse(buffer)
  return parsed.text
}

async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  try {
    const mammoth = await import('mammoth')
    const result = await mammoth.convertToHtml({ buffer })
    return result.value
      .replace(/<img[^>]*>/g, '')
      .replace(/ style="[^"]*"/g, '')
      .replace(/ class="[^"]*"/g, '')
      .replace(/<p>\s*<\/p>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  } catch {
    throw new Error('DOCX 파싱 라이브러리를 불러올 수 없습니다.')
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('status')
    .eq('id', user.id)
    .single()
  if (!profile || profile.status !== 'approved') {
    return NextResponse.json({ error: 'Not approved' }, { status: 403 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const year = formData.get('year') as string | null

  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const MAX_SIZE = 20 * 1024 * 1024
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: '파일 크기는 20MB 이하여야 합니다.' }, { status: 400 })
  }

  const isPdf  = file.name.toLowerCase().endsWith('.pdf')  || file.type === 'application/pdf'
  const isDocx = file.name.toLowerCase().endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

  if (!isPdf && !isDocx) {
    return NextResponse.json({ error: 'PDF 또는 DOCX 파일만 지원합니다.' }, { status: 400 })
  }

  const safeName    = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${user.id}/${Date.now()}_${safeName}`
  const buffer      = Buffer.from(await file.arrayBuffer())

  await admin.storage.from('calendar-imports').upload(storagePath, buffer, {
    contentType: file.type || 'application/octet-stream',
  })

  try {
    let text = ''
    if (isPdf) {
      text = await extractTextFromPdf(buffer)
    } else {
      text = await extractTextFromDocx(buffer)
    }

    if (!text.trim()) {
      return NextResponse.json(
        { error: '문서에서 텍스트를 추출할 수 없습니다. 스캔 이미지 파일은 지원되지 않습니다.' },
        { status: 422 }
      )
    }

    const truncated = text.slice(0, 12000)
    const refYear   = year ?? String(new Date().getFullYear())

    const systemPrompt = `당신은 교육사업계획서에서 교육 일정을 추출하는 전문가입니다.
아래 문서에서 모든 교육과정의 차수별 일정을 빠짐없이 추출하세요.

기준 연도: ${refYear}

날짜 형식 규칙:
- '8.20(목)' → ${refYear}년 8월 20일
- '9.02(수)' → ${refYear}년 9월 2일
- '10.14(수)' → ${refYear}년 10월 14일
- 연도가 명시된 경우 해당 연도 사용

반드시 JSON 객체만 반환하세요. 다른 텍스트 없이.
형식:
{"events": [
  {
    "course_name": "과정명 (예: [고급 4단계] 실습과정)",
    "session": "차수 (예: 1차, 2차)",
    "title": "캘린더 제목 (예: [고급4단계] 실습과정 - 1차)",
    "start_at": "ISO 8601 (예: ${refYear}-08-20T09:00:00)",
    "end_at": "ISO 8601 (교육시간만큼 더한 값, 예: ${refYear}-08-20T12:00:00)",
    "duration_hours": 3,
    "participants": "교육인원 (예: 5~6명)",
    "is_allday": false,
    "description": "과정명 + 차수 + 교육인원 조합"
  }
]}

규칙:
1. 표의 각 행을 차수별 이벤트로 변환 (1차, 2차, 3차 등 모두 추출)
2. 교육시간이 명시된 경우 시작시간 09:00 기준으로 종료시간 계산 (3시간 → end 12:00)
3. 교육시간 미명시 시 is_allday: true, start_at/end_at 은 해당 날짜 00:00:00
4. 과정명이 표 상단에 있고 차수가 행으로 나열된 경우 각 행을 별도 이벤트로 추출
5. 날짜가 범위(~)인 경우 시작~종료 별도 지정 후 is_allday: true`

    const userPrompt = `다음 문서에서 교육 일정을 추출하세요:\n\n${truncated}`

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      }),
    })

    if (!aiRes.ok) {
      return NextResponse.json({ error: 'AI 처리 중 오류가 발생했습니다.' }, { status: 500 })
    }

    const aiData = await aiRes.json()
    const raw    = aiData.choices[0].message.content

    let events: ExtractedEvent[] = []
    try {
      const parsed = JSON.parse(raw)
      events = Array.isArray(parsed) ? parsed : (parsed.events ?? parsed.data ?? [])
    } catch {
      return NextResponse.json({ error: '일정 파싱에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ events })
  } finally {
    await admin.storage.from('calendar-imports').remove([storagePath])
  }
}
