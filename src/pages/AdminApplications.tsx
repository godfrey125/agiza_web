import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, ClipboardCheck, Filter, ShieldCheck, X } from 'lucide-react'
import { Alert } from '../components/ui/Alert'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { SelectField, TextareaField } from '../components/ui/Field'
import { Eyebrow } from '../components/ui/Layout'
import { useCopy } from '../i18n'
import {
  ApiError,
  decideAdminApplication,
  listAdminApplications,
  type AdminApplication,
} from '../lib/api'
import { isPartnerApiConfigured } from '../lib/config'
import { formatDateTime } from '../lib/utils'

type Decision = 'approve' | 'reject' | 'request_info' | 'suspend'

export function AdminApplications() {
  const c = useCopy()
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [applications, setApplications] = useState<AdminApplication[]>([])
  const [loading, setLoading] = useState(isPartnerApiConfigured)
  const [apiMissing, setApiMissing] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [selected, setSelected] = useState<AdminApplication | null>(null)
  const [decision, setDecision] = useState<Decision>('approve')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [decisionError, setDecisionError] = useState('')
  const [decisionSuccess, setDecisionSuccess] = useState('')

  const load = useCallback(async () => {
    if (!isPartnerApiConfigured) {
      setApiMissing(true)
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError('')
    setApiMissing(false)
    try {
      const response = await listAdminApplications({ type: typeFilter, status: statusFilter })
      const list = Array.isArray(response) ? response : response.results || []
      setApplications(list)
    } catch (error) {
      if (error instanceof Error && error.name === 'ApiNotConfiguredError') {
        setApiMissing(true)
      } else {
        setLoadError(error instanceof ApiError ? error.message : c.admin.flow.loadError)
      }
    } finally {
      setLoading(false)
    }
  }, [c, statusFilter, typeFilter])

  useEffect(() => {
    void load()
  }, [load])

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: c.admin.all },
      { value: 'PENDING_REVIEW', label: c.admin.pending },
      { value: 'UNDER_REVIEW', label: c.admin.underReview },
      { value: 'ADDITIONAL_INFORMATION_REQUIRED', label: c.admin.additionalInfo },
      { value: 'APPROVED', label: c.admin.approved },
      { value: 'REJECTED', label: c.admin.rejected },
      { value: 'SUSPENDED', label: c.status.suspendedTitle },
    ],
    [c],
  )

  const statusLabel = (status?: string) => {
    if (!status?.trim()) return c.common.notProvided
    return c.status.statuses[status as keyof typeof c.status.statuses] || status
  }

  const badgeTone = (status?: string) => {
    if (status === 'APPROVED') return 'success' as const
    if (status === 'REJECTED' || status === 'SUSPENDED') return 'error' as const
    if (status === 'ADDITIONAL_INFORMATION_REQUIRED') return 'warning' as const
    return 'orange' as const
  }

  const openApplication = (application: AdminApplication) => {
    setSelected(application)
    setDecision('approve')
    setReason('')
    setDecisionError('')
    setDecisionSuccess('')
  }

  const applyDecision = async () => {
    if (!selected) return
    setDecisionError('')
    setDecisionSuccess('')
    if (decision !== 'approve' && reason.trim().length < 5) {
      setDecisionError(c.admin.flow.reasonHint)
      return
    }
    setSaving(true)
    try {
      await decideAdminApplication(selected.id, decision, reason.trim())
      setDecisionSuccess(c.admin.flow.decisionSuccess)
      setReason('')
      await load()
    } catch (error) {
      setDecisionError(error instanceof ApiError ? error.message : c.admin.flow.decisionError)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <section className="relative overflow-hidden border-b border-brand-line">
        <div
          className="pointer-events-none absolute -right-40 top-0 h-[460px] w-[460px] rounded-full bg-brand-orange/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="container-page relative py-12 sm:py-16">
          <Eyebrow>{c.admin.eyebrow}</Eyebrow>
          <h1 className="mt-5 max-w-3xl font-display text-[2.6rem] font-extrabold leading-[0.98] tracking-[-0.055em] text-brand-charcoal sm:text-[3.4rem]">
            {c.admin.title}
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-brand-muted sm:text-base">{c.admin.lead}</p>
          <div className="mt-6 flex items-start gap-2.5 rounded-2xl border border-brand-line bg-white p-4 text-xs leading-5 text-brand-muted">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-dark" aria-hidden="true" />
            {c.admin.policyNote}
          </div>
        </div>
      </section>

      <section className="container-page py-10 sm:py-14">
        <div className="mx-auto max-w-6xl">
          {apiMissing ? (
            <Alert tone="warning" title={c.admin.apiMissingTitle} className="mb-5">
              {c.admin.apiMissingBody}
            </Alert>
          ) : null}

          <div className="mb-5 rounded-3xl border border-brand-line bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-brand-muted">
                <Filter className="h-4 w-4 text-brand-dark" aria-hidden="true" />
                {c.admin.filters}
              </p>
              <p className="text-[0.68rem] text-brand-muted">{c.admin.flow.filtersHint}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                { value: 'all', label: c.admin.all },
                { value: 'vendor', label: c.admin.vendors },
                { value: 'rider', label: c.admin.riders },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setTypeFilter(item.value)}
                  aria-pressed={typeFilter === item.value}
                  className={
                    typeFilter === item.value
                      ? 'rounded-full bg-brand-charcoal px-4 py-2 text-xs font-bold text-white'
                      : 'rounded-full border border-brand-line bg-white px-4 py-2 text-xs font-semibold text-brand-muted transition hover:border-brand-charcoal/30 hover:text-brand-charcoal'
                  }
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="mt-4 max-w-xs">
              <SelectField
                label={c.admin.status}
                options={statusOptions}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              />
            </div>
          </div>

          {loadError ? (
            <Alert tone="error" title={c.admin.flow.loadError} className="mb-5">
              {loadError}
            </Alert>
          ) : null}

          {decisionSuccess ? (
            <Alert tone="success" className="mb-5">
              {decisionSuccess}
            </Alert>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center rounded-3xl border border-brand-line bg-white py-20">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand-orange border-r-transparent" aria-label={c.common.loading} />
            </div>
          ) : applications.length === 0 ? (
            <div className="surface-card px-6 py-12 text-center">
              <ClipboardCheck className="mx-auto h-7 w-7 text-brand-muted" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-brand-charcoal">{c.admin.noApplications}</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-brand-line bg-white">
              <div className="hidden grid-cols-[1.2fr_0.6fr_0.8fr_0.8fr_0.5fr] gap-4 border-b border-brand-line bg-brand-cream/60 px-5 py-3 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-brand-muted lg:grid">
                <span>{c.admin.applicant}</span>
                <span>{c.admin.type}</span>
                <span>{c.admin.status}</span>
                <span>{c.admin.date}</span>
                <span className="text-right">{c.admin.open}</span>
              </div>
              <ul className="divide-y divide-brand-line">
                {applications.map((application) => (
                  <li
                    key={String(application.id)}
                    className="grid gap-3 px-5 py-4 lg:grid-cols-[1.2fr_0.6fr_0.8fr_0.8fr_0.5fr] lg:items-center lg:gap-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-brand-charcoal">
                        {application.applicant_name || application.applicant || c.common.notProvided}
                      </p>
                      <p className="mt-0.5 break-all text-[0.68rem] text-brand-muted">
                        {application.reference || c.common.notProvided}
                      </p>
                    </div>
                    <p className="text-xs font-semibold text-brand-muted">
                      {application.application_type === 'vendor'
                        ? c.admin.vendors
                        : application.application_type === 'rider'
                          ? c.admin.riders
                          : c.common.notProvided}
                    </p>
                    <div>
                      <Badge tone={badgeTone(application.status)}>{statusLabel(application.status)}</Badge>
                    </div>
                    <p className="text-xs text-brand-muted">
                      {application.submitted_at ? formatDateTime(application.submitted_at) : c.common.notProvided}
                    </p>
                    <div className="lg:text-right">
                      <Button type="button" variant="secondary" size="sm" onClick={() => openApplication(application)}>
                        {c.admin.open}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {selected ? (
            <div className="mt-6 rounded-3xl border border-brand-charcoal/15 bg-white p-5 sm:p-7">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-brand-muted">
                    {c.admin.flow.details}
                  </p>
                  <h2 className="mt-1 font-display text-xl font-bold tracking-tight text-brand-charcoal">
                    {selected.reference || String(selected.id)}
                  </h2>
                  <p className="mt-1 text-xs text-brand-muted">
                    {selected.applicant_name || selected.applicant || c.common.notProvided} ·{' '}
                    {statusLabel(selected.status)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 min-h-0 px-2.5"
                  onClick={() => setSelected(null)}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  {c.admin.flow.close}
                </Button>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-brand-line bg-brand-cream/50 p-4">
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-brand-muted">
                    {c.admin.flow.decision}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(
                      [
                        ['approve', c.admin.flow.approve],
                        ['reject', c.admin.flow.reject],
                        ['request_info', c.admin.flow.requestInfo],
                        ['suspend', c.admin.flow.suspend],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setDecision(value)}
                        aria-pressed={decision === value}
                        className={
                          decision === value
                            ? 'rounded-full bg-brand-charcoal px-3.5 py-2 text-xs font-bold text-white'
                            : 'rounded-full border border-brand-line bg-white px-3.5 py-2 text-xs font-semibold text-brand-muted'
                        }
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-brand-line bg-brand-cream/50 p-4 text-xs leading-5 text-brand-muted">
                  {c.admin.policyNote}
                </div>
              </div>

              <div className="mt-4">
                <TextareaField
                  label={c.admin.flow.reason}
                  hint={c.admin.flow.reasonHint}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="min-h-24"
                />
              </div>

              {decisionError ? (
                <p className="mt-3 flex items-start gap-1.5 text-xs text-brand-error" role="alert">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {decisionError}
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button type="button" onClick={() => void applyDecision()} loading={saving} disabled={saving}>
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  {c.admin.flow.apply}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </>
  )
}
