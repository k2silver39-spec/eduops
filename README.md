# 교육운영 통합 관리 시스템

교육기관 내부 구성원을 위한 업무 통합 관리 플랫폼입니다.  
관리자 승인 기반 회원 관리, 업무보고, 민원/문의, AI 규정 질의응답 기능을 제공합니다.

## 주요 기능

| 기능 | 설명 |
|------|------|
| 회원 관리 | 가입 신청 → 관리자 승인/거절 흐름 |
| 업무보고 | 주간·월간 보고서 작성·제출·수정 요청 |
| 문의 게시판 | 카테고리별 문의 등록 및 관리자 답변 |
| AI 질의응답 | 등록된 규정 문서 기반 RAG 챗봇 |
| 관리자 대시보드 | 사용자·문서·보고서·문의 통합 관리 |

## 기술 스택

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4
- **Backend**: Next.js API Routes (서버리스)
- **Database / Auth**: Supabase (PostgreSQL + pgvector + Row Level Security)
- **AI**: OpenAI `gpt-4o-mini` (채팅), `text-embedding-3-small` (임베딩)
- **배포**: Vercel

---

## 로컬 실행 방법

### 사전 준비

- Node.js 18 이상
- Supabase 프로젝트 생성 완료
- OpenAI API 키 발급 완료

### 설치 및 실행

```bash
# 1. 저장소 클론
git clone <repository-url>
cd eduops

# 2. 패키지 설치
npm install

# 3. 환경변수 설정 (아래 '환경변수 설정 방법' 참고)
cp .env.local.example .env.local
# .env.local 파일을 열어 실제 값으로 채워넣기

# 4. 개발 서버 실행
npm run dev
```

브라우저에서 http://localhost:3000 으로 접속합니다.

---

## 환경변수 설정 방법

`.env.local.example` 파일을 `.env.local`로 복사한 뒤 아래 값을 채웁니다.

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
OPENAI_API_KEY=sk-proj-<openai-key>
```

| 변수 | 위치 | 설명 |
|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase > Project Settings > API | 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase > Project Settings > API | 공개 키 (브라우저 사용) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase > Project Settings > API | 관리자 키 (서버 전용, 노출 금지) |
| `OPENAI_API_KEY` | https://platform.openai.com/api-keys | OpenAI API 키 |

---

## Supabase 초기 설정 방법

Supabase 대시보드 > **SQL Editor** 에서 아래 파일들을 **순서대로** 실행합니다.

### 실행 순서

```
1. supabase-schema.sql     → profiles 테이블, RLS 정책
2. reports-schema.sql      → reports 테이블, RLS 정책
3. admin-schema.sql        → documents, document_chunks 테이블, pgvector 확장
4. ai-qa-schema.sql        → chat_histories 테이블, 벡터 검색 함수
```

> **주의**: `admin-schema.sql` 실행 전 Supabase Storage에서 `documents` 버킷을 생성해야 합니다.  
> Supabase 대시보드 > Storage > New bucket > 이름: `documents`, Public: **off**

### Storage 버킷 생성 (SQL 방식)

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT DO NOTHING;
```

---

## 최초 슈퍼관리자 지정 방법

1. 앱에서 **회원가입**을 완료합니다.
2. Supabase 대시보드 > **SQL Editor** 에서 아래 SQL을 실행합니다.  
   `본인이메일@example.com` 부분을 실제 가입한 이메일로 교체하세요.

```sql
UPDATE profiles
SET role = 'super_admin', status = 'approved'
WHERE email = '본인이메일@example.com';
```

3. 앱에 로그인하면 관리자 메뉴가 표시됩니다.

> 최초 슈퍼관리자 지정 이후에는 앱 내 **관리자 > 사용자 관리** 메뉴에서 신규 가입자를 승인/거절할 수 있습니다.

---

## Vercel 배포 방법

### 1. Vercel 프로젝트 생성

1. [vercel.com](https://vercel.com) 에서 **New Project** 클릭
2. GitHub 저장소를 연결합니다.
3. Framework Preset: **Next.js** (자동 감지)

### 2. 환경변수 등록

Vercel 대시보드 > 프로젝트 > **Settings > Environment Variables** 에서 아래 4개 변수를 등록합니다.

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
```

### 3. 배포

```bash
# Vercel CLI 사용 시
npm i -g vercel
vercel --prod
```

또는 GitHub에 push하면 자동으로 배포됩니다.

### 4. Supabase 허용 URL 설정

Supabase 대시보드 > **Authentication > URL Configuration** 에서 배포된 Vercel URL을 추가합니다.

```
Site URL: https://your-app.vercel.app
Redirect URLs: https://your-app.vercel.app/**
```

---

## 프로젝트 구조

```
src/
├── app/
│   ├── (app)/              # 인증 필요 페이지
│   │   ├── page.tsx        # 홈 대시보드
│   │   ├── ai-qa/          # AI 질의응답
│   │   ├── inquiries/      # 문의 게시판
│   │   ├── reports/        # 업무보고
│   │   ├── mypage/         # 내 정보
│   │   └── admin/          # 관리자 (super_admin 전용)
│   ├── auth/               # 인증 페이지 (로그인, 가입 등)
│   └── api/                # API 라우트
├── components/
│   └── layout/             # Nav, MobileHeader
└── lib/
    └── supabase/           # Supabase 클라이언트 (client / server / admin)
```
