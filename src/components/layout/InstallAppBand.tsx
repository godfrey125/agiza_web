import { Download, Smartphone } from 'lucide-react'
import { useCopy } from '../../i18n'
import { siteConfig } from '../../lib/config'
import { cn } from '../../lib/utils'

export function InstallAppBand({ className }: { className?: string }) {
  const c = useCopy()
  const apkUrl = siteConfig.app.apkUrl

  if (!apkUrl) return null

  return (
    <section
      aria-labelledby="install-agiza-title"
      className={cn('border-t border-white/10 bg-brand-charcoal text-white', className)}
    >
      <div className="container-page py-8 sm:py-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/10 text-brand-orange">
              <Smartphone className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-brand-orange">
                {c.appDownload.installTag}
              </p>
              <h2
                id="install-agiza-title"
                className="mt-1 font-display text-xl font-extrabold leading-tight tracking-[-0.03em] sm:text-2xl"
              >
                {c.appDownload.installTitle}
              </h2>
              <p className="mt-1 max-w-xl text-sm leading-6 text-white/55">
                {c.appDownload.installBody}
              </p>
            </div>
          </div>
          <a
            href={apkUrl}
            download
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-brand-orange px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_-14px_rgba(244,119,33,0.85)] transition hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-2 focus-visible:ring-offset-brand-charcoal"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {c.appDownload.installCta}
          </a>
        </div>
      </div>
    </section>
  )
}
