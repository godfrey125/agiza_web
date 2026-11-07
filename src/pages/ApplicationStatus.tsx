import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Bike, ClipboardCheck, RefreshCw, Store, UserRound } from 'lucide-react'
import { Alert } from '../components/ui/Alert'
import { Badge } from '../components/ui/Badge'
import { Button, ButtonLink } from '../components/ui/Button'
import { Eyebrow } from '../components/ui/Layout'
import { StatusTimeline, type TimelineItem } from '../components/ui/StatusTimeline'
import { useCopy } from '../i18n'
import { ApiError, getMyApplication } from '../lib/api'
import { isPartnerApiConfigured } from '../lib/config'
import { formatDateTime } from '../lib/utils'

type ApplicationType = 'vendor' | 'rider'

interface ApplicationRecord {
  type: ApplicationType
  raw: Record<string, unknown>
  status: string
  reference: string
  submittedAt: string
  updatedAt: string
  reviewer: string
  reason: string
  requested: string
  documents: Array<{ name: string; status: string }>
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function reviewerName(value: unknown) {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return asString(record.full_name) || asString(record.name) || asString(record.username)
  }
  return ''
}

function normalise(type: ApplicationType, data: unknown): ApplicationRecord | null {
  if (!data) return null
  let record: Record<string, unknown> | null = null
  if (Array.isArray(data)) {
    record = data[0] && typeof data[0] === 'object' ? (data[0] as Record<string, unknown>) : null
  } else if (typeof data === 'object') {
    const object = data as Record<string, unknown>
    if (Array.isArray(object.results)) {
      record = object.results[0] && typeof object.results[0] === 'object'
        ? (object.results[0] as Record<string, unknown>)
        : null
    } else if (object.application && typeof object.application === 'object') {
      record = object.application as Record<string, unknown>
    } else {
      record = object
    }
  }
  if (!record) return null

  const status = asString(record.status).toUpperCase()
  const reference = asString(record.reference) || asString(record.application_reference)
  if (!status && !reference && !record.id) return null

  const docs = Array.isArray(record.documents)
    ? record.documents
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
        .map((item) => ({
          name: asString(item.label) || asString(item.name) || asString(item.code) || asString(item.document_type),
          status: asString(item.status) || asString(item.review_status),
        }))
        .filter((item) => item.name)
    : []

  const requestedValue = record.requested_information || record.additional_information
  const requested = Array.isArray(requestedValue)
    ? requestedValue.map((item) => String(item)).join(', ')
    : asString(requestedValue)

  return {
    type,
    raw: record,
    status,
    reference,
    submittedAt: asString(record.submitted_at) || asString(record.created_at),
    updatedAt: asString(record.updated_at),
    reviewer: reviewerName(record.reviewer) || reviewerName(record.reviewed_by),
    reason: asString(record.decision_reason) || asString(record.rejection_reason),
    requested,
    documents: docs,
  }
}

export function ApplicationStatus() {
  const c = useCopy()
  const [applications, setApplications] = useState<ApplicationRecord[]>([])
  const [loading, setLoading] = useState(isPartnerApiConfigured)
  const [error, setError] = useState('')
  const [apiMissing, setApiMissing] = useState(false)

  const load = useCallback(async () => {
    if (!isPartnerApiConfigured) {
      setApiMissing(true)
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    setApiMissing(false)
    const results = await Promise.allSettled([
      getMyApplication('vendor'),
      getMyApplication('rider'),
    ])
    const next: ApplicationRecord[] = []
    const errors: string[] = []
    results.forEach((result, index) => {
      const type: ApplicationType = index === 0 ? 'vendor' : 'rider'
      if (result.status === 'fulfilled') {
        const normalised = normalise(type, result.value)
        if (normalised) next.push(normalised)
        return
      }
      const reason = result.reason
      if (reason instanceof ApiError && reason.status === 404) {
        return
      }
      if (reason instanceof Error && reason.name === 'ApiNotConfiguredError') {
        setApiMissing(true)
        return
      }
      errors.push(reason instanceof Error ? reason.message : c.status.flow.loadError)
    })
    setApplications(next)
    if (errors.length) {
      setError(errors[0] || c.status.flow.loadError)
    }
    setLoading(false)
  }, [c])

  useEffect(() => {
    void load()
  }, [load])

  const badgeTone = (status: string) => {
    if (status === 'APPROVED') return 'success' as const
    if (status === 'REJECTED' || status === 'SUSPENDED') return 'error' as const
    if (status === 'ADDITIONAL_INFORMATION_REQUIRED') return 'warning' as const
    if (status === 'DRAFT') return 'neutral' as const
    return 'orange' as const
  }

  const statusLabel = (status: string) =>
    c.status.statuses[status as keyof typeof c.status.statuses] || status || c.common.notProvided

  const statusDescription = (status: string) =>
    c.status.statusDescriptions[status as keyof typeof c.status.statusDescriptions] || ''

  const timelineFor = (application: ApplicationRecord): TimelineItem[] => {
    const [submittedTitle, reviewTitle, decisionTitle, outcomeTitle] = c.status.timeline
    const status = application.status
    const decided = status === 'APPROVED' || status === 'REJECTED'
    const underReview = status === 'UNDER_REVIEW' || status === 'ADDITIONAL_INFORMATION_REQUIRED'
    const pending = status === 'SUBMITTED' || status === 'PENDING_REVIEW'
    const draft = status === 'DRAFT'

    const submitted: TimelineItem = {
      title: submittedTitle,
      state: draft ? 'pending' : 'done',
      date: application.submittedAt ? formatDateTime(application.submittedAt) : undefined,
    }
    const review: TimelineItem = {
      title: reviewTitle,
      state: draft ? 'pending' : underReview ? 'done' : pending ? 'active' : decided ? 'done' : 'pending',
      date: underReview && application.updatedAt ? formatDateTime(application.updatedAt) : undefined,
    }
    const decision: TimelineItem = {
      title: status === 'SUSPENDED' ? c.status.suspendedTitle : decisionTitle,
      state:
        status === 'SUSPENDED'
          ? 'error'
          : decided
            ? 'done'
            : status === 'ADDITIONAL_INFORMATION_REQUIRED'
              ? 'active'
              : 'pending',
    }
    const outcome: TimelineItem = {
      title:
        status === 'APPROVED'
          ? c.status.approvedTitle
          : status === 'REJECTED'
            ? c.status.rejectedTitle
            : outcomeTitle,
      state: status === 'APPROVED' ? 'done' : status === 'REJECTED' ? 'error' : 'pending',
      description: decided ? statusDescription(status) : undefined,
    }
    return status === 'SUSPENDED' ? [submitted, review, decision] : [submitted, review, decision, outcome]
  }

  return (
    <>
      <section className="relative overflow-hidden border-b border-brand-line">
        <div
          className="pointer-events-none absolute -right-40 top-0 h-[480px] w-[480px] rounded-full bg-brand-orange/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="container-page relative py-12 sm:py-16 lg:py-20">
          <Eyebrow>{c.status.eyebrow}</Eyebrow>
          <h1 className="mt-5 max-w-3xl font-display text-[2.6rem] font-extrabold leading-[0.98] tracking-[-0.055em] text-brand-charcoal sm:text-[3.8rem]">
            {c.status.title}
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-brand-muted sm:text-base">{c.status.lead}</p>
        </div>
      </section>

      <section className="container-page py-10 sm:py-14">
        <div className="mx-auto max-w-4xl">
          {apiMissing ? (
            <Alert tone="warning" title={c.status.apiMissingTitle} className="mb-5">
              {c.status.apiMissingBody}
            </Alert>
          ) : null}

          {error ? (
            <Alert tone="error" title={c.status.flow.loadError} className="mb-5">
              {error}
            </Alert>
          ) : null}

          {!apiMissing ? (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-xs font-semibold text-brand-muted">
                <ClipboardCheck className="h-4 w-4 text-brand-dark" aria-hidden="true" />
                {c.status.flow.lastServerStatus}
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void load()}
                loading={loading}
                disabled={loading}
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                {c.status.refresh}
              </Button>
            </div>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center rounded-3xl border border-brand-line bg-white py-20">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand-orange border-r-transparent" aria-label={c.common.loading} />
            </div>
          ) : !apiMissing && !error && applications.length === 0 ? (
            <div className="surface-card px-6 py-12 text-center sm:px-10">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-cream text-brand-dark ring-1 ring-brand-line">
                <UserRound className="h-6 w-6" aria-hidden="true" />
              </span>
              <h2 className="mt-5 font-display text-2xl font-bold tracking-tight text-brand-charcoal">
                {c.status.noApplicationTitle}
              </h2>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-brand-muted">{c.status.noApplicationBody}</p>
              <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
                <ButtonLink to="/register/vendor" size="lg">
                  <Store className="h-4 w-4" aria-hidden="true" />
                  {c.status.startVendor}
                </ButtonLink>
                <ButtonLink to="/register/rider" size="lg" variant="secondary">
                  <Bike className="h-4 w-4" aria-hidden="true" />
                  {c.status.startRider}
                </ButtonLink>
              </div>
            </div>
          ) : applications.length ? (
            <div className="space-y-5">
              {applications.map((application) => (
                <article key={`${application.type}-${application.reference}`} className="surface-card overflow-hidden">
                  <div className="border-b border-brand-line bg-brand-cream/60 px-5 py-5 sm:px-7">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-brand-muted">
                          {application.type === 'vendor' ? c.status.flow.vendor : c.status.flow.rider}
                        </p>
                        <h2 className="mt-1 font-display text-xl font-bold tracking-tight text-brand-charcoal">
                          {application.reference || c.register.flow.referencePending}
                        </h2>
                      </div>
                      <Badge tone={badgeTone(application.status)}>{statusLabel(application.status)}</Badge>
                    </div>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-brand-muted">
                      {statusDescription(application.status)}
                    </p>
                  </div>

                  <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_240px]">
                    <div>
                      <dl className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <dt className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-brand-muted">
                            {c.status.referenceLabel}
                          </dt>
                          <dd className="mt-1 break-all text-sm font-semibold text-brand-charcoal">
                            {application.reference || c.common.notProvided}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-brand-muted">
                            {c.status.submittedLabel}
                          </dt>
                          <dd className="mt-1 text-sm font-semibold text-brand-charcoal">
                            {application.submittedAt ? formatDateTime(application.submittedAt) : c.common.notProvided}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-brand-muted">
                            {c.status.updatedLabel}
                          </dt>
                          <dd className="mt-1 text-sm font-semibold text-brand-charcoal">
                            {application.updatedAt ? formatDateTime(application.updatedAt) : c.common.notProvided}
                          </dd>
                        </div>
                        {application.reviewer ? (
                          <div>
                            <dt className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-brand-muted">
                              {c.status.reviewerLabel}
                            </dt>
                            <dd className="mt-1 text-sm font-semibold text-brand-charcoal">{application.reviewer}</dd>
                          </div>
                        ) : null}
                      </dl>

                      {application.status === 'ADDITIONAL_INFORMATION_REQUIRED' ? (
                        <Alert tone="warning" title={c.status.additionalInfoTitle} className="mt-5">
                          <p>{c.status.additionalInfoBody}</p>
                          {application.requested || application.reason ? (
                            <p className="mt-2 font-semibold text-brand-charcoal">
                              {c.status.flow.decisionReason}: {application.requested || application.reason}
                            </p>
                          ) : null}
                        </Alert>
                      ) : null}

                      {application.status === 'REJECTED' ? (
                        <Alert tone="error" title={c.status.rejectedTitle} className="mt-5">
                          <p>{c.status.rejectedBody}</p>
                          {application.reason ? (
                            <p className="mt-2 font-semibold text-brand-charcoal">
                              {c.status.flow.decisionReason}: {application.reason}
                            </p>
                          ) : null}
                        </Alert>
                      ) : null}

                      {application.status === 'APPROVED' ? (
                        <Alert tone="success" title={c.status.approvedTitle} className="mt-5">
                          {c.status.approvedBody}
                        </Alert>
                      ) : null}

                      {application.status === 'SUSPENDED' ? (
                        <Alert tone="warning" title={c.status.suspendedTitle} className="mt-5">
                          {c.status.suspendedBody}
                        </Alert>
                      ) : null}

                      {application.documents.length ? (
                        <div className="mt-5 rounded-2xl border border-brand-line bg-brand-cream/50 p-4">
                          <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-brand-muted">
                            {c.status.documentStatus}
                          </p>
                          <ul className="mt-2 space-y-1.5">
                            {application.documents.map((document, index) => (
                              <li
                                key={`${document.name}-${index}`}
                                className="flex flex-wrap items-baseline justify-between gap-2 text-xs"
                              >
                                <span className="font-semibold text-brand-charcoal">{document.name}</span>
                                <span className="text-brand-muted">{document.status || c.common.notProvided}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {application.reason && application.status !== 'REJECTED' && application.status !== 'ADDITIONAL_INFORMATION_REQUIRED' ? (
                        <p className="mt-4 text-xs leading-5 text-brand-muted">
                          {c.status.flow.decisionReason}: {application.reason}
                        </p>
                      ) : null}

                      <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-brand-muted">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-warning" aria-hidden="true" />
                        {c.status.noClientNotes}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-brand-line bg-brand-cream/50 p-4">
                      <h3 className="text-sm font-bold text-brand-charcoal">{c.status.timelineTitle}</h3>
                      <div className="mt-4">
                        <StatusTimeline items={timelineFor(application)} label={c.status.timelineTitle} />
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </>
  )
}
