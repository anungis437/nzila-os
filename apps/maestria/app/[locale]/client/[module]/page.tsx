import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AccessDeniedPanel } from '@/app/[locale]/components/AccessDeniedPanel'
import { getCommerceModule } from '@/lib/shopmoica-commerce'
import { canAccessModule, resolveActor, withActorParam, type SearchParamRecord } from '@/lib/access-control'
import { ClientLiveSurface } from '@/app/[locale]/components/LiveCommerceSurfaces'
import styles from '../../experience.module.css'

type Params = { locale: string; module: string }

export function generateStaticParams() {
  return [
    { module: 'smart-quote-request-portal' },
    { module: 'guided-gift-builder' },
    { module: 'corporate-client-portal' },
    { module: 'order-tracking-experience' },
    { module: 'loyalty-vip-system' },
    { module: 'seasonal-campaign-engine' },
    { module: 'concierge-requests' },
  ]
}

export default async function ClientModulePage({
  params,
  searchParams,
}: {
  params: Promise<Params>
  searchParams: Promise<SearchParamRecord>
}) {
  const { locale, module } = await params
  const actorParams = await searchParams
  const actor = resolveActor(actorParams)
  const actorKey = typeof actorParams.as === 'string' ? actorParams.as : 'lissa'

  if (!canAccessModule(actor, 'client', module)) {
    return (
      <AccessDeniedPanel
        locale={locale}
        actorLabel={`${actor.displayName} (${actor.role})`}
        reason="Your role is currently scoped away from this client-facing module."
      />
    )
  }

  const liveModuleSlugs = new Set([
    'smart-quote-request-portal',
    'guided-gift-builder',
    'corporate-client-portal',
    'order-tracking-experience',
    'loyalty-vip-system',
    'seasonal-campaign-engine',
    'concierge-requests',
  ])
  if (liveModuleSlugs.has(module)) {
    return <ClientLiveSurface slug={module} locale={locale} actor={actor} actorKey={actorKey} />
  }
  const definition = getCommerceModule('client', module)

  if (!definition) {
    notFound()
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <Link href={withActorParam(`/${locale}/client`, actorKey)} className={styles.backLink}>
          Back to client lane
        </Link>

        <section className={styles.hero}>
          <p className={styles.eyebrow}>Lane B module</p>
          <h1 className={styles.title}>{definition.title}</h1>
          <p className={styles.subtitle}>{definition.summary}</p>
          <div className={styles.pillRow}>
            {definition.engineModules.map((engineModule) => (
              <span key={engineModule} className={styles.pill}>{engineModule}</span>
            ))}
          </div>
        </section>

        <section className={styles.dualGrid}>
          <article className={styles.panel}>
            <h2 className={styles.panelTitle}>Core components</h2>
            <ul className={styles.bulletList}>
              {definition.components.map((component) => (
                <li key={component}>{component}</li>
              ))}
            </ul>
          </article>

          <article className={styles.panel}>
            <h2 className={styles.panelTitle}>Required data models</h2>
            <ul className={styles.bulletList}>
              {definition.dataModels.map((model) => (
                <li key={model}>{model}</li>
              ))}
            </ul>
          </article>
        </section>

        <section className={styles.dualGrid}>
          <article className={styles.panel}>
            <h2 className={styles.panelTitle}>Experience stages</h2>
            <div className={styles.pillRow}>
              {definition.stages.map((stage) => (
                <span key={stage} className={styles.pill}>{stage}</span>
              ))}
            </div>
          </article>

          <article className={styles.panel}>
            <h2 className={styles.panelTitle}>Customer outcome</h2>
            <p className={styles.cardText}>{definition.outcome}</p>
          </article>
        </section>

        <section className={styles.dualGrid}>
          <article className={styles.panel}>
            <h2 className={styles.panelTitle}>Instant wow</h2>
            <ul className={styles.bulletList}>
              {definition.wowMoments.map((moment) => (
                <li key={moment}>{moment}</li>
              ))}
            </ul>
          </article>

          <article className={styles.panel}>
            <h2 className={styles.panelTitle}>Long-term stickiness</h2>
            <ul className={styles.bulletList}>
              {definition.stickiness.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </section>

        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Growth pulse</h2>
          {definition.kpis.map((kpi) => (
            <div key={kpi.label} className={styles.metricBlock}>
              <span className={styles.metricLabel}>{kpi.label}</span>
              <span className={styles.metricValue}>{kpi.value}</span>
              <p className={styles.metricNote}>{kpi.note}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  )
}