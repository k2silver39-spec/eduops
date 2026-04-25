# 의료AI 사업관리시스템 (eduops)

교육기관 내부 구성원을 위한 업무 통합 관리 플랫폼입니다.  
관리자 승인 기반 회원 관리, 주간·월간 업무보고, 문의 게시판, AI 규정 질의응답 기능을 제공합니다.

> **운영 중**: https://eduops-sigma.vercel.app

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| 회원 관리 | 가입 신청 → 관리자 승인/거절, 기관구분(운영기관·협력기관·주관기관) |
| 업무보고 | 주간·월간 보고서 작성·제출·수정요청·재제출·승인, Excel/PDF 다운로드 |
| 문의 게시판 | 카테고리별 문의 등록, 댓글 답변, 공개/비공개 설정 |
| AI 질의응답 | 등록된 규정 PDF 기반 RAG 챗봇 (SSE 스트리밍, 출처 표시) |
| 관리자 대시보드 | 사용자·문의·보고서·규정 문서 통합 관리, AI 보고서 요약 |
| 비밀번호 찾기 | 임시 비밀번호 이메일 발송 (Resend) |
| PWA | 모바일 홈 화면 추가, 오프라인 폴백 지원 |

---

## 기술 스택

| 항목 | 버전 / 값 |
|------|----------|
| Next.js | 16.2.3 (App Router, webpack) |
| React | 19.2.4 |
| TypeScript | strict |
| Tailwind CSS | v4 (`@tailwindcss/postcss`) |
| Supabase | `@supabase/supabase-js` + `@supabase/ssr` (PostgreSQL + pgvector + Auth) |
| OpenAI | `gpt-4o-mini` (채팅), `text-embedding-3-small` (임베딩) |
| Vercel AI SDK | `ai` + `@ai-sdk/openai` — SSE 스트리밍 |
| 이메일 | Resend (`resend`) |
| Excel | `xlsx` |
| PDF 파싱 | `pdf-parse` |
| PWA | `next-pwa` v5 |
| 배포 | Vercel (GitHub master 브랜치 자동 배포) |

---

## 로컬 실행 방법

### 사전 준비

- Node.js 20 이상
- Supabase 프로젝트 생성 완료
- OpenAI API 키 발급 완료

### 설치 및 실행

```bash
# 1. 저장소 클론
git clone https://github.com/k2silver39-spec/eduops.git
cd eduops

# 2. 패키지 설치
npm install

# 3. 환경변수 설정
# .env.local 파일 생성 후 아래 '환경변수' 섹션 참고

# 4. 개발 서버 실행
npm run dev
```

브라우저에서 http://localhost:3000 으로 접속합니다.

---

## 환경변수

`.env.local` 파일을 프로젝트 루트에 생성하고 아래 값을 채웁니다.

```env
# Supabase (필수)
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# OpenAI (필수)
OPENAI_API_KEY=sk-proj-<openai-key>

# Resend — 비밀번호 찾기 이메일 발송 (선택, 없으면 해당 기능 비활성)
RESEND_API_KEY=re_<resend-key>
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

| 변수 | 출처 | 필수 |
|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase > Project Settings > API | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase > Project Settings > API | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase > Project Settings > API | ✅ 서버 전용, 외부 노출 금지 |
| `OPENAI_API_KEY` | platform.openai.com/api-keys | ✅ |
| `RESEND_API_KEY` | resend.com/api-keys | 선택 |
| `RESEND_FROM_EMAIL` | 발신 도메인 설정 후 입력 | 선택 |

---

## Supabase 초기 설정

Supabase 대시보드 > **SQL Editor** 에서 아래 스키마를 순서대로 실행합니다.

### 1. pgvector 확장 활성화

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2. profiles 테이블

```sql
CREATE TABLE profiles (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           text NOT NULL,
  organization    text NOT NULL DEFAULT '',
  agency_type     text CHECK (agency_type IN ('운영기관', '협력기관', '주관기관')),
  role            text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'super_admin')),
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  privacy_agreed  boolean NOT NULL DEFAULT false,
  privacy_agreed_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
```

### 3. reports 테이블

```sql
CREATE TABLE reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization    text NOT NULL,
  type            text NOT NULL CHECK (type IN ('weekly', 'monthly')),
  period_label    text NOT NULL,
  period_start    date NOT NULL,
  period_end      date NOT NULL,
  content         jsonb NOT NULL DEFAULT '{}',
  status          text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','submitted','revision_requested','resubmitted','revision_approved','approved')),
  revision_comment text,
  submitted_at    timestamptz,
  approved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
```

### 4. inquiries 및 inquiry_replies 테이블

```sql
CREATE TABLE inquiries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization text NOT NULL,
  title        text NOT NULL,
  content      text NOT NULL,
  category     text NOT NULL,
  is_public    boolean NOT NULL DEFAULT true,
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE inquiry_replies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id  uuid NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
```

### 5. attachments 테이블

```sql
CREATE TABLE attachments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  text NOT NULL CHECK (entity_type IN ('report', 'inquiry')),
  entity_id    uuid NOT NULL,
  filename     text NOT NULL,
  storage_path text NOT NULL,
  size         bigint NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);
```

### 6. documents 및 document_chunks 테이블

```sql
CREATE TABLE documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename     text NOT NULL,
  storage_path text NOT NULL,
  status       text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'error')),
  chunk_count  integer,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE document_chunks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content     text NOT NULL,
  embedding   vector(1536),
  chunk_index integer NOT NULL DEFAULT 0,
  page_number integer NOT NULL DEFAULT 0
);

CREATE INDEX ON document_chunks USING hnsw (embedding vector_cosine_ops);
```

### 7. chat_histories 테이블

```sql
CREATE TABLE chat_histories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('user', 'assistant')),
  content    text NOT NULL,
  sources    jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### 8. 벡터 검색 함수

```sql
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count     int
)
RETURNS TABLE (
  id          uuid,
  document_id uuid,
  content     text,
  filename    text,
  chunk_index int,
  page_number int,
  similarity  float
)
LANGUAGE sql STABLE AS $$
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    d.filename,
    dc.chunk_index,
    dc.page_number,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  JOIN documents d ON d.id = dc.document_id
  WHERE 1 - (dc.embedding <=> query_embedding) > match_threshold
    AND d.status = 'ready'
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
$$;
```

### 9. Storage 버킷 생성

```sql
-- 규정 문서 PDF (관리자 업로드)
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT DO NOTHING;

-- 문의·보고서 첨부파일
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', false)
ON CONFLICT DO NOTHING;
```

---

## 최초 슈퍼관리자 지정

1. 앱에서 **회원가입**을 완료합니다.
2. Supabase 대시보드 > **SQL Editor** 에서 아래 SQL을 실행합니다.

```sql
UPDATE profiles
SET role = 'super_admin',
    status = 'approved',
    agency_type = '주관기관'
WHERE email = '본인이메일@example.com';
```

3. 앱에 로그인하면 **관리자 대시보드** 메뉴가 표시됩니다.

> 이후 신규 가입자 승인은 앱 내 **관리자 > 사용자 관리**에서 처리합니다.

---

## Vercel 배포 방법

### 1. Vercel 프로젝트 연결

1. [vercel.com](https://vercel.com) > **New Project** > GitHub 저장소 연결
2. Framework Preset: **Next.js** (자동 감지)
3. Build Command: `next build --webpack` (자동 감지 또는 직접 입력)

### 2. 환경변수 등록

Vercel 대시보드 > 프로젝트 > **Settings > Environment Variables** 에서 등록:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
RESEND_API_KEY          (비밀번호 찾기 사용 시)
RESEND_FROM_EMAIL       (비밀번호 찾기 사용 시)
```

### 3. Supabase 허용 URL 설정

Supabase 대시보드 > **Authentication > URL Configuration**:

```
Site URL:      https://your-app.vercel.app
Redirect URLs: https://your-app.vercel.app/**
```

### 4. 배포

GitHub `master` 브랜치에 push하면 자동 배포됩니다.

---

## 프로젝트 구조

```
src/
├── app/
│   ├── (app)/                    인증 필요 페이지
│   │   ├── page.tsx              홈 대시보드
│   │   ├── ai-qa/                AI 질의응답 (RAG + 스트리밍)
│   │   ├── inquiries/            문의 게시판 (목록 / 작성 / 상세)
│   │   ├── reports/              업무보고 (목록 / 작성 / 수정 / 상세)
│   │   ├── mypage/               내 정보 (프로필 수정, 비밀번호 변경)
│   │   └── admin/                관리자 (super_admin 전용)
│   │       ├── page.tsx          통계 대시보드
│   │       ├── users/            사용자 승인·거절·역할 변경
│   │       ├── inquiries/        문의 관리
│   │       ├── reports/          보고서 승인·수정요청·AI 요약
│   │       └── documents/        규정 PDF 업로드·임베딩
│   ├── auth/                     인증 페이지
│   │   ├── login/
│   │   ├── signup/
│   │   ├── pending/
│   │   ├── rejected/
│   │   ├── forgot-password/
│   │   ├── reset-password/
│   │   └── callback/
│   └── api/                      API 라우트 (40개+)
│       ├── auth/                 로그인·비밀번호 찾기·세션
│       ├── profile/              프로필·비밀번호 변경
│       ├── inquiries/            문의 CRUD + 댓글 CRUD
│       ├── reports/              보고서 CRUD + 이전 보고서 참조
│       ├── chat/                 AI 질의응답 + 히스토리
│       ├── upload/               파일 업로드 (10MB 제한)
│       ├── attachments/          첨부파일 다운로드
│       └── admin/                관리자 전용 API
│           ├── stats/            대시보드 통계
│           ├── users/            사용자 관리
│           ├── inquiries/        문의 관리
│           ├── reports/          보고서 관리
│           ├── summarize/        AI 보고서 요약
│           ├── documents/        문서 관리
│           └── embed/            PDF 임베딩 생성
├── components/
│   ├── admin/AdminNav.tsx        관리자 사이드 네비게이션
│   └── layout/
│       ├── Nav.tsx               하단 탭 네비게이션
│       ├── MobileHeader.tsx      모바일 상단 헤더
│       └── SessionGuard.tsx      클라이언트 세션 가드
└── lib/
    ├── supabase/
    │   ├── client.ts             브라우저 클라이언트
    │   ├── server.ts             서버 클라이언트
    │   ├── admin.ts              서비스 롤 클라이언트 (RLS 우회)
    │   └── middleware.ts         세션·라우팅 보호 미들웨어
    └── reportDownload.ts         보고서 Excel/PDF 내보내기
```

---

## 권한 체계

```
super_admin
├── 관리자 대시보드 (/admin/*)
├── 사용자 승인/거절/역할 변경
├── 규정 문서 업로드·임베딩
├── 문의 관리 (전체 조회 + 상태 변경)
├── 보고서 관리 (전체 조회 + 승인/수정요청)
└── 일반 사용자 기능 전체

user (approved)
├── 홈 대시보드
├── 리포트 작성·제출·수정
├── 문의 게시판 (본인 글 + 공개 글)
├── AI 질의응답
└── 마이페이지

user (pending / rejected)
└── 접근 불가 → /auth/pending 또는 /auth/rejected 리다이렉트
```

---

## 보고서 상태 흐름

```
draft → submitted → revision_requested → resubmitted → approved
                 ↘ approved
```

| 상태 | 설명 |
|------|------|
| `draft` | 임시저장 |
| `submitted` | 제출 완료 |
| `revision_requested` | 관리자 수정 요청 |
| `resubmitted` | 수정 후 재제출 |
| `revision_approved` | 수정 승인 |
| `approved` | 최종 승인 |
