import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { cn } from '../../lib/utils'

export type ButtonVariant = 'primary' | 'dark' | 'secondary' | 'ghost' | 'outline' | 'link'
export type ButtonSize = 'sm' | 'md' | 'lg'

export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-none'
  const variants: Record<ButtonVariant, string> = {
    primary:
      'bg-brand-orange text-white shadow-[0_12px_30px_-14px_rgba(244,119,33,0.85)] hover:bg-brand-dark active:translate-y-px',
    dark: 'bg-brand-charcoal text-white hover:bg-black active:translate-y-px',
    secondary:
      'border border-brand-line bg-white text-brand-charcoal hover:border-brand-charcoal/25 hover:bg-brand-cream active:translate-y-px',
    ghost: 'text-brand-charcoal hover:bg-brand-line/60',
    outline:
      'border border-white/25 bg-transparent text-white hover:border-white/60 hover:bg-white/10',
    link: 'h-auto rounded-none p-0 text-brand-dark underline decoration-brand-orange/40 underline-offset-4 hover:decoration-brand-orange',
  }
  const sizes: Record<ButtonSize, string> = {
    sm: 'min-h-10 px-4 py-2 text-xs',
    md: 'min-h-12 px-5 py-3 text-sm',
    lg: 'min-h-14 px-7 py-4 text-sm sm:text-base',
  }
  return cn(base, variants[variant], variant === 'link' ? '' : sizes[size], className)
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', fullWidth, loading, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={buttonClasses(variant, size, cn(fullWidth && 'w-full', className))}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
          aria-hidden="true"
        />
      ) : null}
      {children}
    </button>
  )
})

interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
}

export function ButtonLink({
  className,
  variant = 'primary',
  size = 'md',
  fullWidth,
  ...props
}: ButtonLinkProps) {
  return <Link className={buttonClasses(variant, size, cn(fullWidth && 'w-full', className))} {...props} />
}

export function ExternalButtonLink({
  className,
  variant = 'secondary',
  size = 'md',
  fullWidth,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
}) {
  return (
    <a
      className={buttonClasses(variant, size, cn(fullWidth && 'w-full', className))}
      target="_blank"
      rel="noreferrer noopener"
      {...props}
    />
  )
}
