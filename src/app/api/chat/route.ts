import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'

interface HistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

interface Source {
  filename: string
  chunk_index: number
}

async function embedText(text: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
  })
  const data = await res.json()
  return data.data[0].embedding
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { message, history = [] }: { message: string; history: HistoryMessage[] } = await request.json()
  if (!message?.trim()) return NextResponse.json({ error: 'Empty message' }, { status: 400 })

  // 1. 질문 임베딩
  const embedding = await embedText(message)

  // 2. pgvector 유사도 검색
  const { data: chunks, error: rpcError } = await admin.rpc('match_document_chunks', {
    query_embedding: `[${embedding.join(',')}]`,
    match_threshold: 0.35,
    match_count: 10,
  })

  if (rpcError) {
    console.error('[chat] RPC error:', rpcError)
    return NextResponse.json({ error: 'RPC 오류: ' + rpcError.message }, { status: 500 })
  }

  // 3. 유사한 청크 없으면 안내 메시지 반환
  if (!chunks || chunks.length === 0) {
    const noCtxMsg = '등록된 문서에서 관련 내용을 찾을 수 없습니다. 관리자에게 문의하세요.'
    await admin.from('chat_histories').insert([
      { user_id: user.id, role: 'user', content: message, sources: [] },
      { user_id: user.id, role: 'assistant', content: noCtxMsg, sources: [] },
    ])
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`event: sources\ndata: []\n\n`))
        controller.enqueue(encoder.encode(`event: text\ndata: ${JSON.stringify(noCtxMsg)}\n\n`))
        controller.enqueue(encoder.encode(`event: done\ndata: \n\n`))
        controller.close()
      },
    })
    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    })
  }

  // 4. 컨텍스트 및 출처 구성
  const sources: Source[] = chunks.map((c: { filename: string; chunk_index: number }) => ({
    filename: c.filename,
    chunk_index: c.chunk_index,
  }))
  const context = (chunks as { content: string; filename: string }[])
    .map((c, i) => `[문서 ${i + 1}] (출처: ${c.filename})\n${c.content}`)
    .join('\n\n')

  const systemPrompt = `당신은 교육운영 규정 문서를 기반으로 답변하는 전문 어시스턴트입니다.

## 답변 원칙

1. **문서 우선**: 반드시 아래 [참고 문서]에 제공된 내용만을 근거로 답변하세요. 문서 외의 지식이나 추측을 사용하지 마세요.
2. **모든 관련 조항 인용**: 질문과 관련된 조항이 여러 문서에 걸쳐 있거나 여러 항목에 해당하는 경우, 빠짐없이 모두 찾아서 답변하세요. 일부만 발췌하지 마세요.
3. **정확한 인용**: 규정 내용을 설명할 때는 문서의 원문을 직접 인용하고, 인용 출처(문서명 또는 문서 번호)를 함께 표기하세요. 원문 인용은 따옴표(" ") 또는 인용 블록으로 표시하세요.
4. **구조화된 답변**: 관련 조항이 복수인 경우 항목별로 구분하여 나열하고, 각 항목에 해당 문서 출처를 명시하세요.
5. **문서 부재 시 안내**: 질문 내용이 제공된 문서에 전혀 없는 경우에만 "해당 내용은 등록된 문서에서 확인되지 않습니다. 관리자에게 문의하세요."라고 답변하세요. 부분적으로라도 관련 내용이 있으면 그 내용을 먼저 제시하세요.
6. **한국어 작성**: 답변은 명확하고 정확한 한국어로 작성하세요.

## 답변 형식 (관련 조항이 여러 개인 경우)

**[조항 1] (출처: 문서 N)**
> (원문 인용)
- 설명 또는 해석

**[조항 2] (출처: 문서 N)**
> (원문 인용)
- 설명 또는 해석

---
*총 N개의 관련 조항을 확인했습니다.*

## 답변 형식 (단일 조항인 경우)

관련 규정을 직접 인용한 뒤 간략한 설명을 덧붙이세요.

[참고 문서]
${context}`

  // 5. 스트리밍 응답 생성
  const formattedHistory = history.slice(-10).map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  let fullText = ''

  const result = streamText({
    model: openai('gpt-4o-mini'),
    system: systemPrompt,
    messages: [...formattedHistory, { role: 'user', content: message }],
    async onFinish({ text }) {
      fullText = text
      await admin.from('chat_histories').insert([
        { user_id: user.id, role: 'user', content: message, sources: [] },
        { user_id: user.id, role: 'assistant', content: fullText, sources },
      ])
    },
  })

  // 6. 커스텀 SSE 스트림 (sources → text chunks → done)
  const encoder = new TextEncoder()
  const textStream = result.textStream

  const customStream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(`event: sources\ndata: ${JSON.stringify(sources)}\n\n`))
        for await (const chunk of textStream) {
          controller.enqueue(encoder.encode(`event: text\ndata: ${JSON.stringify(chunk)}\n\n`))
        }
        controller.enqueue(encoder.encode(`event: done\ndata: \n\n`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(customStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}
