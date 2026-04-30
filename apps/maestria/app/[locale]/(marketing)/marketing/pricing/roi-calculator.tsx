'use client'

import { useMemo, useState } from 'react'
import styles from '../marketing.module.css'

type RoiCalculatorProps = {
  locale: string
}

export function RoiCalculator({ locale }: RoiCalculatorProps) {
  const isFr = locale === 'fr-CA'
  const [monthlyOrders, setMonthlyOrders] = useState(85)
  const [avgOrderValue, setAvgOrderValue] = useState(260)
  const [hoursSavedWeekly, setHoursSavedWeekly] = useState(9)

  const roi = useMemo(() => {
    const monthlyRevenue = monthlyOrders * avgOrderValue
    const yearlyRecoveredHours = hoursSavedWeekly * 52
    const hourValueCad = 65
    const efficiencyGain = yearlyRecoveredHours * hourValueCad
    return {
      monthlyRevenue,
      yearlyRecoveredHours,
      annualImpact: efficiencyGain + monthlyRevenue * 0.08,
    }
  }, [monthlyOrders, avgOrderValue, hoursSavedWeekly])

  return (
    <section className={styles.formCard}>
      <h2 className={styles.sectionTitle}>{isFr ? 'Calculateur ROI PME' : 'SMB ROI Calculator'}</h2>
      <p className={styles.sectionSubtitle}>
        {isFr ? 'Estimez l impact annuel d un cycle devis-encaissement plus rapide.' : 'Estimate annual impact from faster quote-to-cash cycles.'}
      </p>
      <div className={styles.formGrid}>
        <label>
          {isFr ? 'Commandes mensuelles' : 'Monthly orders'}
          <input type="number" min={1} className={styles.input} value={monthlyOrders} onChange={(event) => setMonthlyOrders(Number(event.target.value || 0))} />
        </label>
        <label>
          {isFr ? 'Valeur moyenne commande (CAD)' : 'Average order value (CAD)'}
          <input type="number" min={1} className={styles.input} value={avgOrderValue} onChange={(event) => setAvgOrderValue(Number(event.target.value || 0))} />
        </label>
        <label>
          {isFr ? 'Heures gagnees par semaine' : 'Hours saved per week'}
          <input type="number" min={1} className={styles.input} value={hoursSavedWeekly} onChange={(event) => setHoursSavedWeekly(Number(event.target.value || 0))} />
        </label>
      </div>
      <div className={styles.grid}>
        <article className={styles.card}>
          <span className={styles.statLabel}>{isFr ? 'Debit mensuel' : 'Monthly throughput'}</span>
          <strong className={styles.statValue}>CAD {roi.monthlyRevenue.toLocaleString('en-CA')}</strong>
        </article>
        <article className={styles.card}>
          <span className={styles.statLabel}>{isFr ? 'Heures recuperees / an' : 'Recovered hours / year'}</span>
          <strong className={styles.statValue}>{roi.yearlyRecoveredHours.toLocaleString('en-CA')}</strong>
        </article>
        <article className={styles.card}>
          <span className={styles.statLabel}>{isFr ? 'Impact annuel estime' : 'Estimated annual impact'}</span>
          <strong className={styles.statValue}>CAD {Math.round(roi.annualImpact).toLocaleString('en-CA')}</strong>
        </article>
      </div>
    </section>
  )
}
