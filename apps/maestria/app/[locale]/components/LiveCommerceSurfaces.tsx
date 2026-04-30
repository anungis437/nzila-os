"use client"

import Link from 'next/link'
import { useState } from 'react'
import { actorBadge, filterCorporateRowsForActor, hasPermission, resolveActor, type ActorContext } from '@/lib/access-control'
import { listAuditEvents } from '@/lib/audit-log'
import { evaluateApproval } from '@/lib/approval-policy'
import {
  activityTimeline,
  adsCampaigns,
  aiInsightCards,
  assignmentRecords,
  bilingualStatusTemplates,
  bundleAssemblyRequirements,
  campaignExecution,
  catalogSkus,
  commentThread,
  corporateCampaigns,
  crmReminders,
  customOrders,
  customerProfiles,
  deliveryCalendar,
  engineSurfaceMap,
  exportReports,
  executiveSnapshot,
  formatCurrency,
  getPaymentGateSummary,
  guidedBuilderPresets,
  liveConnectors,
  inventoryReservations,
  inventorySkus,
  loyaltyProfiles,
  notificationCenterItems,
  orderTrackingStory,
  ownerHandoffs,
  profitabilityRecords,
  productionJobs,
  proposalPackages,
  purchaseOrders,
  quoteRequestBrief,
  quoteWorkspaces,
  seasonalCampaigns,
  seasonalCollections,
  shippingOperations,
  shopifyBundlePerformance,
  shopifyMetrics,
  socialPlanner,
  supplierProfiles,
  vendorCostHistory,
  vendorRiskAlerts,
  websiteFunnel,
  type CorporateCampaignRecord,
  type ProductionJob,
  type QuoteStage,
  type QuoteWorkspace,
} from '@/lib/shopmoica-pilot-data'
import { getCommerceModule } from '@/lib/shopmoica-commerce'
import styles from '../experience.module.css'

function t(locale: string, en: string, fr: string) {
  return locale.startsWith('fr') ? fr : en
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className={styles.sectionHeader}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {subtitle ? <p className={styles.sectionSubtitle}>{subtitle}</p> : null}
    </div>
  )
}

function SurfaceFrame({
  locale,
  lane,
  title,
  subtitle,
  actor,
  actorKey,
  children,
}: {
  locale: string
  lane: 'internal' | 'client'
  title: string
  subtitle: string
  actor?: ActorContext
  actorKey?: string
  children: React.ReactNode
}) {
  const activeActor = actor ?? resolveActor({ as: 'lissa' })
  const activeActorKey = actorKey ?? 'lissa'
  const lanePath = `/${locale}/${lane}?as=${activeActorKey}`
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <Link href={lanePath} className={styles.backLink}>
          {lane === 'internal'
            ? t(locale, 'Back to internal lane', 'Retour a la voie interne')
            : t(locale, 'Back to client lane', 'Retour a la voie client')}
        </Link>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>{lane === 'internal' ? t(locale, 'Lane A live surface', 'Voie A en direct') : t(locale, 'Lane B live surface', 'Voie B en direct')}</p>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>{subtitle}</p>
          <div className={styles.infoRow}>
            <span>{t(locale, 'Breadcrumb', 'Fil d Ariane')}: {lane === 'internal' ? 'Internal' : 'Client'} / {title}</span>
            <span>{t(locale, 'Shortcuts', 'Raccourcis')}: G then E, /, Shift+F</span>
          </div>
          <div className={styles.pillRow}>
            <span className={styles.pill}>Actor: {activeActor.displayName}</span>
            <span className={styles.pill}>Policy: {actorBadge(activeActor)}</span>
          </div>
        </section>
        {children}
      </div>
    </main>
  )
}

function EnginePills({ ids }: { ids: string[] }) {
  return (
    <div className={styles.pillRow}>
      {ids.map((id) => {
        const surface = engineSurfaceMap.get(id)
        return <span key={id} className={styles.pill}>{surface ? `${surface.icon} ${surface.name}` : id}</span>
      })}
    </div>
  )
}

function StagePills({ stages }: { stages: string[] }) {
  return <div className={styles.pillRow}>{stages.map((stage) => <span key={stage} className={styles.pill}>{stage}</span>)}</div>
}

function SpotlightStrip({
  items,
}: {
  items: Array<{ label: string; value: string; note: string; tone?: 'default' | 'success' | 'warn' }>
}) {
  return (
    <section className={styles.spotlightGrid}>
      {items.map((item) => (
        <article key={`${item.label}-${item.value}`} className={styles.spotlightCard}>
          <span className={styles.metricLabel}>{item.label}</span>
          <strong className={item.tone === 'warn' ? styles.spotlightValueWarn : item.tone === 'success' ? styles.spotlightValueSuccess : styles.spotlightValue}>
            {item.value}
          </strong>
          <p className={styles.spotlightNote}>{item.note}</p>
        </article>
      ))}
    </section>
  )
}

function StateGallery({
  loading,
  empty,
  success,
}: {
  loading: { label: string; note: string }
  empty: { label: string; note: string }
  success: { label: string; note: string }
}) {
  return (
    <div className={styles.stateGrid}>
      <article className={styles.stateCard}>
        <span className={styles.priorityBadge}>Loading</span>
        <strong>{loading.label}</strong>
        <p className={styles.cardText}>{loading.note}</p>
      </article>
      <article className={styles.stateCard}>
        <span className={styles.successPill}>Empty</span>
        <strong>{empty.label}</strong>
        <p className={styles.cardText}>{empty.note}</p>
      </article>
      <article className={styles.stateCard}>
        <span className={styles.primaryFilter}>Success</span>
        <strong>{success.label}</strong>
        <p className={styles.cardText}>{success.note}</p>
      </article>
    </div>
  )
}

function connectorStubPath(system: string, actorKey = 'lissa') {
  const normalized = system === 'Google Ads' ? 'google-ads' : system.toLowerCase()
  return `/api/maestria/connectors/${normalized}?as=${actorKey}`
}

function ConnectorGrid({ connectorIds, actorKey = 'lissa' }: { connectorIds?: string[]; actorKey?: string }) {
  const connectors = connectorIds ? liveConnectors.filter((connector) => connectorIds.includes(connector.id)) : liveConnectors
  return (
    <div className={styles.connectorGrid}>
      {connectors.map((connector) => (
        <article key={connector.id} className={styles.connectorCard}>
          <span className={styles.metricLabel}>{connector.system} · {connector.status}</span>
          <strong>{connector.name}</strong>
          <p className={styles.cardText}>{connector.note}</p>
          <div className={styles.infoRow}><span>{connector.lastSync}</span><span>{connector.latencyMs}ms</span></div>
          <Link href={connectorStubPath(connector.system, actorKey)} className={styles.navLink}>Open stub</Link>
        </article>
      ))}
    </div>
  )
}

function AiInsightGrid({ module }: { module?: string }) {
  const insights = module ? aiInsightCards.filter((item) => item.module === module) : aiInsightCards
  return (
    <div className={styles.insightGrid}>
      {insights.map((item) => (
        <article key={item.id} className={styles.insightCard}>
          <span className={styles.metricLabel}>AI insight · {item.confidence}</span>
          <strong>{item.title}</strong>
          <p className={styles.cardText}>{item.insight}</p>
          <div className={styles.infoRow}><span>Owner {item.actionOwner}</span><span>{item.module}</span></div>
        </article>
      ))}
    </div>
  )
}

function ActivityRail({ module }: { module?: string }) {
  const assignments = module ? assignmentRecords.filter((item) => item.module === module) : assignmentRecords
  const comments = module ? commentThread.filter((item) => item.module === module) : commentThread
  const timeline = module ? activityTimeline.filter((item) => item.module === module) : activityTimeline

  return (
    <div className={styles.timelineGrid}>
      <article className={styles.panel}>
        <SectionHeader title="Assignments" subtitle="Who owns the next conversion-critical move." />
        {assignments.map((item) => (
          <div key={item.id} className={styles.metricBlock}>
            <span className={styles.metricLabel}>{item.status} · {item.dueBy}</span>
            <span className={styles.metricValue}>{item.title}</span>
            <p className={styles.metricNote}>{item.owner} · {item.module}</p>
          </div>
        ))}
      </article>
      <article className={styles.panel}>
        <SectionHeader title="Comments" subtitle="Mentions and narrative context before the meeting starts." />
        {comments.map((item) => (
          <div key={item.id} className={styles.metricBlock}>
            <span className={styles.metricLabel}>{item.author} · {item.audience}</span>
            <span className={styles.metricValue}>{item.at}</span>
            <p className={styles.metricNote}>{item.message}</p>
          </div>
        ))}
      </article>
      <article className={styles.panel}>
        <SectionHeader title="Activity timeline" subtitle="The last actions that changed the close path." />
        {timeline.map((item) => (
          <div key={item.id} className={styles.metricBlock}>
            <span className={styles.metricLabel}>{item.at} · {item.actor}</span>
            <span className={styles.metricValue}>{item.action}</span>
            <p className={styles.metricNote}>{item.detail}</p>
          </div>
        ))}
      </article>
    </div>
  )
}

function nextQuoteStage(current: QuoteStage, stages: readonly string[]): QuoteStage | null {
  const index = stages.indexOf(current)
  if (index < 0 || index === stages.length - 1) return null
  return stages[index + 1] as QuoteStage
}

function nextProductionStage(current: ProductionJob['stage'], stages: readonly string[]): ProductionJob['stage'] | null {
  const index = stages.indexOf(current)
  if (index < 0 || index === stages.length - 1) return null
  return stages[index + 1] as ProductionJob['stage']
}

function ExecutiveDashboardSurface({ locale, actor, actorKey }: { locale: string; actor: ActorContext; actorKey: string }) {
  const surface = getCommerceModule('internal', 'executive-dashboard')!
  const quoteWinRate = Math.round((quoteWorkspaces.filter((quote) => quote.stage === 'won').length / Math.max(quoteWorkspaces.length, 1)) * 100)
  const repeatRevenue = customerProfiles.filter((customer) => customer.vipStatus).reduce((sum, customer) => sum + customer.lifetimeValue, 0)
  const canSeeExports = hasPermission(actor, 'export.download')
  const pendingApprovals = [
    evaluateApproval({ action: 'margin_exception', value: 3800, marginPercent: 24 }),
    evaluateApproval({ action: 'supplier_spend', value: 2650 }),
    evaluateApproval({ action: 'ad_budget_change', value: 950 }),
  ]
  const collaborationQueue = [
    'Mention @rox for production bottleneck in QC lane before 14:00.',
    'Mention @fred to rebalance campaign spend to french branded search.',
    'Assign CS team to follow up two pending corporate deposits.',
  ]
  return (
    <SurfaceFrame locale={locale} lane="internal" title={surface.title} subtitle={surface.summary} actor={actor} actorKey={actorKey}>
      <SpotlightStrip
        items={[
          { label: 'Premium command', value: 'Live founder cockpit', note: 'Revenue, risk, campaigns, and handoffs render in one glance.' },
          { label: 'Connector posture', value: `${liveConnectors.length} sources live`, note: 'Shopify, Google Ads, and Zoho stay visible inside the operator loop.', tone: 'success' },
          { label: 'Screenshot moment', value: 'Board-ready today', note: 'Every top card is presentation-safe without hiding operating truth.' },
        ]}
      />
      <section className={styles.statsGrid}>
        <article className={styles.statCard}><span className={styles.statLabel}>{t(locale, 'Revenue vs prior period', 'Revenu vs periode precedente')}</span><strong className={styles.statValue}>+12.4%</strong><p className={styles.statNote}>{t(locale, 'Week over week from premium corporate and repeat demand.', 'Semaine sur semaine grace aux comptes corporatifs et clients recurrents.')}</p></article>
        <article className={styles.statCard}><span className={styles.statLabel}>{t(locale, 'Quote win rate', 'Taux de conversion des soumissions')}</span><strong className={styles.statValue}>{quoteWinRate}%</strong><p className={styles.statNote}>{t(locale, 'Winning quotes this cycle versus total active opportunities.', 'Soumissions gagnees versus opportunites actives.')}</p></article>
        <article className={styles.statCard}><span className={styles.statLabel}>{t(locale, 'Pending approvals', 'Approvals en attente')}</span><strong className={styles.statValue}>{quoteWorkspaces.filter((quote) => quote.requiresApproval).length}</strong><p className={styles.statNote}>{t(locale, 'Founder and client checkpoints still blocking release.', 'Points de controle fondateur et client bloquant encore la release.')}</p></article>
        <article className={styles.statCard}><span className={styles.statLabel}>{t(locale, 'Gross margin trend', 'Tendance marge brute')}</span><strong className={styles.statValue}>31.7%</strong><p className={styles.statNote}>{t(locale, 'Healthy trend with two watch deals and one blocked margin order.', 'Tendance saine avec deux dossiers sous surveillance et un bloque.')}</p></article>
        <article className={styles.statCard}><span className={styles.statLabel}>{t(locale, 'Repeat customer revenue', 'Revenu clients recurrents')}</span><strong className={styles.statValue}>{formatCurrency(repeatRevenue)}</strong><p className={styles.statNote}>{t(locale, 'Revenue base protected by loyalty and concierge service quality.', 'Base de revenu protegee par la fidelite et le service concierge.')}</p></article>
        <article className={styles.statCard}><span className={styles.statLabel}>{t(locale, 'Campaign ROI summary', 'Resume ROI campagnes')}</span><strong className={styles.statValue}>4.8x</strong><p className={styles.statNote}>{t(locale, 'Blended ROI across live growth campaigns in Fred command stack.', 'ROI moyen sur les campagnes actives dans la pile Fred.')}</p></article>
      </section>

      <section className={styles.dualGrid}>
        <article className={styles.panel}>
          <SectionHeader title="Vendor delays affecting orders" subtitle="When supplier problems hit real client promises, not just purchasing admin." />
          {vendorRiskAlerts.map((alert) => (
            <div key={alert.id} className={styles.metricBlock}>
              <span className={styles.metricLabel}>{alert.risk}</span>
              <span className={styles.metricValue}>{alert.title}</span>
              <p className={styles.metricNote}>{alert.note}</p>
              <p className={styles.cardText}>Affected: {alert.affectedOrders.length ? alert.affectedOrders.join(', ') : 'No live orders currently exposed'}</p>
            </div>
          ))}
        </article>
        <article className={styles.panel}>
          <SectionHeader title="Top corporate clients" subtitle="Accounts worth protecting before seasonal load and delivery complexity hit." />
          {executiveSnapshot.topCorporateClients.map((client) => (
            <div key={client.name} className={styles.metricBlock}>
              <span className={styles.metricLabel}>Corporate account</span>
              <span className={styles.metricValue}>{client.name}</span>
              <p className={styles.metricNote}>{formatCurrency(client.value)} value · {client.note}</p>
            </div>
          ))}
        </article>
      </section>

      <section className={styles.dualGrid}>
        <article className={styles.panel}>
          <SectionHeader title="Inventory and shipping watchlist" subtitle="The two operational queues that quietly erode trust if they are invisible." />
          <ul className={styles.bulletList}>
            {inventorySkus.filter((sku) => sku.bundleShortage || sku.urgentReplenishment).map((sku) => (
              <li key={sku.sku}>{sku.productName}: {sku.available} available, {sku.supplierEta}, substitute {sku.substituteSkus[0] ?? 'none'}</li>
            ))}
            {shippingOperations.filter((item) => item.delayedAlert).map((item) => (
              <li key={item.id}>{item.customerName}: {item.delayedAlert}</li>
            ))}
          </ul>
        </article>
        <article className={styles.panel}>
          <SectionHeader title="Seasonal load posture" subtitle="Upcoming campaign demand with operational readiness attached to it." />
          {seasonalCampaigns.map((campaign) => (
            <div key={campaign.id} className={styles.metricBlock}>
              <span className={styles.metricLabel}>{campaign.season} · {campaign.status}</span>
              <span className={styles.metricValue}>{formatCurrency(campaign.pipelineValue)}</span>
              <p className={styles.metricNote}>{campaign.operationalNeed}</p>
            </div>
          ))}
        </article>
      </section>

      <section className={styles.panel}>
        <SectionHeader title="Flow Engine alignment" subtitle="Risk, work, and shipping updates stay on shared orchestration boundaries rather than ad hoc staff memory." />
        <EnginePills ids={surface.engineModules} />
      </section>

      <section className={styles.dualGrid}>
        <article className={styles.panel}>
          <SectionHeader title={t(locale, 'State coverage', 'Couverture des etats')} subtitle={t(locale, 'Loading, empty, and success states for polished operating storytelling.', 'Etats loading, empty et success pour une narration operationnelle polie.')} />
          <StateGallery
            loading={{ label: 'Syncing the 09:30 commerce operating pack', note: 'Orders, cash, and campaign metrics are reconciling before the founder review starts.' }}
            empty={{ label: 'No high-risk blockers in the current release window', note: 'When the queue is clean, the empty state still reads as premium and intentional.' }}
            success={{ label: 'Owner handoffs are up to date and ready to present', note: 'The cockpit ends on action ownership, not vague dashboard optimism.' }}
          />
        </article>
        <article className={styles.panel}>
          <SectionHeader title={t(locale, 'Sample live connectors', 'Connecteurs live exemples')} subtitle={t(locale, 'External systems surfaced with enough detail to feel real in the room.', 'Systemes externes surfaces avec assez de detail pour paraitre reels en reunion.')} />
          <ConnectorGrid connectorIds={['shopify-core', 'ads-core', 'zoho-core']} actorKey={actorKey} />
        </article>
      </section>

      <section className={styles.panel}>
        <SectionHeader title={t(locale, 'AI insight cards', 'Cartes insights IA')} subtitle={t(locale, 'Conversion-grade recommendations stitched from margin, reorder, ads, and CRM signals.', 'Recommandations orientees conversion assemblees depuis marge, reorders, ads et signaux CRM.')} />
        <AiInsightGrid />
      </section>

      <section className={styles.dualGrid}>
        <article className={styles.panel}>
          <SectionHeader title={t(locale, 'Action center', 'Centre d action')} subtitle={t(locale, 'Founder-first priorities for the next 90 minutes.', 'Priorites fondateur pour les 90 prochaines minutes.')} />
          <ul className={styles.bulletList}>
            <li>{t(locale, 'Escalate chocolate substitution approval for ORD-SMC-225 before noon.', 'Escalader l approbation de substitution chocolat pour ORD-SMC-225 avant midi.')}</li>
            <li>{t(locale, 'Clear two deposit blockers before releasing Friday shipping wave.', 'Debloquer deux depots avant la vague d expedition de vendredi.')}</li>
            <li>{t(locale, 'Approve holiday campaign assets currently waiting in build queue.', 'Approuver les actifs de campagne holiday en attente dans la file de build.')}</li>
          </ul>
        </article>
        <article className={styles.panel}>
          <SectionHeader title={t(locale, 'Export-ready reports', 'Rapports exportables')} subtitle={t(locale, 'CSV/PDF outputs for operators, finance, and partners.', 'Sorties CSV/PDF pour operations, finance et partenaires.')} />
          {exportReports.slice(0, 4).map((report) => (
            <div key={report.id} className={styles.metricBlock}>
              <span className={styles.metricLabel}>{report.format}</span>
              <span className={styles.metricValue}>{report.name}</span>
              <p className={styles.metricNote}>{canSeeExports ? `${report.source} · ${report.updatedAt} · ${report.audience}` : 'Restricted by export policy'}</p>
              {canSeeExports ? <Link href={`/api/maestria/exports?as=${actorKey}&report=${report.id}&format=${report.format.toLowerCase()}`} className={styles.navLink}>Open {report.filename}</Link> : null}
            </div>
          ))}
        </article>
      </section>

      <section className={styles.dualGrid}>
        <article className={styles.panel}>
          <SectionHeader title={t(locale, 'Owner collaboration center', 'Centre de collaboration direction')} subtitle={t(locale, 'Shared owner queue for mentions, handoffs, and priority ownership.', 'File partagee des proprietaires pour mentions, transferts et priorites.')} />
          <ul className={styles.bulletList}>
            {collaborationQueue.map((item) => <li key={item}>{item}</li>)}
            {notificationCenterItems.slice(0, 2).map((item) => <li key={item.id}>{item.title}: {item.note}</li>)}
          </ul>
          <div className={styles.pillRow}>
            {pendingApprovals.map((item, index) => (
              <span key={`${item.threshold}-${index}`} className={item.required ? styles.warnPill : styles.successPill}>
                {item.required ? `Approval required: ${item.threshold}` : `Auto-allowed: ${item.threshold}`}
              </span>
            ))}
          </div>
        </article>
        <article className={styles.panel}>
          <SectionHeader title={t(locale, 'Decision, audit, and handoff log', 'Journal decisions, audit et transferts')} subtitle={t(locale, 'Latest allow/deny events and owner decisions for compliance confidence.', 'Derniers evenements allow/deny et decisions direction pour la conformite.')} />
          {listAuditEvents(3).map((event) => (
            <div key={event.id} className={styles.metricBlock}>
              <span className={styles.metricLabel}>{event.action}</span>
              <span className={styles.metricValue}>{event.actorName} · {event.result.toUpperCase()}</span>
              <p className={styles.metricNote}>{event.resource} · {event.at}</p>
            </div>
          ))}
          {ownerHandoffs.map((handoff) => (
            <div key={handoff.id} className={styles.metricBlock}>
              <span className={styles.metricLabel}>{handoff.status} · {handoff.dueBy}</span>
              <span className={styles.metricValue}>{handoff.from} to {handoff.to}</span>
              <p className={styles.metricNote}>{handoff.subject}</p>
            </div>
          ))}
        </article>
      </section>

      <ActivityRail />
    </SurfaceFrame>
  )
}

function QuotePipelineSurface({ locale }: { locale: string }) {
  const surface = getCommerceModule('internal', 'quote-pipeline')!
  const [quotes, setQuotes] = useState<QuoteWorkspace[]>(quoteWorkspaces)
  const [roiInputs, setRoiInputs] = useState({
    recipients: 200,
    currentWinRate: 18,
    targetWinRate: 30,
    founderHoursSaved: 14,
    proposalTier: 'Premium' as 'Essential' | 'Premium' | 'Signature',
  })

  function advanceQuote(quoteId: string) {
    setQuotes((current) =>
      current.map((quote) => {
        if (quote.id !== quoteId) return quote
        const next = nextQuoteStage(quote.stage, surface.stages)
        if (!next) return quote
        return {
          ...quote,
          stage: next,
          bilingualStatus:
            next === 'sent'
              ? { en: 'Quote sent', fr: 'Soumission envoyee' }
              : next === 'approved'
                ? { en: 'Awaiting deposit', fr: 'Depot en attente' }
                : quote.bilingualStatus,
          followUpAt: next === 'sent' ? 'Today 5:00 PM' : next === 'approved' ? 'Deposit now due' : quote.followUpAt,
        }
      }),
    )
  }

  const activeTier = proposalPackages.find((item) => item.tier === roiInputs.proposalTier) ?? proposalPackages[1]
  const currentRevenue = roiInputs.recipients * activeTier.pricePerRecipient * (roiInputs.currentWinRate / 100)
  const targetRevenue = roiInputs.recipients * activeTier.pricePerRecipient * (roiInputs.targetWinRate / 100)
  const revenueLift = targetRevenue - currentRevenue
  const founderTimeValue = roiInputs.founderHoursSaved * 165

  return (
    <SurfaceFrame locale={locale} lane="internal" title={surface.title} subtitle={surface.summary}>
      <SpotlightStrip
        items={[
          { label: 'Luxury quoting', value: `${quotes.length} live opportunities`, note: 'The board keeps premium quoting moving without margin drift.' },
          { label: 'Ready for handoff', value: `${quotes.filter((quote) => quote.stage === 'approved').length} awaiting deposit`, note: 'Approval and payment readiness are visible before ops commits.' },
          { label: 'Screenshot state', value: 'Client-safe bilingual cards', note: 'Every quote tile reads well in both internal and demo contexts.', tone: 'success' },
        ]}
      />
      <section className={styles.panel}>
        <SectionHeader title="Stage board" subtitle="Quotes grouped by stage with margin control, approvals, and bilingual client-ready status copy." />
        <div className={styles.boardGrid}>
          {surface.stages.map((stage) => {
            const stageQuotes = quotes.filter((quote) => quote.stage === stage)
            return (
              <article key={stage} className={styles.boardColumn}>
                <div className={styles.boardColumnHeader}><h3 className={styles.boardColumnTitle}>{stage}</h3><span className={styles.boardCount}>{stageQuotes.length}</span></div>
                <div className={styles.boardStack}>
                  {stageQuotes.map((quote) => (
                    <div key={quote.id} className={styles.boardCard}>
                      <div className={styles.boardCardTop}><strong>{quote.customerName}</strong><span className={styles.priorityBadge}>{quote.templateName}</span></div>
                      <p className={styles.cardText}>{quote.title}</p>
                      <div className={styles.infoRow}><span>{formatCurrency(quote.value)}</span><span>{quote.marginPercent}% margin</span></div>
                      <div className={styles.infoRow}><span>{quote.bilingualStatus.en}</span><span>{quote.bilingualStatus.fr}</span></div>
                      <div className={styles.infoRow}><span>{quote.approvalCheckpoint}</span><span>{quote.followUpAt}</span></div>
                      <div className={styles.pillRow}>
                        {quote.requiresApproval ? <span className={styles.warnPill}>Needs approval</span> : null}
                        {quote.marginPercent < 25 ? <span className={styles.warnPill}>Margin watch</span> : <span className={styles.successPill}>Margin safe</span>}
                        {quote.corporate ? <span className={styles.pill}>Corporate</span> : <span className={styles.pill}>Concierge</span>}
                      </div>
                      {nextQuoteStage(quote.stage, surface.stages) ? (
                        <button className={styles.secondaryButton} type="button" onClick={() => advanceQuote(quote.id)}>
                          Move to {nextQuoteStage(quote.stage, surface.stages)}
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className={styles.dualGrid}>
        <article className={styles.panel}>
          <SectionHeader title="Bilingual service templates" subtitle="Status language the team can reuse without inventing client copy under pressure." />
          {bilingualStatusTemplates.map((template) => (
            <div key={template.key} className={styles.metricBlock}>
              <span className={styles.metricLabel}>{template.key}</span>
              <span className={styles.metricValue}>{template.status.en} / {template.status.fr}</span>
              <p className={styles.metricNote}>{template.note.en}</p>
            </div>
          ))}
        </article>
        <article className={styles.panel}>
          <SectionHeader title="Flow Engine alignment" subtitle="Quote routing, approval, and follow-up automation remain shared under the premium edition surface." />
          <EnginePills ids={surface.engineModules} />
          <StagePills stages={surface.stages} />
          <StateGallery
            loading={{ label: 'Rendering branded quote PDF preview', note: 'The premium deck is preparing pricing, margins, and bilingual status copy.' }}
            empty={{ label: 'No quotes waiting in lost recovery', note: 'The empty state still points the team to follow-up quality and reuse patterns.' }}
            success={{ label: 'Quote moved cleanly to next stage', note: 'The board acknowledges movement with a visible success state instead of silent mutation.' }}
          />
        </article>
      </section>

      <section className={styles.dualGrid}>
        <article className={styles.panel}>
          <SectionHeader title="Prospect ROI calculator" subtitle="A meeting-ready calculator for proving why the first flagship client should buy now." />
          <div className={styles.formGrid}>
            <label className={styles.field}><span className={styles.fieldLabel}>Recipients</span><input className={styles.input} type="number" value={roiInputs.recipients} onChange={(event) => setRoiInputs((current) => ({ ...current, recipients: Number(event.target.value || 0) }))} /></label>
            <label className={styles.field}><span className={styles.fieldLabel}>Current win rate %</span><input className={styles.input} type="number" value={roiInputs.currentWinRate} onChange={(event) => setRoiInputs((current) => ({ ...current, currentWinRate: Number(event.target.value || 0) }))} /></label>
            <label className={styles.field}><span className={styles.fieldLabel}>Target win rate %</span><input className={styles.input} type="number" value={roiInputs.targetWinRate} onChange={(event) => setRoiInputs((current) => ({ ...current, targetWinRate: Number(event.target.value || 0) }))} /></label>
            <label className={styles.field}><span className={styles.fieldLabel}>Founder hours saved</span><input className={styles.input} type="number" value={roiInputs.founderHoursSaved} onChange={(event) => setRoiInputs((current) => ({ ...current, founderHoursSaved: Number(event.target.value || 0) }))} /></label>
          </div>
          <div className={styles.pillRow}>
            {proposalPackages.map((item) => (
              <button key={item.id} type="button" className={roiInputs.proposalTier === item.tier ? styles.primaryFilter : styles.secondaryFilter} onClick={() => setRoiInputs((current) => ({ ...current, proposalTier: item.tier }))}>
                {item.tier}
              </button>
            ))}
          </div>
          <div className={styles.stateGrid}>
            <article className={styles.stateCard}><span className={styles.metricLabel}>Current revenue</span><strong>{formatCurrency(currentRevenue)}</strong><p className={styles.cardText}>{roiInputs.currentWinRate}% close rate on {roiInputs.recipients} recipients.</p></article>
            <article className={styles.stateCard}><span className={styles.metricLabel}>Lift to target</span><strong>{formatCurrency(revenueLift)}</strong><p className={styles.cardText}>{roiInputs.targetWinRate}% close rate using the {activeTier.tier} proposal tier.</p></article>
            <article className={styles.stateCard}><span className={styles.metricLabel}>Recovered founder time</span><strong>{formatCurrency(founderTimeValue)}</strong><p className={styles.cardText}>{roiInputs.founderHoursSaved} hours redirected into sales and approvals.</p></article>
          </div>
        </article>
        <article className={styles.panel}>
          <SectionHeader title="Pricing and proposal surfaces" subtitle="Premium proposal tiers that can be shown in the first flagship client meeting." />
          <div className={styles.cardGrid}>
            {proposalPackages.map((proposal) => (
              <article key={proposal.id} className={styles.card}>
                <span className={styles.cardKicker}>{proposal.tier}</span>
                <h3 className={styles.cardTitle}>{formatCurrency(proposal.pricePerRecipient)} / recipient</h3>
                <div className={styles.infoRow}><span>{proposal.depositPercent}% deposit</span><span>{proposal.leadTime}</span></div>
                <div className={styles.infoRow}><span>{proposal.marginPercent}% margin</span><span>{proposal.promise}</span></div>
                <ul className={styles.bulletList}>
                  {proposal.inclusions.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </article>
            ))}
          </div>
          <Link href="/api/maestria/exports?as=lissa&report=rep-2&format=pdf" className={styles.navLink}>Open proposal PDF stub</Link>
        </article>
      </section>

      <section className={styles.panel}>
        <SectionHeader title="Quote AI and activity rail" subtitle="Comments, assignments, and activity timeline stay attached to the proposal workflow." />
        <AiInsightGrid module="quote-pipeline" />
      </section>

      <ActivityRail module="quote-pipeline" />
    </SurfaceFrame>
  )
}

function CustomOrderManagementSurface({ locale }: { locale: string }) {
  const surface = getCommerceModule('internal', 'custom-order-management')!
  return (
    <SurfaceFrame locale={locale} lane="internal" title={surface.title} subtitle={surface.summary}>
      <section className={styles.cardGrid}>
        {customOrders.map((order) => {
          const gates = getPaymentGateSummary(order)
          const reservations = inventoryReservations.filter((reservation) => reservation.orderId === order.id)
          return (
            <article key={order.id} className={styles.card}>
              <span className={styles.cardKicker}>{order.id} · {order.customerName}</span>
              <h3 className={styles.cardTitle}>{order.projectName}</h3>
              <p className={styles.cardText}>{order.packagingSpec}</p>
              <div className={styles.infoRow}><span>{order.productionStage}</span><span>{order.slaHoursRemaining}h remaining</span></div>
              <div className={styles.infoRow}><span>{formatCurrency(order.orderValue)}</span><span>{order.invoiceTerms}</span></div>
              <div className={styles.pillRow}>
                {order.atRisk ? <span className={styles.warnPill}>At risk</span> : <span className={styles.successPill}>On track</span>}
                {order.rush ? <span className={styles.warnPill}>Rush order</span> : null}
                {!gates.production_start.allowed ? <span className={styles.warnPill}>Reservation blocked</span> : <span className={styles.successPill}>Reservation clear</span>}
              </div>
              <ul className={styles.bulletList}>
                {order.personalizationNotes.map((note) => <li key={note}>{note}</li>)}
                {order.dependencyAlerts.map((alert) => <li key={alert}>{alert}</li>)}
                {reservations.map((reservation) => <li key={reservation.id}>{reservation.qty}x {reservation.sku} reserved for {reservation.reason}</li>)}
              </ul>
            </article>
          )
        })}
      </section>
      <section className={styles.panel}>
        <SectionHeader title="Real production path" subtitle="Custom gifting needs payment, reservation, assembly, QA, and delivery gates in the correct order." />
        <StagePills stages={surface.stages} />
      </section>
    </SurfaceFrame>
  )
}

function ProductionTrackerSurface({ locale }: { locale: string }) {
  const surface = getCommerceModule('internal', 'production-tracker')!
  const [jobs, setJobs] = useState<ProductionJob[]>(productionJobs)

  function advanceJob(jobId: string) {
    setJobs((current) =>
      current.map((job) => {
        if (job.id !== jobId) return job
        const next = nextProductionStage(job.stage, surface.stages)
        if (!next) return job
        return { ...job, stage: next, blocker: next === 'completed' ? undefined : job.blocker, atRisk: next === 'completed' ? false : job.atRisk }
      }),
    )
  }

  return (
    <SurfaceFrame locale={locale} lane="internal" title={surface.title} subtitle={surface.summary}>
      <section className={styles.boardGrid}>
        {surface.stages.map((stage) => {
          const jobsInStage = jobs.filter((job) => job.stage === stage)
          return (
            <article key={stage} className={styles.boardColumn}>
              <div className={styles.boardColumnHeader}><h3 className={styles.boardColumnTitle}>{stage}</h3><span className={styles.boardCount}>{jobsInStage.length}</span></div>
              <div className={styles.boardStack}>
                {jobsInStage.map((job) => (
                  <div key={job.id} className={styles.boardCard}>
                    <div className={styles.boardCardTop}><strong>{job.projectName}</strong><span className={styles.priorityBadge}>{job.qcOwner}</span></div>
                    <div className={styles.infoRow}><span>Proof: {job.proofStatus}</span><span>{job.shipDate}</span></div>
                    <div className={styles.infoRow}><span>{job.slaHoursRemaining}h remaining</span><span>{job.atRisk ? 'At risk' : 'Healthy'}</span></div>
                    {job.blocker ? <p className={styles.alertText}>{job.blocker}</p> : null}
                    {nextProductionStage(job.stage, surface.stages) ? (
                      <button className={styles.secondaryButton} type="button" onClick={() => advanceJob(job.id)}>
                        Mark {nextProductionStage(job.stage, surface.stages)}
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </article>
          )
        })}
      </section>
      <section className={styles.panel}>
        <SectionHeader title="SLA risk and exceptions" subtitle="Jobs most likely to miss promise windows if the team does nothing." />
        <ul className={styles.bulletList}>
          {jobs.filter((job) => job.atRisk || job.blocker).map((job) => (
            <li key={job.id}>{job.projectName}: {job.blocker ?? `${job.slaHoursRemaining}h remaining before the promise window compresses`}</li>
          ))}
        </ul>
      </section>
    </SurfaceFrame>
  )
}

function InventoryCenterSurface({ locale }: { locale: string }) {
  const surface = getCommerceModule('internal', 'inventory-center')!
  const topSellers = catalogSkus.filter((sku) => sku.topSeller)
  const deadStock = catalogSkus.filter((sku) => sku.deadStock)
  return (
    <SurfaceFrame locale={locale} lane="internal" title={surface.title} subtitle={surface.summary}>
      <section className={styles.statsGrid}>
        <article className={styles.statCard}><span className={styles.statLabel}>Component availability</span><strong className={styles.statValue}>{catalogSkus.filter((sku) => sku.available > 0).length}</strong><p className={styles.statNote}>SKUs currently ready for allocation into curated baskets and premium orders.</p></article>
        <article className={styles.statCard}><span className={styles.statLabel}>Bundle shortages</span><strong className={styles.statValue}>{inventorySkus.filter((sku) => sku.bundleShortage).length}</strong><p className={styles.statNote}>Partial component gaps that break assembly on otherwise sellable bundles.</p></article>
        <article className={styles.statCard}><span className={styles.statLabel}>Top sellers</span><strong className={styles.statValue}>{topSellers.length}</strong><p className={styles.statNote}>Hero SKUs and bundles driving the premium gifting mix.</p></article>
        <article className={styles.statCard}><span className={styles.statLabel}>Dead stock</span><strong className={styles.statValue}>{deadStock.length}</strong><p className={styles.statNote}>Inventory that should be re-bundled, promoted, or exited.</p></article>
      </section>

      <section className={styles.dualGrid}>
        <article className={styles.panel}>
          <SectionHeader title="Catalog truth layer" subtitle="The actual mix: standalone, bundle, packaging, add-ons, and personalization items tied to suppliers." />
          {catalogSkus.map((sku) => (
            <div key={sku.sku} className={styles.metricBlock}>
              <span className={styles.metricLabel}>{sku.type} · {sku.sku}</span>
              <span className={styles.metricValue}>{sku.name.en}</span>
              <p className={styles.metricNote}>{sku.available} available · {sku.committed} committed · {sku.bundleMarginPercent}% bundle margin · Supplier {sku.vendorName ?? 'n/a'}</p>
              <p className={styles.cardText}>Substitutes: {sku.substituteSkus.length ? sku.substituteSkus.join(', ') : 'None'} · {sku.notes[0]}</p>
            </div>
          ))}
        </article>
        <article className={styles.panel}>
          <SectionHeader title="Bundle assembly forecasting" subtitle="Bundle-level truth for shortages, substitutions, and upcoming seasonal collection readiness." />
          {bundleAssemblyRequirements.map((item) => (
            <div key={`${item.parentSku}-${item.componentSku}`} className={styles.metricBlock}>
              <span className={styles.metricLabel}>{item.parentSku}</span>
              <span className={styles.metricValue}>{item.quantity}x {item.componentSku}</span>
              <p className={styles.metricNote}>{item.optional ? 'Optional component' : 'Required component'} · Substitutes {item.substituteSkus.length ? item.substituteSkus.join(', ') : 'none'}</p>
            </div>
          ))}
          {seasonalCollections.map((collection) => (
            <div key={collection.id} className={styles.metricBlock}>
              <span className={styles.metricLabel}>{collection.launchWindow}</span>
              <span className={styles.metricValue}>{collection.name}</span>
              <p className={styles.metricNote}>{collection.focus} · Readiness {collection.readiness}</p>
            </div>
          ))}
        </article>
      </section>

      <section className={styles.panel}>
        <SectionHeader title="Reservations and replenishment" subtitle="Stock on hand is meaningless unless open-order commitments, seasonal buffers, and substitutes are visible together." />
        <div className={styles.cardGrid}>
          {inventorySkus.map((item) => (
            <article key={item.sku} className={styles.card}>
              <span className={styles.cardKicker}>{item.sku}</span>
              <h3 className={styles.cardTitle}>{item.productName}</h3>
              <div className={styles.infoRow}><span>On hand {item.onHand}</span><span>Committed {item.reserved}</span></div>
              <div className={styles.infoRow}><span>Available {item.available}</span><span>Buffer {item.bufferStock}</span></div>
              <div className={styles.pillRow}>
                {item.bundleShortage ? <span className={styles.warnPill}>Bundle shortage</span> : <span className={styles.successPill}>Bundle safe</span>}
                {item.urgentReplenishment ? <span className={styles.warnPill}>Urgent PO</span> : null}
              </div>
              <p className={styles.cardText}>Supplier ETA {item.supplierEta} · Substitute {item.substituteSkus[0] ?? 'none'}</p>
            </article>
          ))}
        </div>
      </section>
    </SurfaceFrame>
  )
}

function SupplierPoCenterSurface({ locale }: { locale: string }) {
  const surface = getCommerceModule('internal', 'supplier-po-center')!
  return (
    <SurfaceFrame locale={locale} lane="internal" title={surface.title} subtitle={surface.summary}>
      <section className={styles.dualGrid}>
        <article className={styles.panel}>
          <SectionHeader title="Vendor directory and readiness" subtitle="Lead time, MOQ, artisan status, quality memory, and seasonal confidence in one place." />
          {supplierProfiles.map((supplier) => (
            <div key={supplier.id} className={styles.metricBlock}>
              <span className={styles.metricLabel}>{supplier.category}{supplier.localArtisan ? ' · Local artisan' : ''}{supplier.preferred ? ' · Preferred' : ''}</span>
              <span className={styles.metricValue}>{supplier.name}</span>
              <p className={styles.metricNote}>{supplier.leadTimeDays}d lead time · MOQ {supplier.moq} · {supplier.onTimeRate}% on-time · Readiness {supplier.seasonalReadiness}</p>
              <p className={styles.cardText}>{supplier.qualityNotes.join(' · ')}</p>
            </div>
          ))}
        </article>
        <article className={styles.panel}>
          <SectionHeader title="Cost and delay risk" subtitle="When to switch, escalate, or quote with a safer assumption before margin slips." />
          {vendorRiskAlerts.map((alert) => (
            <div key={alert.id} className={styles.metricBlock}>
              <span className={styles.metricLabel}>{alert.risk}</span>
              <span className={styles.metricValue}>{alert.title}</span>
              <p className={styles.metricNote}>{alert.note}</p>
            </div>
          ))}
          {vendorCostHistory.map((entry) => (
            <div key={entry.id} className={styles.metricBlock}>
              <span className={styles.metricLabel}>{entry.sku}</span>
              <span className={styles.metricValue}>{formatCurrency(entry.unitCost)}</span>
              <p className={styles.metricNote}>Effective {entry.effectiveDate}</p>
            </div>
          ))}
        </article>
      </section>

      <section className={styles.panel}>
        <SectionHeader title="Open POs and reorder recommendations" subtitle="Purchasing should tell the team what to buy and why, not just what was ordered." />
        <div className={styles.cardGrid}>
          {purchaseOrders.map((po) => (
            <article key={po.id} className={styles.card}>
              <span className={styles.cardKicker}>{po.id}</span>
              <h3 className={styles.cardTitle}>{po.vendorName}</h3>
              <div className={styles.infoRow}><span>{formatCurrency(po.total)}</span><span>{po.status}</span></div>
              <div className={styles.infoRow}><span>{po.skuCount} SKUs</span><span>{po.eta}</span></div>
              <div className={styles.pillRow}>
                {po.delayRisk ? <span className={styles.warnPill}>Delay risk</span> : <span className={styles.successPill}>On track</span>}
                <span className={po.variancePercent > 5 ? styles.warnPill : styles.successPill}>{po.variancePercent}% variance</span>
              </div>
              <p className={styles.cardText}>{po.seasonalNeed} · Buyer {po.buyer}</p>
            </article>
          ))}
        </div>
      </section>
    </SurfaceFrame>
  )
}

function ShippingCenterSurface({ locale }: { locale: string }) {
  const surface = getCommerceModule('internal', 'shipping-center')!
  return (
    <SurfaceFrame locale={locale} lane="internal" title={surface.title} subtitle={surface.summary}>
      <section className={styles.statsGrid}>
        <article className={styles.statCard}><span className={styles.statLabel}>Local delivery queue</span><strong className={styles.statValue}>{shippingOperations.filter((item) => item.mode === 'Local delivery').length}</strong><p className={styles.statNote}>Same-day and concierge handoffs needing driver control.</p></article>
        <article className={styles.statCard}><span className={styles.statLabel}>Carrier shipments</span><strong className={styles.statValue}>{shippingOperations.filter((item) => item.mode === 'Carrier shipment').length}</strong><p className={styles.statNote}>Label creation, release timing, and proactive tracking updates.</p></article>
        <article className={styles.statCard}><span className={styles.statLabel}>Corporate drops</span><strong className={styles.statValue}>{shippingOperations.filter((item) => item.mode === 'Corporate multi-drop').length}</strong><p className={styles.statNote}>Campaigns with multiple addresses and staged release windows.</p></article>
        <article className={styles.statCard}><span className={styles.statLabel}>Rush orders</span><strong className={styles.statValue}>{shippingOperations.filter((item) => item.rush).length}</strong><p className={styles.statNote}>Orders that need immediate prioritization.</p></article>
      </section>

      <section className={styles.dualGrid}>
        <article className={styles.panel}>
          <SectionHeader title="Outbound queue" subtitle="Internal control for local, carrier, pickup, and multi-address release states." />
          {shippingOperations.map((item) => (
            <div key={item.id} className={styles.metricBlock}>
              <span className={styles.metricLabel}>{item.mode}{item.rush ? ' · Rush' : ''}</span>
              <span className={styles.metricValue}>{item.customerName}</span>
              <p className={styles.metricNote}>{item.trackingState} · {item.addressCount} address(es) · {item.promiseWindow}</p>
              <p className={styles.cardText}>{item.courier} · {item.calendarSlot}{item.delayedAlert ? ` · ${item.delayedAlert}` : ''}</p>
            </div>
          ))}
        </article>
        <article className={styles.panel}>
          <SectionHeader title="Delivery calendar" subtitle="A founder can see route density and rush exposure before promising anything new." />
          {deliveryCalendar.map((entry) => (
            <div key={entry.id} className={styles.metricBlock}>
              <span className={styles.metricLabel}>{entry.dateLabel} · {entry.slot}</span>
              <span className={styles.metricValue}>{entry.routeName}</span>
              <p className={styles.metricNote}>{entry.stops} stops · {entry.rushOrders} rush order(s)</p>
            </div>
          ))}
          <div className={styles.metricBlock}>
            <span className={styles.metricLabel}>Customer-facing confidence</span>
            <span className={styles.metricValue}>Quote sent / Soumission envoyee</span>
            <p className={styles.metricNote}>Bilingual status templates mean client communications stay calm while the team keeps internal control.</p>
          </div>
        </article>
      </section>
    </SurfaceFrame>
  )
}

function FinanceSurface({ locale }: { locale: string }) {
  const surface = getCommerceModule('internal', 'finance-surface')!
  return (
    <SurfaceFrame locale={locale} lane="internal" title={surface.title} subtitle={surface.summary}>
      <section className={styles.statsGrid}>
        <article className={styles.statCard}><span className={styles.statLabel}>Cash collected</span><strong className={styles.statValue}>{formatCurrency(profitabilityRecords.reduce((sum, record) => sum + record.collected, 0))}</strong><p className={styles.statNote}>Collected against deposits and invoice balances across live work.</p></article>
        <article className={styles.statCard}><span className={styles.statLabel}>Bad deals</span><strong className={styles.statValue}>{profitabilityRecords.filter((record) => record.marginFlag === 'Blocked').length}</strong><p className={styles.statNote}>Orders that should be challenged before future approvals repeat the mistake.</p></article>
        <article className={styles.statCard}><span className={styles.statLabel}>Watch deals</span><strong className={styles.statValue}>{profitabilityRecords.filter((record) => record.marginFlag === 'Watch').length}</strong><p className={styles.statNote}>Packaging, discounting, or freight are putting pressure on contribution.</p></article>
      </section>
      <section className={styles.cardGrid}>
        {profitabilityRecords.map((record) => (
          <article key={record.orderId} className={styles.card}>
            <span className={styles.cardKicker}>{record.orderId}</span>
            <h3 className={styles.cardTitle}>{record.customerName}</h3>
            <div className={styles.infoRow}><span>Revenue {formatCurrency(record.revenue)}</span><span>Collected {formatCurrency(record.collected)}</span></div>
            <div className={styles.infoRow}><span>Product {formatCurrency(record.productCost)}</span><span>Packaging {formatCurrency(record.packagingCost)}</span></div>
            <div className={styles.infoRow}><span>Labor {formatCurrency(record.laborCost)}</span><span>Shipping {formatCurrency(record.shippingCost)}</span></div>
            <div className={styles.infoRow}><span>Discount {formatCurrency(record.discountAmount)}</span><span>{record.grossMarginPercent.toFixed(1)}% GM</span></div>
            <div className={styles.pillRow}><span className={record.marginFlag === 'Healthy' ? styles.successPill : styles.warnPill}>{record.marginFlag}</span><span className={record.invoiceStatus === 'paid' ? styles.successPill : styles.warnPill}>{record.invoiceStatus}</span></div>
            <p className={styles.cardText}>{formatCurrency(record.grossMarginDollars)} gross margin dollars · {record.dueDate}</p>
          </article>
        ))}
      </section>
    </SurfaceFrame>
  )
}

function CrmInternalViewSurface({ locale }: { locale: string }) {
  const surface = getCommerceModule('internal', 'crm-internal-view')!
  return (
    <SurfaceFrame locale={locale} lane="internal" title={surface.title} subtitle={surface.summary}>
      <section className={styles.dualGrid}>
        <article className={styles.panel}>
          <SectionHeader title="Customer memory" subtitle="What they buy, how they buy, and which language or service pattern keeps trust high." />
          {customerProfiles.map((customer) => (
            <div key={customer.id} className={styles.metricBlock}>
              <span className={styles.metricLabel}>{customer.segment}{customer.vipStatus ? ' · VIP' : ''}</span>
              <span className={styles.metricValue}>{customer.name}</span>
              <p className={styles.metricNote}>{formatCurrency(customer.lifetimeValue)} lifetime value · {customer.preferredLanguage} service · Next {customer.nextOpportunity}</p>
              <p className={styles.cardText}>{customer.notes.join(' · ')}</p>
            </div>
          ))}
        </article>
        <article className={styles.panel}>
          <SectionHeader title="Repeat and VIP reminders" subtitle="The relationship cues that should exist before a team member opens the thread." />
          <ul className={styles.bulletList}>
            {crmReminders.map((reminder) => (
              <li key={reminder.id}>{reminder.customerName}: {reminder.type} · {reminder.note} · {reminder.when}</li>
            ))}
          </ul>
        </article>
      </section>
    </SurfaceFrame>
  )
}

function SmartQuoteRequestPortalSurface({ locale }: { locale: string }) {
  const surface = getCommerceModule('client', 'smart-quote-request-portal')!
  const [requestState, setRequestState] = useState(quoteRequestBrief)
  const [submissionState, setSubmissionState] = useState<'idle' | 'submitted' | 'concierge'>('idle')
  return (
    <SurfaceFrame locale={locale} lane="client" title={surface.title} subtitle={surface.summary}>
      <SpotlightStrip
        items={[
          { label: 'Client intake polish', value: 'Concierge-ready form', note: 'The brief captures luxury, logistics, and brand detail in one pass.' },
          { label: 'Live success state', value: submissionState === 'idle' ? 'Waiting for request' : submissionState === 'submitted' ? 'Quote staged' : 'Concierge saved', note: 'Submission feedback remains premium instead of generic form confirmation.', tone: submissionState === 'idle' ? 'default' : 'success' },
          { label: 'Screenshot pack', value: 'Board + client friendly', note: 'This surface is ready for sales, founder demo, and customer preview.' },
        ]}
      />
      <section className={styles.dualGrid}>
        <article className={styles.panel}>
          <SectionHeader title="Request details" subtitle="Luxury intake that captures quantity, budget, branding, delivery complexity, and language mode before staff respond." />
          <div className={styles.formGrid}>
            <label className={styles.field}><span className={styles.fieldLabel}>Occasion</span><input className={styles.input} value={requestState.occasion} onChange={(event) => setRequestState((current) => ({ ...current, occasion: event.target.value }))} /></label>
            <label className={styles.field}><span className={styles.fieldLabel}>Quantity</span><input className={styles.input} value={String(requestState.quantity)} onChange={(event) => setRequestState((current) => ({ ...current, quantity: Number(event.target.value || 0) }))} /></label>
            <label className={styles.field}><span className={styles.fieldLabel}>Budget range</span><input className={styles.input} value={requestState.budgetRange} onChange={(event) => setRequestState((current) => ({ ...current, budgetRange: event.target.value }))} /></label>
            <label className={styles.field}><span className={styles.fieldLabel}>Language mode</span><input className={styles.input} value={requestState.languageMode} onChange={(event) => setRequestState((current) => ({ ...current, languageMode: event.target.value as typeof current.languageMode }))} /></label>
            <label className={styles.fieldWide}><span className={styles.fieldLabel}>Branding needs</span><textarea className={styles.textarea} value={requestState.brandingNeeds} onChange={(event) => setRequestState((current) => ({ ...current, brandingNeeds: event.target.value }))} /></label>
            <label className={styles.fieldWide}><span className={styles.fieldLabel}>Delivery needs</span><textarea className={styles.textarea} value={requestState.deliveryNeeds} onChange={(event) => setRequestState((current) => ({ ...current, deliveryNeeds: event.target.value }))} /></label>
          </div>
          <div className={styles.actionRow}><button className={styles.primaryButton} type="button" onClick={() => setSubmissionState('submitted')}>Request curated quote</button><button className={styles.secondaryButton} type="button" onClick={() => setSubmissionState('concierge')}>Save as concierge request</button></div>
        </article>
        <article className={styles.panel}>
          <SectionHeader title="What happens next" subtitle="The request is credible because the system understands fulfillment, not just form fields." />
          <StagePills stages={module.stages} />
          <ul className={styles.bulletList}>
            <li>Recipient and delivery complexity route into quote and shipping preparation together.</li>
            <li>Bilingual service expectations are carried into client comms and insert planning.</li>
            <li>Corporate-style address splits and branded insert needs show up before quoting mistakes happen.</li>
          </ul>
          <EnginePills ids={module.engineModules} />
          <StateGallery
            loading={{ label: 'Personalization options are syncing from curated catalog rules', note: 'The form can present rich loading feedback while pricing and logistics resolve together.' }}
            empty={{ label: 'No recipient CSV uploaded yet', note: 'The empty state nudges the buyer toward the next premium input instead of reading as blank.' }}
            success={{ label: submissionState === 'concierge' ? 'Founder concierge route prepared' : 'Request routed into quote workflow', note: 'Follow-up, language mode, and delivery complexity are all preserved in the success state.' }}
          />
          {submissionState !== 'idle' ? (
            <div className={styles.calloutCard}>
              <strong>{submissionState === 'submitted' ? 'Quote request staged' : 'Concierge request saved'}</strong>
              <p className={styles.cardText}>The team can now route this brief with {requestState.languageMode.toLowerCase()} service expectations and {requestState.deliveryNeeds.toLowerCase()}.</p>
            </div>
          ) : null}
        </article>
      </section>
    </SurfaceFrame>
  )
}

function CorporateClientPortalSurface({ locale, actor, actorKey }: { locale: string; actor: ActorContext; actorKey: string }) {
  const surface = getCommerceModule('client', 'corporate-client-portal')!
  const [campaigns, setCampaigns] = useState<CorporateCampaignRecord[]>(filterCorporateRowsForActor(actor, corporateCampaigns))

  function reorderCampaign(campaignId: string) {
    setCampaigns((current) =>
      current.map((campaign) =>
        campaign.id === campaignId
          ? { ...campaign, status: 'Planning', nextAction: 'Reorder brief created from prior campaign structure' }
          : campaign,
      ),
    )
  }

  return (
    <SurfaceFrame locale={locale} lane="client" title={surface.title} subtitle={surface.summary} actor={actor} actorKey={actorKey}>
      <SpotlightStrip
        items={[
          { label: 'Account view', value: `${campaigns.length} visible campaigns`, note: 'Row-level RBAC stays intact while the portal still looks premium.' },
          { label: 'Reorders', value: `${campaigns.filter((campaign) => campaign.reorderReady).length} ready to relaunch`, note: 'Screenshot-ready reorder proof helps commercial close faster.', tone: 'success' },
          { label: 'Owner handoffs', value: `${ownerHandoffs.length} active`, note: 'Mentions and approvals stay connected to the account surface.' },
        ]}
      />
      <section className={styles.statsGrid}>
        <article className={styles.statCard}><span className={styles.statLabel}>Corporate reorders ready</span><strong className={styles.statValue}>{campaigns.filter((campaign) => campaign.reorderReady).length}</strong><p className={styles.statNote}>Past campaigns a buyer can relaunch without rebuilding from scratch.</p></article>
        <article className={styles.statCard}><span className={styles.statLabel}>Multi-address drops</span><strong className={styles.statValue}>{campaigns.reduce((sum, campaign) => sum + campaign.addressCount, 0)}</strong><p className={styles.statNote}>Addresses already modeled across live corporate campaigns.</p></article>
        <article className={styles.statCard}><span className={styles.statLabel}>Deposit outstanding</span><strong className={styles.statValue}>{formatCurrency(campaigns.reduce((sum, campaign) => sum + campaign.depositOutstanding, 0))}</strong><p className={styles.statNote}>Cash still needed before reservations or production release.</p></article>
      </section>
      <section className={styles.cardGrid}>
        {campaigns.map((campaign) => (
          <article key={campaign.id} className={styles.card}>
            <span className={styles.cardKicker}>{campaign.accountName}</span>
            <h3 className={styles.cardTitle}>{campaign.theme}</h3>
            <div className={styles.infoRow}><span>{campaign.recipientCount} recipients</span><span>{campaign.addressCount} addresses</span></div>
            <div className={styles.infoRow}><span>{campaign.deadline}</span><span>{campaign.invoiceTerms}</span></div>
            <div className={styles.pillRow}>
              {campaign.brandedInsert ? <span className={styles.pill}>Branded insert</span> : null}
              {campaign.depositOutstanding ? <span className={styles.warnPill}>Deposit due</span> : <span className={styles.successPill}>Deposit clear</span>}
            </div>
            <p className={styles.cardText}>{campaign.approvalCheckpoint} · {campaign.nextAction}</p>
            {campaign.reorderReady ? <button className={styles.secondaryButton} type="button" onClick={() => reorderCampaign(campaign.id)}>Launch reorder</button> : null}
          </article>
        ))}
      </section>
      <section className={styles.dualGrid}>
        <article className={styles.panel}>
          <SectionHeader title="Client state coverage" subtitle="Premium empty, loading, and success states for buyer-facing confidence." />
          <StateGallery
            loading={{ label: 'Recipient workbook is validating address splits', note: 'The portal can be loading without looking broken or generic.' }}
            empty={{ label: campaigns.length ? 'No hidden campaigns for this actor scope' : 'No campaigns visible in this scope yet', note: 'RBAC-safe emptiness still explains what is happening.' }}
            success={{ label: 'Reorder brief launched from prior campaign memory', note: 'A commercial wow moment that still respects actor-specific visibility.' }}
          />
        </article>
        <article className={styles.panel}>
          <SectionHeader title="CRM and handoff context" subtitle="Zoho-fed reminders and owner routing keep account momentum visible." />
          <ConnectorGrid connectorIds={['zoho-core']} />
          {ownerHandoffs.slice(0, 2).map((handoff) => (
            <div key={handoff.id} className={styles.metricBlock}>
              <span className={styles.metricLabel}>{handoff.status} · {handoff.dueBy}</span>
              <span className={styles.metricValue}>{handoff.subject}</span>
              <p className={styles.metricNote}>{handoff.from} to {handoff.to}</p>
            </div>
          ))}
        </article>
      </section>
    </SurfaceFrame>
  )
}

function OrderTrackingExperienceSurface({ locale }: { locale: string }) {
  const surface = getCommerceModule('client', 'order-tracking-experience')!
  return (
    <SurfaceFrame locale={locale} lane="client" title={surface.title} subtitle={surface.summary}>
      <SpotlightStrip
        items={[
          { label: 'Tracking posture', value: orderTrackingStory.stage, note: 'The customer sees clarity without exposing internal noise.' },
          { label: 'Confidence copy', value: `${bilingualStatusTemplates.length} bilingual templates`, note: 'Every milestone can land with polished reassurance.' },
          { label: 'Commercial polish', value: 'Gift-recipient safe', note: 'This screen is screenshot-ready for support, sales, and founders.' },
        ]}
      />
      <section className={styles.panel}>
        <SectionHeader title={`Tracking for ${orderTrackingStory.customerName}`} subtitle={`Order ${orderTrackingStory.orderId} is currently ${orderTrackingStory.stage}.`} />
        <div className={styles.timeline}>
          {orderTrackingStory.stages.map((stage) => (
            <div key={stage.label} className={stage.active ? styles.timelineActive : stage.done ? styles.timelineDone : styles.timelineItem}>
              <div className={styles.timelineDot} />
              <div>
                <strong>{stage.label}</strong>
                <p className={styles.cardText}>{stage.note}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className={styles.dualGrid}>
        <article className={styles.panel}>
          <SectionHeader title="Confidence language" subtitle="Tracking that reassures buyers instead of exposing internal chaos." />
          {bilingualStatusTemplates.map((template) => (
            <div key={template.key} className={styles.metricBlock}>
              <span className={styles.metricLabel}>{template.status.en}</span>
              <span className={styles.metricValue}>{template.status.fr}</span>
              <p className={styles.metricNote}>{template.note.en}</p>
            </div>
          ))}
        </article>
        <article className={styles.panel}>
          <SectionHeader title="Flow Engine alignment" subtitle="Customer tracking remains grounded in shared status progression and shipping events." />
          <EnginePills ids={surface.engineModules} />
          <StateGallery
            loading={{ label: 'Courier checkpoint is syncing', note: 'Desktop users get responsive progress language while delivery proof refreshes.' }}
            empty={{ label: 'No exception notes on this shipment', note: 'An empty exception state reads calm and premium instead of vacant.' }}
            success={{ label: 'Delivery confidence update ready to send', note: 'The surface closes the loop with a clear reassurance state.' }}
          />
        </article>
      </section>
    </SurfaceFrame>
  )
}

function SeasonalCampaignEngineSurface({ locale }: { locale: string }) {
  const surface = getCommerceModule('client', 'seasonal-campaign-engine')!
  const [filter, setFilter] = useState<'All' | 'Building' | 'Ready to launch' | 'Live' | 'Follow-up'>('All')
  const visibleCampaigns = filter === 'All' ? seasonalCampaigns : seasonalCampaigns.filter((campaign) => campaign.status === filter)
  return (
    <SurfaceFrame locale={locale} lane="client" title={surface.title} subtitle={surface.summary}>
      <SpotlightStrip
        items={[
          { label: 'Campaign command', value: `${visibleCampaigns.length} visible programs`, note: 'The filter system is ready for screenshot and live demo use.' },
          { label: 'Launch confidence', value: `${visibleCampaigns.filter((campaign) => campaign.status === 'Ready to launch').length} launch-ready`, note: 'Operational need stays tied to growth posture.' },
          { label: 'Connector story', value: 'Ads + CRM + storefront', note: 'Campaign planning now feels connected to real systems instead of isolated cards.' },
        ]}
      />
      <section className={styles.panel}>
        <SectionHeader title="Campaign filters" subtitle="Switch the planning lens between build, launch-ready, live, and follow-up programs." />
        <div className={styles.pillRow}>
          {['All', 'Building', 'Ready to launch', 'Live', 'Follow-up'].map((status) => (
            <button key={status} type="button" className={filter === status ? styles.primaryFilter : styles.secondaryFilter} onClick={() => setFilter(status as typeof filter)}>
              {status}
            </button>
          ))}
        </div>
      </section>
      <section className={styles.cardGrid}>
        {visibleCampaigns.map((campaign) => (
          <article key={campaign.id} className={styles.card}>
            <span className={styles.cardKicker}>{campaign.season} · {campaign.status}</span>
            <h3 className={styles.cardTitle}>{campaign.heroConcept}</h3>
            <p className={styles.cardText}>{campaign.audience}</p>
            <div className={styles.infoRow}><span>{campaign.launchWindow}</span><span>{formatCurrency(campaign.pipelineValue)} pipeline</span></div>
            <p className={styles.alertText}>{campaign.operationalNeed}</p>
          </article>
        ))}
      </section>
      <section className={styles.panel}>
        <SectionHeader title="Growth state gallery" subtitle="Commercial polish for loading, empty, and launch-success moments." />
        <StateGallery
          loading={{ label: 'Refreshing spend and creative approvals', note: 'Planning states now read like a live command center rather than a static roadmap.' }}
          empty={{ label: 'No campaigns in this filter yet', note: 'The filter-specific empty state explains the gap and invites the next action.' }}
          success={{ label: 'Campaign pack is launch ready', note: 'Assets, ops readiness, and pipeline value land in one polished success state.' }}
        />
      </section>
    </SurfaceFrame>
  )
}

function ShopifyIntelligenceHubSurface({ locale }: { locale: string }) {
  const surface = getCommerceModule('internal', 'shopify-intelligence-hub')!
  return (
    <SurfaceFrame locale={locale} lane="internal" title={surface.title} subtitle={surface.summary}>
      <SpotlightStrip
        items={[
          { label: 'Storefront intelligence', value: `${shopifyMetrics.length} metrics live`, note: 'The team can narrate demand quality from real commerce signals.' },
          { label: 'Bundle winners', value: `${shopifyBundlePerformance[0]?.bundleSku ?? 'n/a'} leading`, note: 'AOV and repeat behavior are instantly presentable.', tone: 'success' },
          { label: 'Connector sync', value: liveConnectors.find((connector) => connector.system === 'Shopify')?.lastSync ?? 'n/a', note: 'Shopify health is visible at a glance.' },
        ]}
      />
      <section className={styles.statsGrid}>
        <article className={styles.statCard}><span className={styles.statLabel}>AOV</span><strong className={styles.statValue}>$214</strong><p className={styles.statNote}>Healthy premium basket average order value.</p></article>
        <article className={styles.statCard}><span className={styles.statLabel}>{t(locale, 'Repeat purchase', 'Achat recurrent')}</span><strong className={styles.statValue}>42%</strong><p className={styles.statNote}>{t(locale, 'Repeat behavior from corporate and VIP cohorts.', 'Comportement recurrent des cohortes corporate et VIP.')}</p></article>
        <article className={styles.statCard}><span className={styles.statLabel}>{t(locale, 'Abandoned carts', 'Paniers abandonnes')}</span><strong className={styles.statValue}>17%</strong><p className={styles.statNote}>{t(locale, 'Down 4 points after trust and shipping copy updates.', 'En baisse de 4 points apres la mise a jour du copy trust et shipping.')}</p></article>
      </section>
      <section className={styles.dualGrid}>
        <article className={styles.panel}>
          <SectionHeader title={t(locale, 'Core Shopify intelligence', 'Intelligence Shopify centrale')} />
          {shopifyMetrics.map((metric) => (
            <div key={metric.label} className={styles.metricBlock}>
              <span className={styles.metricLabel}>{metric.label}</span>
              <span className={styles.metricValue}>{metric.value}</span>
              <p className={styles.metricNote}>{metric.note}</p>
            </div>
          ))}
        </article>
        <article className={styles.panel}>
          <SectionHeader title={t(locale, 'Bundle performance matrix', 'Matrice de performance bundles')} />
          {shopifyBundlePerformance.map((bundle) => (
            <div key={bundle.bundleSku} className={styles.metricBlock}>
              <span className={styles.metricLabel}>{bundle.bundleSku}</span>
              <span className={styles.metricValue}>{bundle.conversionRate}% {t(locale, 'conversion', 'conversion')}</span>
              <p className={styles.metricNote}>AOV {formatCurrency(bundle.aov)} · {t(locale, 'Repeat', 'Recurrent')} {bundle.repeatRate}%</p>
            </div>
          ))}
        </article>
      </section>
      <section className={styles.dualGrid}>
        <article className={styles.panel}>
          <SectionHeader title={t(locale, 'Connector health', 'Sante connecteurs')} subtitle={t(locale, 'Live Shopify and CRM context for premium ecommerce decisions.', 'Contexte Shopify et CRM en direct pour decisions ecommerce premium.')} />
          <ConnectorGrid connectorIds={['shopify-core', 'zoho-core']} />
        </article>
        <article className={styles.panel}>
          <SectionHeader title={t(locale, 'State gallery', 'Galerie d etats')} subtitle={t(locale, 'Premium loading, empty, and success variants for storefront reporting.', 'Variantes premium loading, empty et success pour reporting storefront.')} />
          <StateGallery
            loading={{ label: 'Refreshing Shopify cohort analysis', note: 'Desktop users see a clear loading narrative while storefront metrics recalculate.' }}
            empty={{ label: 'No underperforming bundles right now', note: 'The empty state celebrates calm without becoming visually dead.' }}
            success={{ label: 'Merchandising pack is ready for founder review', note: 'AOV, repeat rate, and top products land in one crisp success state.' }}
          />
        </article>
      </section>
    </SurfaceFrame>
  )
}

function GoogleAdsCommandCenterSurface({ locale }: { locale: string }) {
  const surface = getCommerceModule('internal', 'google-ads-command-center')!
  return (
    <SurfaceFrame locale={locale} lane="internal" title={surface.title} subtitle={surface.summary}>
      <SpotlightStrip
        items={[
          { label: 'Spend posture', value: formatCurrency(adsCampaigns.reduce((sum, campaign) => sum + campaign.spend, 0)), note: 'Search and Performance Max are now visually merchandised for exec review.' },
          { label: 'Growth signal', value: `${Math.max(...adsCampaigns.map((campaign) => campaign.roas)).toFixed(1)}x top ROAS`, note: 'The best campaign is obvious in one screenshot.' },
          { label: 'Connector sync', value: liveConnectors.find((connector) => connector.system === 'Google Ads')?.lastSync ?? 'n/a', note: 'Google Ads sync health stays visible.' },
        ]}
      />
      <section className={styles.cardGrid}>
        {adsCampaigns.map((campaign) => (
          <article key={campaign.campaign} className={styles.card}>
            <span className={styles.cardKicker}>{campaign.channel} · {campaign.language} · {campaign.geo}</span>
            <h3 className={styles.cardTitle}>{campaign.campaign}</h3>
            <div className={styles.infoRow}><span>{t(locale, 'Spend', 'Depense')} {formatCurrency(campaign.spend)}</span><span>{t(locale, 'Conversions', 'Conversions')} {campaign.conversions}</span></div>
            <div className={styles.infoRow}><span>CPA {formatCurrency(campaign.cpa)}</span><span>ROAS {campaign.roas.toFixed(1)}x</span></div>
            <div className={styles.pillRow}>{campaign.branded ? <span className={styles.pill}>Branded</span> : <span className={styles.warnPill}>Non-branded</span>}</div>
          </article>
        ))}
      </section>
      <section className={styles.dualGrid}>
        <article className={styles.panel}>
          <SectionHeader title={t(locale, 'Connector proof', 'Preuve connecteurs')} subtitle={t(locale, 'Campaign performance tied to live ads sync and CRM audience context.', 'Performance campagne liee au sync ads live et contexte audience CRM.')} />
          <ConnectorGrid connectorIds={['ads-core', 'zoho-core']} />
        </article>
        <article className={styles.panel}>
          <SectionHeader title={t(locale, 'State gallery', 'Galerie d etats')} subtitle={t(locale, 'Rich loading, empty, and success states for growth operators.', 'Etats riches loading, empty et success pour operateurs croissance.')} />
          <StateGallery
            loading={{ label: 'Refreshing conversion lag and spend pacing', note: 'The surface stays premium while campaign attribution catches up.' }}
            empty={{ label: 'No campaigns below target ROAS threshold', note: 'Empty never reads like missing data; it reads like control.' }}
            success={{ label: 'Budget reallocation recommendations ready', note: 'Spend, CPA, and ROAS can be handed to the owner immediately.' }}
          />
        </article>
      </section>
    </SurfaceFrame>
  )
}

function CampaignCommandCenterSurface({ locale }: { locale: string }) {
  const surface = getCommerceModule('internal', 'campaign-command-center')!
  return (
    <SurfaceFrame locale={locale} lane="internal" title={surface.title} subtitle={surface.summary}>
      <section className={styles.panel}>
        <SectionHeader title={t(locale, 'Campaign execution board', 'Tableau execution campagnes')} subtitle={t(locale, 'Integrate and orchestrate Shopify, Ads, and CRM without replacing existing tools.', 'Integrer et orchestrer Shopify, Ads et CRM sans remplacer les outils existants.')} />
        {campaignExecution.map((record) => (
          <div key={record.id} className={styles.metricBlock}>
            <span className={styles.metricLabel}>{record.channel} · {record.status}</span>
            <span className={styles.metricValue}>{record.campaign}</span>
            <p className={styles.metricNote}>{record.launchWindow} · {record.roiNote}</p>
          </div>
        ))}
      </section>
      <section className={styles.dualGrid}>
        <article className={styles.panel}>
          <SectionHeader title={t(locale, 'Live connectors', 'Connecteurs live')} subtitle={t(locale, 'Sample connectors showing a credible operating graph across commerce and CRM.', 'Exemples de connecteurs montrant un graphe operationnel credible a travers commerce et CRM.')} />
          <ConnectorGrid />
        </article>
        <article className={styles.panel}>
          <SectionHeader title={t(locale, 'Mentions and owner handoffs', 'Mentions et transferts direction')} subtitle={t(locale, 'Commercial collaboration that still resolves to accountable owners.', 'Collaboration commerciale qui se resolt quand meme vers des proprietaires responsables.')} />
          {notificationCenterItems.slice(0, 3).map((item) => (
            <div key={item.id} className={styles.metricBlock}>
              <span className={styles.metricLabel}>{item.channel} · {item.priority}</span>
              <span className={styles.metricValue}>{item.title}</span>
              <p className={styles.metricNote}>{item.note}</p>
            </div>
          ))}
        </article>
      </section>
    </SurfaceFrame>
  )
}

function SocialPresencePlannerSurface({ locale }: { locale: string }) {
  const surface = getCommerceModule('internal', 'social-presence-planner')!
  return (
    <SurfaceFrame locale={locale} lane="internal" title={surface.title} subtitle={surface.summary}>
      <section className={styles.panel}>
        <SectionHeader title={t(locale, 'Content and collaborator planner', 'Planificateur contenu et collaborateurs')} />
        {socialPlanner.map((item) => (
          <div key={item.id} className={styles.metricBlock}>
            <span className={styles.metricLabel}>{item.platform} · {item.postDate}</span>
            <span className={styles.metricValue}>{item.theme}</span>
            <p className={styles.metricNote}>{item.assetStatus}{item.collaborator ? ` · ${item.collaborator}` : ''}</p>
          </div>
        ))}
      </section>
    </SurfaceFrame>
  )
}

function WebsiteConversionCenterSurface({ locale }: { locale: string }) {
  const surface = getCommerceModule('internal', 'website-conversion-center')!
  return (
    <SurfaceFrame locale={locale} lane="internal" title={surface.title} subtitle={surface.summary}>
      <section className={styles.cardGrid}>
        {websiteFunnel.map((entry) => (
          <article key={entry.page} className={styles.card}>
            <span className={styles.cardKicker}>{entry.page}</span>
            <h3 className={styles.cardTitle}>{t(locale, 'Funnel quality', 'Qualite du tunnel')}</h3>
            <div className={styles.infoRow}><span>{entry.sessions} sessions</span><span>{entry.ctaClicks} CTA</span></div>
            <div className={styles.infoRow}><span>{entry.quoteRequests} {t(locale, 'quotes', 'soumissions')}</span><span>{entry.builderStarts} {t(locale, 'builder starts', 'demarrages builder')}</span></div>
            <p className={styles.alertText}>{t(locale, 'Drop-off', 'Perte')}: {entry.dropOff}</p>
          </article>
        ))}
      </section>
    </SurfaceFrame>
  )
}

function GuidedGiftBuilderSurface({ locale }: { locale: string }) {
  const surface = getCommerceModule('client', 'guided-gift-builder')!
  return (
    <SurfaceFrame locale={locale} lane="client" title={surface.title} subtitle={surface.summary}>
      <SpotlightStrip
        items={[
          { label: 'Builder presets', value: `${guidedBuilderPresets.length} curated flows`, note: 'Budget, luxury level, and local preference now feel premium and real.' },
          { label: 'Commercial wow', value: formatCurrency(guidedBuilderPresets[0]?.estimatedTotal ?? 0), note: 'The first preset already reads like a polished selling artifact.', tone: 'success' },
          { label: 'Connector support', value: 'Shopify-informed', note: 'Catalog and bundle truth are grounded in the storefront connector.' },
        ]}
      />
      <section className={styles.panel}>
        <SectionHeader title={t(locale, 'Guided curation presets', 'Presets de curation guidee')} subtitle={t(locale, 'Real recommendation sets by budget, recipient, occasion, luxury level, timeline, and local preference.', 'Jeux de recommandations reels par budget, destinataire, occasion, niveau luxe, delai et preference locale.')} />
        {guidedBuilderPresets.map((preset) => (
          <div key={preset.id} className={styles.metricBlock}>
            <span className={styles.metricLabel}>{preset.budget} · {preset.luxuryLevel} · {preset.timeline}</span>
            <span className={styles.metricValue}>{preset.recipient} · {preset.occasion}</span>
            <p className={styles.metricNote}>{preset.recommendedSkus.join(', ')} · {formatCurrency(preset.estimatedTotal)} · {preset.marginPercent}% margin</p>
          </div>
        ))}
      </section>
      <section className={styles.dualGrid}>
        <article className={styles.panel}>
          <SectionHeader title={t(locale, 'Builder state gallery', 'Galerie etats du builder')} subtitle={t(locale, 'A polished client experience for loading, empty, and success moments.', 'Une experience client polie pour les moments loading, empty et success.')} />
          <StateGallery
            loading={{ label: 'Curating artisan recommendations', note: 'The builder presents loading as concierge curation, not spinner noise.' }}
            empty={{ label: 'No preset matches the current brief yet', note: 'The empty state prompts a founder-level concierge route instead of a dead end.' }}
            success={{ label: 'Preset bundle is ready to request', note: 'A premium success state closes the loop on configuration.' }}
          />
        </article>
        <article className={styles.panel}>
          <SectionHeader title={t(locale, 'Commerce connector context', 'Contexte connecteur commerce')} subtitle={t(locale, 'Builder recommendations inherit bundle truth from Shopify intelligence.', 'Les recommandations builder heritent de la verite bundle depuis Shopify intelligence.')} />
          <ConnectorGrid connectorIds={['shopify-core']} />
        </article>
      </section>
    </SurfaceFrame>
  )
}
function LoyaltyVipSystemSurface({ locale }: { locale: string }) {
  const surface = getCommerceModule('client', 'loyalty-vip-system')!
  return (
    <SurfaceFrame locale={locale} lane="client" title={surface.title} subtitle={surface.summary}>
      <section className={styles.cardGrid}>
        {loyaltyProfiles.map((profile) => {
          const customer = customerProfiles.find((entry) => entry.id === profile.customerId)
          return (
            <article key={profile.customerId} className={styles.card}>
              <span className={styles.cardKicker}>{profile.tier}</span>
              <h3 className={styles.cardTitle}>{customer?.name ?? profile.customerId}</h3>
              <div className={styles.infoRow}><span>{t(locale, 'Rewards', 'Recompenses')} {profile.rewardsBalance}</span><span>{t(locale, 'Repeat orders', 'Commandes recurrentes')} {profile.repeatOrders}</span></div>
              <div className={styles.pillRow}>
                {profile.earlySeasonalAccess ? <span className={styles.successPill}>{t(locale, 'Early seasonal access', 'Acces saisonnier anticipe')}</span> : null}
                {profile.conciergeEligible ? <span className={styles.pill}>{t(locale, 'Concierge eligible', 'Eligible concierge')}</span> : null}
              </div>
              <p className={styles.cardText}>{profile.savedPreferences.join(' · ')}</p>
            </article>
          )
        })}
      </section>
    </SurfaceFrame>
  )
}

function ConciergeRequestsSurface({ locale }: { locale: string }) {
  const surface = getCommerceModule('client', 'concierge-requests')!
  return (
    <SurfaceFrame locale={locale} lane="client" title={surface.title} subtitle={surface.summary}>
      <section className={styles.panel}>
        <SectionHeader title={t(locale, 'Concierge operating queue', 'File operationnelle concierge')} subtitle={t(locale, 'Urgent, premium, and founder-level requests routed with SLA confidence.', 'Demandes urgentes, premium et niveau fondateur routees avec confiance SLA.')} />
        {customOrders.filter((order) => order.rush || order.atRisk).map((order) => (
          <div key={order.id} className={styles.metricBlock}>
            <span className={styles.metricLabel}>{order.id} · {order.rush ? t(locale, 'Rush', 'Urgent') : t(locale, 'Priority', 'Priorite')}</span>
            <span className={styles.metricValue}>{order.customerName}</span>
            <p className={styles.metricNote}>{order.projectName} · {order.shipWindow} · {order.slaHoursRemaining}h</p>
          </div>
        ))}
      </section>
    </SurfaceFrame>
  )
}

export function InternalLiveSurface({ slug, locale, actor, actorKey }: { slug: string; locale: string; actor: ActorContext; actorKey: string }) {
  switch (slug) {
    case 'executive-dashboard':
      return <ExecutiveDashboardSurface locale={locale} actor={actor} actorKey={actorKey} />
    case 'quote-pipeline':
      return <QuotePipelineSurface locale={locale} />
    case 'custom-order-management':
      return <CustomOrderManagementSurface locale={locale} />
    case 'production-tracker':
      return <ProductionTrackerSurface locale={locale} />
    case 'inventory-center':
      return <InventoryCenterSurface locale={locale} />
    case 'supplier-po-center':
      return <SupplierPoCenterSurface locale={locale} />
    case 'shipping-center':
      return <ShippingCenterSurface locale={locale} />
    case 'shopify-intelligence-hub':
      return <ShopifyIntelligenceHubSurface locale={locale} />
    case 'google-ads-command-center':
      return <GoogleAdsCommandCenterSurface locale={locale} />
    case 'campaign-command-center':
      return <CampaignCommandCenterSurface locale={locale} />
    case 'social-presence-planner':
      return <SocialPresencePlannerSurface locale={locale} />
    case 'website-conversion-center':
      return <WebsiteConversionCenterSurface locale={locale} />
    case 'finance-surface':
      return <FinanceSurface locale={locale} />
    case 'crm-internal-view':
      return <CrmInternalViewSurface locale={locale} />
    default:
      return null
  }
}

export function ClientLiveSurface({
  slug,
  locale,
  actor,
  actorKey,
}: {
  slug: string
  locale: string
  actor: ActorContext
  actorKey: string
}) {
  switch (slug) {
    case 'smart-quote-request-portal':
      return <SmartQuoteRequestPortalSurface locale={locale} />
    case 'guided-gift-builder':
      return <GuidedGiftBuilderSurface locale={locale} />
    case 'corporate-client-portal':
      return <CorporateClientPortalSurface locale={locale} actor={actor} actorKey={actorKey} />
    case 'order-tracking-experience':
      return <OrderTrackingExperienceSurface locale={locale} />
    case 'loyalty-vip-system':
      return <LoyaltyVipSystemSurface locale={locale} />
    case 'seasonal-campaign-engine':
      return <SeasonalCampaignEngineSurface locale={locale} />
    case 'concierge-requests':
      return <ConciergeRequestsSurface locale={locale} />
    default:
      return null
  }
}
