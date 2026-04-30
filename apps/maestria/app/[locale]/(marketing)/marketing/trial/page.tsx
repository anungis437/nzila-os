import { TrialForm } from './trial-form'
import styles from '../marketing.module.css'

type Params = { locale: string }

export default async function MarketingTrialPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params
  const isFr = locale === 'fr-CA'

  return (
    <main className={`${styles.container} ${styles.section}`}>
      <p className={styles.eyebrow}>{isFr ? 'Essai' : 'Trial'}</p>
      <h1 className={styles.sectionTitle}>{isFr ? 'Demarrer votre essai Maestria 14 jours' : 'Start your 14-day Maestria trial'}</h1>
      <p className={styles.sectionSubtitle}>
        {isFr
          ? 'Activez une edition inspiree de Shop Moi Ca et adaptez-la ensuite a vos produits et workflows.'
          : 'Activate the Shop Moi Ca-inspired edition, then adapt it to your products and workflows.'}
      </p>

      <TrialForm locale={locale} />
    </main>
  )
}
