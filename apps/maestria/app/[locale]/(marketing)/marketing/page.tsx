import Link from 'next/link'
import { listFlowEngineModules } from '@nzila/flow-engine'
import { featureCards, getMarketingCopy } from './content'
import styles from './marketing.module.css'

type Params = { locale: string }

export default async function MarketingHomePage({ params }: { params: Promise<Params> }) {
  const { locale } = await params
  const copy = getMarketingCopy(locale)
  const isFr = locale === 'fr-CA'
  const modules = listFlowEngineModules()

  return (
    <main>
      <section className={`${styles.container} ${styles.hero}`}>
        <p className={styles.eyebrow}>{copy.hero.eyebrow}</p>
        <h1 className={styles.title}>{copy.hero.title}</h1>
        <p className={styles.subtitle}>{copy.hero.subtitle}</p>
        <div className={styles.row}>
          <Link href={`/${locale}/marketing/trial`} className={styles.primary}>{copy.hero.primaryCta}</Link>
          <Link href={`/${locale}/demo/shopmoica`} className={styles.secondary}>{copy.hero.secondaryCta}</Link>
        </div>
      </section>

      <section className={`${styles.container} ${styles.stats}`}>
        {copy.stats.map((stat) => (
          <article key={stat.label} className={styles.statCard}>
            <span className={styles.statValue}>{stat.value}</span>
            <span className={styles.statLabel}>{stat.label}</span>
            <p className={styles.statNote}>{stat.note}</p>
          </article>
        ))}
      </section>

      <section className={`${styles.container} ${styles.section}`}>
        <h2 className={styles.sectionTitle}>{copy.modulesTitle}</h2>
        <p className={styles.sectionSubtitle}>{copy.modulesSubtitle}</p>
        <div className={styles.grid}>
          {featureCards.map((card) => (
            <article key={card.titleEn} className={styles.card}>
              <h3 className={styles.cardTitle}>{isFr ? card.titleFr : card.titleEn}</h3>
              <p className={styles.cardText}>{isFr ? card.descriptionFr : card.descriptionEn}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={`${styles.container} ${styles.section}`}>
        <div className={styles.mission}>
          <p className={styles.eyebrow}>{copy.mission.eyebrow}</p>
          <h3 className={styles.missionTitle}>{copy.mission.title}</h3>
          <p className={styles.missionText}>{copy.mission.body}</p>
          <ul className={styles.list}>
            {copy.mission.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className={`${styles.container} ${styles.section}`}>
        <h2 className={styles.sectionTitle}>{isFr ? 'Modules operationnels inclus' : 'Operational modules included'}</h2>
        <p className={styles.sectionSubtitle}>
          {isFr
            ? 'Maestria exploite les modules Flow Engine suivants pour conserver des workflows coherents entre acquisition, ventes et execution.'
            : 'Maestria consumes the following Flow Engine modules to keep acquisition, sales, and execution on a single workflow backbone.'}
        </p>
        <div className={styles.grid}>
          {modules.map((module) => (
            <article key={module.id} className={styles.card}>
              <h3 className={styles.cardTitle}>{module.icon} {module.name}</h3>
              <p className={styles.cardText}>{module.description}</p>
            </article>
          ))}
        </div>

        <div className={styles.footerCta}>
          <h3>{copy.cta.title}</h3>
          <p>{copy.cta.subtitle}</p>
          <div className={styles.row}>
            <Link href={`/${locale}/marketing/trial`} className={styles.primary}>{copy.cta.primary}</Link>
            <Link href={`/${locale}/marketing/contact`} className={styles.secondary}>{copy.cta.secondary}</Link>
          </div>
        </div>
      </section>
    </main>
  )
}
