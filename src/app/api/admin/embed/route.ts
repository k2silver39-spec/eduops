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

function chunkText(text: string, maxChars = 600): string[] {
  const sentences = text.split(/(?<=[.!?。\n])\s+/)
  const chunks: string[] = []
  let current = ''
  for (const sentence of sentences) {
    if ((current + sentence).length > maxChars && current) {
      chunks.push(current.trim())
      current = sentence
    } else {
      current += (current ? ' ' : '') + sentence
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks.filter((c) => c.length > 20)
}

async function embed(text: string): Promise<number[]> {
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
  const ctx = await requireAdmin()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { admin } = ctx

  const { documentId } = await request.json()
  if (!documentId) return NextResponse.json({ error: 'Missing documentId' }, { status: 400 })

  const { data: doc } = await admin.from('documents').select('*').eq('id', documentId).single()
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  try {
    // Storage에서 PDF 다운로드
    const { data: fileData, error: downloadError } = await admin.storage
      .from('documents')
      .download(doc.storage_path)

    if (downloadError || !fileData) throw new Error('Download failed')

    const buffer = Buffer.from(await fileData.arrayBuffer())

    // unpdf로 텍스트 추출 (Vercel 서버리스 환경 호환)
    const { getDocumentProxy, extractText } = await import('unpdf')
    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    const { text } = await extractText(pdf, { mergePages: true })

    if (!text?.trim()) throw new Error('No text extracted')

    // 청크 분할
    const chunks = chunkText(text)

    // 기존 청크 삭제
    await admin.from('document_chunks').delete().eq('document_id', documentId)

    // 청크별 임베딩 생성 및 저장
    const BATCH = 5
    for (let i = 0; i < chunks.length; i += BATCH) {
      const batch = chunks.slice(i, i + BATCH)
      await Promise.all(
        batch.map(async (content, batchIdx) => {
          const chunkIndex = i + batchIdx
          const embedding = await embed(content)
          await admin.from('document_chunks').insert({
            document_id: documentId,
            content,
            embedding: `[${embedding.join(',')}]`,
            chunk_index: chunkIndex,
          })
        })
      )
    }

    // 문서 상태 업데이트
    await admin
      .from('documents')
      .update({ status: 'ready', chunk_count: chunks.length })
      .eq('id', documentId)

    return NextResponse.json({ success: true, chunks: chunks.length })
  } catch (err) {
    await admin.from('documents').update({ status: 'error' }).eq('id', documentId)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
