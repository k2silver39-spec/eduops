# eduops — 구현 현황 문서

> 기준일: 2026-04-25 (name 컬럼 제거, 기관 선택 방식 변경, 시스템 제목 변경)  
> 서비스: https://eduops-sigma.vercel.app  
> 저장소: https://github.com/k2silver39-spec/eduops (master 브랜치 자동 배포)

---

## 구현된 기능 목록

### 1. 인증 (Authentication)

| 기능 | 경로 | 비고 |
|------|------|------|
| 로그인 | `/auth/login` | 이메일 + 비밀번호, Supabase Auth |
| 회원가입 | `/auth/signup` | 이메일·기관명(드롭다운 선택)·기관구분, 개인정보 동의 모달, 비밀번호 강도 체크 |
| 비밀번호 찾기 | `/auth/forgot-password` | Resend로 임시 비밀번호 이메일 발송 |
| 비밀번호 재설정 | `/auth/reset-password` | 임시 비밀번호로 로그인 후 새 비밀번호 설정, uncontrolled input으로 포커스 버그 해결 |
| OAuth 콜백 | `/auth/callback` | PKCE 코드 교환, 세션 복원 |
| 승인 대기 안내 | `/auth/pending` | 가입 후 관리자 승인 대기 상태 안내 |
| 거절 안내 | `/auth/rejected` | 가입 거절 안내 |
| 세션 미들웨어 | `middleware.ts` | 미로그인 → 로그인 리다이렉트, pending/rejected 접근 차단, 관리자 경로 권한 체크 |

### 2. 홈 대시보드

| 기능 | 비고 |
|------|------|
| 기관 표시 | profiles 테이블에서 조회 (name 컬럼 제거됨) |
| 공지사항 섹션 | 최신 공지 3건, 📌 고정 공지 상단, "더보기" → /notices, 공지 없으면 숨김 |
| 주간 캘린더 | 월~일 7일 그리드, 오늘 강조, 데스크탑: 이벤트 pill 2개 + "+N", 모바일: 색상 도트, 이전/다음 주 네비 |
| 기능 카드 그리드 | 공지사항, AI 질의응답, 문의 게시판, 리포트, 캘린더, 내 정보, 관리자 대시보드(super_admin 전용) |
| 관리자 카드 조건부 표시 | role === 'super_admin' 인 경우에만 노출 |

### 3. AI 질의응답

| 기능 | 비고 |
|------|------|
| RAG 기반 답변 | pgvector HNSW 유사도 검색 (match_threshold: 0.35, top-10 청크) |
| SSE 스트리밍 응답 | Vercel AI SDK `streamText` + 커스텀 SSE 스트림 |
| 답변 출처 표시 | 문서명, 페이지 번호 |
| 관련 문서 없을 때 안내 | "관련 내용을 찾을 수 없습니다" 메시지 |
| 대화 기록 유지 | 최근 10개 메시지 컨텍스트 활용 |
| 채팅 히스토리 저장 | chat_histories 테이블 (user/assistant role, sources jsonb) |
| AI 모델 | GPT-4o-mini, 임베딩: text-embedding-3-small |

### 4. 문의 게시판

| 기능 | 비고 |
|------|------|
| 목록 조회 | 검색(제목·내용), 상태 필터(전체/처리중/완료), 카테고리 필터, 페이지네이션(20건) |
| 문의 작성 | 제목, 내용, 카테고리, 공개/비공개 설정, 파일 첨부 |
| 문의 상세 | 내용 + 첨부파일 다운로드 |
| 댓글/답글 | 답글 CRUD (관리자 및 작성자) |
| 권한별 접근 | 일반 사용자: 본인 글 + 공개 글 / 관리자: 전체 |
| 상태 | open → in_progress → closed |
| 파일 첨부 | attachments 버킷, 최대 10MB |

### 5. 리포트 (업무보고서)

| 기능 | 비고 |
|------|------|
| 주간 보고서 작성 | 수행기관 정보, 성과지표(KPI) 6항목, 주간 활동(직무교육/대외협력/기타) |
| 월간 보고서 작성 | 수행기관 정보, 정량실적(KPI), 정성실적, 예산 집행현황, 향후 달성계획 |
| 임시저장 / 제출 | `draft` / `submitted` 상태 분리 |
| 이전 보고서 참고 | 작성 시 같은 기관의 직전 제출 보고서 내용 자동 불러오기 |
| 수정 요청 재제출 | `revision_requested` → `resubmitted` 플로우 |
| 기관 내 보고서 열람 | 같은 organization 소속의 타인 보고서 목록 확인 가능 |
| 중복 제출 방지 | 기관+유형+기간 기준 중복 체크 (409 에러) |
| 파일 첨부 | attachments 버킷, 최대 10MB |
| Excel 다운로드 | xlsx 라이브러리, 주간/월간 양식 |
| PDF 인쇄 | 브라우저 print API 활용, A4 맞춤 HTML 생성 |
| 보고서 상태 | draft → submitted → (revision_requested → resubmitted) → approved |

### 6. 마이페이지

| 기능 | 비고 |
|------|------|
| 프로필 조회 | 이메일, 기관명, 기관구분 |
| 프로필 수정 | 기관명, 기관구분(운영기관/협력기관) 수정 |
| 비밀번호 변경 | 현재 비밀번호 확인 후 새 비밀번호 설정 |

### 7. 캘린더

| 기능 | 비고 |
|------|------|
| 월간 보기 | 7열 그리드, 날짜별 일정 바 표시, 3개 초과 시 "+N개", 날짜 클릭 시 사이드 패널 |
| 주간 보기 | 7일 컬럼 + 시간대 행, 종일 일정 상단 영역, 가로 스크롤 |
| 일정 추가/수정 | 제목, 종일 토글, 날짜/시간, 색상(6종), 상세 내용, 주관기관 공개 토글 |
| 일정 삭제 | 본인 작성 일정 삭제, 관리자는 전체 삭제 가능 |
| 색상 구분 | blue / green / red / orange / purple / gray 6가지 |
| 주관기관 공개 일정 | 📌 뱃지 표시, 모든 사용자에게 노출 |
| 보고서 자동 반영 | 보고서 승인 시 캘린더 일정 자동 생성, 📋 뱃지 표시 |
| 문서 일정 추출 | PDF/DOCX 업로드 → GPT-4o-mini AI 추출 → 선택적 캘린더 추가 (임시 파일 자동 삭제) |
| 관리자 기관 필터 | super_admin: 기관별 일정 필터 드롭다운 |

### 8. 공지사항

| 기능 | 경로 | 비고 |
|------|------|------|
| 공지 목록 조회 | `/notices` | 페이지네이션(10건), 📌 고정 공지 상단, 클릭 시 상세 모달 |
| 공지 상세 모달 | `/notices` | 슬라이드업 모달, 제목/작성일/내용 표시 |
| 공지 관리 (관리자) | `/admin/notices` | 목록(비활성 포함), 생성/수정/삭제, 📌 고정 토글, 활성화 토글 |
| 공지 API | `/api/notices` | GET(최신 5건), POST(super_admin) |
| 공지 전체 API | `/api/notices/all` | GET(페이지네이션, 관리자는 비활성 포함) |
| 공지 개별 API | `/api/notices/[id]` | GET, PATCH, DELETE (수정/삭제는 super_admin) |

### 9. 관리자 대시보드 (super_admin 전용)

| 기능 | 경로 | 비고 |
|------|------|------|
| 대시보드 통계 | `/admin` | 미처리 문의 수, 주간 보고 수, 수정 요청 수, 승인 대기 수 + 최근 문의 목록 |
| 사용자 관리 | `/admin/users` | 전체/대기 탭, 승인/거절, 역할 변경(super_admin 승격 시 기관구분 자동 변경) — 이름 컬럼 없음 |
| 기관 관리 | `/admin/organizations` | 기관 추가/수정/삭제, 활성/비활성 토글, 순서 변경, 소속 사용자 수 표시 |
| 문의 관리 | `/admin/inquiries` | 상태 변경, 답변, 카테고리/상태 필터 |
| 보고서 관리 | `/admin/reports` | 상태/유형/기관 필터, 승인/수정요청/삭제, AI 요약 생성 |
| 규정 문서 관리 | `/admin/documents` | PDF 업로드 → 텍스트 추출(pdf-parse) → 청크 분할 → 임베딩 생성(배치 3개) |
| AI 보고서 요약 | `/api/admin/summarize` | 기간·기관 필터 후 GPT-4o-mini로 개인별 요약 + 종합 요약 |

### 8. 공통 인프라

| 기능 | 비고 |
|------|------|
| PWA | next-pwa, manifest.json, 서비스 워커, 오프라인 페이지 |
| 파일 업로드 API | `/api/upload` — Supabase Storage `attachments` 버킷, 10MB 제한 |
| 첨부파일 다운로드 | `/api/attachments/[id]` — signed URL 기반 다운로드 |
| 모바일 헤더 | 뒤로가기 버튼 포함 모바일 전용 헤더 |
| 네비게이션 | 하단 탭바 (홈, 문의, 리포트, AI) |
| 세션 가드 | 인증 상태 클라이언트 사이드 체크 |

---

## 구현되지 않은 기능 목록

| 기능 | 설명 |
|------|------|
| 캘린더 — 반복 일정 | 매주/매월 반복 일정 설정 |
| 캘린더 — 외부 캘린더 연동 | Google Calendar / iCal 내보내기·가져오기 |
| 이메일 알림 — 회원 승인/거절 | 관리자가 승인/거절 시 해당 사용자에게 이메일 발송 |
| 이메일 알림 — 문의 답변 | 문의에 답글 등록 시 작성자에게 이메일 발송 |
| 이메일 알림 — 보고서 승인/수정요청 | 상태 변경 시 보고서 작성자에게 이메일 발송 |
| ~~공지사항 게시판~~ | ✅ 2026-04-24 구현 완료 |
| 알림 센터 | 앱 내 알림 목록 (승인, 답변, 보고서 상태 변경 등) |
| 리포트 통계/분석 대시보드 | 기간별·기관별 성과지표 추이 차트 |
| 사용자 회원 탈퇴 | 계정 삭제 및 개인정보 파기 |
| 비밀번호 재설정 링크 방식 | 현재는 임시 비밀번호 이메일 방식. Supabase 이메일 링크(PKCE) 방식으로 전환 가능 |
| 문서 OCR 지원 | 현재 스캔 이미지 PDF는 텍스트 추출 불가 |
| 관리자 복수 계정 | 현재 role 기반으로 복수 관리자 가능하나, 관리자별 권한 세분화 없음 |
| 첨부파일 미리보기 | 이미지/PDF 파일 인라인 미리보기 |
| 리포트 일괄 다운로드 | 여러 보고서를 ZIP으로 일괄 다운로드 |
| 모바일 푸시 알림 | PWA 기반 Web Push |

---

## 현재 파일 구조

```
eduops/
├── public/
│   ├── icons/                      PWA 아이콘
│   ├── manifest.json               PWA 매니페스트
│   ├── offline.html                오프라인 폴백 페이지
│   └── sw.js                       서비스 워커 (next-pwa 자동 생성)
├── src/
│   ├── app/
│   │   ├── layout.tsx              루트 레이아웃 (PWA 메타, 폰트)
│   │   ├── globals.css
│   │   ├── (app)/                  인증된 사용자 라우트 그룹
│   │   │   ├── layout.tsx          앱 공통 레이아웃 (네비게이션, 세션 가드)
│   │   │   ├── page.tsx            홈 대시보드
│   │   │   ├── ai-qa/
│   │   │   │   └── page.tsx        AI 질의응답
│   │   │   ├── inquiries/
│   │   │   │   ├── page.tsx        문의 목록
│   │   │   │   ├── InquiryList.tsx 문의 목록 클라이언트 컴포넌트
│   │   │   │   ├── new/page.tsx    문의 작성
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx    문의 상세
│   │   │   │       └── InquiryDetail.tsx
│   │   │   ├── reports/
│   │   │   │   ├── page.tsx        리포트 목록
│   │   │   │   ├── ReportList.tsx
│   │   │   │   ├── ReportForm.tsx  리포트 작성/수정 폼
│   │   │   │   ├── ReportPreviewModal.tsx
│   │   │   │   ├── report-types.ts 보고서 타입 정의 + 유틸 함수
│   │   │   │   ├── new/page.tsx    새 리포트 작성
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx    리포트 상세
│   │   │   │       ├── ReportDetail.tsx
│   │   │   │       └── edit/page.tsx  리포트 수정
│   │   │   ├── calendar/
│   │   │   │   ├── page.tsx        캘린더 메인 (서버 컴포넌트)
│   │   │   │   ├── CalendarView.tsx 캘린더 클라이언트 컴포넌트 (월간/주간)
│   │   │   │   ├── EventModal.tsx  일정 추가/수정 모달
│   │   │   │   └── EventModal.tsx  일정 추가/수정 모달
│   │   │   ├── notices/
│   │   │   │   └── page.tsx        공지사항 목록/상세 모달
│   │   │   ├── HomeClient.tsx      홈 주간 캘린더 클라이언트 컴포넌트
│   │   │   ├── mypage/
│   │   │   │   └── page.tsx        마이페이지
│   │   │   └── admin/
│   │   │       ├── layout.tsx      관리자 레이아웃
│   │   │       ├── page.tsx        관리자 대시보드
│   │   │       ├── users/page.tsx  사용자 관리
│   │   │       ├── inquiries/page.tsx  문의 관리
│   │   │       ├── reports/page.tsx    보고서 관리
│   │   │       ├── documents/page.tsx  규정 문서 관리
│   │   │       └── notices/page.tsx    공지사항 관리
│   │   ├── auth/
│   │   │   ├── login/page.tsx
│   │   │   ├── signup/page.tsx
│   │   │   ├── pending/page.tsx
│   │   │   ├── rejected/page.tsx
│   │   │   ├── forgot-password/page.tsx
│   │   │   ├── reset-password/page.tsx
│   │   │   └── callback/page.tsx
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── login/route.ts
│   │       │   ├── login-form/route.ts
│   │       │   ├── forgot-password/route.ts    임시 비밀번호 이메일 발송
│   │       │   └── set-session/route.ts
│   │       ├── profile/
│   │       │   ├── route.ts                    프로필 수정 (PATCH)
│   │       │   └── password/route.ts           비밀번호 변경
│   │       ├── inquiries/
│   │       │   ├── route.ts                    문의 목록/작성 (GET/POST)
│   │       │   └── [id]/
│   │       │       ├── route.ts                문의 상세/수정/삭제
│   │       │       └── replies/
│   │       │           ├── route.ts            댓글 목록/작성
│   │       │           └── [replyId]/route.ts  댓글 수정/삭제
│   │       ├── reports/
│   │       │   ├── route.ts                    리포트 목록/작성 (GET/POST)
│   │       │   ├── previous/route.ts           이전 보고서 내용 조회
│   │       │   ├── org/route.ts                기관 목록 조회
│   │       │   └── [id]/route.ts               리포트 상세/수정/삭제
│   │       ├── chat/
│   │       │   ├── route.ts                    AI 질의응답 (RAG + SSE 스트리밍)
│   │       │   └── history/route.ts            채팅 기록 조회
│   │       ├── events/
│   │       │   ├── route.ts                    일정 목록/생성 (GET/POST) — start/end 날짜 범위 지원 추가
│   │       │   └── [id]/route.ts               일정 수정/삭제 (PATCH/DELETE)
│   │       ├── notices/
│   │       │   ├── route.ts                    공지 최신 5건/생성 (GET/POST)
│   │       │   ├── all/route.ts                공지 전체 목록 페이지네이션 (GET)
│   │       │   └── [id]/route.ts               공지 상세/수정/삭제 (GET/PATCH/DELETE)
│   │       ├── upload/route.ts                 파일 업로드 (attachments 버킷)
│   │       ├── attachments/[id]/route.ts        첨부파일 다운로드
│   │       └── admin/
│   │           ├── stats/route.ts              대시보드 통계
│   │           ├── users/
│   │           │   ├── route.ts                사용자 목록
│   │           │   └── [id]/route.ts           사용자 상태/역할 변경
│   │           ├── inquiries/route.ts          문의 관리 (관리자용)
│   │           ├── reports/
│   │           │   ├── route.ts                보고서 목록 (관리자용)
│   │           │   └── [id]/route.ts           보고서 승인/수정요청/삭제
│   │           ├── summarize/route.ts          AI 보고서 요약
│   │           ├── events/route.ts             관리자 전체 일정 조회 (GET)
│   │           ├── documents/
│   │           │   ├── route.ts                문서 목록/업로드
│   │           │   └── [id]/route.ts           문서 삭제
│   │           └── embed/route.ts              PDF 임베딩 생성
│   ├── components/
│   │   ├── admin/
│   │   │   └── AdminNav.tsx                    관리자 사이드 네비게이션
│   │   └── layout/
│   │       ├── Nav.tsx                         하단 탭 네비게이션
│   │       ├── MobileHeader.tsx                모바일 상단 헤더
│   │       └── SessionGuard.tsx                클라이언트 세션 가드
│   └── lib/
│       ├── supabase/
│       │   ├── client.ts                       브라우저 Supabase 클라이언트
│       │   ├── server.ts                       서버 Supabase 클라이언트
│       │   ├── admin.ts                        서비스 롤 키 클라이언트 (RLS 우회)
│       │   └── middleware.ts                   세션 미들웨어 (라우팅 보호)
│       ├── reportDownload.ts                   Excel/PDF 다운로드 유틸
│       └── dom-polyfills.ts
├── supabase/
│   └── migrations/
│       ├── 20260422_create_events.sql          events 테이블 + RLS + calendar-imports 버킷
│       └── 20260424_create_notices.sql         notices 테이블 + RLS
├── CLAUDE.md
├── IMPLEMENTED.md                              (이 파일)
├── next.config.ts
├── middleware.ts                               Next.js 미들웨어 진입점
├── package.json
├── tsconfig.json
└── vercel.json
```

---

## 사용 중인 환경변수 목록

| 변수명 | 위치 | 용도 | 필수 |
|--------|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` | Supabase 프로젝트 URL (클라이언트/서버 공용) | 필수 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` | Supabase 익명 키 (클라이언트/미들웨어용) | 필수 |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` | Supabase 서비스 롤 키 (RLS 우회, 서버 전용) | 필수 |
| `OPENAI_API_KEY` | `.env.local` | OpenAI API 키 (GPT-4o-mini, text-embedding-3-small) | 필수 |
| `RESEND_API_KEY` | `.env.local` 미설정 | Resend 이메일 발송 API 키 (비밀번호 찾기 이메일) | 선택 (없으면 이메일 기능 비활성) |
| `RESEND_FROM_EMAIL` | `.env.local` 미설정 | 이메일 발신자 주소 (기본값: `onboarding@resend.dev`) | 선택 |

> **주의:** `RESEND_API_KEY`가 설정되지 않으면 비밀번호 찾기 기능이 "이메일 발송 서비스가 설정되지 않았습니다" 오류를 반환합니다.

---

## Supabase 테이블 목록

| 테이블 | 주요 컬럼 | 역할 |
|--------|----------|------|
| `profiles` | `id` (uuid, auth user와 동일), `email`, `name`, `organization`, `agency_type` (`운영기관`\|`협력기관`\|`주관기관`), `role` (`user`\|`super_admin`), `status` (`pending`\|`approved`\|`rejected`), `privacy_agreed` (bool), `privacy_agreed_at` | 사용자 프로필 및 권한 |
| `reports` | `id`, `user_id`, `organization`, `type` (`weekly`\|`monthly`), `period_label`, `period_start`, `period_end`, `content` (jsonb), `status` (`draft`\|`submitted`\|`revision_requested`\|`resubmitted`\|`revision_approved`\|`approved`), `revision_comment`, `submitted_at`, `approved_at` | 주간·월간 보고서 |
| `inquiries` | `id`, `user_id`, `organization`, `title`, `content`, `category`, `is_public` (bool), `status` (`open`\|`in_progress`\|`closed`) | 문의 게시판 |
| `inquiry_replies` | `id`, `inquiry_id`, `user_id`, `content` | 문의 답글 |
| `attachments` | `id`, `entity_type` (`report`\|`inquiry`), `entity_id`, `filename`, `storage_path`, `size` | 파일 첨부 (문의/보고서 공용) |
| `documents` | `id`, `filename`, `storage_path`, `status` (`processing`\|`ready`\|`error`), `chunk_count` | 관리자 업로드 규정 PDF |
| `document_chunks` | `id`, `document_id`, `content`, `embedding` (vector 1536), `chunk_index`, `page_number` | PDF 청크 + pgvector 임베딩 |
| `chat_histories` | `id`, `user_id`, `role` (`user`\|`assistant`), `content`, `sources` (jsonb) | AI 질의응답 대화 기록 |
| `events` | `id`, `user_id`, `organization`, `agency_type`, `title`, `description`, `start_at`, `end_at`, `is_allday` (bool), `color` (`blue`\|`green`\|`red`\|`orange`\|`purple`\|`gray`), `source` (`manual`\|`document`\|`report`), `source_id`, `is_public` (bool) | 캘린더 일정 |
| `notices` | `id`, `admin_id` (uuid), `title`, `content`, `is_pinned` (bool), `is_active` (bool), `created_at`, `updated_at` | 공지사항 |

### Supabase Storage 버킷

| 버킷 | 용도 | 접근 |
|------|------|------|
| `attachments` | 문의·보고서 첨부파일 | private (signed URL) |
| `documents` | 관리자 규정 PDF 원본 | private (server-side download) |
| `calendar-imports` | 일정 추출용 임시 업로드 파일 (처리 후 자동 삭제) | private |

### Supabase Functions (RPC)

| 함수 | 용도 |
|------|------|
| `match_document_chunks` | pgvector 코사인 유사도 검색 (query_embedding, match_threshold, match_count 파라미터) |

## 2026-04-25: name 컬럼 제거 + 기관 관리 + 시스템명 변경

| 항목 | 변경 내용 |
|------|----------|
| profiles.name 컬럼 | 완전 제거 (마이그레이션 후 적용) |
| 홈 환영 문구 | "{name}님" → "{organization}님" |
| 회원가입 기관명 | 텍스트 입력 → 드롭다운 선택 |
| organizations 테이블 | 신규 생성 (기관 관리) |
| /admin/organizations | 기관 관리 관리자 페이지 신규 |
| 실무담당자 | 자동 입력(name) 제거 → 직접 입력 |
| 시스템명 | 의료AI 직무교육사업 관리시스템 → 의료AI 사업관리시스템 |
