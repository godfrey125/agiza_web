import { Pencil } from 'lucide-react'
import { Button } from '../ui/Button'

export interface ReviewRow {
  label: string
  value: string
}

export function ReviewSection({
  title,
  rows,
  files,
  editLabel,
  onEdit,
  noFilesLabel,
  filesLabel,
}: {
  title: string
  rows: ReviewRow[]
  files?: { label: string; file: File }[]
  editLabel: string
  onEdit: () => void
  noFilesLabel?: string
  filesLabel?: string
}) {
  return (
    <section className="rounded-3xl border border-brand-line bg-white p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-lg font-bold tracking-tight text-brand-charcoal">{title}</h3>
        <Button type="button" variant="ghost" size="sm" className="h-9 min-h-0 px-2.5" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          {editLabel}
        </Button>
      </div>
      <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="min-w-0">
            <dt className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-brand-muted">{row.label}</dt>
            <dd className="mt-1 break-words text-sm leading-6 text-brand-charcoal">{row.value || '—'}</dd>
          </div>
        ))}
      </dl>
      {files?.length ? (
        <div className="mt-4 border-t border-brand-line pt-4">
          {filesLabel ? (
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-brand-muted">
              {filesLabel}
            </p>
          ) : null}
          <ul className="mt-2 space-y-1.5">
            {files.map((item) => (
              <li key={`${item.label}-${item.file.name}`} className="flex flex-wrap items-baseline gap-2 text-xs">
                <span className="font-semibold text-brand-charcoal">{item.label}:</span>
                <span className="break-all text-brand-muted">{item.file.name}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : noFilesLabel ? (
        <p className="mt-4 border-t border-brand-line pt-4 text-xs text-brand-muted">{noFilesLabel}</p>
      ) : null}
    </section>
  )
}
