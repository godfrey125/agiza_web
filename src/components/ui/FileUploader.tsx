import { useId, useRef, useState, type DragEvent } from 'react'
import { FileCheck2, FileText, Replace, Trash2, UploadCloud } from 'lucide-react'
import { cn, formatFileSize } from '../../lib/utils'
import { Button } from './Button'

interface FileUploaderProps {
  label: string
  description?: string
  why?: string
  whyLabel?: string
  required?: boolean
  optionalLabel?: string
  requiredLabel?: string
  accept?: string
  maxSizeMb?: number
  imageOnly?: boolean
  value: File | null
  onChange: (file: File | null) => void
  error?: string
  progress?: number
  uploaded?: boolean
  messages: {
    upload: string
    replace: string
    remove: string
    selected: string
    uploaded?: string
    types: string
    maxSize: string
    fileType: string
    fileSize: string
  }
  disabled?: boolean
}

export function FileUploader({
  label,
  description,
  why,
  whyLabel = 'Why:',
  required,
  optionalLabel = 'Optional',
  requiredLabel = 'Required',
  accept = '.pdf,.jpg,.jpeg,.png',
  maxSizeMb = 10,
  imageOnly = false,
  value,
  onChange,
  error,
  progress,
  uploaded,
  messages,
  disabled,
}: FileUploaderProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [localError, setLocalError] = useState('')
  const [dragging, setDragging] = useState(false)

  const validate = (file: File) => {
    const allowed = imageOnly
      ? ['image/jpeg', 'image/png']
      : ['application/pdf', 'image/jpeg', 'image/png']
    const extension = file.name.toLowerCase().split('.').pop()
    const extensionAllowed = (imageOnly ? ['jpg', 'jpeg', 'png'] : ['pdf', 'jpg', 'jpeg', 'png']).includes(
      extension || '',
    )
    if (!allowed.includes(file.type) && !extensionAllowed) return messages.fileType
    if (file.size > maxSizeMb * 1024 * 1024) return `${messages.fileSize} (${messages.maxSize} ${maxSizeMb} MB)`
    return ''
  }

  const acceptFile = (file: File | undefined) => {
    if (!file) return
    const validation = validate(file)
    if (validation) {
      setLocalError(validation)
      return
    }
    setLocalError('')
    onChange(file)
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    acceptFile(event.dataTransfer.files[0])
  }

  const shownError = error || localError

  return (
    <div
      className={cn(
        'rounded-3xl border bg-white p-5 transition sm:p-6',
        shownError ? 'border-brand-error/60' : 'border-brand-line',
        disabled && 'opacity-65',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-brand-charcoal">{label}</p>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.14em]',
                required ? 'bg-brand-orange/10 text-brand-dark' : 'bg-brand-line/70 text-brand-muted',
              )}
            >
              {required ? requiredLabel : optionalLabel}
            </span>
          </div>
          {description ? <p className="mt-1.5 text-xs leading-5 text-brand-muted">{description}</p> : null}
          {why ? (
            <p className="mt-1 flex items-start gap-1.5 text-xs leading-5 text-brand-muted">
              <span className="mt-px font-semibold text-brand-charcoal">{whyLabel}</span>
              {why}
            </p>
          ) : null}
        </div>
        <span className="shrink-0 rounded-full bg-brand-cream px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-brand-muted">
          {messages.types} · {messages.maxSize} {maxSizeMb} MB
        </span>
      </div>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        disabled={disabled}
        className="sr-only"
        aria-label={`${messages.upload}: ${label}`}
        onChange={(event) => {
          acceptFile(event.target.files?.[0])
          event.target.value = ''
        }}
      />

      {value ? (
        <div className="mt-4 rounded-2xl border border-brand-line bg-brand-cream/60 p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-brand-dark ring-1 ring-brand-line">
              {uploaded ? (
                <FileCheck2 className="h-5 w-5 text-brand-success" aria-hidden="true" />
              ) : (
                <FileText className="h-5 w-5" aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-brand-charcoal">{value.name}</p>
              <p className="mt-0.5 text-xs text-brand-muted">
                {formatFileSize(value.size)} ·{' '}
                <span className={uploaded ? 'font-semibold text-brand-success' : ''}>
                  {uploaded ? messages.uploaded || messages.selected : messages.selected}
                </span>
              </p>
              {typeof progress === 'number' && progress > 0 && progress < 100 ? (
                <div className="mt-3">
                  <div className="h-1.5 overflow-hidden rounded-full bg-brand-line">
                    <div
                      className="h-full rounded-full bg-brand-orange transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[0.68rem] font-semibold text-brand-muted">{progress}%</p>
                </div>
              ) : null}
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 min-h-0 px-3"
                onClick={() => inputRef.current?.click()}
                disabled={disabled}
              >
                <Replace className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">{messages.replace}</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 min-h-0 px-3 text-brand-error hover:bg-brand-error/10"
                onClick={() => {
                  onChange(null)
                  setLocalError('')
                  if (inputRef.current) inputRef.current.value = ''
                }}
                disabled={disabled}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="sr-only">{messages.remove}</span>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          onClick={() => !disabled && inputRef.current?.click()}
          onKeyDown={(event) => {
            if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault()
              inputRef.current?.click()
            }
          }}
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'mt-4 flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-6 text-center transition',
            dragging
              ? 'border-brand-orange bg-brand-orange/5'
              : 'border-brand-line bg-brand-cream/40 hover:border-brand-orange/50 hover:bg-brand-cream',
          )}
          aria-label={`${messages.upload}: ${label}`}
        >
          <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-brand-dark ring-1 ring-brand-line">
            <UploadCloud className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-sm font-semibold text-brand-charcoal">{messages.upload}</span>
          <span className="text-xs text-brand-muted">{messages.types}</span>
        </div>
      )}

      {shownError ? (
        <p className="field-error" role="alert">
          {shownError}
        </p>
      ) : null}
    </div>
  )
}
