import { useId, useRef, useState, type ChangeEvent } from 'react'
import { ImagePlus, Trash2, UploadCloud } from 'lucide-react'
import { cn, formatFileSize } from '../../lib/utils'
import { Button } from '../ui/Button'

interface MultiFileUploaderProps {
  label: string
  hint?: string
  files: File[]
  onChange: (files: File[]) => void
  maxFiles?: number
  maxSizeMb?: number
  imageOnly?: boolean
  messages: {
    add: string
    remove: string
    count: string
    max: string
    fileType: string
    fileSize: string
    hint?: string
  }
  disabled?: boolean
}

export function MultiFileUploader({
  label,
  hint,
  files,
  onChange,
  maxFiles = 3,
  maxSizeMb = 10,
  imageOnly = false,
  messages,
  disabled,
}: MultiFileUploaderProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')

  const addFiles = (incoming: FileList | null) => {
    if (!incoming?.length) return
    const next = [...files]
    let nextError = ''
    Array.from(incoming).forEach((file) => {
      if (next.length >= maxFiles) {
        nextError = messages.max
        return
      }
      const extension = file.name.toLowerCase().split('.').pop()
      const allowed = imageOnly
        ? ['image/jpeg', 'image/png']
        : ['application/pdf', 'image/jpeg', 'image/png']
      const extensionAllowed = (imageOnly ? ['jpg', 'jpeg', 'png'] : ['pdf', 'jpg', 'jpeg', 'png']).includes(
        extension || '',
      )
      if (!allowed.includes(file.type) && !extensionAllowed) {
        nextError = messages.fileType
        return
      }
      if (file.size > maxSizeMb * 1024 * 1024) {
        nextError = `${messages.fileSize} (${maxSizeMb} MB)`
        return
      }
      next.push(file)
    })
    if (next.length !== files.length) {
      onChange(next)
      setError(nextError)
    } else if (nextError) {
      setError(nextError)
    }
  }

  return (
    <div className={cn('rounded-3xl border border-brand-line bg-white p-5 sm:p-6', disabled && 'opacity-65')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-brand-charcoal">{label}</p>
          {hint ? <p className="mt-1.5 text-xs leading-5 text-brand-muted">{hint}</p> : null}
        </div>
        <span className="rounded-full bg-brand-cream px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-brand-muted">
          {files.length}/{maxFiles}
        </span>
      </div>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={imageOnly ? '.jpg,.jpeg,.png' : '.jpg,.jpeg,.png,.pdf'}
        multiple
        disabled={disabled}
        className="sr-only"
        aria-label={`${messages.add}: ${label}`}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          addFiles(event.target.files)
          if (inputRef.current) inputRef.current.value = ''
        }}
      />

      {files.length ? (
        <ul className="mt-4 space-y-2">
          {files.map((file) => (
            <li
              key={`${file.name}-${file.size}-${file.lastModified}`}
              className="flex items-center gap-3 rounded-2xl border border-brand-line bg-brand-cream/60 p-3"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-brand-dark ring-1 ring-brand-line">
                <ImagePlus className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-brand-charcoal">{file.name}</p>
                <p className="text-[0.68rem] text-brand-muted">{formatFileSize(file.size)}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 min-h-0 px-2.5 text-brand-error hover:bg-brand-error/10"
                onClick={() => onChange(files.filter((item) => item !== file))}
                disabled={disabled}
                aria-label={`${messages.remove}: ${file.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      <button
        type="button"
        disabled={disabled || files.length >= maxFiles}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'mt-4 flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-5 text-center transition',
          'border-brand-line bg-brand-cream/40 hover:border-brand-orange/50 hover:bg-brand-cream',
          (disabled || files.length >= maxFiles) && 'cursor-not-allowed opacity-55',
        )}
      >
        <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-brand-dark ring-1 ring-brand-line">
          <UploadCloud className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="text-xs font-semibold text-brand-charcoal">{messages.add}</span>
        <span className="text-[0.68rem] text-brand-muted">
          {messages.hint || hint} · {files.length} {messages.count}
        </span>
      </button>

      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
