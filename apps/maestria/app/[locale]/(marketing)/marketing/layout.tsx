import type { ReactNode } from 'react'
import Link from 'next/link'
import { getMarketingCopy } from './content'
import styles from './marketing.module.css'

type Params = { locale: string }

export default async function MarketingLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<Params>
}) {
  const { locale } = await params
  const copy = getMarketingCopy(locale)
  const year = new Date().getFullYear()

  return (
    <div className={styles.page}>
      <header className={styles.topNav}>
        <div className={`${styles.container} ${styles.navInner}`}>
          <p className={styles.brand}>Maestria <span>x</span> Shop Moi Ca</p>
          <nav className={styles.navLinks}>
            <Link href={`/${locale}/marketing`} className={styles.navLink}>{copy.nav.product}</Link>
            <Link href={`/${locale}/marketing/features`} className={styles.navLink}>{copy.nav.features}</Link>
            <Link href={`/${locale}/marketing/pricing`} className={styles.navLink}>{copy.nav.pricing}</Link>
            <Link href={`/${locale}/marketing/about`} className={styles.navLink}>{copy.nav.about}</Link>
            <Link href={`/${locale}/marketing/contact`} className={styles.navLink}>{copy.nav.contact}</Link>
            <Link href={`/${locale}/marketing/trial`} className={styles.navLinkStrong}>{copy.nav.trial}</Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className={styles.footer}>
        <div className={`${styles.container} ${styles.footerInner}`}>
          <span>{year} Maestria Commerce Edition</span>
          <span>Flagship implementation: Shop Moi Ca</span>
        </div>
      </footer>
    </div>
  )
}
