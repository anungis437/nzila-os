/**
 * TrustCore - Marketing Landing Page
 */

import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import {
  ShieldCheckIcon,
  ClipboardDocumentCheckIcon,
  BanknotesIcon,
  ChatBubbleLeftEllipsisIcon,
  EyeIcon,
  BoltIcon,
} from '@heroicons/react/24/outline'
import { Badge, Card, Container } from '@nzila/ui'
import { TrackedCtaLink } from '@/components/shared/TrackedCtaLink'
import {
  DossierStackVisual,
  MarketingContextOverlay,
  ModernComplianceVisual,
} from '@/components/marketing/TrustcoreVisuals'

const FRAME_CLASS = 'max-w-6xl px-5 sm:px-8 lg:px-10 xl:px-12'

export default async function LandingPage() {
  const t = await getTranslations('marketing')

  const overviewPages = [
    {
      href: '/how-it-works',
      icon: BoltIcon,
      eyebrow: t('subpages.howItWorks.eyebrow'),
      title: t('steps.sectionTitle'),
      description: t('overview.workflowTeaser'),
      stat: t('overview.workflowStat'),
    },
    {
      href: '/features',
      icon: ClipboardDocumentCheckIcon,
      eyebrow: t('subpages.features.eyebrow'),
      title: t('features.sectionTitle'),
      description: t('overview.featuresTeaser'),
      stat: t('overview.featuresStat'),
    },
    {
      href: '/pricing',
      icon: BanknotesIcon,
      eyebrow: t('subpages.pricing.eyebrow'),
      title: t('pricing.sectionTitle'),
      description: t('overview.pricingTeaser'),
      stat: t('overview.pricingStat'),
    },
    {
      href: '/trust',
      icon: ShieldCheckIcon,
      eyebrow: t('subpages.trust.eyebrow'),
      title: t('trust.sectionTitle'),
      description: t('overview.trustTeaser'),
      stat: t('overview.trustStat'),
    },
  ]

  return (
    <div className="bg-white text-slate-950">
      <section className="relative overflow-hidden border-b border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_60%)] pt-20 pb-24 sm:pt-24 sm:pb-28">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_12%_18%,rgba(15,118,110,0.12),transparent_38%),radial-gradient(circle_at_88%_14%,rgba(30,41,59,0.10),transparent_34%)]" />

        <Container size="lg" className={FRAME_CLASS}>
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <Badge variant="accent" className="mb-5">{t('hero.badge')}</Badge>
              <h1 className="max-w-2xl text-4xl font-extrabold leading-tight text-slate-950 sm:text-5xl">
                {t('hero.title')}
                <span className="block text-teal-700">{t('hero.titleAccent')}</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
                {t('hero.description')}
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <TrackedCtaLink
                  href="/start"
                  event="landing_cta_click"
                  payload={{ location: 'hero' }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-7 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-slate-800"
                >
                  <ShieldCheckIcon className="h-5 w-5" />
                  {t('hero.ctaPrimary')}
                </TrackedCtaLink>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-7 py-3.5 text-base font-semibold text-slate-700 transition hover:border-slate-400"
                >
                  {t('hero.ctaSecondary')}
                </Link>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <p className="text-xs text-slate-400">{t('hero.freeNote')}</p>
                <span className="text-slate-200">|</span>
                <TrackedCtaLink
                  href="/trust-center/sample"
                  event="landing_sample_trust_center_click"
                  payload={{ location: 'hero' }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 transition hover:text-teal-800"
                >
                  <EyeIcon className="h-3.5 w-3.5" />
                  {t('hero.viewSample')}
                </TrackedCtaLink>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {['0', '1', '2'].map((index) => (
                  <Card key={index} variant="bordered" className="border-slate-200 bg-white/80 p-4">
                    <p className="text-2xl font-black text-slate-950">{t(`proof.stat${index}value`)}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">{t(`proof.stat${index}label`)}</p>
                  </Card>
                ))}
              </div>

              <MarketingContextOverlay
                imageSrc="/images/marketing/home-montreal-downtown.jpg"
                imageAlt={t('overview.imageAlt')}
                caption={t('overview.imageCaption')}
                eyebrow={t('overview.sectionEyebrow')}
              />
            </div>

            <div className="lg:pl-4">
              <ModernComplianceVisual
                title={t('mockup.label')}
                subtitle={t('mockup.subtitle')}
                synced={t('mockup.synced')}
                scoreLabel={t('mockup.scoreLabel')}
                scoreStatus={t('mockup.scoreStatus')}
                riskLabel={t('mockup.riskLabel')}
                risk0={t('mockup.risk0')}
                risk0Severity={t('mockup.risk0Severity')}
                risk1={t('mockup.risk1')}
                risk1Severity={t('mockup.risk1Severity')}
                trustCenterLabel={t('mockup.trustCenterLabel')}
                trustCenterText={t('mockup.trustCenterText')}
                live={t('mockup.live')}
              />
            </div>
          </div>
        </Container>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 py-20">
        <Container size="lg" className={FRAME_CLASS}>
          <div className="mb-12 max-w-3xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">{t('overview.sectionEyebrow')}</p>
            <h2 className="mb-3 text-3xl font-bold text-slate-950">{t('overview.sectionTitle')}</h2>
            <p className="text-base text-slate-600">{t('overview.sectionSubtitle')}</p>
          </div>

          <div className="mb-10 grid gap-4 md:grid-cols-3">
            <Card variant="bordered" className="border-slate-200 bg-white p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-teal-700">Quebec context</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{t('overview.liveOutput0')}</p>
            </Card>
            <Card variant="bordered" className="border-slate-200 bg-white p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-teal-700">Buyer diligence</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{t('overview.liveOutput1')}</p>
            </Card>
            <Card variant="bordered" className="border-slate-200 bg-white p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-teal-700">Operational proof</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{t('overview.liveOutput2')}</p>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {overviewPages.map((page) => {
              const Icon = page.icon
              return (
                <Card key={page.href} variant="bordered" className="border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-teal-700">{page.eyebrow}</span>
                    <Icon className="h-5 w-5 text-slate-400" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-slate-950">{page.title}</h3>
                  <p className="mb-4 text-sm leading-relaxed text-slate-500">{page.description}</p>
                  <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{page.stat}</p>
                  <Link
                    href={page.href}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700 transition hover:text-teal-800"
                  >
                    {t('overview.openPage')}
                    <span aria-hidden="true">→</span>
                  </Link>
                </Card>
              )
            })}
          </div>
        </Container>
      </section>

      <section className="bg-white py-20">
        <Container size="lg" className={FRAME_CLASS}>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)] lg:items-center">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">{t('overview.liveOutputEyebrow')}</p>
              <h2 className="mb-4 text-3xl font-bold text-slate-950">{t('overview.liveOutputTitle')}</h2>
              <p className="max-w-2xl text-base leading-relaxed text-slate-600">{t('overview.liveOutputDescription')}</p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <TrackedCtaLink
                  href="/trust-center/sample"
                  event="landing_sample_trust_center_click"
                  payload={{ location: 'overview_live_output' }}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-400"
                >
                  <EyeIcon className="h-4 w-4" />
                  {t('features.viewSample')}
                </TrackedCtaLink>
                <Link href="/trust" className="text-sm font-semibold text-teal-700 transition hover:text-teal-800">
                  {t('overview.openPage')} →
                </Link>
              </div>
            </div>

            <DossierStackVisual
              eyebrow={t('overview.liveOutputEyebrow')}
              title={t('overview.liveOutputTitle')}
              items={[t('overview.liveOutput0'), t('overview.liveOutput1'), t('overview.liveOutput2')]}
            />
          </div>
        </Container>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 py-16">
        <Container size="sm" className="text-center">
          <ChatBubbleLeftEllipsisIcon className="mx-auto mb-4 h-8 w-8 text-teal-600" />
          <blockquote className="mb-4 text-xl font-semibold leading-relaxed text-slate-900">
            &ldquo;{t('testimonial.quote')}&rdquo;
          </blockquote>
          <p className="text-sm font-medium text-teal-700">{t('testimonial.attribution')}</p>
        </Container>
      </section>

    </div>
  )
}
