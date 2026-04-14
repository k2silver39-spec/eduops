-- ============================================================
-- 멀티모달 RAG 마이그레이션
-- 기존 DB에 이미 ai-qa-schema.sql을 실행한 경우 이 파일을 실행하세요.
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================

-- 1. document_chunks에 page_number 컬럼 추가
ALTER TABLE public.document_chunks
  ADD COLUMN IF NOT EXISTS page_number integer NOT NULL DEFAULT 0;

-- 2. match_document_chunks 함수 업데이트 (page_number 반환 추가)
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count     int
)
RETURNS TABLE (
  id          uuid,
  document_id uuid,
  content     text,
  chunk_index int,
  page_number int,
  similarity  float,
  filename    text
)
LANGUAGE sql STABLE
AS $$
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    dc.chunk_index,
    dc.page_number,
    1 - (dc.embedding <=> query_embedding) AS similarity,
    d.filename
  FROM public.document_chunks dc
  JOIN public.documents d ON dc.document_id = d.id
  WHERE 1 - (dc.embedding <=> query_embedding) > match_threshold
    AND d.status = 'ready'
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ============================================================
-- 실행 후: 관리자 페이지 > RAG 문서 관리 > "전체 재임베딩" 버튼 클릭
-- 기존 문서를 멀티모달 방식으로 다시 임베딩해야 page_number가 채워집니다.
-- ============================================================
