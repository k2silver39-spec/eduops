-- ============================================================
-- AI 질의응답 스키마 - Supabase SQL Editor에서 실행하세요.
-- ============================================================

-- 0. ivfflat 인덱스 제거 후 hnsw로 교체 (소량 데이터 호환)
DROP INDEX IF EXISTS document_chunks_embedding_idx;
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
  ON public.document_chunks USING hnsw (embedding vector_cosine_ops);

-- 1. document_chunks에 chunk_index 컬럼 추가
ALTER TABLE public.document_chunks
  ADD COLUMN IF NOT EXISTS chunk_index integer NOT NULL DEFAULT 0;

-- 2. documents RLS 활성화 (로그인 사용자 읽기)
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'documents' AND policyname = '로그인 사용자 문서 읽기'
  ) THEN
    CREATE POLICY "로그인 사용자 문서 읽기"
      ON public.documents FOR SELECT
      USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- 3. document_chunks RLS 활성화 (로그인 사용자 읽기)
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'document_chunks' AND policyname = '로그인 사용자 청크 읽기'
  ) THEN
    CREATE POLICY "로그인 사용자 청크 읽기"
      ON public.document_chunks FOR SELECT
      USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- 4. chat_histories 테이블
CREATE TABLE IF NOT EXISTS public.chat_histories (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role       text        NOT NULL CHECK (role IN ('user', 'assistant')),
  content    text        NOT NULL,
  sources    jsonb       NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_histories ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chat_histories' AND policyname = '본인 채팅 읽기'
  ) THEN
    CREATE POLICY "본인 채팅 읽기"
      ON public.chat_histories FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chat_histories' AND policyname = '본인 채팅 쓰기'
  ) THEN
    CREATE POLICY "본인 채팅 쓰기"
      ON public.chat_histories FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 5. pgvector 유사도 검색 함수
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
    1 - (dc.embedding <=> query_embedding) AS similarity,
    d.filename
  FROM public.document_chunks dc
  JOIN public.documents d ON dc.document_id = d.id
  WHERE 1 - (dc.embedding <=> query_embedding) > match_threshold
    AND d.status = 'ready'
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
$$;
