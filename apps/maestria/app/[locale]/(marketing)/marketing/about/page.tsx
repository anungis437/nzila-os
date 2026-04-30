import Image from 'next/image'
import styles from '../marketing.module.css'

type Params = { locale: string }

const VALUES = [
  {
    titleEn: 'Owner-first architecture',
    titleFr: 'Architecture orientee direction',
    bodyEn: 'Mission control should feel natural for founders before they build a full operations team.',
    bodyFr: 'Le mission control doit etre naturel pour les fondateurs avant de monter une equipe operations complete.',
  },
  {
    titleEn: 'Workflow truth over dashboard theater',
    titleFr: 'Verite workflow, pas theatre dashboard',
    bodyEn: 'We prioritize enforceable workflows and explainable states, not decorative metrics.',
    bodyFr: 'Nous privilegions des workflows appliques et etats explicables, pas des metriques decoratives.',
  },
  {
    titleEn: 'Premium client experience by default',
    titleFr: 'Experience client premium par defaut',
    bodyEn: 'External portals should feel polished while preserving strict internal controls.',
    bodyFr: 'Les portails externes doivent etre premium tout en preservant des controles internes stricts.',
  },
]

export default async function MarketingAboutPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params
  const isFr = locale === 'fr-CA'

  return (
    <main>
      <div className={styles.visualBand}>
        <Image
          src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1600&q=85&auto=format&fit=crop"
          alt="Maestria product team — building commerce intelligence for operators"
          fill
          className={styles.visualBandImg}
          sizes="100vw"
        />
        <div className={styles.visualBandOverlay}>
          <p className={styles.visualBandQuote}>&ldquo;Rigorous by design. Premium by conviction.&rdquo;</p>
          <p className={styles.visualBandSub}>A platform built by operators, for operators who care about craft.</p>
        </div>
      </div>

      <section className={`${styles.container} ${styles.section}`}>
        <p className={styles.eyebrow}>{isFr ? 'A propos de Maestria' : 'About Maestria'}</p>
        <h1 className={styles.sectionTitle}>
          {isFr
            ? 'Nous construisons des surfaces premium qui restent rigoureuses en operations.'
            : 'We build premium product surfaces that stay rigorous under operational pressure.'}
        </h1>
        <p className={styles.sectionSubtitle}>
          {isFr
            ? 'Shop Moi Ca est notre implementation phare: acquisition, devis, production, fulfillment et suivi client dans une seule architecture coherente.'
            : 'Shop Moi Ca is our flagship implementation: acquisition, quoting, production, fulfillment, and client tracking in one coherent architecture.'}
        </p>
        <div className={styles.grid}>
          {VALUES.map((item) => (
            <article key={item.titleEn} className={styles.card}>
              <h2 className={styles.cardTitle}>{isFr ? item.titleFr : item.titleEn}</h2>
              <p className={styles.cardText}>{isFr ? item.bodyFr : item.bodyEn}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
