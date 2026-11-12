import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Filter,
  Image as ImageIcon,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  LoadingBlock,
  Modal,
  PageHeader,
  SectionCard,
  Select,
  Textarea,
} from '../../components/ui'
import { cn, formatDateTime } from '../../lib/format'
import {
  decideAdminApplication,
  listAdminApplications,
  MarketplaceApiError,
  marketplaceConfig,
  type AdminApplication,
} from '../../lib/marketplace'

type Decision = 'approve' | 'reject' | 'request_info' | 'suspend'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'PENDING_REVIEW', label: 'Pending review' },
  { value: 'UNDER_REVIEW', label: 'Under review' },
  { value: 'ADDITIONAL_INFORMATION_REQUIRED', label: 'Information required' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'SUSPENDED', label: 'Suspended' },
]

function statusLabel(status?: string) {
  if (!status) return 'Not provided'
  const known = STATUS_OPTIONS.find((option) => option.value === status)?.label
  if (known) return known
  return status
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function statusTone(status?: string) {
  if (status === 'APPROVED') return 'badge-green'
  if (status === 'REJECTED' || status === 'SUSPENDED') return 'badge-red'
  if (status === 'ADDITIONAL_INFORMATION_REQUIRED') return 'badge-yellow'
  return 'badge-orange'
}

function mediaUrl(url?: string) {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return `${marketplaceConfig.apiUrl.replace(/\/api$/, '')}${url.startsWith('/') ? '' : '/'}${url}`
}

function payloadEntries(payload?: Record<string, unknown>) {
  if (!payload) return []
  return Object.entries(payload).filter(([, value]) => {
    if (value === null || value === undefined || value === '') return false
    return typeof value !== 'object'
  })
}

function humanizeKey(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export default function MarketplaceApplications() {
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [applications, setApplications] = useState<AdminApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<AdminApplication | null>(null)
  const [decision, setDecision] = useState<Decision>('approve')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [decisionError, setDecisionError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await listAdminApplications({ type: typeFilter, status: statusFilter })
      setApplications(Array.isArray(response) ? response : response.results || [])
    } catch (cause) {
      setError(
        cause instanceof MarketplaceApiError
          ? cause.message
          : 'The partner application queue could not be loaded.',
      )
    } finally {
      setLoading(false)
    }
  }, [typeFilter, statusFilter])

  useEffect(() => {
    void load()
  }, [load])

  const openApplication = (application: AdminApplication) => {
    setSelected(application)
    setDecision('approve')
    setReason('')
    setDecisionError('')
    setSuccess('')
  }

  const applyDecision = async () => {
    if (!selected) return
    setDecisionError('')
    setSuccess('')
    if (decision !== 'approve' && reason.trim().length < 5) {
      setDecisionError('Enter a reason of at least 5 characters for this decision.')
      return
    }
    setSaving(true)
    try {
      await decideAdminApplication(selected.id, decision, reason.trim())
      setSuccess(`Decision recorded for ${selected.reference || selected.id}.`)
      setSelected(null)
      setReason('')
      await load()
    } catch (cause) {
      setDecisionError(
        cause instanceof MarketplaceApiError ? cause.message : 'The decision could not be recorded.',
      )
    } finally {
      setSaving(false)
    }
  }

  const counts = useMemo(() => {
    const pending = applications.filter((application) =>
      ['SUBMITTED', 'PENDING_REVIEW', 'UNDER_REVIEW', 'ADDITIONAL_INFORMATION_REQUIRED'].includes(
        String(application.status),
      ),
    ).length
    const approved = applications.filter((application) => application.status === 'APPROVED').length
    const rejected = applications.filter((application) =>
      ['REJECTED', 'SUSPENDED'].includes(String(application.status)),
    ).length
    return { total: applications.length, pending, approved, rejected }
  }, [applications])

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Marketplace"
        title="Partner applications"
        description="Review vendor and rider applications, inspect submitted documents and record an auditable decision."
        actions={
          <Button variant="secondary" size="sm" onClick={() => void load()} loading={loading}>
            <RefreshCw size={13} />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['In view', counts.total, 'text-ink'],
          ['Awaiting action', counts.pending, 'text-[#9A7214]'],
          ['Approved', counts.approved, 'text-success'],
          ['Rejected / suspended', counts.rejected, 'text-coral'],
        ].map(([label, value, tone]) => (
          <div key={String(label)} className="card p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">{label}</p>
            <p className={cn('mt-1.5 font-display text-2xl font-extrabold tracking-[-0.03em]', String(tone))}>
              {value}
            </p>
          </div>
        ))}
      </div>

      <SectionCard
        title="Review queue"
        description="Filter by partner type or status. The backend returns the newest applications first."
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted">
              <Filter size={13} />
              Partner type
            </span>
            {[
              { value: 'all', label: 'All' },
              { value: 'vendor', label: 'Vendors' },
              { value: 'rider', label: 'Riders' },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setTypeFilter(item.value)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs font-semibold transition',
                  typeFilter === item.value
                    ? 'bg-ink text-white'
                    : 'border border-line bg-white text-muted hover:text-ink',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="max-w-xs">
            <Field label="Status">
              <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
      </SectionCard>

      {success ? (
        <p className="flex items-center gap-1.5 rounded-xl border border-[#cfe9d8] bg-soft-green px-4 py-3 text-xs font-medium text-success">
          <CheckCircle2 size={14} />
          {success}
        </p>
      ) : null}

      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      {loading ? (
        <LoadingBlock rows={6} />
      ) : applications.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck size={22} />}
          title="No applications in this view"
          message="Change the partner type or status filter. New applications appear here automatically."
        />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Type</th>
                <th>Status</th>
                <th>Submitted</th>
                <th className="text-right">Open</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((application) => (
                <tr key={String(application.id)}>
                  <td>
                    <p className="table-primary">
                      {application.applicant_name || String(application.applicant || 'Unknown')}
                    </p>
                    <p className="table-secondary">{application.reference || `#${application.id}`}</p>
                  </td>
                  <td>
                    <Badge className="badge-gray">
                      {application.application_type === 'vendor'
                        ? 'Vendor'
                        : application.application_type === 'rider'
                          ? 'Rider'
                          : 'Partner'}
                    </Badge>
                  </td>
                  <td>
                    <Badge className={statusTone(application.status)}>
                      {statusLabel(application.status)}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap text-xs text-muted">
                    {formatDateTime(application.submitted_at)}
                  </td>
                  <td className="text-right">
                    <Button variant="secondary" size="sm" onClick={() => openApplication(application)}>
                      Open
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.reference || `Application #${selected?.id || ''}`}
        description={
          selected
            ? `${selected.applicant_name || 'Applicant'} · ${statusLabel(selected.status)}`
            : undefined
        }
        width="max-w-2xl"
      >
        {selected ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-[#fdfbf7] p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Applicant</p>
                <p className="mt-1 text-sm font-semibold text-ink">
                  {selected.applicant_name || 'Not provided'}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {selected.applicant_phone || selected.applicant_email || 'No contact recorded'}
                </p>
              </div>
              <div className="rounded-xl border border-line bg-[#fdfbf7] p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Submitted</p>
                <p className="mt-1 text-sm font-semibold text-ink">
                  {formatDateTime(selected.submitted_at)}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {selected.decided_at
                    ? `Decided ${formatDateTime(selected.decided_at)}`
                    : 'Awaiting a decision'}
                </p>
              </div>
            </div>

            {payloadEntries(selected.payload).length ? (
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
                  Submitted details
                </p>
                <dl className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-2">
                  {payloadEntries(selected.payload).map(([key, value]) => (
                    <div key={key} className="min-w-0">
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                        {humanizeKey(key)}
                      </dt>
                      <dd className="mt-0.5 break-words text-xs text-ink">{String(value)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}

            {selected.attachments?.length ? (
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
                  Documents
                </p>
                <ul className="space-y-2">
                  {selected.attachments.map((attachment) => (
                    <li key={String(attachment.id)}>
                      <a
                        href={mediaUrl(attachment.url)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-xs font-semibold text-ink transition hover:border-primary/40 hover:text-primary"
                      >
                        {attachment.kind === 'image' ? <ImageIcon size={14} /> : <FileText size={14} />}
                        <span className="min-w-0 flex-1 truncate">{attachment.label || attachment.code}</span>
                        <span className="text-[10px] text-muted">{attachment.kind}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {selected.decision_reason ? (
              <div className="rounded-xl border border-line bg-[#fdfbf7] p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
                  Previous decision
                </p>
                <p className="mt-1 text-xs leading-5 text-ink">{selected.decision_reason}</p>
              </div>
            ) : null}

            <div className="rounded-xl border border-line bg-[#fdfbf7] p-3 text-[11px] leading-5 text-muted">
              <ShieldCheck size={13} className="mr-1 inline text-primary" />
              Decisions are attributed to your account and written to the immutable audit log. A reason
              is required for anything other than approval.
            </div>

            {selected.status === 'APPROVED' || selected.status === 'REJECTED' ? (
              <>
                <div className="rounded-xl border border-line bg-[#fdfbf7] p-3 text-[11px] leading-5 text-muted">
                  This application is already {statusLabel(selected.status).toLowerCase()} and cannot
                  be decided again.
                </div>
                <div className="flex justify-end border-t border-line pt-4">
                  <Button variant="secondary" onClick={() => setSelected(null)}>
                    Close
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
                    Decision
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ['approve', 'Approve'],
                        ['reject', 'Reject'],
                        ['request_info', 'Request information'],
                        ['suspend', 'Suspend'],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setDecision(value)}
                        className={cn(
                          'rounded-full px-3 py-1.5 text-xs font-semibold transition',
                          decision === value
                            ? value === 'reject' || value === 'suspend'
                              ? 'bg-coral text-white'
                              : 'bg-ink text-white'
                            : 'border border-line bg-white text-muted hover:text-ink',
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <Field
                  label="Reason"
                  hint="Required for rejection, information requests and suspensions. At least 5 characters."
                >
                  <Textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Explain the decision for the applicant and the audit record."
                  />
                </Field>

                {decisionError ? (
                  <p className="text-xs font-medium text-coral" role="alert">
                    {decisionError}
                  </p>
                ) : null}

                <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
                  <Button variant="secondary" onClick={() => setSelected(null)}>
                    Cancel
                  </Button>
                  <Button onClick={() => void applyDecision()} loading={saving} disabled={saving}>
                    <CheckCircle2 size={15} />
                    Record decision
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
