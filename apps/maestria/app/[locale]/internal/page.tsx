import { getVisibleModules, resolveActor, type SearchParamRecord } from '@/lib/access-control'
import { getMaestriaCopy, getCommerceModulesByLane } from '@/lib/shopmoica-commerce'
import { ModuleCardGrid } from '../components/CommerceCards'
import styles from '../experience.module.css'

type Params = { locale: string }

export default async function InternalLanePage({
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
  const modules = getVisibleModules(actor, getCommerceModulesByLane('internal'))

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>{copy.laneA}</p>
          <h1 className={styles.title}>Operator-grade commerce control for Shop Moi Ça.</h1>
          <p className={styles.subtitle}>
            These pages are the owner and staff operating system: quotes, orders, production, inventory,
            procurement, finance, and CRM memory built on Flow Engine instead of duplicated business logic.
          </p>
          <div className={styles.pillRow}>
            <span className={styles.pill}>Actor: {actor.displayName}</span>
            <span className={styles.pill}>Scope: least privilege</span>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Internal sitemap</h2>
            <p className={styles.sectionSubtitle}>
              Every module is a production surface, not a placeholder. The card copy below defines the exact pages,
              core components, and outcome each page must deliver.
            </p>
          </div>
          <ModuleCardGrid locale={locale} modules={modules} actorKey={actorKey} />
        </section>
      </div>
    </main>
  )
}