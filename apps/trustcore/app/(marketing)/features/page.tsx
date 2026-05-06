import Link from 'next/link'
import {
  ArchiveBoxIcon,
  ClipboardDocumentCheckIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  GlobeAltIcon,
  LockClosedIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import { getTranslations } from 'next-intl/server'
import { Badge, Card, Container } from '@nzila/ui'
import { DossierStackVisual, MarketingContextOverlay } from '@/components/marketing/TrustcoreVisuals'

const FRAME_CLASS = 'max-w-6xl px-5 sm:px-8 lg:px-10 xl:px-12'

export default async function FeaturesPage() {
  const t = await getTranslations('marketing')

  const features = [
    { icon: ShieldCheckIcon, title: t('features.0title'), description: t('features.0desc') },
    { icon: ExclamationTriangleIcon, title: t('features.1title'), description: t('features.1desc') },
    { icon: DocumentTextIcon, title: t('features.2title'), description: t('features.2desc'), locked: true },
    { icon: ArchiveBoxIcon, title: t('features.3title'), description: t('features.3desc'), locked: true },
    { icon: GlobeAltIcon, title: t('features.4title'), description: t('features.4desc'), locked: true, sampleLink: true },
    { icon: ClipboardDocumentCheckIcon, title: t('features.5title'), description: t('features.5desc') },
  ]

  return (
    <div className="bg-white text-slate-950">
      <section className="border-b border-slate-200 bg-slate-50 py-20 sm:py-24">
        <Container size="lg" className={FRAME_CLASS}>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] lg:items-center">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">{t('subpages.features.eyebrow')}</p>
              <h1 className="mb-4 text-4xl font-extrabold text-slate-950 sm:text-5xl">{t('features.sectionTitle')}</h1>
              <p className="max-w-2xl text-lg leading-relaxed text-slate-600">{t('subpages.features.intro')}</p>

              <MarketingContextOverlay
                imageSrc="/images/marketing/features-montreal-skyline.jpg"
                imageAlt={t('subpages.features.imageAlt')}
                caption={t('subpages.features.imageCaption')}
                eyebrow={t('subpages.features.eyebrow')}
              />
            </div>

            <DossierStackVisual
              eyebrow={t('subpages.features.eyebrow')}
              title={t('subpages.features.dossierTitle')}
              items={[
                t('subpages.features.dossier0'),
                t('subpages.features.dossier1'),
                t('subpages.features.dossier2'),
              ]}
            />
          </div>
        </Container>
      </section>

      <section className="py-20">
        <Container size="lg" className={FRAME_CLASS}>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon

              return (
                <Card key={feature.title} variant="bordered" className="relative border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-sm">
                  {feature.locked ? (
                    <Badge variant="warning" className="absolute right-4 top-4 inline-flex items-center gap-1">
                      <LockClosedIcon className="h-3 w-3" />
                      {t('features.proLabel')}
                    </Badge>
                  ) : null}
                  <Icon className="mb-3 h-6 w-6 text-teal-600" />
                  <h2 className="mb-2 text-lg font-semibold text-slate-950">{feature.title}</h2>
                  <p className="text-sm leading-relaxed text-slate-500">{feature.description}</p>
                  {feature.sampleLink ? (
                    <Link href="/trust-center/sample" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-teal-700 transition hover:text-teal-800">
                      {t('features.viewSample')}
                      <span aria-hidden="true">→</span>
                    </Link>
                  ) : null}
                </Card>
              )
            })}
          </div>
        </Container>
      </section>

    </div>
  )
}