import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { AlertCircle, Check } from 'lucide-react'
import { cn } from '../../lib/utils'

interface FieldShellProps {
  id: string
  label: string
  hint?: string
  error?: string
  optional?: boolean
  optionalLabel?: string
  children: ReactNode
  className?: string
}

export function FieldShell({
  id,
  label,
  hint,
  error,
  optional,
  optionalLabel = 'Optional',
  children,
  className,
}: FieldShellProps) {
  return (
    <div className={cn('w-full', className)}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold text-brand-charcoal">
          {label}
        </label>
        {optional ? (
          <span className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-brand-muted">
            {optionalLabel}
          </span>
        ) : null}
      </div>
      {children}
      {error ? (
        <p className="field-error" id={`${id}-error`} role="alert">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p className="field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}

function describedBy(id: string, hint?: string, error?: string) {
  if (error) return `${id}-error`
  if (hint) return `${id}-hint`
  return undefined
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
  error?: string
  optional?: boolean
  optionalLabel?: string
  leading?: ReactNode
  trailing?: ReactNode
}

export const TextInput = forwardRef<HTMLInputElement, InputProps>(function TextInput(
  { label, hint, error, optional, optionalLabel, leading, trailing, className, id, ...props },
  ref,
) {
  const generated = useId()
  const fieldId = id || generated
  return (
    <FieldShell
      id={fieldId}
      label={label}
      hint={hint}
      error={error}
      optional={optional}
      optionalLabel={optionalLabel}
    >
      <div className="relative">
        {leading ? (
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-brand-muted">
            {leading}
          </span>
        ) : null}
        <input
          ref={ref}
          id={fieldId}
          className={cn(
            'input-base',
            leading && 'pl-11',
            trailing && 'pr-11',
            error && 'border-brand-error focus:border-brand-error focus:ring-brand-error/15',
            className,
          )}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy(fieldId, hint, error)}
          {...props}
        />
        {trailing ? (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-muted">{trailing}</span>
        ) : null}
      </div>
    </FieldShell>
  )
})

export type SelectOption = string | { value: string; label: string }

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  hint?: string
  error?: string
  optional?: boolean
  optionalLabel?: string
  options: readonly SelectOption[]
  placeholder?: string
}

export const SelectField = forwardRef<HTMLSelectElement, SelectProps>(function SelectField(
  { label, hint, error, optional, optionalLabel, options, placeholder, className, id, ...props },
  ref,
) {
  const generated = useId()
  const fieldId = id || generated
  const normalised = options.map((option) =>
    typeof option === 'string' ? { value: option, label: option } : option,
  )
  return (
    <FieldShell
      id={fieldId}
      label={label}
      hint={hint}
      error={error}
      optional={optional}
      optionalLabel={optionalLabel}
    >
      <select
        ref={ref}
        id={fieldId}
        className={cn('select-base', error && 'border-brand-error focus:border-brand-error', className)}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(fieldId, hint, error)}
        {...props}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {normalised.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  )
})

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  hint?: string
  error?: string
  optional?: boolean
  optionalLabel?: string
}

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaProps>(function TextareaField(
  { label, hint, error, optional, optionalLabel, className, id, ...props },
  ref,
) {
  const generated = useId()
  const fieldId = id || generated
  return (
    <FieldShell
      id={fieldId}
      label={label}
      hint={hint}
      error={error}
      optional={optional}
      optionalLabel={optionalLabel}
    >
      <textarea
        ref={ref}
        id={fieldId}
        className={cn(
          'input-base min-h-32 resize-y',
          error && 'border-brand-error focus:border-brand-error focus:ring-brand-error/15',
          className,
        )}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(fieldId, hint, error)}
        {...props}
      />
    </FieldShell>
  )
})

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode
  error?: string
}

export function CheckboxField({ label, error, className, id, ...props }: CheckboxProps) {
  const generated = useId()
  const fieldId = id || generated
  return (
    <div>
      <label
        htmlFor={fieldId}
        className={cn(
          'flex cursor-pointer items-start gap-3 rounded-2xl border border-brand-line bg-white p-4 text-sm leading-6 text-brand-muted transition hover:border-brand-orange/40',
          error && 'border-brand-error',
          className,
        )}
      >
        <span className="relative mt-0.5 grid h-5 w-5 shrink-0 place-items-center">
          <input
            id={fieldId}
            type="checkbox"
            className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-brand-line bg-white checked:border-brand-orange checked:bg-brand-orange focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-orange/20"
            aria-invalid={Boolean(error)}
            {...props}
          />
          <Check
            className="pointer-events-none absolute h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100"
            strokeWidth={3}
            aria-hidden="true"
          />
        </span>
        <span>{label}</span>
      </label>
      {error ? (
        <p className="field-error" role="alert">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </div>
  )
}
