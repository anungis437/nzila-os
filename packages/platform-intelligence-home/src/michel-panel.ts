/**
 * @nzila/platform-intelligence-home — Michel Panel Service
 *
 * Generates a tailored weekly action list for Michel Nungisa's role as
 * Legal Counsel + President. Actions leverage Michel's unique advantages:
 * legal training (MOU review, data governance, IP), executive signing authority
 * (grant submissions, partner agreements), and founder-level relationship capital.
 *
 * Each action includes why Michel specifically should own it (leverage),
 * estimated time, and strategic context.
 */
import type { MichelAction } from './types'
import { getDealPipeline, getHighProbabilityDeals, getStaleDeals } from './deal-service'
import { getFundingOpportunities, getUpcomingDeadlines } from './funding-service'
import { getPartners } from './partner-service'
import { scoreProducts } from './scoring-service'

// ── Local helpers ─────────────────────────────────────────────────────────────

function fmtCad(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${n}`
}

let _idCounter = 0
function nextId(): string {
  return `michel-${(++_idCounter).toString().padStart(3, '0')}`
}

// ── Action Generators ─────────────────────────────────────────────────────────

function mouReviews(now: Date): MichelAction[] {
  const deals = getDealPipeline()
  const negotiating = deals.filter((d) => d.stage === 'negotiation').slice(0, 2)
  return negotiating.map((deal) => ({
    id: nextId(),
    actionType: 'legal_review' as const,
    priority: 1 as const,
    title: `Review ${deal.org} pilot MOU / agreement draft`,
    context: `${deal.product.replace(/-/g, ' ')} deal with ${deal.org} is in negotiation at ${deal.probability}% probability. ${deal.nextStep}`,
    leverage:
      "Michel's legal training eliminates $5K–$15K in external counsel cost per MOU review. Faster legal iteration = faster close. Founder reviewing own agreements also gives flexibility to accept risk clauses external counsel would over-flag.",
    estimatedTime: '2–3 hours',
    product: deal.product,
    dueBy: deal.expectedCloseDate,
  }))
}

function sponsorCalls(now: Date): MichelAction[] {
  const deals = getDealPipeline()
  const sponsorDeals = deals
    .filter((d) => d.dealType === 'sponsor' && d.probability >= 35 && !['closed_won', 'closed_lost'].includes(d.stage))
    .slice(0, 1)
  return sponsorDeals.map((deal) => ({
    id: nextId(),
    actionType: 'sponsor_call' as const,
    priority: 2 as const,
    title: `Call ${deal.org} — ${deal.product.replace(/-/g, ' ')} sponsorship`,
    context: `${deal.org} sponsor deal at ${deal.probability}% probability. ${deal.nextStep}`,
    leverage:
      'Corporate sponsorships are highest-margin revenue (no COGS). A single founder-to-executive call can move probability 20+ points. Michel as president signals seriousness that junior sales cannot replicate.',
    estimatedTime: '45 minutes (15 min prep + 30 min call)',
    product: deal.product,
    dueBy: null,
  }))
}

function grantSubmissions(now: Date): MichelAction[] {
  const deadlines14 = getUpcomingDeadlines(14, now)
  if (deadlines14.length === 0) return []
  const grant = deadlines14[0]
  const maxVal = grant.typicalMaxCad != null ? `Up to ${fmtCad(grant.typicalMaxCad)}` : 'Amount TBD'
  return [
    {
      id: nextId(),
      actionType: 'grant_submission' as const,
      priority: 1 as const,
      title: `Approve + submit ${grant.name.split('—')[0].trim()} application`,
      context: `Deadline: ${grant.deadline?.slice(0, 10) ?? 'imminent'}. As president and signing authority, Michel must approve and submit. Budget: ${maxVal}. Confidence: ${grant.confidenceScore}%.`,
      leverage:
        'Grant funding is non-dilutive capital — no equity given. Missing this deadline means 6–12 months wait for the next intake. Michel is signing authority; delegation here is not an option.',
      estimatedTime: '3–4 hours review + 1 hour submission',
      product: grant.relevantDomains[0] ?? null,
      dueBy: grant.deadline?.slice(0, 10) ?? null,
    },
  ]
}

function channelNegotiations(now: Date): MichelAction[] {
  const deals = getDealPipeline()
  const channel = deals
    .filter(
      (d) =>
        (d.dealType === 'channel' || d.dealType === 'law_firm_partnership' || d.dealType === 'distribution') &&
        (d.stage === 'negotiation' || d.stage === 'proposal') &&
        d.probability >= 40,
    )
    .slice(0, 1)
  return channel.map((deal) => ({
    id: nextId(),
    actionType: 'negotiation' as const,
    priority: 2 as const,
    title: `Negotiate ${deal.org} ${deal.dealType === 'law_firm_partnership' ? 'law firm channel' : 'distribution'} terms`,
    context: `${deal.org} ${deal.dealType.replace(/_/g, ' ')} deal at ${deal.probability}%. ${deal.nextStep}`,
    leverage:
      'Channel and law firm partnerships multiply distribution 10–50× without headcount. Michel can draft and negotiate distribution terms that protect IP while making adoption frictionless.',
    estimatedTime: '1–2 hours',
    product: deal.product,
    dueBy: deal.expectedCloseDate,
  }))
}

function strategicIntros(now: Date): MichelAction[] {
  const partners = getPartners()
  const researchProspects = partners
    .filter((p) => (p.partnerType === 'research_institution' || p.partnerType === 'foundation') && p.status === 'prospect')
    .slice(0, 1)
  return researchProspects.map((p) => ({
    id: nextId(),
    actionType: 'strategic_intro' as const,
    priority: 3 as const,
    title: `Pursue ${p.name} strategic introduction`,
    context: `${p.name} (${p.primaryDomain}) is a ${p.partnerType.replace(/_/g, ' ')} who can provide data access, academic credibility, grant co-applicant status, and government stakeholder introductions.`,
    leverage:
      'Research institution partnerships unlock SSHRC, NSERC, and provincial research grants inaccessible to commercial entities alone. One email from Michel opens a door that a sales process cannot.',
    estimatedTime: '30 minutes (intro email + LinkedIn)',
    product: null,
    dueBy: null,
  }))
}

function dealAdvance(now: Date): MichelAction[] {
  const highProb = getHighProbabilityDeals(60)
  const ueDeals = highProb
    .filter((d) => d.product === 'union-eyes' && !['negotiation', 'closed_won', 'pilot_active'].includes(d.stage))
    .slice(0, 1)
  return ueDeals.map((deal) => ({
    id: nextId(),
    actionType: 'deal_advance' as const,
    priority: 2 as const,
    title: `Advance ${deal.org} to pilot agreement stage`,
    context: `${deal.org} at ${deal.probability}% — currently in ${deal.stage.replace(/_/g, ' ')}. ${deal.nextStep}`,
    leverage:
      'First closed Union Eyes pilot transforms the entire commercial narrative: investor conversations shift, next deal probability jumps, and FedDev + CLC grant credibility increases. Michel drafting the pilot terms eliminates counsel cost and enables rapid iteration.',
    estimatedTime: '2–3 hours deal prep + 1 hour call',
    product: 'union-eyes',
    dueBy: deal.expectedCloseDate,
  }))
}

function sredDocumentApproval(now: Date): MichelAction[] {
  const month = now.getMonth() // 0-indexed
  const isQuarterApproach = [1, 4, 7, 10].includes(month) // Feb, May, Aug, Nov
  const isQuarterEnd = [2, 5, 8, 11].includes(month) // Mar, Jun, Sep, Dec
  if (!isQuarterApproach && !isQuarterEnd) return []
  const qLabel = month <= 2 ? 'Q1' : month <= 5 ? 'Q2' : month <= 8 ? 'Q3' : 'Q4'
  return [
    {
      id: nextId(),
      actionType: 'approve_document' as const,
      priority: 3 as const,
      title: `Approve ${qLabel} SR&ED engineering activity documentation`,
      context: `SR&ED requires quarterly work logs for each qualifying R&D activity. Michel must review and approve engineering team's ${qLabel} logs before accountant review. Estimated annual refund: $50K–$150K.`,
      leverage:
        'Non-dilutive capital. Missing quarterly documentation reduces claim quality and CRA audit defensibility. Year-end reconstruction = lower refund. Michel as signing authority must approve — cannot be delegated.',
      estimatedTime: '1 hour review',
      product: 'platform',
      dueBy: null,
    },
  ]
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Generate Michel's tailored weekly action list, sorted by priority. */
export function getMichelWeeklyActions(now: Date = new Date()): MichelAction[] {
  // Reset counter for deterministic IDs per call
  _idCounter = 0

  const actions: MichelAction[] = [
    ...mouReviews(now),
    ...grantSubmissions(now),
    ...sponsorCalls(now),
    ...channelNegotiations(now),
    ...dealAdvance(now),
    ...strategicIntros(now),
    ...sredDocumentApproval(now),
  ]

  // Sort by priority, then by estimated time (shorter first within same priority)
  return actions.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))
}
