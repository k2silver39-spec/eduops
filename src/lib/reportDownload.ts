import * as XLSX from 'xlsx'
import {
  WeeklyContent, MonthlyContent,
  KPI_LABELS, ACTIVITY_LABELS,
  calcRate, calcBudgetRow, calcBudgetSubtotal, fmtNum,
} from '@/app/(app)/reports/report-types'

export interface ReportDownloadData {
  type: 'weekly' | 'monthly'
  period_label: string
  content: WeeklyContent | MonthlyContent
  organization: string
  author_name: string
}

// ─────────────────────────────────────────────────
// Excel
// ─────────────────────────────────────────────────

export function downloadReportExcel(report: ReportDownloadData) {
  const wb = XLSX.utils.book_new()
  const rows = report.type === 'weekly'
    ? buildWeeklyRows(report)
    : buildMonthlyRows(report)

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 22 }, { wch: 28 }, { wch: 28 }, { wch: 18 }, { wch: 14 }]

  XLSX.utils.book_append_sheet(wb, ws, report.type === 'weekly' ? '주간보고서' : '월간보고서')

  const safe = report.period_label.replace(/[/\\:*?"<>|]/g, '_')
  XLSX.writeFile(wb, `${report.author_name}_${safe}.xlsx`)
}

function buildWeeklyRows(report: ReportDownloadData): (string | number)[][] {
  const wc = report.content as WeeklyContent
  const rows: (string | number)[][] = []

  rows.push(['주간 실적보고서'])
  rows.push([report.period_label])
  rows.push(['기관명', report.organization, '', '작성자', report.author_name])
  rows.push([])

  rows.push(['1. 수행기관 정보'])
  if (wc.org_info.agency_type) rows.push(['기관구분', wc.org_info.agency_type])
  rows.push(['기관명', wc.org_info.operator])
  rows.push(['실무담당자', wc.org_info.operator_name])
  rows.push([])

  rows.push(['2. 성과지표 달성 현황'])
  rows.push(['지표명', '연간목표(A)', '누적실적(B)', '달성률(B/A)', '비고'])
  KPI_LABELS.forEach((label, i) => {
    const row = wc.kpi_rows[i] ?? { target: '', actual: '' }
    rows.push([label, fmtNum(row.target) || '—', fmtNum(row.actual) || '—', calcRate(row.target, row.actual), (row as { note?: string }).note || ''])
  })
  rows.push([])

  rows.push(['3. 주간 실적 및 계획'])
  rows.push(['구분', '이번주 실적', '다음주 계획', '비고'])
  ACTIVITY_LABELS.forEach((label, i) => {
    const row = wc.activity_rows[i] ?? { current_week: '', next_week: '', note: '' }
    rows.push([label, row.current_week || '—', row.next_week || '—', row.note || '—'])
  })

  return rows
}

function buildMonthlyRows(report: ReportDownloadData): (string | number)[][] {
  const mc = report.content as MonthlyContent
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = mc as any
  const kpi_rows: { target: string; actual: string }[] = Array.isArray(c.kpi_rows) ? c.kpi_rows : []
  const qual: { target?: string; actual?: string; rate?: string } = c.qualitative ?? {}

  const opGov  = calcBudgetRow(mc.budget.operator_gov)
  const opSelf = calcBudgetRow(mc.budget.operator_self)
  const total  = calcBudgetSubtotal(mc.budget.operator_gov, mc.budget.operator_self)

  const rows: (string | number)[][] = []

  rows.push(['월간 실적보고서'])
  rows.push([report.period_label])
  rows.push(['기관명', report.organization, '', '작성자', report.author_name])
  rows.push([])

  rows.push(['1. 수행기관 정보'])
  if (mc.org_info.agency_type) rows.push(['기관구분', mc.org_info.agency_type])
  rows.push(['기관명', mc.org_info.operator])
  rows.push(['사업책임자', mc.org_info.project_manager || '—'])
  rows.push(['실무담당자', mc.org_info.operator_name])
  rows.push([])

  rows.push(['2. 정량 및 정성 실적'])
  rows.push(['[정량실적]'])
  rows.push(['지표명', '연간목표(A)', '누적실적(B)', '달성률(B/A)'])
  KPI_LABELS.forEach((label, i) => {
    const row = kpi_rows[i] ?? { target: '', actual: '' }
    rows.push([label, fmtNum(row.target) || '—', fmtNum(row.actual) || '—', calcRate(row.target, row.actual)])
  })
  rows.push([])

  rows.push(['[정성실적]'])
  rows.push(['목표', '실적', '달성률'])
  rows.push([qual.target || '—', qual.actual || '—', qual.rate || '—'])
  rows.push([])

  rows.push(['향후목표 달성계획', mc.achievement_plan || '—'])
  rows.push([])

  rows.push(['3. 예산 집행현황'])
  rows.push(['구분', '예산', '집행액', '집행잔액', '집행률'])
  rows.push(['국고보조금',
    fmtNum(mc.budget.operator_gov.budget) || '—',
    fmtNum(mc.budget.operator_gov.executed) || '—',
    opGov.budget ? opGov.remaining.toLocaleString('ko-KR') : '—',
    opGov.rate,
  ])
  rows.push(['자기부담금',
    fmtNum(mc.budget.operator_self.budget) || '—',
    fmtNum(mc.budget.operator_self.executed) || '—',
    opSelf.budget ? opSelf.remaining.toLocaleString('ko-KR') : '—',
    opSelf.rate,
  ])
  rows.push(['합계',
    total.budget ? total.budget.toLocaleString('ko-KR') : '—',
    total.executed ? total.executed.toLocaleString('ko-KR') : '—',
    total.budget ? total.remaining.toLocaleString('ko-KR') : '—',
    total.rate,
  ])
  rows.push([])
  rows.push(['향후예산 활용계획', mc.budget_plan || '—'])

  return rows
}

// ─────────────────────────────────────────────────
// PDF (새 창 + 자동 인쇄 → 브라우저 PDF 저장)
// ─────────────────────────────────────────────────

export function printReportPdf(report: ReportDownloadData) {
  const html = report.type === 'weekly'
    ? buildWeeklyHtml(report)
    : buildMonthlyHtml(report)

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 600)
}

// ── 공통 CSS ──
const PRINT_CSS = `
  @page { size: A4; margin: 15mm 15mm 15mm 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Malgun Gothic', '맑은 고딕', sans-serif; font-size: 10pt; color: #111; }
  h1 { text-align: center; font-size: 14pt; font-weight: bold; margin-bottom: 4px; }
  .subtitle { text-align: center; font-size: 10pt; color: #444; margin-bottom: 12px; }
  .meta { font-size: 9pt; color: #555; margin-bottom: 10px; }
  h2 { font-size: 10pt; font-weight: bold; border-bottom: 1.5px solid #333; padding-bottom: 2px; margin: 14px 0 5px; }
  .sub-title { font-size: 9pt; font-weight: bold; color: #333; margin: 8px 0 3px; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 8px; }
  th, td { border: 1px solid #555; padding: 4px 6px; }
  th { background: #e8e8e8; font-weight: bold; text-align: center; }
  .text-center { text-align: center; }
  .text-right { text-align: right; }
  .pre { white-space: pre-wrap; vertical-align: top; min-height: 40px; }
  .plan-box { border: 1px solid #555; padding: 6px 8px; font-size: 9pt; white-space: pre-wrap; margin-bottom: 6px; }
  .plan-label { font-size: 9pt; font-weight: bold; color: #333; margin-bottom: 3px; }
`

function wrapHtml(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>${title}</title><style>${PRINT_CSS}</style></head><body>${body}</body></html>`
}

function buildWeeklyHtml(report: ReportDownloadData): string {
  const wc = report.content as WeeklyContent
  const kpiRows = KPI_LABELS.map((label, i) => {
    const row = wc.kpi_rows[i] ?? { target: '', actual: '' }
    const note = (row as { note?: string }).note || ''
    return `<tr>
      <td>${label}</td>
      <td class="text-center">${fmtNum(row.target) || '—'}</td>
      <td class="text-center">${fmtNum(row.actual) || '—'}</td>
      <td class="text-center">${calcRate(row.target, row.actual)}</td>
      <td>${esc(note)}</td>
    </tr>`
  }).join('')

  const actRows = ACTIVITY_LABELS.map((label, i) => {
    const row = wc.activity_rows[i] ?? { current_week: '', next_week: '', note: '' }
    return `<tr>
      <th>${label}</th>
      <td class="pre">${esc(row.current_week) || '—'}</td>
      <td class="pre">${esc(row.next_week) || '—'}</td>
      <td class="pre">${esc(row.note) || '—'}</td>
    </tr>`
  }).join('')

  const orgRows = [
    wc.org_info.agency_type ? `<tr><th style="width:120px">기관구분</th><td>${esc(wc.org_info.agency_type)}</td></tr>` : '',
    `<tr><th>기관명</th><td>${esc(wc.org_info.operator)}</td></tr>`,
    `<tr><th>실무담당자</th><td>${esc(wc.org_info.operator_name)}</td></tr>`,
  ].join('')

  const body = `
    <h1>주간 실적보고서</h1>
    <p class="subtitle">${esc(report.period_label)}</p>
    <p class="meta">기관명: ${esc(report.organization)} &nbsp;|&nbsp; 작성자: ${esc(report.author_name)}</p>

    <h2>1. 수행기관 정보</h2>
    <table><tbody>${orgRows}</tbody></table>

    <h2>2. 성과지표 달성 현황</h2>
    <table>
      <thead><tr><th style="width:130px">지표명</th><th>연간목표(A)</th><th>누적실적(B)</th><th>달성률(B/A)</th><th style="width:100px">비고</th></tr></thead>
      <tbody>${kpiRows}</tbody>
    </table>

    <h2>3. 주간 실적 및 계획</h2>
    <table>
      <thead><tr><th style="width:80px">구분</th><th>이번주 실적</th><th>다음주 계획</th><th style="width:90px">비고</th></tr></thead>
      <tbody>${actRows}</tbody>
    </table>
  `
  return wrapHtml('주간 실적보고서', body)
}

function buildMonthlyHtml(report: ReportDownloadData): string {
  const mc = report.content as MonthlyContent
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = mc as any
  const kpi_rows: { target: string; actual: string }[] = Array.isArray(c.kpi_rows) ? c.kpi_rows : []
  const qual: { target?: string; actual?: string; rate?: string } = c.qualitative ?? {}

  const opGov  = calcBudgetRow(mc.budget.operator_gov)
  const opSelf = calcBudgetRow(mc.budget.operator_self)
  const total  = calcBudgetSubtotal(mc.budget.operator_gov, mc.budget.operator_self)

  const kpiRows = KPI_LABELS.map((label, i) => {
    const row = kpi_rows[i] ?? { target: '', actual: '' }
    return `<tr>
      <td>${label}</td>
      <td class="text-center">${fmtNum(row.target) || '—'}</td>
      <td class="text-center">${fmtNum(row.actual) || '—'}</td>
      <td class="text-center">${calcRate(row.target, row.actual)}</td>
    </tr>`
  }).join('')

  const orgRows = [
    mc.org_info.agency_type ? `<tr><th style="width:100px">기관구분</th><td colspan="3">${esc(mc.org_info.agency_type)}</td></tr>` : '',
    `<tr><th>기관명</th><td colspan="3">${esc(mc.org_info.operator)}</td></tr>`,
    `<tr><th>사업책임자</th><td>${esc(mc.org_info.project_manager || '—')}</td><th>실무담당자</th><td>${esc(mc.org_info.operator_name)}</td></tr>`,
  ].join('')

  const body = `
    <h1>월간 실적보고서</h1>
    <p class="subtitle">${esc(report.period_label)}</p>
    <p class="meta">기관명: ${esc(report.organization)} &nbsp;|&nbsp; 작성자: ${esc(report.author_name)}</p>

    <h2>1. 수행기관 정보</h2>
    <table><tbody>${orgRows}</tbody></table>

    <h2>2. 정량 및 정성 실적</h2>
    <p class="sub-title">정량실적</p>
    <table>
      <thead><tr><th style="width:130px">지표명</th><th>연간목표(A)</th><th>누적실적(B)</th><th>달성률(B/A)</th></tr></thead>
      <tbody>${kpiRows}</tbody>
    </table>

    <p class="sub-title">정성실적</p>
    <table>
      <thead><tr><th>목표</th><th>실적</th><th style="width:80px">달성률</th></tr></thead>
      <tbody><tr>
        <td class="pre">${esc(qual.target || '—')}</td>
        <td class="pre">${esc(qual.actual || '—')}</td>
        <td class="text-center">${esc(qual.rate || '—')}</td>
      </tr></tbody>
    </table>

    ${mc.achievement_plan ? `<div class="plan-label">향후목표 달성계획</div><div class="plan-box">${esc(mc.achievement_plan)}</div>` : ''}

    <h2>3. 예산 집행현황</h2>
    <table>
      <thead><tr><th style="width:100px">구분</th><th>예산</th><th>집행액</th><th>집행잔액</th><th style="width:60px">집행률</th></tr></thead>
      <tbody>
        <tr>
          <th>국고보조금</th>
          <td class="text-right">${fmtNum(mc.budget.operator_gov.budget) || '—'}</td>
          <td class="text-right">${fmtNum(mc.budget.operator_gov.executed) || '—'}</td>
          <td class="text-right">${opGov.budget ? opGov.remaining.toLocaleString('ko-KR') : '—'}</td>
          <td class="text-center">${opGov.rate}</td>
        </tr>
        <tr>
          <th>자기부담금</th>
          <td class="text-right">${fmtNum(mc.budget.operator_self.budget) || '—'}</td>
          <td class="text-right">${fmtNum(mc.budget.operator_self.executed) || '—'}</td>
          <td class="text-right">${opSelf.budget ? opSelf.remaining.toLocaleString('ko-KR') : '—'}</td>
          <td class="text-center">${opSelf.rate}</td>
        </tr>
        <tr>
          <th>합계</th>
          <td class="text-right">${total.budget ? total.budget.toLocaleString('ko-KR') : '—'}</td>
          <td class="text-right">${total.executed ? total.executed.toLocaleString('ko-KR') : '—'}</td>
          <td class="text-right">${total.budget ? total.remaining.toLocaleString('ko-KR') : '—'}</td>
          <td class="text-center">${total.rate}</td>
        </tr>
      </tbody>
    </table>

    ${mc.budget_plan ? `<div class="plan-label">향후예산 활용계획</div><div class="plan-box">${esc(mc.budget_plan)}</div>` : ''}
  `
  return wrapHtml('월간 실적보고서', body)
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
