import Image from 'next/image'
import { ShieldCheckIcon } from '@heroicons/react/24/outline'
import { Badge, Card, Container } from '@nzila/ui'
import { TrackedCtaLink } from '@/components/shared/TrackedCtaLink'

interface ModernComplianceVisualProps {
  title: string
  subtitle: string
  synced: string
  scoreLabel: string
  scoreStatus: string
  riskLabel: string
  risk0: string
  risk0Severity: string
  risk1: string
  risk1Severity: string
  trustCenterLabel: string
  trustCenterText: string
  live: string
}

export function ModernComplianceVisual({
  title,
  subtitle,
  synced,
  scoreLabel,
  scoreStatus,
  riskLabel,
  risk0,
  risk0Severity,
  risk1,
  risk1Severity,
  trustCenterLabel,
  trustCenterText,
  live,
}: ModernComplianceVisualProps) {
  return (
    <div className="relative">
      <div className="absolute -inset-5 rounded-4xl bg-linear-to-br from-slate-300/30 via-teal-100/20 to-sky-200/20 blur-3xl" />
      <Card variant="elevated" className="relative rounded-3xl border border-white/70 bg-white/90 p-5 shadow-2xl shadow-slate-200/40 sm:p-6">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{title}</p>
            <p className="text-sm font-semibold text-slate-950">{subtitle}</p>
          </div>
          <Badge variant="ok" dot>
            {synced}
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-4">
          <Card variant="bordered" className="col-span-1 border-slate-200 bg-slate-50/80 p-3">
            <p className="text-[11px] uppercase font-semibold tracking-[0.2em] text-teal-700">{scoreLabel}</p>
            <p className="mt-1 text-2xl font-black text-gray-900">73</p>
            <p className="text-[11px] text-gray-500">{scoreStatus}</p>
          </Card>
          <Card variant="bordered" className="col-span-2 border-slate-200 p-3">
            <p className="text-[11px] uppercase font-semibold tracking-[0.2em] text-gray-500">{riskLabel}</p>
            <div className="mt-2 space-y-2">
              <div className="flex items-center justify-between rounded-lg bg-red-50 px-2.5 py-1.5">
                <span className="text-xs text-red-800">{risk0}</span>
                <Badge variant="critical">{risk0Severity}</Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-amber-50 px-2.5 py-1.5">
                <span className="text-xs text-amber-900">{risk1}</span>
                <Badge variant="warning">{risk1Severity}</Badge>
              </div>
            </div>
          </Card>
        </div>

        <Card variant="bordered" className="mt-3 border-slate-200 bg-slate-50/70 p-3">
          <p className="text-[11px] uppercase font-semibold tracking-[0.2em] text-gray-500">{trustCenterLabel}</p>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs text-gray-700">{trustCenterText}</p>
            <Badge variant="info">{live}</Badge>
          </div>
        </Card>
      </Card>
    </div>
  )
}

export function DossierStackVisual({
  eyebrow,
  title,
  items,
}: {
  eyebrow: string
  title: string
  items: string[]
}) {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-950 p-6 text-white shadow-xl shadow-slate-300/30">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.22),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)]" />
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-teal-300">{eyebrow}</p>
        <h3 className="mt-3 text-2xl font-bold leading-tight">{title}</h3>

        <div className="mt-6 space-y-3">
          {items.map((item, index) => (
            <Card key={item} variant="bordered" className="border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-teal-400/30 bg-teal-400/10 text-xs font-bold text-teal-200">
                  0{index + 1}
                </span>
                <p className="text-sm leading-relaxed text-slate-200">{item}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

export function MarketingFooterCta({
  title,
  subtitle,
  button,
  note,
}: {
  title: string
  subtitle: string
  button: string
  note: string
}) {
  return (
    <section className="bg-slate-950 py-24">
      <Container size="sm" className="text-center">
        <ShieldCheckIcon className="mx-auto mb-5 h-12 w-12 text-teal-400" />
        <h2 className="mb-4 text-3xl font-extrabold text-white sm:text-4xl">{title}</h2>
        <p className="mx-auto mb-8 max-w-lg text-base text-slate-300">{subtitle}</p>
        <TrackedCtaLink
          href="/start"
          event="landing_cta_click"
          payload={{ location: 'cta_footer' }}
          className="inline-flex items-center gap-2 rounded-2xl bg-teal-500 px-8 py-4 text-lg font-bold text-white shadow-lg shadow-teal-900/30 transition hover:bg-teal-400"
        >
          <ShieldCheckIcon className="h-6 w-6" />
          {button}
        </TrackedCtaLink>
        <p className="mt-4 text-xs text-slate-500">{note}</p>
      </Container>
    </section>
  )
}

export function MarketingContextOverlay({
  imageSrc,
  imageAlt,
  caption,
  eyebrow,
}: {
  imageSrc: string
  imageAlt: string
  caption: string
  eyebrow: string
}) {
  return (
    <div className="relative mt-7 overflow-hidden rounded-3xl border border-slate-200">
      <div className="relative h-48 w-full sm:h-56">
        <Image
          src={imageSrc}
          alt={imageAlt}
          fill
          className="object-cover"
          sizes="(min-width: 1024px) 520px, 100vw"
        />
        <div className="absolute inset-0 bg-linear-to-t from-slate-950/82 via-slate-950/24 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-teal-200">{eyebrow}</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-100">{caption}</p>
        </div>
      </div>
    </div>
  )
}