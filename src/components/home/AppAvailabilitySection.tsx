import { motion } from 'framer-motion'
import {
  ArrowUpRight,
  Clock3,
  Download,
  ExternalLink,
  MapPin,
  Search,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Utensils,
  UserRound,
  Wifi,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCopy } from '../../i18n'
import { siteConfig } from '../../lib/config'
import { cn } from '../../lib/utils'
import { Badge } from '../ui/Badge'
import { Eyebrow, Section } from '../ui/Layout'

type PreviewPlatform = 'android' | 'ios'

interface PlatformCard {
  key: string
  platform: PreviewPlatform
  name: string
  meta: string
  url: string
  directDownload?: boolean
  badge?: string
  badgeAlt?: string
  badgeWidth?: number
  badgeHeight?: number
  logo: string
}

const previewMenu = [
  { name: 'Chipsi Mayai', meta: 'Chips · Eggs · Kachumbari', price: 'TSh 5,000' },
  { name: 'Pilau', meta: 'Spiced rice · Beef', price: 'TSh 8,000' },
]

function PreviewStatusBar({ platform }: { platform: PreviewPlatform }) {
  return (
    <div
      className={cn(
        'relative z-10 flex items-center justify-between px-3 text-[0.34rem] font-bold text-brand-charcoal',
        platform === 'ios' ? 'pb-0.5 pt-3.5' : 'pb-0.5 pt-2.5',
      )}
    >
      <span className="tracking-tight">9:41</span>
      <span className="flex items-center gap-1" aria-hidden="true">
        <span className="flex items-end gap-[1px]">
          {[2, 3, 4, 5].map((height) => (
            <span
              key={height}
              className="w-[1.5px] rounded-sm bg-brand-charcoal"
              style={{ height }}
            />
          ))}
        </span>
        <Wifi className="h-2 w-2" strokeWidth={3} />
        <span className="flex h-2 w-3.5 items-center rounded-[2px] border border-brand-charcoal/70 p-[1px]">
          <span className="h-full w-2/3 rounded-[0.5px] bg-brand-charcoal" />
        </span>
      </span>
    </div>
  )
}

function MiniPhonePreview({ platform }: { platform: PreviewPlatform }) {
  const c = useCopy()
  const isIos = platform === 'ios'
  const screenRadius = isIos ? '2.15rem' : '1.85rem'

  return (
    <div className="relative mx-auto w-full min-w-0 max-w-[108px] sm:max-w-[136px] lg:max-w-[150px]">
      <div className="pointer-events-none absolute -inset-3 rounded-full bg-brand-orange/15 blur-2xl" aria-hidden="true" />
      <div
        className={cn(
          'relative isolate aspect-[9/19.2] overflow-hidden shadow-[0_22px_40px_-18px_rgba(0,0,0,0.8)] ring-1',
          isIos
            ? 'rounded-[2.45rem] bg-[#1b1b1d] ring-white/20'
            : 'rounded-[2.15rem] bg-[#24211e] ring-white/10',
        )}
      >
        <div
          className={cn(
            'absolute inset-[4px] isolate flex min-h-0 flex-col overflow-hidden bg-[#FAF7F2]',
            isIos ? 'rounded-[2.15rem]' : 'rounded-[1.85rem]',
          )}
          style={{
            WebkitClipPath: `inset(0 round ${screenRadius})`,
            clipPath: `inset(0 round ${screenRadius})`,
          }}
        >
          <span
            className={cn(
              'absolute left-1/2 z-20 -translate-x-1/2 rounded-full bg-black',
              isIos
                ? 'top-1.5 h-3.5 w-12 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]'
                : 'top-1.5 h-1.5 w-1.5 shadow-[0_0_0_1px_rgba(0,0,0,0.18)]',
            )}
            aria-hidden="true"
          >
            {isIos ? (
              <span className="absolute right-2 top-1/2 h-1 w-1 -translate-y-1/2 rounded-full bg-[#16202a]" />
            ) : null}
          </span>

          <div className="shrink-0">
            <PreviewStatusBar platform={platform} />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2.5 pb-1 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[0.32rem] font-semibold uppercase tracking-[0.12em] text-brand-muted">
                  {c.labels.deliverTo}
                </p>
                <p className="mt-0.5 flex items-center gap-0.5 truncate text-[0.4rem] font-bold text-brand-charcoal">
                  <MapPin className="h-1.5 w-1.5 shrink-0 text-brand-orange" aria-hidden="true" />
                  {c.labels.city}
                </p>
              </div>
              <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-white text-brand-charcoal shadow-sm ring-1 ring-black/5">
                <UserRound className="h-2 w-2" aria-hidden="true" />
              </span>
            </div>

            <div className="mt-1.5 flex items-center gap-1 rounded-lg bg-white px-1.5 py-1 shadow-sm ring-1 ring-black/5">
              <Search className="h-2 w-2 shrink-0 text-brand-muted" aria-hidden="true" />
              <span className="truncate text-[0.34rem] text-brand-muted">{c.labels.searchFood}</span>
            </div>

            <div className="relative mt-1.5 h-10 overflow-hidden rounded-lg bg-brand-charcoal sm:h-14">
              <img
                src="/images/hero-grill.jpg"
                alt=""
                className="h-full w-full object-cover opacity-85"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-1.5">
                <p className="text-[0.38rem] font-bold text-white">{c.labels.nearbyKitchen}</p>
                <p className="mt-0.5 truncate text-[0.29rem] text-white/70">
                  {c.labels.localVendorOpen}
                </p>
              </div>
            </div>

            <div className="mt-1.5 flex items-center justify-between gap-1">
              <p className="text-[0.36rem] font-bold text-brand-charcoal">{c.labels.popularNearYou}</p>
              <span className="text-[0.29rem] font-semibold text-brand-dark">{c.labels.seeAll}</span>
            </div>

            <div className="mt-1 space-y-1">
              {previewMenu.map((item, index) => (
                <div
                  key={item.name}
                  className={cn(
                    'items-center gap-1.5 rounded-lg bg-white p-1 shadow-sm ring-1 ring-black/5',
                    index > 0 ? 'hidden sm:flex' : 'flex',
                  )}
                >
                  <span className="grid h-4 w-4 shrink-0 place-items-center rounded-[0.3rem] bg-brand-orange/10 text-brand-dark">
                    <Utensils className="h-2 w-2" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.33rem] font-bold text-brand-charcoal">{item.name}</p>
                    <p className="truncate text-[0.26rem] text-brand-muted">{item.meta}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[0.28rem] font-bold text-brand-charcoal">{item.price}</p>
                    <span className="mt-0.5 inline-flex items-center gap-0.5 text-[0.23rem] font-semibold text-brand-success">
                      <Clock3 className="h-1.5 w-1.5" aria-hidden="true" />
                      25–35 min
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            className={cn(
              'relative isolate flex-none border-t border-black/5 bg-white/95 backdrop-blur',
              isIos ? 'pb-2.5' : 'pb-2',
            )}
          >
            <div className="px-2.5 pb-1 pt-1.5">
              <div className="flex items-center justify-between px-1">
                {[
                  { icon: Utensils, label: c.labels.discover, active: true },
                  { icon: Clock3, label: c.labels.orders, active: false },
                  { icon: ShoppingBag, label: c.labels.cart, active: false },
                  { icon: UserRound, label: c.labels.profile, active: false },
                ].map(({ icon: Icon, label, active }) => (
                  <span
                    key={label}
                    className={cn(
                      'flex flex-col items-center gap-0.5',
                      active ? 'text-brand-dark' : 'text-brand-muted/60',
                    )}
                  >
                    <Icon className="h-2 w-2" aria-hidden="true" />
                    <span className="text-[0.24rem] font-semibold">{label}</span>
                  </span>
                ))}
              </div>
            </div>

            <span
              className={cn(
                'absolute bottom-0.5 left-1/2 -translate-x-1/2 rounded-full bg-brand-charcoal/60',
                isIos ? 'h-0.5 w-8' : 'h-0.5 w-6',
              )}
              aria-hidden="true"
            />
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-[0.54rem] font-bold uppercase tracking-[0.14em] text-white/40">
        {isIos ? c.appDownload.ios : c.appDownload.android}
      </p>
    </div>
  )
}

export function AppAvailabilitySection({ className }: { className?: string }) {
  const c = useCopy()
  const app = siteConfig.app

  const androidPlatform: PlatformCard = app.links.playStore
    ? {
        key: 'playStore',
        platform: 'android',
        name: c.appDownload.platformPlayStore,
        meta: c.appDownload.platformPlayStoreMeta,
        url: app.links.playStore,
        badge: '/badges/google-play.png',
        badgeAlt: 'Get it on Google Play',
        badgeWidth: 646,
        badgeHeight: 250,
        logo: '/badges/google-play-icon.png',
      }
    : app.apkUrl
      ? {
          key: 'androidApk',
          platform: 'android',
          name: c.appDownload.platformAndroidApk,
          meta: c.appDownload.platformAndroidApkMeta,
          url: app.apkUrl,
          directDownload: true,
          logo: '/agiza.png',
        }
      : {
          key: 'playStore',
          platform: 'android',
          name: c.appDownload.platformPlayStore,
          meta: c.appDownload.platformPlayStoreMeta,
          url: '',
          badge: '/badges/google-play.png',
          badgeAlt: 'Get it on Google Play',
          badgeWidth: 646,
          badgeHeight: 250,
          logo: '/badges/google-play-icon.png',
        }

  const platforms: PlatformCard[] = [
    androidPlatform,
    {
      key: 'appStore',
      platform: 'ios',
      name: c.appDownload.platformAppStore,
      meta: c.appDownload.platformAppStoreMeta,
      url: app.links.appStore,
      badge: '/badges/app-store.svg',
      badgeAlt: 'Download on the App Store',
      badgeWidth: 120,
      badgeHeight: 40,
      logo: '/badges/app-store-icon.svg',
    },
  ]

  const details = [
    ...(app.apkUrl
      ? [{ label: c.appDownload.package, value: c.appDownload.androidApk }]
      : []),
    ...(app.version
      ? [{ label: c.appDownload.version, value: app.version }]
      : !app.apkUrl
        ? [{ label: c.appDownload.version, value: c.appDownload.notPublished }]
        : []),
    ...(app.size ? [{ label: c.appDownload.size, value: app.size }] : []),
    ...(app.releaseDate ? [{ label: c.appDownload.released, value: app.releaseDate }] : []),
    ...(app.minAndroid ? [{ label: c.appDownload.minAndroid, value: app.minAndroid }] : []),
    ...(app.minIos ? [{ label: c.appDownload.minIos, value: app.minIos }] : []),
  ]

  const hasReleaseDetails = Boolean(
    app.apkUrl || app.version || app.size || app.releaseDate || app.minAndroid || app.minIos,
  )

  return (
    <Section id="get-the-app" className={cn('bg-white', className)}>
      <div className="container-page">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-[2.5rem] bg-brand-charcoal px-5 py-10 text-white sm:px-8 sm:py-12 lg:px-14 lg:py-16"
        >
          <div
            className="pointer-events-none absolute -right-24 -top-32 h-96 w-96 rounded-full bg-brand-orange/15 blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-40 left-1/3 h-80 w-80 rounded-full bg-brand-orange/10 blur-3xl"
            aria-hidden="true"
          />

          <div className="relative grid grid-cols-1 gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start lg:gap-14">
            <div className="min-w-0">
              <Eyebrow light>{c.appDownload.eyebrow}</Eyebrow>
              <h2
                id="app-download-title"
                className="mt-5 max-w-xl font-display text-[2.1rem] font-extrabold leading-[0.98] tracking-[-0.05em] sm:text-[2.8rem] lg:text-[3.35rem]"
              >
                {c.appDownload.title}
              </h2>
              <p className="mt-5 max-w-xl text-sm leading-7 text-white/60 sm:text-base">
                {c.appDownload.body}
              </p>
              <div className="mt-6 inline-flex max-w-full flex-wrap items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-2 text-[0.65rem] font-bold uppercase leading-5 tracking-[0.15em] text-white/60">
                <Smartphone className="h-3.5 w-3.5 shrink-0 text-brand-orange" aria-hidden="true" />
                {c.appDownload.platforms} · Android · iOS
              </div>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-3" aria-labelledby="app-download-title">
              {platforms.map((platform) => {
                const available = Boolean(platform.url)
                const linkProps = platform.directDownload
                  ? { download: true }
                  : { target: '_blank', rel: 'noreferrer noopener' }

                const content = (
                  <>
                    <MiniPhonePreview platform={platform.platform} />

                    <div className="min-w-20 flex-1 py-1">
                      <div className="flex items-start justify-between gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10">
                          <img
                            src={platform.logo}
                            alt=""
                            aria-hidden="true"
                            className="h-5 w-5 object-contain"
                            loading="lazy"
                          />
                        </span>
                        {available ? (
                          platform.directDownload ? (
                            <Download
                              className="h-4 w-4 shrink-0 text-white/35 transition group-hover:text-white"
                              aria-hidden="true"
                            />
                          ) : (
                            <ExternalLink
                              className="h-4 w-4 shrink-0 text-white/35 transition group-hover:text-white"
                              aria-hidden="true"
                            />
                          )
                        ) : null}
                      </div>

                      <p className="mt-4 text-base font-bold leading-5 text-white">{platform.name}</p>
                      <p className="mt-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-white/40">
                        {platform.meta}
                      </p>

                      {available && platform.badge ? (
                        <img
                          src={platform.badge}
                          alt={platform.badgeAlt || platform.name}
                          width={platform.badgeWidth}
                          height={platform.badgeHeight}
                          className="mt-4 h-9 w-auto max-w-full object-contain"
                          loading="lazy"
                        />
                      ) : available ? (
                        <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand-orange px-3.5 py-2 text-[0.68rem] font-bold text-white">
                          <Download className="h-3.5 w-3.5" aria-hidden="true" />
                          {c.appDownload.downloadApk}
                        </span>
                      ) : (
                        <Badge tone="inverse" className="mt-4">
                          {c.appDownload.comingSoon}
                        </Badge>
                      )}

                      {available ? (
                        <p className="mt-3 text-[0.68rem] leading-5 text-white/40">
                          {platform.directDownload ? c.appDownload.apkNote : c.appDownload.availableOn}
                        </p>
                      ) : null}
                    </div>
                  </>
                )

                if (available) {
                  return (
                    <a
                      key={platform.key}
                      href={platform.url}
                      {...linkProps}
                      aria-label={
                        platform.directDownload
                          ? `${c.appDownload.downloadApk} ${platform.name}`
                          : `${c.appDownload.availableOn} ${platform.name} (${platform.meta})`
                      }
                      className="group flex min-w-0 flex-wrap items-center gap-4 rounded-[1.75rem] border border-white/10 bg-white/[0.055] p-4 transition duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-2 focus-visible:ring-offset-brand-charcoal sm:gap-5 sm:p-5"
                    >
                      {content}
                    </a>
                  )
                }

                return (
                  <div
                    key={platform.key}
                    className="flex min-w-0 flex-wrap items-center gap-4 rounded-[1.75rem] border border-white/10 bg-white/[0.055] p-4 sm:gap-5 sm:p-5"
                  >
                    {content}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="relative mt-9 border-t border-white/10 pt-6">
            <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
              {details.map((detail) => (
                <div key={detail.label}>
                  <p className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-white/35">
                    {detail.label}
                  </p>
                  <p className="mt-1.5 text-sm font-semibold text-white/85">{detail.value}</p>
                </div>
              ))}
            </div>

            {!hasReleaseDetails ? (
              <p className="mt-5 max-w-2xl text-xs leading-5 text-white/40">
                {c.appDownload.releaseNote}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold">
              <Link to="/terms" className="text-white/55 transition hover:text-white">
                {c.appDownload.terms}
              </Link>
              <Link to="/privacy" className="text-white/55 transition hover:text-white">
                {c.appDownload.privacy}
              </Link>
              {app.changelogUrl ? (
                <a
                  href={app.changelogUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-white/55 transition hover:text-white"
                >
                  {c.appDownload.changelog}
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              ) : null}
              {app.version ? (
                <span className="ml-auto inline-flex items-center gap-1.5 text-white/35">
                  <ShieldCheck className="h-3.5 w-3.5 text-brand-orange" aria-hidden="true" />
                  {c.appDownload.verifiedRelease}
                </span>
              ) : null}
            </div>
          </div>
        </motion.div>
      </div>
    </Section>
  )
}
