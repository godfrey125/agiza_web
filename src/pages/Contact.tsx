import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { LockKeyhole, Mail, MessageSquare, Phone, Send } from 'lucide-react'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { CheckboxField, SelectField, TextareaField, TextInput } from '../components/ui/Field'
import { Eyebrow } from '../components/ui/Layout'
import { useCopy } from '../i18n'
import { ApiError, submitContact } from '../lib/api'
import { isContactEndpointConfigured } from '../lib/config'
import { emailPattern, mapOptions } from '../lib/forms'
import { isValidTZPhone } from '../lib/utils'

interface ContactValues {
  name: string
  phone: string
  email: string
  topic: string
  message: string
  consent: boolean
}

const topicCodes = ['support', 'vendor', 'rider', 'review', 'partnership', 'legal', 'other'] as const

export function Contact() {
  const c = useCopy()
  const [serverError, setServerError] = useState('')
  const [sent, setSent] = useState(false)

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(3, c.validation.name),
        phone: z.string().min(1, c.validation.required).refine(isValidTZPhone, c.validation.phone),
        email: z
          .string()
          .trim()
          .refine((value) => !value || emailPattern.test(value), c.validation.email),
        topic: z.string().min(1, c.validation.select),
        message: z.string().trim().min(20, c.validation.description),
        consent: z.boolean().refine(Boolean, c.validation.consent),
      }),
    [c],
  )

  const methods = useForm<ContactValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { name: '', phone: '', email: '', topic: '', message: '', consent: false },
  })
  const { formState, register, reset } = methods
  const errors = formState.errors

  const onSubmit = methods.handleSubmit(async (values) => {
    setServerError('')
    setSent(false)
    if (!isContactEndpointConfigured) return
    try {
      await submitContact({
        name: values.name,
        phone: values.phone,
        email: values.email || undefined,
        topic: values.topic,
        message: values.message,
      })
      setSent(true)
      reset()
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : c.contact.missingBody)
    }
  })

  return (
    <>
      <section className="relative overflow-hidden border-b border-brand-line">
        <div
          className="pointer-events-none absolute -right-40 top-0 h-[460px] w-[460px] rounded-full bg-brand-orange/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="container-page relative py-12 sm:py-16 lg:py-20">
          <Eyebrow>{c.contact.eyebrow}</Eyebrow>
          <h1 className="mt-5 max-w-3xl font-display text-[2.6rem] font-extrabold leading-[0.98] tracking-[-0.055em] text-brand-charcoal sm:text-[3.8rem]">
            {c.contact.title}
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-brand-muted sm:text-base">{c.contact.lead}</p>
        </div>
      </section>

      <section className="container-page py-10 sm:py-14">
        <div className="mx-auto grid max-w-6xl items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="surface-card p-5 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-orange/10 text-brand-dark">
                <MessageSquare className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-display text-xl font-bold tracking-tight text-brand-charcoal">
                  {c.contact.formTitle}
                </h2>
                <p className="mt-1 text-xs leading-5 text-brand-muted">{c.contact.formBody}</p>
              </div>
            </div>

            {!isContactEndpointConfigured ? (
              <Alert tone="warning" title={c.contact.missingTitle} className="mt-5">
                <p>{c.contact.missingBody}</p>
                <p className="mt-2 text-xs">{c.contact.missingHint}</p>
              </Alert>
            ) : null}

            {sent ? (
              <Alert tone="success" title={c.contact.successTitle} className="mt-5">
                {c.contact.successBody}
              </Alert>
            ) : null}

            {serverError ? (
              <Alert tone="error" className="mt-5">
                {serverError}
              </Alert>
            ) : null}

            <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <TextInput
                  label={c.contact.name}
                  autoComplete="name"
                  error={errors.name?.message}
                  {...register('name')}
                />
                <TextInput
                  label={c.contact.phone}
                  hint={c.validation.phone}
                  inputMode="tel"
                  autoComplete="tel"
                  leading={<Phone className="h-4 w-4" aria-hidden="true" />}
                  error={errors.phone?.message}
                  {...register('phone')}
                />
                <TextInput
                  label={c.contact.email}
                  type="email"
                  autoComplete="email"
                  leading={<Mail className="h-4 w-4" aria-hidden="true" />}
                  optional
                  optionalLabel={c.common.optional}
                  error={errors.email?.message}
                  {...register('email')}
                />
                <SelectField
                  label={c.contact.topic}
                  options={mapOptions(topicCodes, c.contact.topics)}
                  placeholder={c.validation.select}
                  error={errors.topic?.message}
                  {...register('topic')}
                />
              </div>

              <TextareaField
                label={c.contact.message}
                hint={c.contact.messageHint}
                error={errors.message?.message}
                {...register('message')}
              />

              <CheckboxField
                label={c.contact.consent}
                error={errors.consent?.message}
                {...register('consent')}
              />

              <div className="flex flex-col gap-3 border-t border-brand-line pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-start gap-2 text-xs leading-5 text-brand-muted">
                  <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-dark" aria-hidden="true" />
                  {c.contact.privacyNote}
                </p>
                <Button
                  type="submit"
                  size="lg"
                  loading={formState.isSubmitting}
                  disabled={!isContactEndpointConfigured}
                >
                  {formState.isSubmitting ? c.common.sending : c.contact.submit}
                  <Send className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </form>
          </div>

          <aside className="space-y-4">
            <div className="rounded-3xl bg-brand-charcoal p-6 text-white">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-brand-orange">
                {c.contact.formTitle}
              </p>
              <p className="mt-3 text-sm leading-7 text-white/65">{c.contact.formBody}</p>
              <ul className="mt-4 space-y-2">
                {[c.contact.privacyNote, c.footer.contactPending].map((item) => (
                  <li key={item} className="text-xs leading-5 text-white/55">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border border-brand-line bg-white p-6">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-brand-muted">
                {c.footer.legal}
              </p>
              <div className="mt-3 space-y-2 text-sm font-semibold">
                <Link to="/privacy" className="block text-brand-dark underline underline-offset-4">
                  {c.legal.privacyTitle}
                </Link>
                <Link to="/terms" className="block text-brand-dark underline underline-offset-4">
                  {c.legal.termsTitle}
                </Link>
                <Link to="/faq" className="block text-brand-dark underline underline-offset-4">
                  {c.faq.eyebrow}
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </>
  )
}
