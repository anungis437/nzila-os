import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AccessDeniedPanel } from '@/app/[locale]/components/AccessDeniedPanel'
import { getCommerceModule } from '@/lib/shopmoica-commerce'
import { canAccessModule, resolveActor, withActorParam, type SearchParamRecord } from '@/lib/access-control'
import { InternalLiveSurface } from '@/app/[locale]/components/LiveCommerceSurfaces'
import styles from '../../experience.module.css'

type Params = { locale: string; module: string }

export function generateStaticParams() {
  return [
    { module: 'executive-dashboard' },
    { module: 'quote-pipeline' },
    { module: 'custom-order-management' },
    { module: 'production-tracker' },
    { module: 'inventory-center' },
    { module: 'supplier-po-center' },
    { module: 'shipping-center' },
    { module: 'shopify-intelligence-hub' },
    { module: 'google-ads-command-center' },
    { module: 'campaign-command-center' },
    { module: 'social-presence-planner' },
    { module: 'website-conversion-center' },
    { module: 'finance-surface' },
    { module: 'crm-internal-view' },
  ]
}

export default async function InternalModulePage({
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

  if (!canAccessModule(actor, 'internal', module)) {
    return (
      <AccessDeniedPanel
        locale={locale}
        actorLabel={`${actor.displayName} (${actor.role})`}
        reason="Your current role does not allow access to this internal module. Request owner escalation or switch to an authorized persona in demo mode."
      />
    )
  }

  const liveModuleSlugs = new Set([
    'executive-dashboard',
    'quote-pipeline',
    'custom-order-management',
    'production-tracker',
    'inventory-center',
    'supplier-po-center',
    'shipping-center',
    'shopify-intelligence-hub',
    'google-ads-command-center',
    'campaign-command-center',
    'social-presence-planner',
    'website-conversion-center',
    'finance-surface',
    'crm-internal-view',
  ])
  if (liveModuleSlugs.has(module)) {
    return <InternalLiveSurface slug={module} locale={locale} actor={actor} actorKey={actorKey} />
  }
  const definition = getCommerceModule('internal', module)

  if (!definition) {
    notFound()
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <Link href={withActorParam(`/${locale}/internal`, actorKey)} className={styles.backLink}>
          Back to internal lane
        </Link>

        <section className={styles.hero}>
          <p className={styles.eyebrow}>Lane A module</p>
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
            <h2 className={styles.panelTitle}>Workflow stages</h2>
            <div className={styles.pillRow}>
              {definition.stages.map((stage) => (
                <span key={stage} className={styles.pill}>{stage}</span>
              ))}
            </div>
          </article>

          <article className={styles.panel}>
            <h2 className={styles.panelTitle}>Business outcome</h2>
            <p className={styles.cardText}>{definition.outcome}</p>
          </article>
        </section>

        <section className={styles.dualGrid}>
          <article className={styles.panel}>
            <h2 className={styles.panelTitle}>Revenue impact</h2>
            <ul className={styles.bulletList}>
              {definition.revenueLevers.map((lever) => (
                <li key={lever}>{lever}</li>
              ))}
            </ul>
          </article>

          <article className={styles.panel}>
            <h2 className={styles.panelTitle}>Why it sticks</h2>
            <ul className={styles.bulletList}>
              {definition.stickiness.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </section>

        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Operating pulse</h2>
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