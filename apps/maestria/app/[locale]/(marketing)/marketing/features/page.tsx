import { featureCards, getMarketingCopy } from '../content'
import styles from '../marketing.module.css'

type Params = { locale: string }

export default async function MarketingFeaturesPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params
  const copy = getMarketingCopy(locale)
  const isFr = locale === 'fr-CA'

  return (
    <main className={`${styles.container} ${styles.section}`}>
      <p className={styles.eyebrow}>{copy.nav.features}</p>
      <h1 className={styles.sectionTitle}>
        {isFr ? 'Fonctionnalites concues pour des equipes qui executent vite.' : 'Features designed for teams that need speed and control.'}
      </h1>
      <p className={styles.sectionSubtitle}>
        {isFr
          ? 'Chaque surface est alignee sur un resultat operationnel reel: plus de vitesse commerciale, moins de derive et plus de confiance client.'
          : 'Each surface maps to a real operating outcome: faster commercial motion, less process drift, and higher buyer trust.'}
      </p>
      <div className={styles.grid}>
        {featureCards.map((card) => (
          <article key={card.titleEn} className={styles.card}>
            <h2 className={styles.cardTitle}>{isFr ? card.titleFr : card.titleEn}</h2>
            <p className={styles.cardText}>{isFr ? card.descriptionFr : card.descriptionEn}</p>
          </article>
        ))}
      </div>
    </main>
  )
}
