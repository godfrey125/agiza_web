import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, LockKeyhole, Phone, ShieldCheck, Smartphone } from 'lucide-react'
import { Alert } from '../components/ui/Alert'
import { Badge } from '../components/ui/Badge'
import { Button, ButtonLink } from '../components/ui/Button'
import { TextInput } from '../components/ui/Field'
import { Eyebrow } from '../components/ui/Layout'
import { useCopy, useI18n } from '../i18n'
import { controlCopy } from '../i18n/control'
import { useAuth } from '../lib/auth'
import { ApiError, submitPublicAppeal } from '../lib/api'
import { formatPhoneTZ, isValidTZPhone } from '../lib/utils'

type Step = 'phone' | 'code'

export function Login() {
  const c = useCopy()
  const { lang } = useI18n()
  const ac = controlCopy[lang]
  const { sendOtp, confirmOtp, isAuthenticated, user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [devOtp, setDevOtp] = useState('')
  const [serverError, setServerError] = useState('')
  const [resending, setResending] = useState(false)
  const [showAppeal, setShowAppeal] = useState(false)
  const [appealMessage, setAppealMessage] = useState('')
  const [appealStatus, setAppealStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [appealError, setAppealError] = useState('')

  const phoneSchema = useMemo(
    () =>
      z.object({
        phone: z
          .string()
          .min(1, c.validation.required)
          .refine(isValidTZPhone, c.validation.phone),
      }),
    [c],
  )

  const codeSchema = useMemo(
    () =>
      z.object({
        otp: z.string().regex(/^\d{6}$/, c.validation.otp),
      }),
    [c],
  )

  const phoneForm = useForm<{ phone: string }>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: '' },
  })

  const codeForm = useForm<{ otp: string }>({
    resolver: zodResolver(codeSchema),
    defaultValues: { otp: '' },
  })

  useEffect(() => {
    if (isAuthenticated) setStep('phone')
  }, [isAuthenticated])

  const submitPhone = phoneForm.handleSubmit(async (values) => {
    setServerError('')
    setShowAppeal(false)
    setAppealStatus('idle')
    setAppealError('')
    try {
      const result = await sendOtp(values.phone)
      setPhone(formatPhoneTZ(values.phone))
      setDevOtp(result.devOtp || '')
      setStep('code')
      codeForm.reset()
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : c.auth.errorGeneric)
    }
  })

  const submitCode = codeForm.handleSubmit(async (values) => {
    setServerError('')
    try {
      const signedIn = await confirmOtp(phone, values.otp)
      const from = (location.state as { from?: string } | null)?.from
      if (from) {
        navigate(from, { replace: true })
      } else if (signedIn.role === 'admin') {
        navigate('/admin', { replace: true })
      } else {
        navigate('/application-status', { replace: true })
      }
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : c.auth.errorCode)
      if (error instanceof ApiError && error.status === 403) {
        setShowAppeal(true)
      }
    }
  })

  const submitAppeal = async () => {
    setAppealError('')
    if (appealMessage.trim().length < 20) {
      setAppealError(ac.loginAppeal.messageHint)
      return
    }
    setAppealStatus('sending')
    try {
      await submitPublicAppeal(phone, appealMessage.trim())
      setAppealStatus('sent')
      setAppealMessage('')
    } catch (error) {
      setAppealStatus('error')
      setAppealError(error instanceof ApiError ? error.message : ac.loginAppeal.error)
    }
  }

  const resend = async () => {
    setServerError('')
    setResending(true)
    try {
      const result = await sendOtp(phone)
      setDevOtp(result.devOtp || '')
      codeForm.reset()
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : c.auth.errorGeneric)
    } finally {
      setResending(false)
    }
  }

  if (isAuthenticated && user) {
    return (
      <section className="container-page py-16 sm:py-24">
        <div className="mx-auto max-w-lg">
          <div className="surface-card p-7 text-center sm:p-10">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-success/10 text-brand-success">
              <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
            </span>
            <h1 className="mt-5 font-display text-2xl font-extrabold tracking-tight text-brand-charcoal">{c.nav.account}</h1>
            <p className="mt-2 text-sm leading-6 text-brand-muted">
              {c.nav.signedInAs} <span className="font-bold text-brand-charcoal">{user.username}</span>
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <ButtonLink to="/application-status" fullWidth size="lg">
                {c.nav.status}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </ButtonLink>
              {user.role === 'admin' ? (
                <ButtonLink to="/admin" fullWidth size="lg" variant="secondary">
                  {c.nav.admin}
                </ButtonLink>
              ) : (
                <ButtonLink to="/get-started" fullWidth size="lg" variant="secondary">
                  {c.common.becomePartner}
                </ButtonLink>
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  logout()
                  navigate('/')
                }}
              >
                {c.nav.logout}
              </Button>
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute -right-56 top-10 h-[620px] w-[620px] rounded-full bg-brand-orange/10 blur-3xl" aria-hidden="true" />
      <div className="container-page relative grid min-h-[calc(100dvh-74px)] items-center gap-12 py-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-20 lg:py-20">
        <div className="hidden lg:block">
          <Eyebrow>{c.auth.eyebrow}</Eyebrow>
          <h1 className="mt-5 font-display text-[3.2rem] font-extrabold leading-[0.96] tracking-[-0.06em] text-brand-charcoal">
            {c.auth.title}
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-brand-muted">{c.auth.subtitle}</p>

          <div className="mt-9 space-y-3">
            {[
              { icon: ShieldCheck, title: c.home.trustCards[1].title, body: c.home.trustCards[1].description },
              { icon: LockKeyhole, title: c.home.trustCards[2].title, body: c.home.trustCards[2].description },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex gap-3 rounded-2xl border border-brand-line bg-white/60 p-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-cream text-brand-dark ring-1 ring-brand-line">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-bold text-brand-charcoal">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-brand-muted">{body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-2">
            <Badge tone="neutral">{c.labels.phoneNumbers}</Badge>
            <Badge tone="neutral">{c.labels.secureOtp}</Badge>
            <Badge tone="neutral">{c.labels.accessTokenSession}</Badge>
          </div>
        </div>

        <div className="mx-auto w-full max-w-lg">
          <div className="surface-card overflow-hidden">
            <div className="border-b border-brand-line bg-brand-cream/70 px-6 py-5 sm:px-8">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-charcoal text-brand-orange">
                    <Smartphone className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-brand-charcoal">
                      {step === 'phone' ? c.auth.phoneLabel : c.auth.codeLabel}
                    </p>
                    <p className="text-[0.65rem] text-brand-muted">
                      {step === 'phone' ? c.auth.phoneHint : phone}
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-brand-muted ring-1 ring-brand-line">
                  {step === 'phone' ? '1 / 2' : '2 / 2'}
                </span>
              </div>
            </div>

            <div className="p-6 sm:p-8">
              {serverError ? (
                <Alert tone="error" className="mb-5" title={c.auth.errorGeneric}>
                  {serverError}
                </Alert>
              ) : null}

              {showAppeal && step === 'code' ? (
                <div className="mb-5 rounded-2xl border border-brand-line bg-brand-cream/60 p-4">
                  {appealStatus === 'sent' ? (
                    <Alert tone="success" title={ac.loginAppeal.title}>
                      {ac.loginAppeal.success}
                    </Alert>
                  ) : (
                    <>
                      <h3 className="font-display text-base font-extrabold tracking-[-0.02em] text-brand-charcoal">
                        {ac.loginAppeal.title}
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-brand-muted">{ac.loginAppeal.body}</p>
                      <textarea
                        value={appealMessage}
                        onChange={(event) => setAppealMessage(event.target.value)}
                        placeholder={ac.loginAppeal.placeholder}
                        rows={4}
                        className="input-base mt-3 resize-y"
                      />
                      <p className="field-hint">{ac.loginAppeal.messageHint}</p>
                      {appealError ? (
                        <p className="field-error" role="alert">{appealError}</p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void submitAppeal()}
                          loading={appealStatus === 'sending'}
                          disabled={appealStatus === 'sending'}
                        >
                          {appealStatus === 'sending' ? ac.loginAppeal.submitting : ac.loginAppeal.submit}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setShowAppeal(false)
                            setAppealError('')
                          }}
                        >
                          {ac.loginAppeal.close}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ) : null}

              {step === 'phone' ? (
                <form onSubmit={submitPhone} noValidate>
                  <h2 className="font-display text-2xl font-extrabold tracking-tight text-brand-charcoal">{c.auth.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-brand-muted">{c.auth.subtitle}</p>

                  <div className="mt-6">
                    <TextInput
                      label={c.auth.phoneLabel}
                      hint={c.auth.phoneHint}
                      placeholder="712 345 678"
                      inputMode="tel"
                      autoComplete="tel"
                      leading={<Phone className="h-4 w-4" aria-hidden="true" />}
                      trailing={<span className="text-xs font-bold text-brand-muted">+255</span>}
                      error={phoneForm.formState.errors.phone?.message}
                      {...phoneForm.register('phone')}
                    />
                  </div>

                  <Button type="submit" fullWidth size="lg" className="mt-5" loading={phoneForm.formState.isSubmitting}>
                    {c.auth.sendCode}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>

                  <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-brand-muted">
                    <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-dark" aria-hidden="true" />
                    {c.auth.secure}
                  </p>

                  <p className="mt-6 border-t border-brand-line pt-5 text-xs leading-5 text-brand-muted">
                    {c.auth.noAccount}{' '}
                    <Link to="/get-started" className="font-bold text-brand-dark underline underline-offset-4">
                      {c.common.becomePartner}
                    </Link>
                  </p>
                </form>
              ) : (
                <form onSubmit={submitCode} noValidate>
                  <h2 className="font-display text-2xl font-extrabold tracking-tight text-brand-charcoal">{c.auth.codeLabel}</h2>
                  <p className="mt-2 text-sm leading-6 text-brand-muted">
                    {c.auth.codeHint} <span className="font-semibold text-brand-charcoal">{phone}</span>
                  </p>

                  {devOtp ? (
                    <Alert tone="warning" className="mt-5" title={c.auth.devNotice}>
                      <span className="block text-xs">{c.auth.devCode}</span>
                      <span className="mt-1 block font-mono text-2xl font-bold tracking-[0.35em] text-brand-charcoal">{devOtp}</span>
                    </Alert>
                  ) : null}

                  <div className="mt-6">
                    <TextInput
                      label={c.auth.codeLabel}
                      hint={c.auth.codeHint}
                      placeholder="000000"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      className="text-center text-2xl font-bold tracking-[0.5em]"
                      error={codeForm.formState.errors.otp?.message}
                      {...codeForm.register('otp')}
                    />
                  </div>

                  <Button type="submit" fullWidth size="lg" className="mt-5" loading={codeForm.formState.isSubmitting}>
                    {c.auth.verify}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setStep('phone')
                        setDevOtp('')
                        setServerError('')
                      }}
                      className="inline-flex items-center gap-1.5 font-semibold text-brand-muted hover:text-brand-charcoal"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                      {c.auth.changeNumber}
                    </button>
                    <button
                      type="button"
                      onClick={resend}
                      disabled={resending}
                      className="font-bold text-brand-dark underline underline-offset-4 disabled:opacity-50"
                    >
                      {resending ? c.common.sending : c.auth.resend}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {import.meta.env.DEV ? (
            <p className="mt-5 flex items-start gap-2 px-2 text-xs leading-5 text-brand-muted">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-warning" aria-hidden="true" />
              {c.auth.devNotice}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}
