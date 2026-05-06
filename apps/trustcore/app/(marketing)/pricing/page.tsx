import { CheckCircleIcon } from '@heroicons/react/24/outline'
import { getTranslations } from 'next-intl/server'
import { Badge, Card, Container } from '@nzila/ui'
import { MarketingContextOverlay } from '@/components/marketing/TrustcoreVisuals'
import { TrackedCtaLink } from '@/components/shared/TrackedCtaLink'

const FRAME_CLASS = 'max-w-6xl px-5 sm:px-8 lg:px-10 xl:px-12'

export default async function PricingPage() {
  const t = await getTranslations('marketing')

  const fitCards = [
    { title: t('subpages.pricing.fit0Title'), description: t('subpages.pricing.fit0Desc') },
    { title: t('subpages.pricing.fit1Title'), description: t('subpages.pricing.fit1Desc') },
    { title: t('subpages.pricing.fit2Title'), description: t('subpages.pricing.fit2Desc') },
  ]

  return (
    <div className="bg-white text-slate-950">
      <section className="border-b border-slate-200 bg-slate-50 py-20 sm:py-24">
        <Container size="md" className={FRAME_CLASS}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">{t('subpages.pricing.eyebrow')}</p>
          <h1 className="mb-4 text-4xl font-extrabold text-slate-950 sm:text-5xl">{t('pricing.sectionTitle')}</h1>
          <p className="max-w-3xl text-lg leading-relaxed text-slate-600">{t('subpages.pricing.intro')}</p>

          <MarketingContextOverlay
            imageSrc="/images/marketing/pricing-inbox-trays.jpg"
            imageAlt={t('subpages.pricing.imageAlt')}
            caption={t('subpages.pricing.imageCaption')}
            eyebrow={t('subpages.pricing.eyebrow')}
          />
        </Container>
      </section>

      <section className="bg-slate-50 py-20">
        <Container size="md" className={FRAME_CLASS}>
          <div className="mb-10 grid gap-6 sm:grid-cols-3">
            <Card variant="bordered" className="border-slate-200 bg-white p-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{t('pricing.freeName')}</p>
              <p className="mb-1 text-3xl font-black text-slate-950">{t('pricing.freePrice')}</p>
              <p className="mb-5 text-xs text-gray-400">{t('pricing.freePeriod')}</p>
              <TrackedCtaLink href="/start" event="landing_cta_click" payload={{ location: 'pricing_free_page' }} className="mb-5 block w-full rounded-xl border border-gray-200 py-2.5 text-center text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
                {t('pricing.freeCta')}
              </TrackedCtaLink>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2"><CheckCircleIcon className="h-4 w-4 shrink-0 text-teal-500" />{t('pricing.freeFeature0')}</li>
                <li className="flex items-center gap-2"><CheckCircleIcon className="h-4 w-4 shrink-0 text-teal-500" />{t('pricing.freeFeature1')}</li>
                <li className="flex items-center gap-2"><CheckCircleIcon className="h-4 w-4 shrink-0 text-teal-500" />{t('pricing.freeFeature2')}</li>
                <li className="flex items-center gap-2"><CheckCircleIcon className="h-4 w-4 shrink-0 text-teal-500" />{t('pricing.freeFeature3')}</li>
              </ul>
            </Card>

            <Card variant="elevated" className="relative border border-slate-900 bg-slate-950 p-6 text-white shadow-lg shadow-slate-300/30">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge variant="info" className="bg-teal-600 text-white">{t('pricing.mostPopular')}</Badge>
              </div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-teal-200">{t('pricing.proName')}</p>
              <p className="mb-1 text-3xl font-black">{t('pricing.proPrice')}</p>
              <p className="mb-5 text-xs text-teal-200">{t('pricing.proPeriod')}</p>
              <TrackedCtaLink href="/start" event="landing_cta_click" payload={{ location: 'pricing_pro_page' }} className="mb-5 block w-full rounded-xl bg-white py-2.5 text-center text-sm font-semibold text-teal-700 transition hover:bg-teal-50">
                {t('pricing.proCta')}
              </TrackedCtaLink>
              <ul className="space-y-2 text-sm text-teal-100">
                <li className="flex items-center gap-2"><CheckCircleIcon className="h-4 w-4 shrink-0 text-teal-300" />{t('pricing.proFeature0')}</li>
                <li className="flex items-center gap-2"><CheckCircleIcon className="h-4 w-4 shrink-0 text-teal-300" />{t('pricing.proFeature1')}</li>
                <li className="flex items-center gap-2"><CheckCircleIcon className="h-4 w-4 shrink-0 text-teal-300" />{t('pricing.proFeature2')}</li>
                <li className="flex items-center gap-2"><CheckCircleIcon className="h-4 w-4 shrink-0 text-teal-300" />{t('pricing.proFeature3')}</li>
                <li className="flex items-center gap-2"><CheckCircleIcon className="h-4 w-4 shrink-0 text-teal-300" />{t('pricing.proFeature4')}</li>
              </ul>
            </Card>

            <Card variant="bordered" className="border-slate-200 bg-white p-6 opacity-90">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{t('pricing.premiumName')}</p>
              <p className="mb-1 text-3xl font-black text-slate-950">{t('pricing.premiumPrice')}</p>
              <p className="mb-5 text-xs text-gray-400">{t('pricing.premiumPeriod')}</p>
              <div className="mb-5 w-full rounded-xl border border-dashed border-gray-300 py-2.5 text-center text-sm font-medium text-gray-400">
                {t('pricing.notifyMe')}
              </div>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2"><CheckCircleIcon className="h-4 w-4 shrink-0 text-gray-300" />{t('pricing.premiumFeature0')}</li>
                <li className="flex items-center gap-2"><CheckCircleIcon className="h-4 w-4 shrink-0 text-gray-300" />{t('pricing.premiumFeature1')}</li>
                <li className="flex items-center gap-2"><CheckCircleIcon className="h-4 w-4 shrink-0 text-gray-300" />{t('pricing.premiumFeature2')}</li>
                <li className="flex items-center gap-2"><CheckCircleIcon className="h-4 w-4 shrink-0 text-gray-300" />{t('pricing.premiumFeature3')}</li>
              </ul>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {fitCards.map((card) => (
              <Card key={card.title} variant="bordered" className="border-slate-200 bg-white p-6">
                <h2 className="mb-3 text-lg font-semibold text-slate-950">{card.title}</h2>
                <p className="text-sm leading-relaxed text-slate-500">{card.description}</p>
              </Card>
            ))}
          </div>
        </Container>
      </section>

    </div>
  )
}