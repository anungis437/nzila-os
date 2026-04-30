import Link from 'next/link'
import { actorOptions, canAccessModule, resolveActor, type SearchParamRecord } from '@/lib/access-control'
import {
  aiInsightCards,
  demoScenarios,
  deliveryCalendar,
  exportReports,
  formatCurrency,
  liveConnectors,
  notificationCenterItems,
  profitabilityRecords,
  proposalPackages,
  shippingOperations,
  vendorRiskAlerts,
} from '@/lib/shopmoica-pilot-data'
import styles from '../../experience.module.css'

type Params = { locale: string }

export default async function ShopMoiCaDemoPage({
  params,
  searchParams,
}: {
  params: Promise<Params>
  searchParams: Promise<SearchParamRecord>
}) {
  const { locale } = await params
  const actorParams = await searchParams
  const actor = resolveActor(actorParams)
  const actorKey = typeof actorParams.as === 'string' ? actorParams.as : 'lissa'
  const marginLeak = profitabilityRecords.find((record) => record.marginFlag === 'Blocked')
  const premiumTier = proposalPackages.find((item) => item.tier === 'Premium') ?? proposalPackages[1]
  const investorProof = [
    { label: 'Close wedge', value: 'Corporate reorders + concierge gifting', note: 'The flagship entry point compounds because pricing, recipient memory, and delivery confidence all stay in one system.' },
    { label: 'Revenue proof', value: formatCurrency(200 * premiumTier.pricePerRecipient * 0.3), note: 'A 200-recipient premium proposal at a 30% close path creates immediate revenue signal.' },
    { label: 'Why now', value: 'Bilingual + premium + operationally credible', note: 'The product stands out because it feels luxurious without hiding the messy operating truth.' },
  ]
  const guidedFlow = [
    { step: '01', title: 'Open executive cockpit', note: 'Lead with cash, risk, and workload in one screenshot-ready surface.', route: '/internal/executive-dashboard' },
    { step: '02', title: 'Show the quote system', note: 'Advance a premium quote and demonstrate margin-safe movement.', route: '/internal/quote-pipeline' },
    { step: '03', title: 'Escalate a real corporate reorder', note: 'Prove self-service without losing founder control.', route: '/client/corporate-client-portal' },
    { step: '04', title: 'Switch to connectors', note: 'Demonstrate Shopify, Google Ads, and Zoho as live context, not decoration.', route: '/internal/campaign-command-center' },
    { step: '05', title: 'Reassure the customer', note: 'Open the tracking experience and show bilingual confidence states.', route: '/client/order-tracking-experience' },
    { step: '06', title: 'Close with polished exports', note: 'End on PDF/CSV proof that looks client- and founder-ready.', route: '/internal/finance-surface' },
  ]
  const walkthrough = [
    'Morning dashboard clarity',
    'Vendor delay detected and escalated',
    'Rush executive gift saved',
    'Quote converted fast',
    'Christmas corporate campaign coordinated',
    'Google Ads profitable keyword surfaced',
    'Repeat law firm reorder launched',
    'Margin leak prevented before approval',
    'Shipping queue controlled with confidence updates',
    'Seasonal growth forecasted with action owners',
  ]

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <Link href={`/${locale}?as=${actorKey}`} className={styles.backLink}>Back to overview</Link>

        <section className={styles.hero}>
          <p className={styles.eyebrow}>Demo mode</p>
          <h1 className={styles.title}>Shop Moi Ça operating scenarios</h1>
          <p className={styles.subtitle}>
            {locale.startsWith('fr')
              ? 'Cette route est le script fondateur: scenarios de pression credibles qui prouvent que Maestria comprend la curation, '
              : 'This route is the founder demo script: believable pressure scenarios that prove Maestria understands curated gifting,'}
            supplier risk, shipping complexity, margin guardrails, and repeat B2B campaigns.
          </p>
          <div className={styles.pillRow}>
            <span className={styles.pill}>Active actor: {actor.displayName}</span>
            <span className={styles.pill}>Role: {actor.role}</span>
          </div>
        </section>

        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Persona and staff switcher</h2>
          <p className={styles.cardText}>Use these links to prove owner-equivalent access and constrained staff/client scopes.</p>
          <div className={styles.pillRow}>
            {actorOptions.map((option) => (
              <Link
                key={option.key}
                href={`/${locale}/demo/shopmoica?as=${option.key}`}
                className={option.key === actorKey ? styles.primaryFilter : styles.secondaryFilter}
              >
                {option.label}
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>12-minute founder walkthrough</h2>
          <ul className={styles.bulletList}>
            {walkthrough.map((step, index) => (
              <li key={step}>{index + 1}. {step}</li>
            ))}
          </ul>
        </section>

        <section className={styles.cardGrid}>
          {guidedFlow.map((step) => (
            <article key={step.step} className={styles.card}>
              <span className={styles.cardKicker}>Step {step.step}</span>
              <h2 className={styles.cardTitle}>{step.title}</h2>
              <p className={styles.cardText}>{step.note}</p>
              <Link href={`/${locale}${step.route}?as=${actorKey}`} className={styles.navLink}>Open guided step</Link>
            </article>
          ))}
        </section>

        <section className={styles.statsGrid}>
          <article className={styles.statCard}><span className={styles.statLabel}>Scenarios</span><strong className={styles.statValue}>{demoScenarios.length}</strong><p className={styles.statNote}>High-value stories designed to show how the product handles real operating complexity.</p></article>
          <article className={styles.statCard}><span className={styles.statLabel}>Vendor risks live</span><strong className={styles.statValue}>{vendorRiskAlerts.length}</strong><p className={styles.statNote}>Supplier issues actively threatening live orders or quoted margin assumptions.</p></article>
          <article className={styles.statCard}><span className={styles.statLabel}>Same-day delivery load</span><strong className={styles.statValue}>{shippingOperations.filter((item) => item.rush).length}</strong><p className={styles.statNote}>Rush orders in flight right now, not a generic shipping placeholder.</p></article>
          <article className={styles.statCard}><span className={styles.statLabel}>Worst margin leak</span><strong className={styles.statValue}>{marginLeak ? `${marginLeak.grossMarginPercent.toFixed(1)}%` : 'n/a'}</strong><p className={styles.statNote}>Shows why discounting and packaging creep need a stoplight before approval.</p></article>
        </section>

        <section className={styles.spotlightGrid}>
          {investorProof.map((item) => (
            <article key={item.label} className={styles.spotlightCard}>
              <span className={styles.metricLabel}>{item.label}</span>
              <strong className={styles.spotlightValue}>{item.value}</strong>
              <p className={styles.spotlightNote}>{item.note}</p>
            </article>
          ))}
        </section>

        <section className={styles.cardGrid}>
          {demoScenarios.map((scenario) => (
            <article key={scenario.id} className={styles.card}>
              <span className={styles.cardKicker}>{scenario.id}</span>
              <h2 className={styles.cardTitle}>{scenario.title}</h2>
              <p className={styles.cardText}>{scenario.summary}</p>
              <p className={styles.metricNote}>{scenario.impact}</p>
              <Link href={`/${locale}${scenario.route}?as=${actorKey}`} className={styles.navLink}>Open surface</Link>
            </article>
          ))}
        </section>

        <section className={styles.dualGrid}>
          <article className={styles.panel}>
            <h2 className={styles.panelTitle}>Policy proof: internal lane</h2>
            <ul className={styles.bulletList}>
              <li>Executive Dashboard: {canAccessModule(actor, 'internal', 'executive-dashboard') ? 'allowed' : 'denied'}</li>
              <li>Finance Surface: {canAccessModule(actor, 'internal', 'finance-surface') ? 'allowed' : 'denied'}</li>
              <li>Production Tracker: {canAccessModule(actor, 'internal', 'production-tracker') ? 'allowed' : 'denied'}</li>
            </ul>
          </article>
          <article className={styles.panel}>
            <h2 className={styles.panelTitle}>Policy proof: client lane</h2>
            <ul className={styles.bulletList}>
              <li>Corporate Portal: {canAccessModule(actor, 'client', 'corporate-client-portal') ? 'allowed' : 'denied'}</li>
              <li>Loyalty / VIP: {canAccessModule(actor, 'client', 'loyalty-vip-system') ? 'allowed' : 'denied'}</li>
              <li>Concierge Requests: {canAccessModule(actor, 'client', 'concierge-requests') ? 'allowed' : 'denied'}</li>
            </ul>
          </article>
        </section>

        <section className={styles.dualGrid}>
          <article className={styles.panel}>
            <h2 className={styles.panelTitle}>Shipping and delivery proof</h2>
            {shippingOperations.map((operation) => (
              <div key={operation.id} className={styles.metricBlock}>
                <span className={styles.metricLabel}>{operation.mode}{operation.rush ? ' · Rush' : ''}</span>
                <span className={styles.metricValue}>{operation.customerName}</span>
                <p className={styles.metricNote}>{operation.trackingState} · {operation.promiseWindow}</p>
              </div>
            ))}
          </article>

          <article className={styles.panel}>
            <h2 className={styles.panelTitle}>Delivery calendar snapshot</h2>
            {deliveryCalendar.map((entry) => (
              <div key={entry.id} className={styles.metricBlock}>
                <span className={styles.metricLabel}>{entry.dateLabel} · {entry.slot}</span>
                <span className={styles.metricValue}>{entry.routeName}</span>
                <p className={styles.metricNote}>{entry.stops} stops · {entry.rushOrders} rush order(s)</p>
              </div>
            ))}
          </article>
        </section>

        <section className={styles.dualGrid}>
          <article className={styles.panel}>
            <h2 className={styles.panelTitle}>Connector proof pack</h2>
            {liveConnectors.map((connector) => (
              <div key={connector.id} className={styles.metricBlock}>
                <span className={styles.metricLabel}>{connector.system} · {connector.status}</span>
                <span className={styles.metricValue}>{connector.name}</span>
                <p className={styles.metricNote}>{connector.lastSync} · {connector.latencyMs}ms</p>
                <Link href={`/api/maestria/connectors/${connector.system === 'Google Ads' ? 'google-ads' : connector.system.toLowerCase()}?as=${actorKey}`} className={styles.navLink}>Open connector stub</Link>
              </div>
            ))}
          </article>
          <article className={styles.panel}>
            <h2 className={styles.panelTitle}>Demo close: exports and handoffs</h2>
            {exportReports.slice(0, 3).map((report) => (
              <div key={report.id} className={styles.metricBlock}>
                <span className={styles.metricLabel}>{report.format} · {report.audience}</span>
                <span className={styles.metricValue}>{report.name}</span>
                <p className={styles.metricNote}>{report.polishNote}</p>
              </div>
            ))}
            <ul className={styles.bulletList}>
              {notificationCenterItems.slice(0, 2).map((item) => (
                <li key={item.id}>{item.title}: {item.note}</li>
              ))}
            </ul>
          </article>
        </section>

        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Investor-grade proof layer</h2>
          <div className={styles.insightGrid}>
            {aiInsightCards.map((item) => (
              <article key={item.id} className={styles.insightCard}>
                <span className={styles.metricLabel}>{item.confidence} confidence</span>
                <strong>{item.title}</strong>
                <p className={styles.cardText}>{item.insight}</p>
                <p className={styles.metricNote}>{item.actionOwner} · {item.module}</p>
              </article>
            ))}
          </div>
        </section>

        {marginLeak ? (
          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>Margin leak spotlight</h2>
            <p className={styles.cardText}>
              {marginLeak.customerName} is currently sitting at {marginLeak.grossMarginPercent.toFixed(1)}% gross margin after
              product, packaging, labor, freight, and discount impact. Maestria shows the exact cost composition before that mistake repeats.
            </p>
            <div className={styles.infoRow}>
              <span>Revenue {formatCurrency(marginLeak.revenue)}</span>
              <span>Discount {formatCurrency(marginLeak.discountAmount)}</span>
              <span>Shipping {formatCurrency(marginLeak.shippingCost)}</span>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  )
}
