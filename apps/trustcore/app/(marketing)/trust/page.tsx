import Link from 'next/link'
import { ArchiveBoxIcon, ClipboardDocumentCheckIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'
import { getTranslations } from 'next-intl/server'
import { Card, Container } from '@nzila/ui'
import { DossierStackVisual, MarketingContextOverlay } from '@/components/marketing/TrustcoreVisuals'

const FRAME_CLASS = 'max-w-6xl px-5 sm:px-8 lg:px-10 xl:px-12'

export default async function TrustPage() {
  const t = await getTranslations('marketing')

  const trustItems = [
    { icon: ShieldCheckIcon, title: t('trust.0title'), description: t('trust.0desc') },
    { icon: ArchiveBoxIcon, title: t('trust.1title'), description: t('trust.1desc') },
    { icon: ClipboardDocumentCheckIcon, title: t('trust.2title'), description: t('trust.2desc') },
  ]

  return (
    <div className="bg-white text-slate-950">
      <section className="border-b border-slate-200 bg-slate-50 py-20 sm:py-24">
        <Container size="lg" className={FRAME_CLASS}>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] lg:items-center">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">{t('subpages.trust.eyebrow')}</p>
              <h1 className="mb-4 text-4xl font-extrabold text-slate-950 sm:text-5xl">{t('trust.sectionTitle')}</h1>
              <p className="max-w-2xl text-lg leading-relaxed text-slate-600">{t('subpages.trust.intro')}</p>

              <MarketingContextOverlay
                imageSrc="/images/marketing/trust-montreal-city-hall.jpg"
                imageAlt={t('subpages.trust.imageAlt')}
                caption={t('subpages.trust.imageCaption')}
                eyebrow={t('subpages.trust.eyebrow')}
              />

              <div className="mt-6">
                <Link href="/trust-center/sample" className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700 transition hover:text-teal-800">
                  {t('features.viewSample')}
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>

            <DossierStackVisual
              eyebrow={t('subpages.trust.eyebrow')}
              title={t('subpages.trust.dossierTitle')}
              items={[
                t('subpages.trust.dossier0'),
                t('subpages.trust.dossier1'),
                t('subpages.trust.dossier2'),
              ]}
            />
          </div>
        </Container>
      </section>

      <section className="py-20">
        <Container size="lg" className={FRAME_CLASS}>
          <div className="grid gap-6 md:grid-cols-3">
            {trustItems.map((item) => {
              const Icon = item.icon
              return (
                <Card key={item.title} variant="bordered" className="border-slate-200 bg-white p-6">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-teal-100 bg-teal-50">
                    <Icon className="h-6 w-6 text-teal-600" />
                  </div>
                  <h2 className="mb-3 text-lg font-semibold text-slate-950">{item.title}</h2>
                  <p className="text-sm leading-relaxed text-slate-500">{item.description}</p>
                </Card>
              )
            })}
          </div>
        </Container>
      </section>

    </div>
  )
}