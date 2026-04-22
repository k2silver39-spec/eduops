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
  // mammoth은 선택 의존성이므로 동적 import
  try {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value
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

    // 텍스트가 너무 길면 앞 8000자만 사용
    const truncated = text.slice(0, 8000)
    const refYear = year ?? String(new Date().getFullYear())

    const prompt = `다음 문서에서 날짜와 관련된 모든 일정을 추출하세요.
기준 연도: ${refYear}
반드시 JSON 배열만 반환하세요. 다른 텍스트는 포함하지 마세요.
형식: [{"title":"string","start_at":"ISO8601","end_at":"ISO8601","is_allday":boolean,"description":"string"}]
날짜가 모호하면 is_allday: true로 처리하세요.
종료일이 없으면 시작일과 동일하게 설정하세요.

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
          { role: 'system', content: '당신은 문서에서 일정 정보를 추출하는 어시스턴트입니다. JSON만 반환하세요.' },
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
