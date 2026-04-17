'use client'

import {
  WeeklyContent,
  MonthlyContent,
  KPI_LABELS,
  ACTIVITY_LABELS,
  calcRate,
  calcBudgetRow,
  calcBudgetSubtotal,
  fmtNum,
} from './report-types'
// calcBudgetSubtotal used for totals

interface Props {
  type: 'weekly' | 'monthly'
  periodLabel: string
  content: WeeklyContent | MonthlyContent
  onClose: () => void
}

// ── 공통 테이블 셀 스타일 ──
const TH = 'border border-gray-400 bg-gray-100 px-2 py-1.5 text-xs font-semibold text-center text-gray-700 print:bg-gray-200'
const TD = 'border border-gray-400 px-2 py-1.5 text-xs text-gray-800'
const TDC = `${TD} text-center`
const TDR = `${TD} text-right tabular-nums`

function WeeklyPreview({ content, periodLabel }: { content: WeeklyContent; periodLabel: string }) {
  const { org_info, kpi_rows, activity_rows } = content
  return (
    <div className="space-y-5">
      <h2 className="text-center text-base font-bold text-gray-900 mb-1">주간 실적보고서</h2>
      <p className="text-center text-sm text-gray-600 mb-4">{periodLabel}</p>

      {/* 1. 수행기관 정보 */}
      <section>
        <h3 className="text-xs font-bold text-gray-700 mb-1 border-b border-gray-400 pb-0.5">1. 수행기관 정보</h3>
        <table className="w-full border-collapse text-xs">
          <tbody>
            {org_info.agency_type && (
              <tr>
                <td className={`${TH} w-36`}>기관구분</td>
                <td className={TD}>{org_info.agency_type}</td>
              </tr>
            )}
            <tr>
              <td className={`${TH} w-36`}>기관명</td>
              <td className={TD}>{org_info.operator || '—'}</td>
            </tr>
            <tr>
              <td className={TH}>실무담당자</td>
              <td className={TD}>{org_info.operator_name || '—'}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* 2. 성과지표 달성 현황 */}
      <section>
        <h3 className="text-xs font-bold text-gray-700 mb-1 border-b border-gray-400 pb-0.5">2. 성과지표 달성 현황</h3>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className={`${TH} w-32`}>지표명</th>
              <th className={`${TH} w-20`}>연간목표(A)</th>
              <th className={`${TH} w-20`}>누적실적(B)</th>
              <th className={`${TH} w-20`}>달성률(B/A)</th>
            </tr>
          </thead>
          <tbody>
            {KPI_LABELS.map((label, i) => {
              const row = kpi_rows[i] ?? { target: '', actual: '' }
              return (
                <tr key={label}>
                  <td className={TD}>{label}</td>
                  <td className={TDC}>{fmtNum(row.target) || '—'}</td>
                  <td className={TDC}>{fmtNum(row.actual) || '—'}</td>
                  <td className={TDC}>{calcRate(row.target, row.actual)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      {/* 3. 주간 실적 및 계획 */}
      <section>
        <h3 className="text-xs font-bold text-gray-700 mb-1 border-b border-gray-400 pb-0.5">3. 주간 실적 및 계획</h3>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className={`${TH} w-20`}>구분</th>
              <th className={TH}>이번주 실적</th>
              <th className={TH}>다음주 계획</th>
              <th className={`${TH} w-24`}>비고</th>
            </tr>
          </thead>
          <tbody>
            {ACTIVITY_LABELS.map((label, i) => {
              const row = activity_rows[i] ?? { current_week: '', next_week: '', note: '' }
              return (
                <tr key={label}>
                  <td className={`${TH} font-medium`}>{label}</td>
                  <td className={`${TD} whitespace-pre-wrap align-top min-h-[3rem]`}>{row.current_week || '—'}</td>
                  <td className={`${TD} whitespace-pre-wrap align-top`}>{row.next_week || '—'}</td>
                  <td className={TD}>{row.note || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </div>
  )
}

function MonthlyPreview({ content, periodLabel }: { content: MonthlyContent; periodLabel: string }) {
  const { org_info, achievement_plan, budget, budget_plan } = content
  // 신규 포맷(kpi_rows) vs 구형 포맷(quantitative) 호환
  const c = content as any
  const kpi_rows: { target: string; actual: string }[] | null = Array.isArray(c.kpi_rows) ? c.kpi_rows : null
  const qualTarget: string = c.qualitative?.target ?? ''
  const qualActual: string = c.qualitative?.actual ?? ''
  const qualRate: string = c.qualitative?.rate ?? ''

  const opGov  = calcBudgetRow(budget.operator_gov)
  const opSelf = calcBudgetRow(budget.operator_self)
  const total  = calcBudgetSubtotal(budget.operator_gov, budget.operator_self)

  return (
    <div className="space-y-5">
      <h2 className="text-center text-base font-bold text-gray-900 mb-1">월간 실적보고서</h2>
      <p className="text-center text-sm text-gray-600 mb-4">{periodLabel}</p>

      {/* 1. 수행기관 정보 */}
      <section>
        <h3 className="text-xs font-bold text-gray-700 mb-1 border-b border-gray-400 pb-0.5">1. 수행기관 정보</h3>
        <table className="w-full border-collapse text-xs">
          <tbody>
            {org_info.agency_type && (
              <tr>
                <td className={`${TH} w-36`}>기관구분</td>
                <td className={TD}>{org_info.agency_type}</td>
              </tr>
            )}
            <tr>
              <td className={`${TH} w-36`}>기관명</td>
              <td className={TD}>{org_info.operator || '—'}</td>
            </tr>
            <tr>
              <td className={TH}>사업책임자</td>
              <td className={TD}>{org_info.operator_name || '—'}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* 2. 정량 및 정성 실적 */}
      <section>
        <h3 className="text-xs font-bold text-gray-700 mb-1 border-b border-gray-400 pb-0.5">2. 정량 및 정성 실적</h3>

        {/* 정량실적 */}
        <p className="text-xs font-semibold text-gray-600 mb-1">정량실적</p>
        <table className="w-full border-collapse text-xs mb-3">
          <thead>
            <tr>
              <th className={`${TH} w-32`}>지표명</th>
              <th className={`${TH} w-20`}>연간목표(A)</th>
              <th className={`${TH} w-20`}>누적실적(B)</th>
              <th className={`${TH} w-20`}>달성률(B/A)</th>
            </tr>
          </thead>
          <tbody>
            {kpi_rows
              ? KPI_LABELS.map((label, i) => {
                  const row = kpi_rows[i] ?? { target: '', actual: '' }
                  return (
                    <tr key={label}>
                      <td className={TD}>{label}</td>
                      <td className={TDC}>{fmtNum(row.target) || '—'}</td>
                      <td className={TDC}>{fmtNum(row.actual) || '—'}</td>
                      <td className={TDC}>{calcRate(row.target, row.actual)}</td>
                    </tr>
                  )
                })
              : <tr><td colSpan={4} className={`${TD} text-center`}>—</td></tr>
            }
          </tbody>
        </table>

        {/* 정성실적 */}
        <p className="text-xs font-semibold text-gray-600 mb-1">정성실적</p>
        <table className="w-full border-collapse text-xs mb-3">
          <thead>
            <tr>
              <th className={TH}>목표</th>
              <th className={TH}>실적</th>
              <th className={`${TH} w-20`}>달성률</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={`${TD} whitespace-pre-wrap align-top`}>{qualTarget || '—'}</td>
              <td className={`${TD} whitespace-pre-wrap align-top`}>{qualActual || '—'}</td>
              <td className={TDC}>{qualRate || '—'}</td>
            </tr>
          </tbody>
        </table>

        {achievement_plan && (
          <div className="border border-gray-400 px-3 py-2">
            <p className="text-xs font-semibold text-gray-600 mb-1">향후목표 달성계획</p>
            <p className="text-xs text-gray-800 whitespace-pre-wrap">{achievement_plan}</p>
          </div>
        )}
      </section>

      {/* 3. 예산 집행현황 */}
      <section>
        <h3 className="text-xs font-bold text-gray-700 mb-1 border-b border-gray-400 pb-0.5">3. 예산 집행현황</h3>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className={`${TH} w-32`}>구분</th>
              <th className={TH}>예산</th>
              <th className={TH}>집행액</th>
              <th className={TH}>집행잔액</th>
              <th className={`${TH} w-16`}>집행률</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={`${TH} font-medium`}>국고보조금</td>
              <td className={TDR}>{fmtNum(budget.operator_gov.budget) || '—'}</td>
              <td className={TDR}>{fmtNum(budget.operator_gov.executed) || '—'}</td>
              <td className={TDR}>{opGov.budget ? opGov.remaining.toLocaleString('ko-KR') : '—'}</td>
              <td className={TDC}>{opGov.rate}</td>
            </tr>
            <tr>
              <td className={`${TH} font-medium`}>자기부담금</td>
              <td className={TDR}>{fmtNum(budget.operator_self.budget) || '—'}</td>
              <td className={TDR}>{fmtNum(budget.operator_self.executed) || '—'}</td>
              <td className={TDR}>{opSelf.budget ? opSelf.remaining.toLocaleString('ko-KR') : '—'}</td>
              <td className={TDC}>{opSelf.rate}</td>
            </tr>
            <tr className="bg-gray-50">
              <td className={`${TH} font-bold`}>합계</td>
              <td className={TDR}>{total.budget ? total.budget.toLocaleString('ko-KR') : '—'}</td>
              <td className={TDR}>{total.executed ? total.executed.toLocaleString('ko-KR') : '—'}</td>
              <td className={TDR}>{total.budget ? total.remaining.toLocaleString('ko-KR') : '—'}</td>
              <td className={TDC}>{total.rate}</td>
            </tr>
          </tbody>
        </table>
        {budget_plan && (
          <div className="mt-1.5 border border-gray-400 px-3 py-2">
            <p className="text-xs font-semibold text-gray-600 mb-1">향후예산 활용계획</p>
            <p className="text-xs text-gray-800 whitespace-pre-wrap">{budget_plan}</p>
          </div>
        )}
      </section>
    </div>
  )
}

export default function ReportPreviewModal({ type, periodLabel, content, onClose }: Props) {
  const handlePrint = () => window.print()

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-6 px-4 print:p-0 print:bg-white print:overflow-visible print:block">
      {/* 인쇄 시 이 ID가 있는 요소만 출력 */}
      <div id="report-print-area" className="bg-white w-full max-w-3xl rounded-xl shadow-2xl print:rounded-none print:shadow-none print:max-w-none print:w-auto">
        {/* 액션 바 (인쇄 시 숨김) */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 print:hidden">
          <p className="text-sm font-semibold text-gray-800">미리보기</p>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.75 19.5m10.56-5.671-.001-.001A42.42 42.42 0 0 1 17.25 19.5m0 0-1.063-6.01M7.875 5.25h8.25M7.875 5.25A2.625 2.625 0 0 0 5.25 7.875v1.5c0 .621.504 1.125 1.125 1.125h11.25c.621 0 1.125-.504 1.125-1.125v-1.5A2.625 2.625 0 0 0 16.125 5.25" />
              </svg>
              인쇄
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 본문 */}
        <div className="p-6 print:p-6">
          {type === 'weekly'
            ? <WeeklyPreview content={content as WeeklyContent} periodLabel={periodLabel} />
            : <MonthlyPreview content={content as MonthlyContent} periodLabel={periodLabel} />
          }
        </div>
      </div>
    </div>
  )
}
