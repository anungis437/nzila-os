import { getVisibleModules, resolveActor, type SearchParamRecord } from '@/lib/access-control'
import { getMaestriaCopy, getCommerceModulesByLane } from '@/lib/shopmoica-commerce'
import { ModuleCardGrid } from '../components/CommerceCards'
import styles from '../experience.module.css'

type Params = { locale: string }

export default async function ClientLanePage({
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
  const modules = getVisibleModules(actor, getCommerceModulesByLane('client'))

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>{copy.laneB}</p>
          <h1 className={styles.title}>Client growth surfaces that convert and reassure.</h1>
          <p className={styles.subtitle}>
            This lane is the buyer-facing commerce engine: premium intake, guided gifting, corporate reorders,
            tracking, seasonal campaigns, and concierge handling that all route into Flow Engine workflows.
          </p>
          <div className={styles.pillRow}>
            <span className={styles.pill}>Actor: {actor.displayName}</span>
            <span className={styles.pill}>Scope: policy filtered</span>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Client experience sitemap</h2>
            <p className={styles.sectionSubtitle}>
              These pages are the exact external revenue surfaces needed for Shop Moi Ça to convert faster,
              reduce back-and-forth, and deepen repeat buying.
            </p>
          </div>
          <ModuleCardGrid locale={locale} modules={modules} actorKey={actorKey} />
        </section>
      </div>
    </main>
  )
}