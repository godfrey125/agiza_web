import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarDays, Download, FileSpreadsheet, FileText, History, Play, Printer, RefreshCw,
  SlidersHorizontal,
} from 'lucide-react'
import { api } from '../lib/api'
import type { ReportPreview, ReportRow } from '../lib/types'
import { currency, dayRange, formatDate, formatDateTime, number } from '../lib/format'
import {
  Button, EmptyState, ErrorState, Field, LoadingBlock, PageHeader, SectionCard, Select, useToast,
} from '../components/ui'

interface ReportOptions {
  categories: { id: number; name: string }[]
  paymentMethods: string[]
  orderStatuses: string[]
  types: { value: string; label: string }[]
}

const range = dayRange(30)

const typeLabels: Record<string, string> = {
  sales: 'Sales report', revenue: 'Revenue report', orders: 'Orders report',
  menu: 'Menu performance', customers: 'Customer report', inventory: 'Inventory report',
  profit: 'Profit & loss', payments: 'Payment report', staff: 'Staff performance',
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char] || char))
}

function displayValue(value: unknown, type: string) {
  if (value === null || value === undefined || value === '') return '—'
  if (type === 'currency') return currency(Number(value))
  if (type === 'percent') return `${Number(value).toFixed(1)}%`
  if (type === 'number') return number(Number(value))
  if (typeof value === 'string' && value.includes('T') && !Number.isNaN(Date.parse(value))) return formatDateTime(value)
  return String(value)
}

export default function ReportsPage() {
  const [options, setOptions] = useState<ReportOptions | null>(null)
  const [history, setHistory] = useState<ReportRow[]>([])
  const [selected, setSelected] = useState<ReportPreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [exporting, setExporting] = useState('')
  const [form, setForm] = useState({
    type: 'sales', startDate: range.start, endDate: range.end,
    categoryId: 'all', paymentMethod: 'all', status: 'all',
  })
  const toast = useToast()

  const loadHistory = useCallback(async () => {
    const result = await api.get<{ reports: ReportRow[] }>('/api/reports')
    setHistory(result.reports)
    return result.reports
  }, [])

  const openReport = useCallback(async (id: number) => {
    setPreviewLoading(true)
    try {
      const result = await api.get<{ report: ReportPreview }>(`/api/reports/${id}`)
      setSelected(result.report)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not open this report.', 'error')
    } finally {
      setPreviewLoading(false)
    }
  }, [toast])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [optionData, reports] = await Promise.all([
        api.get<ReportOptions>('/api/reports/options'),
        loadHistory(),
      ])
      setOptions(optionData)
      if (reports[0]) await openReport(reports[0].id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the reports workspace.')
    } finally {
      setLoading(false)
    }
  }, [loadHistory, openReport])

  useEffect(() => { load() }, [load])

  const generate = async () => {
    if (!form.startDate || !form.endDate) return toast('Choose both a start and end date.', 'warning')
    if (form.endDate < form.startDate) return toast('The end date must be on or after the start date.', 'warning')
    setGenerating(true)
    try {
      const result = await api.post<{ id: number; report: ReportPreview; message: string }>('/api/reports/generate', form)
      setSelected(result.report)
      await loadHistory()
      toast('Report generated and saved to history.', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not generate this report.', 'error')
    } finally {
      setGenerating(false)
    }
  }

  const exportReport = async (format: 'csv' | 'xls' | 'pdf') => {
    if (!selected) return
    setExporting(format)
    try {
      await api.download(`/api/reports/${selected.id}/export?format=${format}`, `agiza-analytics-${selected.reportType}.${format}`)
      toast(`${format.toUpperCase()} export downloaded.`, 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not export this report.', 'error')
    } finally {
      setExporting('')
    }
  }

  const printReport = () => {
    if (!selected) return
    const reportWindow = window.open('', '_blank', 'width=1100,height=800')
    if (!reportWindow) return toast('Allow pop-ups to print this report.', 'warning')
    const headers = selected.columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('')
    const rows = selected.rows.map((row) => (
      `<tr>${selected.columns.map((column) => `<td class="${['currency', 'number', 'percent'].includes(column.type) ? 'right' : ''}">${escapeHtml(displayValue(row[column.key], column.type))}</td>`).join('')}</tr>`
    )).join('')
    const totals = selected.columns.filter((column) => ['currency', 'number', 'percent'].includes(column.type))
      .map((column) => selected.totals[column.key] !== undefined
        ? `<span><strong>${escapeHtml(column.label)}:</strong> ${escapeHtml(displayValue(selected.totals[column.key], column.type))}</span>`
        : '').join('')
    reportWindow.document.write(`<!doctype html><html><head><title>${escapeHtml(typeLabels[selected.reportType] || selected.reportType)}</title>
      <style>
        *{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#252525;margin:36px}
        .brand{color:#F05A32;font-size:24px;font-weight:800;letter-spacing:-.03em}.sub{color:#777;font-size:10px;text-transform:uppercase;letter-spacing:.12em;margin-top:4px}
        h1{font-size:20px;margin:24px 0 6px}.dates{color:#777;font-size:12px}.totals{display:flex;flex-wrap:wrap;gap:14px;margin:18px 0;padding:12px 14px;background:#FAF7F2;border-radius:8px;font-size:11px}
        table{width:100%;border-collapse:collapse;font-size:10px}th{background:#FAF7F2;text-align:left;padding:7px 8px;border-bottom:1px solid #ddd;text-transform:uppercase;letter-spacing:.05em;color:#777}
        td{padding:6px 8px;border-bottom:1px solid #eee}.right{text-align:right}.foot{margin-top:20px;color:#999;font-size:9px}
      </style></head><body>
      <div class="brand">Agiza Admin</div><div class="sub">Platform control center</div>
      <h1>${escapeHtml(typeLabels[selected.reportType] || selected.reportType)}</h1>
      <p class="dates">${escapeHtml(formatDate(selected.startDate))} – ${escapeHtml(formatDate(selected.endDate))} · ${number(selected.rows.length)} rows</p>
      <div class="totals">${totals}</div>
      <table><thead><tr>${headers}</tr></thead><tbody>${rows || '<tr><td colspan="99">No records in this period.</td></tr>'}</tbody></table>
      <p class="foot">Generated ${escapeHtml(formatDateTime(new Date().toISOString()))} · Agiza Admin report #${selected.id}</p>
      <script>window.onload=function(){window.print()}</script></body></html>`)
    reportWindow.document.close()
    toast('Print preview opened.', 'info')
  }

  const summaryChips = useMemo(() => {
    if (!selected) return []
    return selected.columns
      .filter((column) => ['currency', 'number', 'percent'].includes(column.type))
      .slice(0, 5)
      .map((column) => ({ label: column.label, value: displayValue(selected.totals[column.key], column.type) }))
  }, [selected])

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Workspace' }, { label: 'Reports' }]}
        eyebrow="Reporting studio"
        title="Reports"
        description="Generate board-ready reports from live restaurant data, preview every row and export in the format your team needs."
        actions={(
          <>
            <Button variant="secondary" icon={<RefreshCw size={15} />} onClick={() => load()}>Refresh</Button>
            <Button icon={<Play size={15} />} onClick={generate} loading={generating}>Generate report</Button>
          </>
        )}
      />

      <div className="card mb-5 p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <SlidersHorizontal size={17} className="text-primary" />
          <h2 className="section-title">Report builder</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-12">
          <Field label="Report type" className="xl:col-span-3">
            <Select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
              {(options?.types || Object.entries(typeLabels).map(([value, label]) => ({ value, label }))).map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </Select>
          </Field>
          <Field label="Start date" className="xl:col-span-2">
            <input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} className="input text-xs" />
          </Field>
          <Field label="End date" className="xl:col-span-2">
            <input type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} className="input text-xs" />
          </Field>
          <Field label="Category" className="xl:col-span-2">
            <Select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
              <option value="all">All categories</option>
              {(options?.categories || []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </Select>
          </Field>
          <Field label="Payment" className="xl:col-span-2">
            <Select value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })}>
              <option value="all">All methods</option>
              {(options?.paymentMethods || []).map((method) => <option key={method} value={method}>{method}</option>)}
            </Select>
          </Field>
          <Field label="Order status" className="xl:col-span-1">
            <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              <option value="all">All</option>
              {(options?.orderStatuses || []).map((status) => <option key={status} value={status}>{status[0] + status.slice(1).toLowerCase()}</option>)}
            </Select>
          </Field>
        </div>
        <div className="mt-4 flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] leading-5 text-muted">Reports are computed on the server from orders, menu, stock, expenses and staff records. Each run is saved to history.</p>
          <Button onClick={generate} loading={generating} icon={<FileText size={15} />}>Generate & preview</Button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
          <div className="card p-5"><LoadingBlock rows={6} /></div>
          <div className="card p-5"><LoadingBlock rows={9} /></div>
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => load()} />
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[320px_1fr]">
          <SectionCard title="Report history" description="The 80 most recent generated reports." action={<History size={17} className="text-primary" />} bodyClassName="p-0">
            <div className="max-h-[720px] overflow-y-auto">
              {history.length ? history.map((report) => {
                const active = selected?.id === report.id
                return (
                  <button
                    key={report.id}
                    type="button"
                    onClick={() => openReport(report.id)}
                    className={`flex w-full items-start gap-3 border-b border-line px-4 py-3 text-left transition last:border-0 ${active ? 'bg-[#fff7f1]' : 'hover:bg-[#fcfaf6]'}`}
                  >
                    <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${active ? 'bg-primary text-white' : 'bg-peach text-primary'}`}><FileText size={16} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-xs font-semibold text-ink">{typeLabels[report.reportType] || report.reportType}</span>
                        <span className="ml-auto shrink-0 text-[10px] text-muted">#{report.id}</span>
                      </span>
                      <span className="mt-1 block text-[10px] text-muted">{formatDate(report.startDate)} – {formatDate(report.endDate)}</span>
                      <span className="mt-1 flex items-center gap-1 text-[10px] text-[#a39b91]"><CalendarDays size={10} /> {formatDateTime(report.createdAt)}{report.generatedBy ? ` · ${report.generatedBy}` : ''}</span>
                    </span>
                  </button>
                )
              }) : (
                <div className="p-4">
                  <EmptyState icon={<FileText size={22} />} title="No reports yet" message="Use the builder above to generate your first report." />
                </div>
              )}
            </div>
          </SectionCard>

          <div className="card min-w-0 overflow-hidden">
            {previewLoading ? (
              <div className="p-5"><LoadingBlock rows={9} /></div>
            ) : !selected ? (
              <div className="p-5">
                <EmptyState icon={<FileText size={24} />} title="Choose or generate a report" message="A preview with totals, rows and export options will appear here." />
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">{typeLabels[selected.reportType] || selected.reportType}</h2>
                      <span className="badge-orange">#{selected.id}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted">{formatDate(selected.startDate)} – {formatDate(selected.endDate)} · {number(selected.rows.length)} rows · generated from live database records</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" icon={<Printer size={14} />} onClick={printReport}>Print</Button>
                    <Button variant="secondary" size="sm" icon={<Download size={14} />} onClick={() => exportReport('csv')} loading={exporting === 'csv'}>CSV</Button>
                    <Button variant="secondary" size="sm" icon={<FileSpreadsheet size={14} />} onClick={() => exportReport('xls')} loading={exporting === 'xls'}>Excel</Button>
                    <Button size="sm" icon={<FileText size={14} />} onClick={() => exportReport('pdf')} loading={exporting === 'pdf'}>PDF</Button>
                  </div>
                </div>

                {summaryChips.length > 0 && (
                  <div className="flex flex-wrap gap-2 border-b border-line bg-[#fcfaf6] px-5 py-3">
                    {summaryChips.map((chip) => (
                      <div key={chip.label} className="rounded-xl border border-line bg-white px-3 py-2">
                        <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted">{chip.label}</p>
                        <p className="mt-0.5 text-sm font-bold text-ink">{chip.value}</p>
                      </div>
                    ))}
                  </div>
                )}

                {selected.rows.length ? (
                  <div className="max-h-[650px] overflow-auto">
                    <table className="data-table min-w-[720px]">
                      <thead className="sticky top-0 z-10"><tr>{selected.columns.map((column) => <th key={column.key} className={['currency', 'number', 'percent'].includes(column.type) ? 'text-right' : ''}>{column.label}</th>)}</tr></thead>
                      <tbody>
                        {selected.rows.map((row, index) => (
                          <tr key={index}>
                            {selected.columns.map((column) => (
                              <td key={column.key} className={['currency', 'number', 'percent'].includes(column.type) ? 'text-right tabular-nums' : ''}>
                                {displayValue(row[column.key], column.type)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-5">
                    <EmptyState icon={<FileText size={24} />} title="No rows in this report" message="There were no matching records for these dates and filters. Try a wider date range." />
                  </div>
                )}

                <div className="flex flex-col gap-2 border-t border-line bg-[#fcfaf6] px-5 py-3 text-[11px] text-muted sm:flex-row sm:items-center sm:justify-between">
                  <span>Exports use the stored report snapshot so numbers stay consistent.</span>
                  <span>PDF includes the first 250 rows; CSV and Excel include every row.</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
