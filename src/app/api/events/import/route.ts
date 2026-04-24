import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import pdfParse from 'pdf-parse'

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface ExtractedEvent {
  course_name: string
  session: string
  title: string
  date_label: string      // e.g. '8/20(목)'
  start_at: string        // ISO 8601
  end_at: string
  duration_hours: number | null
  participants: string
  is_allday: boolean
  description: string
}

interface TItem { str: string; x: number; y: number }

interface ParsedDate {
  iso: string    // YYYY-MM-DD
  label: string  // M/D(요일)
}

interface ParsedSession {
  session: string
  date: ParsedDate
  start_at: string
  end_at: string
  duration_hours: number | null
  participants: string
  is_allday: boolean
}

interface ScheduleTable {
  pageNum: number
  contextText: string  // text above the table — used for course name extraction
  header: string[]
  sessions: ParsedSession[]
}

// ── Step 2: Date / Duration Parsing (regex, no GPT) ──────────────────────────

function parseDate(dateStr: string, baseYear: number): ParsedDate | null {
  const s = (dateStr ?? '').trim()
  // matches: 8.20(목)  8.20.(목)  9.2(수)  10.14(수)  — with optional fullwidth parens
  const m = s.match(/(\d{1,2})\.(\d{1,2})\.?\s*[(\（]?([월화수목금토일])[)\）]?/)
  if (!m) return null
  const month = parseInt(m[1], 10)
  const day   = parseInt(m[2], 10)
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const iso   = `${baseYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const label = `${month}/${day}(${m[3]})`
  return { iso, label }
}

function parseDuration(durationStr: string): number | null {
  const m = (durationStr ?? '').match(/(\d+)/)
  return m ? parseInt(m[1], 10) : null
}

// ── Step 1: PDF Table Extraction (pdfjs-dist) ─────────────────────────────────

async function extractScheduleTables(buffer: Buffer, baseYear: number): Promise<ScheduleTable[]> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = ''

  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false,
    verbosity: 0,
  }).promise

  const tables: ScheduleTable[] = []

  for (let p = 1; p <= pdf.numPages; p++) {
    const page    = await pdf.getPage(p)
    const content = await page.getTextContent()

    type RawItem = { str: string; transform: number[] }
    const items: TItem[] = (content.items as RawItem[])
      .filter(i => i.str?.trim())
      .map(i => ({ str: i.str.trim(), x: i.transform[4], y: i.transform[5] }))

    if (!items.length) continue

    // Sort: top-to-bottom (PDF y is bottom-up → high y = top of page), then left-to-right
    const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x)

    // Cluster items into rows (y-tolerance = 4pt)
    const rows: TItem[][] = []
    let cur: TItem[] = []
    let baseY = sorted[0].y
    for (const it of sorted) {
      if (Math.abs(it.y - baseY) > 4) {
        if (cur.length) rows.push([...cur].sort((a, b) => a.x - b.x))
        cur = []; baseY = it.y
      }
      cur.push(it)
    }
    if (cur.length) rows.push([...cur].sort((a, b) => a.x - b.x))

    // Find header row containing "차수" or "교육일정"
    const headerIdx = rows.findIndex(r =>
      /차수|교육일정/.test(r.map(c => c.str).join(''))
    )
    if (headerIdx === -1) continue

    const headerRow = rows[headerIdx]
    const header    = headerRow.map(c => c.str)
    const colX      = headerRow.map(c => c.x)

    // Helper: find column index by keyword
    const findCol = (...kws: string[]) =>
      header.findIndex(h => kws.some(k => h.includes(k)))

    const colSession     = findCol('차수')
    const colDate        = findCol('교육일정', '일정')
    const colDuration    = findCol('교육시간', '시간')
    const colParticipant = findCol('교육인원', '인원')

    // Context text: items ABOVE the header (for course name extraction by GPT)
    const headerY   = headerRow[0].y
    const ctxText   = items
      .filter(i => i.y > headerY + 5)
      .sort((a, b) => b.y - a.y || a.x - b.x)
      .map(i => i.str)
      .join(' ')

    // Step 3: Extract and parse data rows
    const sessions: ParsedSession[] = []

    for (let i = headerIdx + 1; i < Math.min(headerIdx + 60, rows.length); i++) {
      const row = rows[i]
      if (!row.length) continue

      // Map each item to nearest column by x-distance
      const cells = new Array<string>(header.length).fill('')
      for (const item of row) {
        let nearCol = 0, minDist = Infinity
        colX.forEach((cx, c) => {
          const d = Math.abs(item.x - cx)
          if (d < minDist) { minDist = d; nearCol = c }
        })
        cells[nearCol] = cells[nearCol]
          ? `${cells[nearCol]} ${item.str}`
          : item.str
      }

      const get = (col: number) => (col >= 0 ? (cells[col]?.trim() ?? '') : '')
      const sessionVal     = get(colSession)
      const dateVal        = get(colDate)
      const durationVal    = get(colDuration)
      const participantVal = get(colParticipant)

      // Skip empty and 합계 rows
      if (!dateVal) continue
      if (/합계|합 계/.test(sessionVal)) continue

      const date = parseDate(dateVal, baseYear)
      if (!date) continue

      const durationHours = parseDuration(durationVal)
      const endHour = durationHours ? 9 + durationHours : 18
      const endTime = `${String(endHour).padStart(2, '0')}:00:00`

      sessions.push({
        session:        sessionVal,
        date,
        start_at:       `${date.iso}T09:00:00`,
        end_at:         `${date.iso}T${endTime}`,
        duration_hours: durationHours,
        participants:   participantVal,
        is_allday:      !durationHours,
      })
    }

    if (sessions.length > 0) {
      tables.push({ pageNum: p, contextText: ctxText, header, sessions })
    }
  }

  return tables
}

// ── Step 4: GPT — course name mapping only ───────────────────────────────────

async function mapCourseNames(tables: ScheduleTable[]): Promise<string[]> {
  const tableList = tables.map((t, idx) => ({
    table_index: idx,
    page: t.pageNum,
    context_text: t.contextText.slice(0, 400),
    header: t.header,
    sample_sessions: t.sessions.slice(0, 3).map(s => s.session),
  }))

  const prompt = `아래는 PDF에서 추출한 교육일정 테이블 목록입니다.
각 테이블이 어떤 교육과정에 해당하는지 과정명을 찾아주세요.
과정명은 context_text(테이블 바로 위 텍스트)에서 추출하세요.
대괄호([])가 있으면 포함해서 추출하세요.
예: '[고급 4단계] 실습과정', '[기초 1단계] 세미나과정'

${JSON.stringify(tableList, null, 2)}

반드시 JSON만 반환하세요:
[{ "table_index": 0, "course_name": "과정명" }]`

  const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    }),
  })

  if (!aiRes.ok) throw new Error('GPT 호출 오류')

  const raw = (await aiRes.json()).choices[0].message.content
  let mapping: { table_index: number; course_name: string }[] = []

  try {
    const v = JSON.parse(raw)
    if (Array.isArray(v)) mapping = v
  } catch {
    const s = raw.indexOf('['), e = raw.lastIndexOf(']')
    if (s !== -1 && e > s) {
      try { mapping = JSON.parse(raw.slice(s, e + 1)) } catch { /* fallback names */ }
    }
  }

  return tables.map((_, i) => {
    const found = mapping.find(m => m.table_index === i)
    return found?.course_name ?? `과정 ${i + 1}`
  })
}

// ── Fallback: full-text → GPT (DOCX or PDF with no detected tables) ──────────

function parseAiJson(raw: string): ExtractedEvent[] {
  // 1. Direct parse
  try {
    const v = JSON.parse(raw)
    if (Array.isArray(v)) return v
    if (v?.events) return v.events
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
  const s = raw.indexOf('['), e = raw.lastIndexOf(']')
  if (s !== -1 && e > s) {
    try { const v = JSON.parse(raw.slice(s, e + 1)); if (Array.isArray(v)) return v } catch { /* fail */ }
  }

  throw new Error('JSON 파싱 실패')
}

async function extractViaGpt(text: string, refYear: string): Promise<ExtractedEvent[]> {
  const systemPrompt = `당신은 교육사업계획서에서 교육 일정을 추출하는 전문가입니다.

## 중요 규칙
1. 각 차수(1차, 2차, 3차...)마다 반드시 서로 다른 날짜가 있습니다.
2. 날짜가 같은 차수가 2개 이상 나오면 추출이 잘못된 것입니다.
3. 테이블의 각 행을 독립적으로 처리하세요.

## 날짜 변환 (기준 연도: ${refYear})
- '8.20(목)' → ${refYear}-08-20  ·  '9.2(수)' → ${refYear}-09-02
- '10.14(수)' → ${refYear}-10-14  ·  연도 명시 시 해당 연도 우선

## 시작/종료 시간
- 교육시간 명시 시: 시작 09:00, 종료 = 09:00 + 교육시간 (예: 3시간 → 12:00)
- 미명시: is_allday = true

반드시 JSON 배열만 반환:
[{ "course_name": string, "session": string, "title": string, "date_label": string, "start_at": string, "end_at": string, "duration_hours": number|null, "participants": string, "is_allday": boolean, "description": string }]`

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
        { role: 'user', content: `다음 문서에서 교육 일정을 추출하세요:\n\n${text.slice(0, 16000)}` },
      ],
      temperature: 0.1,
    }),
  })

  if (!aiRes.ok) throw new Error('AI 처리 오류')
  return parseAiJson((await aiRes.json()).choices[0].message.content)
}

// ── DOCX extraction ───────────────────────────────────────────────────────────

async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  try {
    const mammoth = await import('mammoth')
    const result  = await mammoth.convertToHtml({ buffer })
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

// ── Route handler ─────────────────────────────────────────────────────────────

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
    const refYear = parseInt(year ?? String(new Date().getFullYear()), 10)

    // ── PDF: structured table extraction ──────────────────────────────────────
    if (isPdf) {
      // Step 1–3: extract tables, parse dates/durations in code
      let tables: ScheduleTable[] = []
      try {
        tables = await extractScheduleTables(buffer, refYear)
      } catch { /* fall through to full-text GPT */ }

      if (tables.length > 0) {
        // Step 4: GPT maps course names only
        const courseNames = await mapCourseNames(tables)

        // Step 5: assemble final events
        const events: ExtractedEvent[] = []
        for (let i = 0; i < tables.length; i++) {
          const courseName = courseNames[i]
          for (const sess of tables[i].sessions) {
            events.push({
              course_name:    courseName,
              session:        sess.session,
              title:          `${courseName} - ${sess.session}`,
              date_label:     sess.date.label,
              start_at:       sess.start_at,
              end_at:         sess.end_at,
              duration_hours: sess.duration_hours,
              participants:   sess.participants,
              is_allday:      sess.is_allday,
              description:    `${courseName} ${sess.session}${sess.participants ? ` | 교육인원: ${sess.participants}` : ''}`,
            })
          }
        }

        if (events.length > 0) return NextResponse.json({ events })
      }

      // Fallback: full text via GPT
      let text = ''
      try {
        text = (await pdfParse(buffer)).text
      } catch {
        return NextResponse.json(
          { error: 'PDF에서 텍스트를 추출할 수 없습니다.' },
          { status: 422 }
        )
      }

      if (!text.trim()) {
        return NextResponse.json(
          { error: '문서에서 텍스트를 추출할 수 없습니다. 스캔 이미지 파일은 지원되지 않습니다.' },
          { status: 422 }
        )
      }

      const events = await extractViaGpt(text, String(refYear))
      return NextResponse.json({ events })
    }

    // ── DOCX: full text via GPT ───────────────────────────────────────────────
    const text = await extractTextFromDocx(buffer)
    if (!text.trim()) {
      return NextResponse.json(
        { error: '문서에서 텍스트를 추출할 수 없습니다.' },
        { status: 422 }
      )
    }
    const events = await extractViaGpt(text, String(refYear))
    return NextResponse.json({ events })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.'
    return NextResponse.json({ error: msg }, { status: 500 })
  } finally {
    await admin.storage.from('calendar-imports').remove([storagePath])
  }
}
