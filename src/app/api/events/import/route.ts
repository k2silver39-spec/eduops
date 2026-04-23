import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import pdfParse from 'pdf-parse'

interface ExtractedEvent {
  title: string
  start_at: string
  end_at: string
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

  // Storage에 임시 저장
  const safeName  = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${user.id}/${Date.now()}_${safeName}`
  const buffer = Buffer.from(await file.arrayBuffer())

  await admin.storage.from('calendar-imports').upload(storagePath, buffer, {
    contentType: file.type || 'application/octet-stream',
  })

  try {
    // 텍스트 추출
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

    // 텍스트가 너무 길면 앞 12000자만 사용
    const truncated = text.slice(0, 12000)
    const refYear = year ?? String(new Date().getFullYear())

    const prompt = `다음 문서에서 날짜와 관련된 모든 일정을 추출하세요.
기준 연도: ${refYear}

[추출 규칙]
1. HTML 표(<table>)가 있으면 각 행(<tr>)을 한 건의 일정으로, 헤더(<th>/<td>)로 컬럼 의미 매칭.
2. 같은 행의 날짜·제목·설명은 반드시 같은 일정으로 연관. 표 경계 넘지 않음.
3. 표 없어도 같은 단락/불릿 내 날짜+제목은 한 일정으로 묶음.
4. 다양한 날짜 표기(1월 5일, 2026-01-05, 1/5(수))를 ISO8601로 정규화. 연도 누락 시 기준 연도 사용.
5. 범위 날짜(1월 5일~1월 7일)는 start_at/end_at 각각 채우고 is_allday:true.
6. 시간 미명시 → is_allday:true. 시간 명시 → is_allday:false + ISO8601에 시각 포함.
7. 같은 제목이 여러 날짜에 흩어진 경우 각각 별도 이벤트로 추출.
8. description에 같은 행/문단의 장소·대상·비고를 간결히 합침.

[반환 형식]
JSON 객체만 반환. 다른 텍스트 금지.
{"events":[{"title":"string","start_at":"ISO8601","end_at":"ISO8601","is_allday":boolean,"description":"string"}]}

문서:
${truncated}`

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: '당신은 공공기관 공문/일정표에서 일정 정보를 구조적으로 추출하는 어시스턴트입니다. 표의 행·열 의미를 해석하고, 흩어진 정보를 연결해 JSON 객체만 반환하세요.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    })

    if (!aiRes.ok) {
      return NextResponse.json({ error: 'AI 처리 중 오류가 발생했습니다.' }, { status: 500 })
    }

    const aiData = await aiRes.json()
    const raw = aiData.choices[0].message.content

    let events: ExtractedEvent[] = []
    try {
      const parsed = JSON.parse(raw)
      // AI가 배열을 감싸는 경우 대응
      events = Array.isArray(parsed) ? parsed : (parsed.events ?? parsed.data ?? [])
    } catch {
      return NextResponse.json({ error: '일정 파싱에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ events })
  } finally {
    // 성공/실패 무관하게 임시 파일 삭제
    await admin.storage.from('calendar-imports').remove([storagePath])
  }
}
