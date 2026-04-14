-- ============================================================
-- 관리자 기능 확장 스키마 - Supabase SQL Editor에서 실행하세요.
-- ============================================================

-- 1. pgvector 확장 활성화 (RAG 문서 임베딩용)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. documents 테이블
CREATE TABLE IF NOT EXISTS public.documents (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  filename     text        NOT NULL,
  storage_path text        NOT NULL,
  status       text        NOT NULL DEFAULT 'processing'
                           CHECK (status IN ('processing', 'ready', 'error')),
  chunk_count  integer     NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 3. document_chunks 테이블 (벡터 임베딩)
CREATE TABLE IF NOT EXISTS public.document_chunks (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  uuid        NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  content      text        NOT NULL,
  embedding    vector(1536),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 4. 벡터 유사도 검색 인덱스
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
  ON public.document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 5. RLS는 별도 설정 불필요 (service role key로만 접근)

-- ============================================================
-- Supabase Storage 버킷 생성 (대시보드 또는 아래 SQL 실행)
-- ============================================================
-- Storage > Buckets > New bucket: 이름 'documents', Private 설정
-- 또는:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false)
-- ON CONFLICT DO NOTHING;
