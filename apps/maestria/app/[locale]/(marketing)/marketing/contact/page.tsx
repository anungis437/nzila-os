import { ContactForm } from './contact-form'
import styles from '../marketing.module.css'

type Params = { locale: string }

export default async function MarketingContactPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params
  const isFr = locale === 'fr-CA'

  return (
    <main className={`${styles.container} ${styles.section}`}>
      <p className={styles.eyebrow}>{isFr ? 'Contact' : 'Contact'}</p>
      <h1 className={styles.sectionTitle}>
        {isFr ? 'Parlons de votre croissance commerce.' : 'Let us map your commerce growth path.'}
      </h1>
      <p className={styles.sectionSubtitle}>
        {isFr
          ? 'Partagez votre goulot principal. Nous proposons un plan de deploiement priorise sur vos 30 premiers jours.'
          : 'Share your biggest bottleneck. We will propose a prioritized deployment plan for your first 30 days.'}
      </p>
      <ContactForm locale={locale} />
    </main>
  )
}
