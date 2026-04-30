import Image from 'next/image'
import { featureCards, getMarketingCopy } from '../content'
import styles from '../marketing.module.css'

type Params = { locale: string }

export default async function MarketingFeaturesPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params
  const copy = getMarketingCopy(locale)
  const isFr = locale === 'fr-CA'

  return (
    <main>
      <section className={`${styles.container} ${styles.section}`}>
        <p className={styles.eyebrow}>{copy.nav.features}</p>
        <h1 className={styles.sectionTitle}>
          {isFr ? 'Fonctionnalites concues pour des equipes qui executent vite.' : 'Features designed for teams that need speed and control.'}
        </h1>
        <p className={styles.sectionSubtitle}>
          {isFr
            ? 'Chaque surface est alignee sur un resultat operationnel reel: plus de vitesse commerciale, moins de derive et plus de confiance client.'
            : 'Each surface maps to a real operating outcome: faster commercial motion, less process drift, and higher buyer trust.'}
        </p>
      </section>

      <div className={styles.visualBand}>
        <Image
          src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1600&q=85&auto=format&fit=crop"
          alt="Analytics dashboards and workflow intelligence — Maestria feature suite"
          fill
          className={styles.visualBandImg}
          sizes="100vw"
        />
        <div className={styles.visualBandOverlay}>
          <p className={styles.visualBandQuote}>&ldquo;Every feature earns its surface.&rdquo;</p>
          <p className={styles.visualBandSub}>Built for commercial teams that execute under real pressure.</p>
        </div>
      </div>

      <section className={`${styles.container} ${styles.section}`}>
        <div className={styles.grid}>
          {featureCards.map((card) => (
            <article key={card.titleEn} className={styles.card}>
              {card.icon && <span className={styles.cardIcon}>{card.icon}</span>}
              <h2 className={styles.cardTitle}>{isFr ? card.titleFr : card.titleEn}</h2>
              <p className={styles.cardText}>{isFr ? card.descriptionFr : card.descriptionEn}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
