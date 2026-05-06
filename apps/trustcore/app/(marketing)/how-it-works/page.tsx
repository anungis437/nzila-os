import { BoltIcon } from '@heroicons/react/24/outline'
import { getTranslations } from 'next-intl/server'
import { Card, Container } from '@nzila/ui'
import { DossierStackVisual, MarketingContextOverlay } from '@/components/marketing/TrustcoreVisuals'

const FRAME_CLASS = 'max-w-6xl px-5 sm:px-8 lg:px-10 xl:px-12'

export default async function HowItWorksPage() {
  const t = await getTranslations('marketing')

  const steps = [
    { number: '01', title: t('steps.0title'), description: t('steps.0desc') },
    { number: '02', title: t('steps.1title'), description: t('steps.1desc') },
    { number: '03', title: t('steps.2title'), description: t('steps.2desc') },
  ]

  return (
    <div className="bg-white text-slate-950">
      <section className="border-b border-slate-200 bg-slate-50 py-20 sm:py-24">
        <Container size="lg" className={FRAME_CLASS}>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] lg:items-center">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">{t('subpages.howItWorks.eyebrow')}</p>
              <h1 className="mb-4 text-4xl font-extrabold text-slate-950 sm:text-5xl">{t('steps.sectionTitle')}</h1>
              <p className="max-w-2xl text-lg leading-relaxed text-slate-600">{t('subpages.howItWorks.intro')}</p>

              <MarketingContextOverlay
                imageSrc="/images/marketing/how-it-works-archives.jpg"
                imageAlt={t('subpages.howItWorks.imageAlt')}
                caption={t('subpages.howItWorks.imageCaption')}
                eyebrow={t('subpages.howItWorks.eyebrow')}
              />
            </div>

            <DossierStackVisual
              eyebrow={t('subpages.howItWorks.eyebrow')}
              title={t('subpages.howItWorks.checklistTitle')}
              items={[
                t('subpages.howItWorks.checklist0'),
                t('subpages.howItWorks.checklist1'),
                t('subpages.howItWorks.checklist2'),
              ]}
            />
          </div>
        </Container>
      </section>

      <section className="py-20">
        <Container size="lg" className={FRAME_CLASS}>
          <div className="grid gap-6 md:grid-cols-3">
            {steps.map((step) => (
              <Card key={step.number} variant="bordered" className="border-slate-200 bg-white p-6">
                <div className="mb-5 flex items-center gap-3">
                  <span className="text-5xl font-black text-teal-100">{step.number}</span>
                  <div className="h-px flex-1 bg-teal-100" />
                </div>
                <h2 className="mb-3 text-xl font-semibold text-slate-950">{step.title}</h2>
                <p className="text-sm leading-relaxed text-slate-500">{step.description}</p>
              </Card>
            ))}
          </div>

          <div className="mt-12 rounded-[2rem] border border-slate-200 bg-slate-950 p-8 text-white">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl border border-teal-400/20 bg-teal-400/10 p-3">
                <BoltIcon className="h-6 w-6 text-teal-300" />
              </div>
              <div>
                <h3 className="text-2xl font-bold">{t('steps.cta')}</h3>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">{t('steps.sectionSubtitle')}</p>
              </div>
            </div>
          </div>
        </Container>
      </section>

    </div>
  )
}