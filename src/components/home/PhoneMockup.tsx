import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  Apple,
  Bike,
  ClipboardList,
  Clock3,
  MapPin,
  Search,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Store,
  Utensils,
  UserRound,
  Wifi,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useCopy } from '../../i18n'

const menu = [
  { name: 'Ugali na Nyama', meta: 'Grilled beef · Ugali · Greens', price: 'TSh 12,000' },
  { name: 'Chipsi Mayai', meta: 'Chips · Eggs · Kachumbari', price: 'TSh 5,000' },
  { name: 'Pilau', meta: 'Spiced rice · Beef or chicken', price: 'TSh 8,000' },
]

type Platform = 'android' | 'ios'

const platforms = [
  { id: 'android' as const, icon: Smartphone },
  { id: 'ios' as const, icon: Apple },
]

function StatusBar({ platform }: { platform: Platform }) {
  return (
    <div
      className={cn(
        'flex items-center justify-between px-5 text-[0.55rem] font-bold text-brand-charcoal',
        platform === 'ios' ? 'pb-1 pt-3.5' : 'pb-1 pt-3',
      )}
    >
      <span className="tracking-tight">9:41</span>
      <span className="flex items-center gap-1.5" aria-hidden="true">
        <span className="flex items-end gap-[1.5px]">
          {[3, 5, 7, 9].map((height) => (
            <span
              key={height}
              className="w-[2px] rounded-sm bg-brand-charcoal"
              style={{ height }}
            />
          ))}
        </span>
        <Wifi className="h-2.5 w-2.5" strokeWidth={3} />
        <span className="flex h-2.5 w-4 items-center rounded-[3px] border border-brand-charcoal/70 p-[1px]">
          <span className="h-full w-2/3 rounded-[1px] bg-brand-charcoal" />
        </span>
      </span>
    </div>
  )
}

function AppScreen({ platform, reduceMotion }: { platform: Platform; reduceMotion: boolean | null }) {
  const c = useCopy()
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-16 pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[0.54rem] font-semibold uppercase tracking-[0.16em] text-brand-muted">
              {c.labels.deliverTo}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-[0.72rem] font-bold text-brand-charcoal">
              <MapPin className="h-3 w-3 text-brand-orange" aria-hidden="true" />
              {c.labels.city}
            </p>
          </div>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-brand-charcoal shadow-sm ring-1 ring-black/5">
            <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-black/5">
          <Search className="h-3.5 w-3.5 text-brand-muted" aria-hidden="true" />
          <span className="text-[0.62rem] text-brand-muted">{c.labels.searchFood}</span>
        </div>

        <div className="mt-3 flex gap-1.5 overflow-hidden">
          {[c.labels.all, 'Nyama choma', 'Chipsi', 'Mama lishe'].map((chip, index) => (
            <span
              key={chip}
              className={cn(
                'shrink-0 rounded-full px-2.5 py-1 text-[0.54rem] font-bold',
                index === 0 ? 'bg-brand-charcoal text-white' : 'bg-white text-brand-muted ring-1 ring-black/5',
              )}
            >
              {chip}
            </span>
          ))}
        </div>

        <div className="relative mt-3.5 overflow-hidden rounded-2xl bg-brand-charcoal">
          <motion.img
            src="/images/hero-grill.jpg"
            alt=""
            className="h-28 w-full object-cover opacity-85"
            loading="eager"
            animate={reduceMotion ? undefined : { scale: [1, 1.035, 1] }}
            transition={reduceMotion ? undefined : { duration: 9, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[0.68rem] font-bold text-white">{c.labels.nearbyKitchen}</p>
                <p className="mt-0.5 flex items-center gap-1 text-[0.52rem] text-white/70">
                  <Store className="h-2.5 w-2.5" aria-hidden="true" />
                  {c.labels.localVendorOpen}
                </p>
              </div>
              <span className="inline-flex items-center rounded-full bg-white/15 px-2 py-1 text-[0.5rem] font-bold text-white backdrop-blur">
                {c.labels.popular}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <p className="text-[0.66rem] font-bold text-brand-charcoal">{c.labels.popularNearYou}</p>
          <span className="text-[0.52rem] font-semibold text-brand-dark">{c.labels.seeAll}</span>
        </div>

        <div className="mt-2 space-y-2">
          {menu.map((item) => (
            <div key={item.name} className="flex items-center gap-2.5 rounded-xl bg-white p-2 shadow-sm ring-1 ring-black/5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-orange/10 text-brand-dark">
                <Utensils className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.58rem] font-bold text-brand-charcoal">{item.name}</p>
                <p className="truncate text-[0.48rem] text-brand-muted">{item.meta}</p>
              </div>
              <div className="text-right">
                <p className="text-[0.52rem] font-bold text-brand-charcoal">{item.price}</p>
                <span className="mt-0.5 inline-flex items-center gap-0.5 text-[0.44rem] font-semibold text-brand-success">
                  <Clock3 className="h-2 w-2" aria-hidden="true" />
                  25–35 min
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={cn('relative flex-none', platform === 'ios' ? 'pb-3' : 'pb-2.5')}>
        <div
          className={cn(
            'relative border-t border-black/5 bg-white/95 px-5 pt-2.5 backdrop-blur',
            platform === 'ios' ? 'pb-1.5' : 'pb-2',
          )}
        >
          <div className="flex items-center justify-between">
            {[
              { icon: Utensils, label: c.labels.discover, active: true },
              { icon: Clock3, label: c.labels.orders, active: false },
              { icon: ShoppingBag, label: c.labels.cart, active: false },
              { icon: UserRound, label: c.labels.profile, active: false },
            ].map(({ icon: Icon, label, active }) => (
              <span key={label} className={cn('flex flex-col items-center gap-0.5', active ? 'text-brand-dark' : 'text-brand-muted/60')}>
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="text-[0.42rem] font-semibold">{label}</span>
              </span>
            ))}
          </div>
        </div>

        <span
          className={cn(
            'absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-brand-charcoal/60',
            platform === 'ios' ? 'h-1 w-24' : 'h-0.5 w-16',
          )}
          aria-hidden="true"
        />
      </div>
    </div>
  )
}

export function PhoneMockup({ className }: { className?: string }) {
  const c = useCopy()
  const [platform, setPlatform] = useState<Platform>('android')
  const reduceMotion = useReducedMotion()
  const isIos = platform === 'ios'

  return (
    <div className={cn('relative mx-auto w-full min-w-0 max-w-[286px] sm:max-w-[318px] lg:max-w-[342px]', className)}>
      <div className="relative z-10 mb-4 flex flex-wrap items-center justify-center gap-2.5 lg:justify-end">
        <span className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-brand-muted">
          {c.appDownload.previewOn}
        </span>
        <div
          role="group"
          aria-label={c.appDownload.previewOn}
          className="inline-flex rounded-full border border-brand-line bg-white p-1 shadow-sm"
        >
          {platforms.map(({ id, icon: Icon }) => {
            const active = platform === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setPlatform(id)}
                aria-pressed={active}
                className={cn(
                  'relative inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[0.64rem] font-bold transition-colors',
                  active ? 'text-white' : 'text-brand-muted hover:text-brand-charcoal',
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="phone-platform-pill"
                    className="absolute inset-0 rounded-full bg-brand-charcoal"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                ) : null}
                <Icon className="relative h-3 w-3" aria-hidden="true" />
                <span className="relative">{id === 'android' ? c.appDownload.android : c.appDownload.ios}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="absolute -inset-8 -z-10 rounded-full bg-brand-orange/20 blur-3xl" aria-hidden="true" />

      <motion.div
        animate={reduceMotion ? undefined : { y: [0, -7, 0] }}
        transition={reduceMotion ? undefined : { duration: 6.5, repeat: Infinity, ease: 'easeInOut' }}
        className="relative"
      >
        <div
          className={cn(
            'relative shadow-[0_45px_90px_-30px_rgba(0,0,0,0.55)] ring-1',
            isIos
              ? 'rounded-[3.2rem] bg-[#1b1b1d] p-[8px] ring-white/15'
              : 'rounded-[2.8rem] bg-[#24211e] p-[7px] ring-white/10',
          )}
        >
          <div
            className={cn(
              'relative overflow-hidden bg-[#FAF7F2]',
              isIos ? 'rounded-[2.8rem]' : 'rounded-[2.4rem]',
            )}
          >
            <span
              className={cn(
                'absolute left-1/2 z-20 -translate-x-1/2 rounded-full bg-black',
                isIos
                  ? 'top-2.5 h-6 w-[88px] shadow-[0_0_0_1px_rgba(255,255,255,0.08)]'
                  : 'top-2.5 h-2.5 w-2.5 shadow-[0_0_0_2px_rgba(0,0,0,0.18)]',
              )}
              aria-hidden="true"
            >
              {isIos ? (
                <span className="absolute right-3 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[#16202a]" />
              ) : null}
            </span>

            <StatusBar platform={platform} />

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={platform}
                initial={{ opacity: 0, y: 7 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
              >
                <AppScreen platform={platform} reduceMotion={reduceMotion} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {[
        {
          side: 'left' as const,
          position: 'top-28',
          icon: ClipboardList,
          title: c.labels.dineInOrder,
          body: c.labels.orderAhead,
          iconClass: 'bg-brand-success/10 text-brand-success',
          delay: 0,
        },
        {
          side: 'right' as const,
          position: 'bottom-40',
          icon: Bike,
          title: c.labels.deliveryRequest,
          body: c.labels.trackStatus,
          iconClass: 'bg-brand-orange/10 text-brand-dark',
          delay: 0.8,
        },
        {
          side: 'left' as const,
          position: 'bottom-16',
          icon: ShieldCheck,
          title: c.labels.verifiedPartners,
          body: c.labels.reviewedByAgiza,
          iconClass: 'bg-brand-charcoal text-brand-orange',
          delay: 1.6,
        },
      ].map(({ side, position, icon: Icon, title, body, iconClass, delay }) => (
        <motion.div
          key={title}
          initial={{ opacity: 0, x: side === 'left' ? -12 : 12 }}
          animate={
            reduceMotion
              ? { opacity: 1, x: 0 }
              : { opacity: 1, x: 0, y: [0, -5, 0] }
          }
          transition={{
            opacity: { duration: 0.45, delay: 0.5 + delay * 0.12 },
            x: { duration: 0.45, delay: 0.5 + delay * 0.12 },
            y: reduceMotion
              ? undefined
              : { duration: 5.5, repeat: Infinity, ease: 'easeInOut', delay },
          }}
          className={cn(
            'absolute hidden rounded-2xl border border-brand-line bg-white p-3 shadow-soft sm:block',
            side === 'left' ? '-left-8' : '-right-8',
            position,
          )}
        >
          <div className="flex items-center gap-2.5">
            <span className={cn('grid h-9 w-9 place-items-center rounded-xl', iconClass)}>
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[0.62rem] font-bold text-brand-charcoal">{title}</p>
              <p className="text-[0.5rem] text-brand-muted">{body}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
