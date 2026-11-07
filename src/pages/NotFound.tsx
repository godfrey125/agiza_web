import { ArrowRight, Compass, Home } from 'lucide-react'
import { ButtonLink } from '../components/ui/Button'
import { Eyebrow } from '../components/ui/Layout'
import { useCopy } from '../i18n'

export function NotFound() {
  const c = useCopy()

  return (
    <section className="container-page flex min-h-[calc(100dvh-74px)] items-center py-16">
      <div className="mx-auto max-w-xl text-center">
        <Eyebrow>{c.notFound.eyebrow}</Eyebrow>
        <p className="mt-6 font-display text-[5rem] font-extrabold leading-none tracking-[-0.08em] text-brand-charcoal sm:text-[7rem]">
          404
        </p>
        <h1 className="mt-2 font-display text-[2rem] font-extrabold leading-[1.05] tracking-[-0.045em] text-brand-charcoal sm:text-[2.6rem]">
          {c.notFound.title}
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-brand-muted">{c.notFound.body}</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <ButtonLink to="/" size="lg">
            <Home className="h-4 w-4" aria-hidden="true" />
            {c.common.backHome}
          </ButtonLink>
          <ButtonLink to="/services" size="lg" variant="secondary">
            <Compass className="h-4 w-4" aria-hidden="true" />
            {c.common.viewServices}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </ButtonLink>
        </div>
      </div>
    </section>
  )
}
