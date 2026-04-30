import Link from 'next/link'
import { listFlowEngineModules } from '@nzila/flow-engine'
import { getVisibleModules, resolveActor, type SearchParamRecord } from '@/lib/access-control'
import {
  dataModelDefinitions,
  getCommerceModulesByLane,
  getMaestriaCopy,
  instantWowMoments,
  longTermStickiness,
  mvpLaunchSet,
  repoSequence,
  revenueModel,
  rolloutPlan,
} from '@/lib/shopmoica-commerce'
import { DataModelGrid, ModuleCardGrid, RepoSequenceGrid, RevenueModelGrid, RolloutGrid } from './components/CommerceCards'
import styles from './experience.module.css'

type Params = { locale: string }

export default async function MaestriaHomePage({
  params,
  searchParams,
}: {
  params: Promise<Params>
  searchParams: Promise<SearchParamRecord>
}) {
  const { locale } = await params
  const actorParams = await searchParams
  const actor = resolveActor(actorParams)
  const actorKey = typeof actorParams.as === 'string' ? actorParams.as : undefined
  const copy = getMaestriaCopy(locale)
  const internalModules = getVisibleModules(actor, getCommerceModulesByLane('internal'))
  const clientModules = getVisibleModules(actor, getCommerceModulesByLane('client'))
  const engineModules = listFlowEngineModules()

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h1 className={styles.title}>{copy.title}</h1>
          <p className={styles.subtitle}>{copy.subtitle}</p>
          <div className={styles.pillRow}>
            <span className={styles.pill}>Actor: {actor.displayName}</span>
            <span className={styles.pill}>Role: {actor.role}</span>
          </div>
          <div className={styles.navRow}>
            <Link href={`/${locale}/internal${actorKey ? `?as=${actorKey}` : ''}`} className={styles.navLink}>{copy.laneA}</Link>
            <Link href={`/${locale}/client${actorKey ? `?as=${actorKey}` : ''}`} className={styles.navLink}>{copy.laneB}</Link>
            <Link href={`/${locale}/demo/shopmoica${actorKey ? `?as=${actorKey}` : ''}`} className={styles.navLink}>Demo Mode</Link>
            <Link href={`/${locale}/marketing`} className={styles.navLink}>Marketing Site</Link>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{copy.sitemapTitle}</h2>
            <p className={styles.sectionSubtitle}>
              The build is split into operator and buyer lanes. Every route below is wired to Flow Engine module boundaries,
              so Maestria owns the premium experience while the engine owns the workflow logic.
            </p>
          </div>

          <div className={styles.dualGrid}>
            <article className={styles.panel}>
              <h3 className={styles.panelTitle}>{copy.laneA}</h3>
              <ModuleCardGrid locale={locale} modules={internalModules} actorKey={actorKey} />
            </article>

            <article className={styles.panel}>
              <h3 className={styles.panelTitle}>{copy.laneB}</h3>
              <ModuleCardGrid locale={locale} modules={clientModules} actorKey={actorKey} />
            </article>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{copy.mvpTitle}</h2>
            <p className={styles.sectionSubtitle}>
              This is the first launch cut that immediately reduces founder burden and improves quote, deposit, and reorder performance.
            </p>
          </div>
          <div className={styles.pillRow}>
            {mvpLaunchSet.map((item) => (
              <span key={item} className={styles.pill}>{item}</span>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{copy.dataTitle}</h2>
            <p className={styles.sectionSubtitle}>
              These are the high-value records that make the platform operationally intelligent instead of visually impressive but shallow.
            </p>
          </div>
          <DataModelGrid models={dataModelDefinitions} />
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{copy.roadmapTitle}</h2>
            <p className={styles.sectionSubtitle}>
              The rollout stages internal control first, then client growth, then retention and premium expansion.
            </p>
          </div>
          <RolloutGrid phases={rolloutPlan} />
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Repo implementation sequence</h2>
            <p className={styles.sectionSubtitle}>
              The implementation order keeps workflow logic centralized in Flow Engine and keeps Maestria focused on operator and client experience quality.
            </p>
          </div>
          <RepoSequenceGrid steps={repoSequence} />
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{copy.revenueTitle}</h2>
            <p className={styles.sectionSubtitle}>
              The business case is direct: faster quoting, safer margin, stronger repeat ordering, and founder time recovered from avoidable coordination work.
            </p>
          </div>
          <RevenueModelGrid items={revenueModel} />
        </section>

        <section className={styles.dualGrid}>
          <article className={styles.panel}>
            <h2 className={styles.panelTitle}>{copy.wowTitle}</h2>
            <ul className={styles.bulletList}>
              {instantWowMoments.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>

          <article className={styles.panel}>
            <h2 className={styles.panelTitle}>{copy.stickinessTitle}</h2>
            <ul className={styles.bulletList}>
              {longTermStickiness.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Flow Engine modules consumed by Maestria</h2>
            <p className={styles.sectionSubtitle}>
              These shared modules remain the workflow core beneath the Shop Moi Ça experience.
            </p>
          </div>
          <div className={styles.cardGrid}>
            {engineModules.map((module) => (
              <article key={module.id} className={styles.card}>
                <span className={styles.cardKicker}>{module.icon} {module.id}</span>
                <h3 className={styles.cardTitle}>{module.name}</h3>
                <p className={styles.cardText}>{module.description}</p>
                <ul className={styles.bulletList}>
                  {module.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}