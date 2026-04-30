import Link from 'next/link'
import Image from 'next/image'
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
          <Link href={`/${locale}/marketing/features`} className={styles.secondary}>{copy.hero.secondaryCta}</Link>
        </div>

        <div className={styles.heroPreview}>
          <div className={styles.mockupWindow}>
            <div className={styles.mockupHeader}>
              <div className={styles.mockupDots}><span /><span /><span /></div>
              <span className={styles.mockupTitle}>Maestria · Live dashboard</span>
            </div>
            <div className={styles.mockupBody}>
              <div className={styles.mockupStats}>
                <div className={styles.mockupStat}>
                  <span className={styles.mockupValue}>$124k</span>
                  <span className={styles.mockupLabel}>Monthly revenue</span>
                </div>
                <div className={styles.mockupStat}>
                  <span className={styles.mockupValue}>+38%</span>
                  <span className={styles.mockupLabel}>Quote throughput</span>
                </div>
                <div className={styles.mockupStat}>
                  <span className={styles.mockupValue}>72%</span>
                  <span className={styles.mockupLabel}>Conversion rate</span>
                </div>
              </div>
              <div className={styles.mockupChart}>
                <div className={styles.mockupBars}>
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className={styles.mockupBar} />
                  ))}
                </div>
                <span className={styles.mockupChartLabel}>Quote → Invoice · Last 7 weeks</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className={styles.heroShot}>
        <Image
          src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1800&q=85&auto=format&fit=crop"
          alt="Commerce operations powered by Maestria — unified workflow from quote to delivery"
          fill
          className={styles.heroShotImg}
          sizes="100vw"
          priority
        />
      </div>

      <section className={`${styles.container} ${styles.stats}`}>
        {copy.stats.map((stat) => (
          <article key={stat.label} className={styles.statCard}>
            <span className={styles.statValue}>{stat.value}</span>
            <span className={styles.statLabel}>{stat.label}</span>
            <p className={styles.statNote}>{stat.note}</p>
          </article>
        ))}
      </section>

      <div className={styles.visualBand}>
        <Image
          src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1600&q=85&auto=format&fit=crop"
          alt="Premium boutique interior — commerce operations powered by Maestria"
          fill
          className={styles.visualBandImg}
          sizes="100vw"
        />
        <div className={styles.visualBandOverlay}>
          <p className={styles.visualBandQuote}>&ldquo;Commerce, orchestrated.&rdquo;</p>
          <p className={styles.visualBandSub}>From first quote to final delivery — in one unified flow.</p>
        </div>
      </div>

      <section className={`${styles.container} ${styles.section}`}>
        <h2 className={styles.sectionTitle}>{copy.modulesTitle}</h2>
        <p className={styles.sectionSubtitle}>{copy.modulesSubtitle}</p>
        <div className={styles.grid}>
          {featureCards.map((card) => (
            <article key={card.titleEn} className={styles.card}>
              {card.icon && <span className={styles.cardIcon}>{card.icon}</span>}
              <h3 className={styles.cardTitle}>{isFr ? card.titleFr : card.titleEn}</h3>
              <p className={styles.cardText}>{isFr ? card.descriptionFr : card.descriptionEn}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={`${styles.container} ${styles.section}`}>
        <div className={styles.missionSplit}>
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
          <div className={styles.missionImageWrap}>
            <Image
              src="https://images.unsplash.com/photo-1551434678-e076c223a692?w=800&q=85&auto=format&fit=crop"
              alt="Commerce team reviewing Maestria analytics and workflows"
              width={560}
              height={440}
              className={styles.missionImage}
              sizes="(max-width: 768px) 100vw, 45vw"
            />
          </div>
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
