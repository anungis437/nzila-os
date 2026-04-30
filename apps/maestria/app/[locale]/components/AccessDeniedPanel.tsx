import Link from 'next/link'
import styles from '../experience.module.css'

export function AccessDeniedPanel({
  locale,
  reason,
  actorLabel,
}: {
  locale: string
  reason: string
  actorLabel: string
}) {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>Access policy</p>
          <h1 className={styles.title}>This surface is restricted</h1>
          <p className={styles.subtitle}>{reason}</p>
          <div className={styles.pillRow}>
            <span className={styles.warnPill}>Actor: {actorLabel}</span>
            <span className={styles.pill}>Audit event recorded</span>
          </div>
          <div className={styles.navRow}>
            <Link href={`/${locale}`} className={styles.navLink}>Back to overview</Link>
            <Link href={`/${locale}/demo/shopmoica`} className={styles.navLink}>Open RBAC demo</Link>
          </div>
        </section>
      </div>
    </main>
  )
}
