import { getKpiWarehouseSummary } from '@/lib/maestria-analytics'
import styles from '../../experience.module.css'

type Params = { locale: string }

export default async function PilotMetricsPage({ params }: { params: Promise<Params> }) {
  const { locale: _locale } = await params
  const warehouse = getKpiWarehouseSummary()

  const gmv = warehouse.kpis.find((k) => k.eventName === 'gmv')
  const margin = warehouse.kpis.find((k) => k.eventName === 'margin')
  const roas = warehouse.kpis.find((k) => k.eventName === 'roas')

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>Internal · Pilot Intelligence</p>
          <h1 className={styles.title}>Pilot Metrics</h1>
          <p className={styles.subtitle}>
            Live KPI snapshot from the operational event warehouse. Covers GMV, margin, and ROAS across all active
            pilot connectors.
          </p>
          <div className={styles.pillRow}>
            <span className={styles.pill}>Events captured: {warehouse.totalEvents}</span>
            <span className={styles.pill}>Generated: {new Date(warehouse.generatedAt).toLocaleString()}</span>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Key Performance Indicators</h2>
            <p className={styles.sectionSubtitle}>
              Aggregated totals and averages computed from the last 500 KPI events.
            </p>
          </div>

          <div className={styles.cardGrid}>
            <KpiCard
              label="Gross Merchandise Value"
              value={gmv ? `${gmv.total.toLocaleString()} ${gmv.unit}` : '—'}
              sub={gmv ? `${gmv.count} events · avg ${gmv.average} ${gmv.unit}` : 'No events recorded'}
            />
            <KpiCard
              label="Contribution Margin"
              value={margin ? `${margin.total.toLocaleString()} ${margin.unit}` : '—'}
              sub={margin ? `${margin.count} events · avg ${margin.average} ${margin.unit}` : 'No events recorded'}
            />
            <KpiCard
              label="Return on Ad Spend"
              value={roas ? `${roas.average}×` : '—'}
              sub={roas ? `${roas.count} events · total ${roas.total} ${roas.unit}` : 'No events recorded'}
            />
          </div>
        </section>

        {warehouse.kpis.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>All Tracked Events</h2>
            </div>
            <div className={styles.cardGrid}>
              {warehouse.kpis.map((kpi) => (
                <KpiCard
                  key={kpi.eventName}
                  label={kpi.eventName}
                  value={`${kpi.total.toLocaleString()} ${kpi.unit}`}
                  sub={`${kpi.count} events · avg ${kpi.average} ${kpi.unit}`}
                />
              ))}
            </div>
          </section>
        )}

        {Object.keys(warehouse.sourceBreakdown).length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Source Breakdown</h2>
            </div>
            <div className={styles.pillRow}>
              {Object.entries(warehouse.sourceBreakdown).map(([source, count]) => (
                <span key={source} className={styles.pill}>
                  {source}: {count}
                </span>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className={styles.card}>
      <p className={styles.eyebrow}>{label}</p>
      <p className={styles.title} style={{ fontSize: '1.5rem' }}>
        {value}
      </p>
      <p className={styles.subtitle} style={{ fontSize: '0.85rem' }}>
        {sub}
      </p>
    </div>
  )
}
