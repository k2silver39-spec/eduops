// ─────────────────────────────────────────────────
// 보고서 양식 v2 공유 타입
// ─────────────────────────────────────────────────

export type ReportType = 'weekly' | 'monthly'
export type ReportMode = 'create' | 'edit' | 'resubmit'
export type ReportStatus = 'draft' | 'submitted' | 'approved' | 'revision_requested' | 'resubmitted' | 'revision_approved'

// 수행기관 정보
export interface OrgInfo {
  agency_type?: string        // 기관구분 (자동입력)
  operator: string            // 기관명 (자동입력)
  project_manager?: string    // 사업책임자 (월간보고 직접 입력)
  operator_name: string       // 사업실무자/실무담당자 (자동입력)
  operator_position: string   // 직위
}

// ── 주간 보고서 ──

export const KPI_LABELS = [
  '프로그램 개발(건)',
  '전문인력 양성(명)',
  '수료율(%)',
  '만족도 점수(점)',
  '지역확산(건)',
  '홍보(건)',
] as const

export const ACTIVITY_LABELS = ['직무교육', '대외협력 및 홍보', '기타'] as const

export interface KpiRow {
  target: string  // 목표(A) — 숫자 문자열 (콤마 없는 raw digits)
  actual: string  // 실적(B)
  note?: string   // 참고사항 (주간보고용)
}

export interface ActivityRow {
  current_week: string // 이번주 실적
  next_week: string    // 다음주 계획
  note: string         // 비고
}

export interface WeeklyContent {
  version: 2
  org_info: OrgInfo
  kpi_rows: KpiRow[]        // KPI_LABELS 순서와 동일, 길이 6
  activity_rows: ActivityRow[] // ACTIVITY_LABELS 순서와 동일, 길이 3
}

// ── 월간 보고서 ──

export interface PerfEntry {
  target: string // 목표(A)
  actual: string // 실적(B)
}

export interface BudgetEntry {
  budget: string   // 예산
  executed: string // 집행액
}

export interface MonthlyBudget {
  operator_gov:  BudgetEntry // 국고보조금
  operator_self: BudgetEntry // 자기부담금
}

export interface QualitativeEntry {
  target: string   // 정성 목표 (텍스트)
  actual: string   // 정성 실적 (텍스트)
  rate: string     // 달성률 (수동 입력, 예: '85%')
}

export interface MonthlyContent {
  version: 2
  org_info: OrgInfo
  kpi_rows: KpiRow[]            // 정량실적 (KPI_LABELS 기준)
  qualitative: QualitativeEntry  // 정성실적
  achievement_plan: string
  budget: MonthlyBudget
  budget_plan: string
}

// ── 유틸 함수 ──

/** 숫자 문자열(raw digits)을 천단위 콤마 포맷으로 변환 */
export function fmtNum(raw: string): string {
  const n = parseInt(raw.replace(/,/g, ''), 10)
  if (isNaN(n)) return ''
  return n.toLocaleString('ko-KR')
}

/** 달성률 계산 (소수점 1자리) */
export function calcRate(target: string, actual: string): string {
  const t = parseFloat(target.replace(/,/g, ''))
  const a = parseFloat(actual.replace(/,/g, ''))
  if (!t || isNaN(t) || isNaN(a)) return '—'
  return `${((a / t) * 100).toFixed(1)}%`
}

/** 예산 row 계산 결과 */
export function calcBudgetRow(entry: BudgetEntry) {
  const b = parseFloat(entry.budget) || 0
  const e = parseFloat(entry.executed) || 0
  const remaining = b - e
  const rate = b > 0 ? `${((e / b) * 100).toFixed(1)}%` : '—'
  return { budget: b, executed: e, remaining, rate }
}

/** 예산 소계 계산 */
export function calcBudgetSubtotal(a: BudgetEntry, b: BudgetEntry) {
  const ab = (parseFloat(a.budget) || 0) + (parseFloat(b.budget) || 0)
  const ae = (parseFloat(a.executed) || 0) + (parseFloat(b.executed) || 0)
  const remaining = ab - ae
  const rate = ab > 0 ? `${((ae / ab) * 100).toFixed(1)}%` : '—'
  return { budget: ab, executed: ae, remaining, rate }
}

/** 기본 WeeklyContent 생성 */
export function defaultWeekly(org: string, name: string, agencyType?: string): WeeklyContent {
  return {
    version: 2,
    org_info: {
      agency_type: agencyType,
      operator: org,
      operator_name: name,
      operator_position: '실무담당자',
    },
    kpi_rows: KPI_LABELS.map(() => ({ target: '', actual: '' })),
    activity_rows: ACTIVITY_LABELS.map(() => ({ current_week: '', next_week: '', note: '' })),
  }
}

/** 기본 MonthlyContent 생성 */
export function defaultMonthly(org: string, name: string, agencyType?: string): MonthlyContent {
  const emptyBudget: BudgetEntry = { budget: '', executed: '' }
  return {
    version: 2,
    org_info: {
      agency_type: agencyType,
      operator: org,
      operator_name: name,
      operator_position: '사업책임자',
    },
    kpi_rows: KPI_LABELS.map(() => ({ target: '', actual: '' })),
    qualitative: { target: '', actual: '', rate: '' },
    achievement_plan: '',
    budget: {
      operator_gov:  { ...emptyBudget },
      operator_self: { ...emptyBudget },
    },
    budget_plan: '',
  }
}
