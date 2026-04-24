import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import pdfParse from 'pdf-parse'

export interface ExtractedEvent {
  course_name: string
  session: string
  title: string
  date_label: string
  day_of_week: string
  start_at: string
  end_at: string
  duration_hours: number
  participants: string
  is_allday: boolean
  description: string
}

// ── PDF: coordinate-based table extraction ──────────────────────────────────

interface TItem { str: string; x: number; y: number }

async function tryExtractTablesFromPdf(buffer: Buffer): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = ''

  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false,
    verbosity: 0,
  }).promise

  const pageParts: string[] = []

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()

    type RawItem = { str: string; transform: number[] }
    const items: TItem[] = (content.items as RawItem[])
      .filter(i => i.str?.trim())
      .map(i => ({
        str: i.str.trim(),
        x: Math.round(i.transform[4]),
        y: Math.round(i.transform[5]),
      }))

    if (!items.length) continue

    // Sort top-to-bottom (PDF y is bottom-up, so higher y = higher on page), then left-to-right
    items.sort((a, b) => b.y - a.y || a.x - b.x)

    // Cluster into rows by y-proximity (4pt tolerance)
    const rows: TItem[][] = []
    let cur: TItem[] = []
    let baseY = items[0].y
    for (const it of items) {
      if (Math.abs(it.y - baseY) > 4) {
        if (cur.length) rows.push([...cur].sort((a, b) => a.x - b.x))
        cur = []
        baseY = it.y
      }
      cur.push(it)
    }
    if (cur.length) rows.push([...cur].sort((a, b) => a.x - b.x))

    // Detect table: ≥3 rows each with ≥3 cells
    const isTable = rows.filter(r => r.length >= 3).length >= 3

    if (isTable) {
      pageParts.push(`=== 페이지 ${p} 테이블 ===`)
      for (const row of rows) {
        if (row.length >= 2) {
          pageParts.push(row.map(i => i.str).join(' | '))
        } else {
          pageParts.push(row.map(i => i.str).join(' '))
        }
      }
    } else {
      const text = rows.map(r => r.map(i => i.str).join(' ')).join('\n')
      if (text.trim()) pageParts.push(text)
    }
  }

  return pageParts.join('\n\n')
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    const structured = await tryExtractTablesFromPdf(buffer)
    if (structured.trim()) return structured
  } catch { /* fall through to pdf-parse */ }
  const parsed = await pdfParse(buffer)
  return parsed.text
}

// ── DOCX extraction ─────────────────────────────────────────────────────────

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

// ── JSON parsing with multiple fallback strategies ───────────────────────────

function parseAiJson(raw: string): ExtractedEvent[] {
  // 1. Direct parse
  try {
    const v = JSON.parse(raw)
    if (Array.isArray(v)) return v
    if (v?.events) return v.events
    if (v?.data)   return v.data
  } catch { /* next */ }

  // 2. ```json ... ``` block
  const codeMatch = raw.match(/```json\s*([\s\S]*?)```/i)
  if (codeMatch) {
    try {
      const v = JSON.parse(codeMatch[1].trim())
      if (Array.isArray(v)) return v
      if (v?.events) return v.events
    } catch { /* next */ }
  }

  // 3. First [ to last ]
  const start = raw.indexOf('[')
  const end   = raw.lastIndexOf(']')
  if (start !== -1 && end > start) {
    try {
      const v = JSON.parse(raw.slice(start, end + 1))
      if (Array.isArray(v)) return v
    } catch { /* next */ }
  }

  throw new Error('일정 파싱에 실패했습니다.')
}

// ── Route handler ────────────────────────────────────────────────────────────

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

    const truncated = text.slice(0, 16000)
    const refYear   = year ?? String(new Date().getFullYear())

    const systemPrompt = `당신은 교육사업계획서에서 교육 일정을 추출하는 전문가입니다.

## 중요 규칙
1. 각 차수(1차, 2차, 3차...)마다 반드시 서로 다른 날짜가 있습니다.
2. 날짜가 같은 차수가 2개 이상 나오면 추출이 잘못된 것입니다.
3. 테이블의 각 행을 독립적으로 처리하세요.
4. 과정명은 테이블 바로 위에 있는 제목에서 추출하세요.

## 날짜 변환 규칙
기준 연도: ${refYear}
- '8.20(목)' → ${refYear}-08-20, 요일: 목
- '8.20.(목)' → ${refYear}-08-20, 요일: 목
- '9.2(수)' → ${refYear}-09-02, 요일: 수
- '9.02(수)' → ${refYear}-09-02, 요일: 수
- '10.14(수)' → ${refYear}-10-14, 요일: 수
- 연도가 명시된 경우 해당 연도 우선 사용

## 시작/종료 시간 규칙
- 교육시간이 명시된 경우: 시작 09:00, 종료 = 09:00 + 교육시간
  예) 3시간 → 09:00~12:00, 4시간 → 09:00~13:00
- 교육시간 미명시: is_allday = true

## 출력 형식
반드시 JSON 배열만 반환. 설명 텍스트, 마크다운 코드블록 없이 순수 JSON만.

[
  {
    "course_name": "과정명 (예: [고급 4단계] 실습과정)",
    "session": "차수 (예: 1차)",
    "title": "제목 (예: [고급4단계] 실습과정 - 1차)",
    "date_label": "원본 날짜 표기 (예: 8.20.(목))",
    "day_of_week": "요일 (예: 목)",
    "start_at": "ISO 8601 (예: ${refYear}-08-20T09:00:00)",
    "end_at": "ISO 8601 (예: ${refYear}-08-20T12:00:00)",
    "duration_hours": 3,
    "participants": "교육인원 (예: 5~6명)",
    "is_allday": false,
    "description": "과정명 차수 | 교육인원: 참가자수"
  }
]

## 검증
응답하기 전에 스스로 확인:
- 같은 course_name 내에 중복된 start_at이 없는가?
- 모든 차수에 고유한 날짜가 배정되었는가?
- 날짜가 기준 연도(${refYear})로 올바르게 변환되었는가?`

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
      events = parseAiJson(raw)
    } catch {
      return NextResponse.json({ error: '일정 파싱에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ events })
  } finally {
    await admin.storage.from('calendar-imports').remove([storagePath])
  }
}
