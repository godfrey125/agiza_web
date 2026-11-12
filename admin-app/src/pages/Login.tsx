import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, KeyRound, Loader2, LockKeyhole, Mail, ShieldCheck, Sparkles } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { ApiError } from '../lib/api'
import { agizaLinks } from '../lib/links'
import { Field, Input } from '../components/ui'

export default function LoginPage() {
  const { user, loading, signIn, verifyTwoFactor } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('admin@agiza.app')
  const [password, setPassword] = useState('Admin@123')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [challenge, setChallenge] = useState('')
  const [code, setCode] = useState('')

  useEffect(() => {
    if (!loading && user) navigate('/dashboard', { replace: true })
  }, [loading, user, navigate])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const result = await signIn(email.trim(), password)
      if (result.requires2fa && result.challengeToken) setChallenge(result.challengeToken)
      else navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign-in failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const submitCode = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await verifyTwoFactor(challenge, code)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That code did not work.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream lg:grid lg:grid-cols-[1.06fr_.94fr]">
      <section className="relative hidden overflow-hidden bg-[linear-gradient(145deg,#252525_0%,#3A302B_58%,#5A3428_100%)] px-12 py-11 text-white lg:flex lg:flex-col lg:justify-between xl:px-16">
        <div className="absolute -left-32 -top-32 h-[430px] w-[430px] rounded-full bg-primary/25 blur-[110px]" />
        <div className="absolute -bottom-24 right-[-120px] h-[420px] w-[420px] rounded-full bg-[#EAB544]/20 blur-[110px]" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-primary shadow-float">
            <svg width="25" height="25" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5.2 19 11 5h2l5.8 14h-2.6l-1.4-3.6H9.2L7.8 19H5.2Zm4.8-5.7h4L12 8.1l-2 5.2Z" fill="currentColor" />
              <circle cx="18.4" cy="18" r="2.1" fill="currentColor" opacity=".72" />
            </svg>
          </div>
          <div>
            <p className="font-display text-xl font-extrabold tracking-[-0.03em]">Agiza Admin</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/45">Platform control center</p>
          </div>
        </div>

        <div className="relative z-10 max-w-lg">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.06] px-3 py-1.5 text-[11px] font-semibold text-white/70">
            <Sparkles size={12} className="text-[#EAB544]" /> One calm control center
          </p>
          <h1 className="font-display text-[42px] font-extrabold leading-[1.04] tracking-[-0.045em] xl:text-[50px]">
            Run the whole Agiza marketplace, from one control center.
          </h1>
          <p className="mt-5 max-w-md text-sm leading-7 text-white/55">
            Live orders, riders, vendors, food, payments, partner applications, accounts, trust &amp;
            safety and staff roles — connected to the live Django API and protected by role-based
            access.
          </p>
          <div className="mt-9 grid grid-cols-3 gap-3">
            {[
              ['Orders', 'Live flow', 'Vendor → rider → delivered'],
              ['Riders', 'Fleet', 'Online, assigned, delivered'],
              ['Vendors', 'Catalogue', 'Food, availability, reviews'],
            ].map(([label, value, text]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[.045] p-3.5 backdrop-blur-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/35">{label}</p>
                <p className="mt-1.5 font-display text-sm font-bold text-white">{value}</p>
                <p className="mt-1 text-[10px] leading-4 text-white/40">{text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-2 text-[11px] text-white/35">
          <ShieldCheck size={14} className="text-[#43A66A]" /> Supabase Google sign-in · Django JWT sessions · server-enforced permissions
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[420px]">
          <div className="mb-9 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-primary text-white shadow-soft">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5.2 19 11 5h2l5.8 14h-2.6l-1.4-3.6H9.2L7.8 19H5.2Zm4.8-5.7h4L12 8.1l-2 5.2Z" fill="currentColor" />
                <circle cx="18.4" cy="18" r="2.1" fill="currentColor" opacity=".72" />
              </svg>
            </div>
            <div>
              <p className="font-display text-lg font-extrabold tracking-tight">Agiza Admin</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Platform control center</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-line bg-[linear-gradient(135deg,#FFF0E8,#FAF7F2)] p-4 shadow-soft">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
                <ShieldCheck size={16} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink">Platform administrator?</p>
                <p className="mt-0.5 text-[11px] leading-5 text-muted">
                  Open the Agiza Admin control center with Google. Only the platform administrator
                  account is allowed.
                </p>
              </div>
            </div>
            <Link to="/marketplace" className="btn-primary mt-3 w-full">
              Open Agiza Admin <ArrowRight size={15} />
            </Link>
          </div>

          <p className="eyebrow mb-2 mt-8">{challenge ? 'Two-step verification' : 'Restaurant workspace'}</p>
          <h2 className="font-display text-[30px] font-extrabold tracking-[-0.04em] text-ink">
            {challenge ? 'Enter your authenticator code' : 'Sign in to the restaurant workspace'}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            {challenge
              ? 'Open your authenticator app and enter the six-digit code for Agiza Admin.'
              : 'Use your restaurant staff account. Platform administrators sign in with Google above.'}
          </p>

          {error && (
            <div className="mt-5 rounded-xl border border-[#f4d7d2] bg-soft-red px-3.5 py-3 text-sm font-medium text-coral">{error}</div>
          )}

          {challenge ? (
            <form onSubmit={submitCode} className="mt-7 space-y-4">
              <Field label="Authenticator code">
                <div className="relative">
                  <KeyRound size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                  <Input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} className="pl-10 text-center text-lg font-bold tracking-[0.35em]" placeholder="000000" inputMode="numeric" autoFocus />
                </div>
              </Field>
              <button type="submit" disabled={submitting || code.length !== 6} className="btn-primary w-full py-3">
                {submitting ? <Loader2 size={17} className="animate-spin" /> : <ArrowRight size={17} />}
                Verify and continue
              </button>
              <button type="button" onClick={() => { setChallenge(''); setCode(''); setError('') }} className="btn-ghost w-full">
                Back to sign in
              </button>
            </form>
          ) : (
            <form onSubmit={submit} className="mt-7 space-y-4">
              <Field label="Email address">
                <div className="relative">
                  <Mail size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                  <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="pl-10" placeholder="you@restaurant.com" autoComplete="email" required />
                </div>
              </Field>
              <Field label="Password">
                <div className="relative">
                  <LockKeyhole size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                  <Input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} className="pl-10 pr-11" placeholder="••••••••" autoComplete="current-password" required />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition hover:text-ink" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </Field>
              <button type="submit" disabled={submitting} className="btn-primary w-full py-3">
                {submitting ? <Loader2 size={17} className="animate-spin" /> : <ArrowRight size={17} />}
                {submitting ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          )}

          <div className="mt-6 rounded-2xl border border-line bg-white p-4 shadow-soft">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-peach text-primary"><ShieldCheck size={14} /></span>
              <p className="text-xs font-bold text-ink">Restaurant workspace demo</p>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted">The seeded restaurant Super Admin account is pre-filled above. This workspace is backed by the local SQLite database; platform administration uses the live Django API.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-lg bg-[#fbf8f3] px-2 py-1 text-[10px] font-medium text-[#5f5a53]">admin@agiza.app</span>
              <span className="rounded-lg bg-[#fbf8f3] px-2 py-1 text-[10px] font-medium text-[#5f5a53]">Admin@123</span>
            </div>
          </div>

          <p className="mt-8 text-center text-[11px] text-muted">
            Having trouble signing in? Ask your restaurant Super Admin to review your account. <Link to="/marketplace" className="font-semibold text-primary hover:underline">Platform admin</Link>
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] text-muted">
            <span className="font-semibold text-[#5f5a53]">Agiza Admin · Platform control center</span>
            <a href={agizaLinks.website} target="_blank" rel="noreferrer" className="font-semibold text-primary hover:underline">Agiza website</a>
            <a href={agizaLinks.apk} className="font-semibold text-primary hover:underline">Download the Agiza app</a>
          </div>
        </div>
      </section>
    </div>
  )
}
