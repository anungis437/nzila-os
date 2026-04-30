import Link from 'next/link'
import { getMarketingCopy, pricingPlans } from '../content'
import { RoiCalculator } from './roi-calculator'
import styles from '../marketing.module.css'

type Params = { locale: string }

export default async function MarketingPricingPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params
  const copy = getMarketingCopy(locale)
  const isFr = locale === 'fr-CA'

  return (
    <main className={`${styles.container} ${styles.section}`}>
      <p className={styles.eyebrow}>{copy.nav.pricing}</p>
      <h1 className={styles.sectionTitle}>
        {isFr ? 'Tarification adaptee a votre maturite operationnelle' : 'Pricing that scales with operational maturity'}
      </h1>
      <p className={styles.sectionSubtitle}>
        {isFr
          ? 'Demarrez avec le blueprint Shop Moi Ca puis etendez les surfaces a votre contexte sans replatformer.'
          : 'Start with the Shop Moi Ca blueprint and expand surfaces to your context without re-platforming.'}
      </p>

      <div className={styles.grid}>
        {pricingPlans.map((plan) => (
          <article key={plan.name} className={styles.card}>
            <h2 className={styles.cardTitle}>{plan.name}</h2>
            <p className={styles.statValue}>{plan.monthly}</p>
            <ul className={styles.list}>
              {(isFr ? plan.featuresFr : plan.featuresEn).map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            <div className={styles.row}>
              <Link href={`/${locale}/marketing/trial`} className={styles.primary}>{isFr ? 'Demarrer' : 'Start'}</Link>
            </div>
          </article>
        ))}
      </div>

      <section className={styles.section}>
        <RoiCalculator locale={locale} />
      </section>
    </main>
  )
}
