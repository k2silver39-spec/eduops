import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { setupDOMPolyfills } from '@/lib/dom-polyfills'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: p } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (p?.role !== 'super_admin') return null
  return { user, admin }
}

function chunkText(text: string, maxChars = 800): string[] {
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

async function extractPageTextViaVision(imageBase64: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: 'high',
              },
            },
            {
              type: 'text',
              text: '이 페이지의 모든 내용을 텍스트로 변환해줘. 표는 마크다운 표 형식으로, 이미지/차트는 내용을 텍스트로 설명해줘.',
            },
          ],
        },
      ],
    }),
  })
  if (!res.ok) throw new Error(`Vision API 오류: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return data.choices[0]?.message?.content ?? ''
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

    // pdfjs-dist 5.x 요구 DOM API 폴리필 설정 (module import 전에 실행)
    setupDOMPolyfills()

    // pdfjs-dist 및 canvas 동적 import (서버리스 환경 호환)
    const pdfjsLib = await import('pdfjs-dist')
    const { createCanvas } = await import('canvas')
    const { readFileSync } = await import('fs')
    const { join } = await import('path')

    // Node.js ESM은 file:/data: 프로토콜만 허용.
    // 파일 경로가 환경마다 다를 수 있으므로 worker를 data: URL로 인라인 임베딩.
    const workerContent = readFileSync(
      join(process.cwd(), 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs'),
      'base64'
    )
    pdfjsLib.GlobalWorkerOptions.workerSrc = `data:text/javascript;base64,${workerContent}`

    // Node.js 환경용 Canvas 팩토리
    const nodeCanvasFactory = {
      create(width: number, height: number) {
        const canvas = createCanvas(width, height)
        return { canvas, context: canvas.getContext('2d') }
      },
      reset(canvasAndContext: { canvas: any; context: any }, width: number, height: number) {
        canvasAndContext.canvas.width = width
        canvasAndContext.canvas.height = height
      },
      destroy(canvasAndContext: { canvas: any; context: any }) {
        canvasAndContext.canvas.width = 0
        canvasAndContext.canvas.height = 0
      },
    }

    // PDF 로드
    const pdfDoc = await pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      canvasFactory: nodeCanvasFactory as any,
      useSystemFonts: true,
      disableFontFace: true,
      verbosity: 0,
    } as any).promise

    const numPages = pdfDoc.numPages

    // 기존 청크 삭제
    await admin.from('document_chunks').delete().eq('document_id', documentId)

    let totalChunks = 0

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum)
      const viewport = page.getViewport({ scale: 1.5 })

      // 페이지를 이미지로 렌더링
      const canvasObj = nodeCanvasFactory.create(viewport.width, viewport.height)
      await page.render({
        canvasContext: canvasObj.context as any,
        canvas: canvasObj.canvas as any,
        viewport,
      }).promise

      const imageBase64 = (canvasObj.canvas as any)
        .toBuffer('image/jpeg', { quality: 0.85 })
        .toString('base64')
      nodeCanvasFactory.destroy(canvasObj)

      // GPT-4o Vision으로 페이지 텍스트 추출
      const pageText = await extractPageTextViaVision(imageBase64)
      if (!pageText.trim()) continue

      // 청크 분할
      const chunks = chunkText(pageText)

      // 임베딩 생성 및 저장 (배치: 3개씩)
      const BATCH = 3
      for (let i = 0; i < chunks.length; i += BATCH) {
        const batch = chunks.slice(i, i + BATCH)
        await Promise.all(
          batch.map(async (content, batchIdx) => {
            const chunkIndex = totalChunks + i + batchIdx
            const embedding = await embed(content)
            await admin.from('document_chunks').insert({
              document_id: documentId,
              content,
              embedding: `[${embedding.join(',')}]`,
              chunk_index: chunkIndex,
              page_number: pageNum,
            })
          })
        )
      }

      totalChunks += chunks.length
    }

    // 문서 상태 업데이트
    await admin
      .from('documents')
      .update({ status: 'ready', chunk_count: totalChunks })
      .eq('id', documentId)

    return NextResponse.json({ success: true, chunks: totalChunks, pages: numPages })
  } catch (err) {
    await admin.from('documents').update({ status: 'error' }).eq('id', documentId)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
