'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpenIcon, ArrowPathIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { HelpTooltip } from '@/components/help-tooltip'

type FlowItem = { label: string; href: string }
type SectionInfo = { name: string; flow: FlowItem[] }

type GuideConfig = {
  title: string
  summary: string
  bestUse: string
  actions: string[]
  related: Array<{ label: string; href: string }>
  glossary: Array<{ term: string; definition: string }>
}

const COMMAND_FLOW: FlowItem[] = [
  { label: 'Today', href: '/today' },
  { label: 'Command Center', href: '/command-center' },
  { label: 'Briefing', href: '/briefing' },
  { label: 'Focus', href: '/focus' },
  { label: 'Portfolio', href: '/portfolio' },
  { label: 'Weekly Review', href: '/weekly-review' },
  { label: 'Autopilot', href: '/autopilot' },
]

const REVENUE_FLOW: FlowItem[] = [
  { label: 'Pipeline', href: '/revenue' },
  { label: 'FAIRCASE Funnel', href: '/revenue/faircase' },
  { label: 'UE Revenue Cockpit', href: '/ue-revenue-cockpit' },
  { label: 'Pilot Export', href: '/pilot/export' },
]

const CAPITAL_FLOW: FlowItem[] = [
  { label: 'Burn & Runway', href: '/capital' },
  { label: 'Runway', href: '/runway' },
  { label: 'Forecast', href: '/forecast' },
  { label: 'Cost Dashboard', href: '/cost' },
  { label: 'Economics', href: '/platform-economics' },
  { label: 'Finance Ops', href: '/business/finance' },
]

const EXECUTION_FLOW: FlowItem[] = [
  { label: 'Initiatives', href: '/execution' },
  { label: 'Operator Mode', href: '/operator' },
  { label: 'Accountability', href: '/accountability' },
  { label: 'Approvals', href: '/business/approvals' },
  { label: 'Decision Scoreback', href: '/decision-scoreback' },
]

const RISK_FLOW: FlowItem[] = [
  { label: 'Risk Register', href: '/risk' },
  { label: 'Ops Score', href: '/ops-score' },
  { label: 'Audit Insights', href: '/audit-insights' },
  { label: 'Trend Detection', href: '/trend-detection' },
]

const GOVERNANCE_FLOW: FlowItem[] = [
  { label: 'Governance', href: '/governance' },
  { label: 'Board Pack', href: '/board' },
  { label: 'Corporate Gov', href: '/business/governance' },
  { label: 'Compliance', href: '/compliance-snapshots' },
  { label: 'Evidence Packs', href: '/evidence-packs' },
  { label: 'Proof Center', href: '/proof-center' },
]

const OPS_FLOW: FlowItem[] = [
  { label: 'System Health', href: '/system-health' },
  { label: 'Ops', href: '/ops' },
  { label: 'Performance', href: '/performance' },
  { label: 'Integrations', href: '/integrations' },
  { label: 'Control Plane', href: '/integrations-control-plane' },
]

const SERVICE_OPS_FLOW: FlowItem[] = [
  { label: 'Ops Dashboard', href: '/itsm/dashboard' },
  { label: 'Support Desk', href: '/itsm/queue' },
  { label: 'Incidents', href: '/itsm/incidents' },
  { label: 'Client Accounts', href: '/itsm/clients' },
  { label: 'Change Log', href: '/itsm/changes' },
]

const ADMIN_FLOW: FlowItem[] = [
  { label: 'Organizations', href: '/orgs' },
  { label: 'Docs', href: '/docs' },
  { label: 'Settings', href: '/settings' },
]

// Maps each route prefix to a section so the drawer label and flow are correct
const SECTION_BY_ROUTE: Array<{ prefix: string; section: SectionInfo }> = [
  // Command
  { prefix: '/ceo', section: { name: 'Command', flow: COMMAND_FLOW } },
  { prefix: '/intelligence', section: { name: 'Command', flow: COMMAND_FLOW } },
  { prefix: '/today', section: { name: 'Command', flow: COMMAND_FLOW } },
  { prefix: '/autopilot', section: { name: 'Command', flow: COMMAND_FLOW } },
  { prefix: '/briefing', section: { name: 'Command', flow: COMMAND_FLOW } },
  { prefix: '/focus', section: { name: 'Command', flow: COMMAND_FLOW } },
  { prefix: '/portfolio', section: { name: 'Command', flow: COMMAND_FLOW } },
  { prefix: '/command-center', section: { name: 'Command', flow: COMMAND_FLOW } },
  { prefix: '/weekly-review', section: { name: 'Command', flow: COMMAND_FLOW } },
  // Revenue — more specific prefixes before shorter ones
  { prefix: '/revenue/faircase', section: { name: 'Revenue', flow: REVENUE_FLOW } },
  { prefix: '/revenue/renewals', section: { name: 'Revenue', flow: REVENUE_FLOW } },
  { prefix: '/revenue/executive', section: { name: 'Revenue', flow: REVENUE_FLOW } },
  { prefix: '/revenue/partnerships', section: { name: 'Revenue', flow: REVENUE_FLOW } },
  { prefix: '/revenue/grants', section: { name: 'Revenue', flow: REVENUE_FLOW } },
  { prefix: '/revenue', section: { name: 'Revenue', flow: REVENUE_FLOW } },
  { prefix: '/ue-revenue-cockpit', section: { name: 'Revenue', flow: REVENUE_FLOW } },
  { prefix: '/pilot/export', section: { name: 'Revenue', flow: REVENUE_FLOW } },
  // Capital
  { prefix: '/capital', section: { name: 'Capital', flow: CAPITAL_FLOW } },
  { prefix: '/runway', section: { name: 'Capital', flow: CAPITAL_FLOW } },
  { prefix: '/forecast', section: { name: 'Capital', flow: CAPITAL_FLOW } },
  { prefix: '/cost', section: { name: 'Capital', flow: CAPITAL_FLOW } },
  { prefix: '/platform-economics', section: { name: 'Capital', flow: CAPITAL_FLOW } },
  { prefix: '/business/finance', section: { name: 'Capital', flow: CAPITAL_FLOW } },
  // Execution
  { prefix: '/execution', section: { name: 'Execution', flow: EXECUTION_FLOW } },
  { prefix: '/accountability', section: { name: 'Execution', flow: EXECUTION_FLOW } },
  { prefix: '/operator', section: { name: 'Execution', flow: EXECUTION_FLOW } },
  { prefix: '/decision-scoreback', section: { name: 'Execution', flow: EXECUTION_FLOW } },
  { prefix: '/business/approvals', section: { name: 'Execution', flow: EXECUTION_FLOW } },
  { prefix: '/business/queues', section: { name: 'Execution', flow: EXECUTION_FLOW } },
  { prefix: '/business/signatures', section: { name: 'Execution', flow: EXECUTION_FLOW } },
  // Risk
  { prefix: '/risk', section: { name: 'Risk', flow: RISK_FLOW } },
  { prefix: '/ops-score', section: { name: 'Risk', flow: RISK_FLOW } },
  { prefix: '/audit-insights', section: { name: 'Risk', flow: RISK_FLOW } },
  { prefix: '/trend-detection', section: { name: 'Risk', flow: RISK_FLOW } },
  // Governance — /business/governance and /business/equity before /business/
  { prefix: '/governance', section: { name: 'Governance', flow: GOVERNANCE_FLOW } },
  { prefix: '/board', section: { name: 'Governance', flow: GOVERNANCE_FLOW } },
  { prefix: '/business/governance', section: { name: 'Governance', flow: GOVERNANCE_FLOW } },
  { prefix: '/business/equity', section: { name: 'Governance', flow: GOVERNANCE_FLOW } },
  { prefix: '/evidence-packs', section: { name: 'Governance', flow: GOVERNANCE_FLOW } },
  { prefix: '/proof-center', section: { name: 'Governance', flow: GOVERNANCE_FLOW } },
  { prefix: '/compliance-snapshots', section: { name: 'Governance', flow: GOVERNANCE_FLOW } },
  // Ops Toolkit — /integrations-control-plane before /integrations
  { prefix: '/system-health', section: { name: 'Ops Toolkit', flow: OPS_FLOW } },
  { prefix: '/ops', section: { name: 'Ops Toolkit', flow: OPS_FLOW } },
  { prefix: '/performance', section: { name: 'Ops Toolkit', flow: OPS_FLOW } },
  { prefix: '/integrations-control-plane', section: { name: 'Ops Toolkit', flow: OPS_FLOW } },
  { prefix: '/integrations', section: { name: 'Ops Toolkit', flow: OPS_FLOW } },
  // Service Operations
  { prefix: '/itsm', section: { name: 'Service Operations', flow: SERVICE_OPS_FLOW } },
  // Admin
  { prefix: '/orgs', section: { name: 'Admin', flow: ADMIN_FLOW } },
  { prefix: '/docs', section: { name: 'Admin', flow: ADMIN_FLOW } },
  { prefix: '/settings', section: { name: 'Admin', flow: ADMIN_FLOW } },
]

function getSectionInfo(pathname: string): SectionInfo | null {
  const match = SECTION_BY_ROUTE.find(
    (item) => pathname === item.prefix || pathname.startsWith(item.prefix + '/'),
  )
  return match?.section ?? null
}

const GUIDE_BY_ROUTE: Array<{ prefix: string; guide: GuideConfig }> = [
  {
    prefix: '/today',
    guide: {
      title: 'Today is the first screen to check each morning',
      summary: 'Use it to spot immediate cash, pipeline, pilot, and approval issues before you drill into deeper analysis.',
      bestUse: 'Read top to bottom in under 2 minutes, then click into the one area that needs intervention now.',
      actions: [
        'Check alerts first; those are the items requiring same-day action.',
        'Use the metric strip to decide whether to open Capital, Revenue, or Approvals next.',
        'Treat Venture Priorities as directional, not as a replacement for the weekly plan.',
      ],
      related: [
        { label: 'Open Weekly Briefing', href: '/briefing' },
        { label: 'Open Focus', href: '/focus' },
      ],
      glossary: [
        { term: 'Runway', definition: 'Estimated months of cash left under the current base-case spend and revenue assumptions.' },
        { term: 'Pipeline', definition: 'Current quote volume and value, used as a rough signal of near-term sales motion.' },
        { term: 'Active pilots', definition: 'Organizations currently in a live pilot phase rather than only in proposal or closed state.' },
        { term: 'Approvals', definition: 'Pending governance or operating decisions that need sign-off before work can proceed.' },
      ],
    },
  },
  {
    prefix: '/command-center',
    guide: {
      title: 'Command Center is the operating snapshot for client, product, and team health',
      summary: 'Use it when you want one page that ties revenue pulse, risk, support load, and founder priorities together.',
      bestUse: 'Open this after Today when the issue is operational rather than purely financial or strategic.',
      actions: [
        'Start with Revenue Pulse to see whether risk is concentrated in renewals, churn, or support load.',
        'Read Smart Alerts next; those are the highest-signal issues already synthesized for you.',
        'Use Team Load and Founder Priorities to decide who should act, not just what is wrong.',
      ],
      related: [
        { label: 'Open Weekly Review', href: '/weekly-review' },
        { label: 'Open ITSM Dashboard', href: '/itsm/dashboard' },
      ],
      glossary: [
        { term: 'ARR proxy', definition: 'A rough annualized revenue view built from contract values, useful for directional monitoring rather than formal finance reporting.' },
        { term: 'MRR proxy', definition: 'A rough monthly recurring revenue estimate derived from the same contract values.' },
        { term: 'Renewals 90d', definition: 'Clients with renewal dates inside the next 90 days; this is your near-term retention watchlist.' },
        { term: 'Support load', definition: 'Open support demand carried by a product or team, often used as a proxy for operational drag.' },
      ],
    },
  },
  {
    prefix: '/briefing',
    guide: {
      title: 'Briefing is the weekly decision memo',
      summary: 'Use it to prepare for the week, align with leadership, and convert observations into explicit approved decisions.',
      bestUse: 'Read this at the start of the week or before any founder or executive planning session.',
      actions: [
        'Scan Executive Summary, then compare What Improved vs What Worsened.',
        'Approve only the decision candidates that clearly change execution this week.',
        'Use the intelligence radar to see whether ranking changes support or challenge your instincts.',
      ],
      related: [
        { label: 'Open Execution', href: '/execution' },
        { label: 'Open Decision Scoreback', href: '/decision-scoreback' },
      ],
      glossary: [
        { term: 'Decision candidate', definition: 'A proposed decision generated from current business signals that should be either approved, deferred, or rejected.' },
        { term: 'Ranking shift', definition: 'A change in venture or recommendation priority relative to previous snapshots.' },
        { term: 'Founder-action deals', definition: 'Quotes or deals that likely need direct founder involvement to move forward.' },
      ],
    },
  },
  {
    prefix: '/focus',
    guide: {
      title: 'Focus translates priorities into founder time allocation',
      summary: 'Use it to decide where founder hours should go this week and to spot admin drag or context-switch tax.',
      bestUse: 'Check it after Briefing whenever you know what matters but need to decide how to spend time.',
      actions: [
        'Compare weekly targets with logged hours before adding more work.',
        'Treat admin drag and deep-work score as constraint signals, not vanity metrics.',
        'Use the recommendation cut-line to avoid overcommitting the week.',
      ],
      related: [
        { label: 'Open Today', href: '/today' },
        { label: 'Open Weekly Review', href: '/weekly-review' },
      ],
      glossary: [
        { term: 'Admin drag', definition: 'The share of founder time spent on low-leverage administrative work.' },
        { term: 'Context-switch tax', definition: 'The cost of splitting attention across too many ventures or task categories.' },
        { term: 'Cut-line', definition: 'The boundary between the work that fits in this week and the work that should wait.' },
      ],
    },
  },
  {
    prefix: '/portfolio',
    guide: {
      title: 'Portfolio ranks ventures by current strategic and operating priority',
      summary: 'Use it to decide where capital, founder time, and build energy should go across the venture set.',
      bestUse: 'Review weekly for allocation decisions and monthly for broader venture strategy updates.',
      actions: [
        'Read directives first; they tell you whether to sell, build, maintain, or hold.',
        'Use capital priority score to compare ventures on a common basis.',
        'Open details only for the ventures at the top and bottom of the list; that is where decisions matter most.',
      ],
      related: [
        { label: 'Open Command Center', href: '/command-center' },
        { label: 'Open Weekly Review', href: '/weekly-review' },
      ],
      glossary: [
        { term: 'Directive', definition: 'The current operating instruction for a venture, such as sell now, build next, or hold.' },
        { term: 'Code presence', definition: 'How much implementation depth exists for the venture today.' },
        { term: 'Evidence status', definition: 'How much proof exists that the venture works in the real world or is commercially ready.' },
      ],
    },
  },
  {
    prefix: '/weekly-review',
    guide: {
      title: 'Weekly Review is the cadence screen for daily, weekly, and monthly operating rhythm',
      summary: 'Use it to review the same operating questions at three time horizons without rebuilding context each time.',
      bestUse: 'Switch tabs based on cadence: daily for immediate action, weekly for leadership review, monthly for board-style synthesis.',
      actions: [
        'Use Daily Ops for same-day interventions and blockers.',
        'Use Weekly Exec for decisions, churn watch, and product reliability review.',
        'Use Monthly Board when you need summary language for partners or formal review meetings.',
      ],
      related: [
        { label: 'Open Briefing', href: '/briefing' },
        { label: 'Open Board Pack', href: '/board' },
      ],
      glossary: [
        { term: 'Decision queue', definition: 'The current set of synthesized executive decisions that should be resolved in the present cadence window.' },
        { term: 'Churn risk watch', definition: 'Accounts likely to be lost unless specific intervention happens soon.' },
        { term: 'Roadmap delivery signals', definition: 'A compact read on whether product teams are shipping, slipping, or accumulating quality risk.' },
      ],
    },
  },
  {
    prefix: '/autopilot',
    guide: {
      title: 'Autopilot proposes high-confidence actions you can approve quickly',
      summary: 'Use it when you want the system to suggest next actions, but still want a human approval gate before execution is tracked.',
      bestUse: 'Review the cards when you want leverage, then approve only the actions with clear upside and ownership.',
      actions: [
        'Read rationale and upside before clicking approve; do not approve based on confidence alone.',
        'Treat urgency as triage, not as proof of quality.',
        'After approval, check Execution and Decision Scoreback to make sure the action is actually moving.',
      ],
      related: [
        { label: 'Open Execution', href: '/execution' },
        { label: 'Open Decision Scoreback', href: '/decision-scoreback' },
      ],
      glossary: [
        { term: 'Confidence', definition: 'How strongly the recommendation engine believes the action is directionally correct given available data.' },
        { term: 'Expected upside', definition: 'The outcome the system expects if the action is completed successfully.' },
        { term: 'Data freshness', definition: 'A rough signal of how current the underlying data sources are for the recommendation set.' },
      ],
    },
  },
  {
    prefix: '/intelligence',
    guide: {
      title: 'Intelligence is the broadest strategic research surface in Command',
      summary: 'Use it for cross-domain synthesis across funding, deals, partners, products, risks, and founder actions.',
      bestUse: 'Come here when Today or Command Center show something important and you need richer context before acting.',
      actions: [
        'Use the tabs to narrow the question rather than trying to read the whole page at once.',
        'Look at Insights and Decisions before drilling into raw funding, partner, or product lists.',
        'Treat this page as context generation, then hand off execution to Briefing, Focus, or Execution.',
      ],
      related: [
        { label: 'Open Briefing', href: '/briefing' },
        { label: 'Open Today', href: '/today' },
      ],
      glossary: [
        { term: 'Insights', definition: 'Synthesized strategic observations generated from multiple signals rather than a single metric.' },
        { term: 'Michel actions', definition: 'Named founder actions surfaced by the intelligence system as next moves.' },
        { term: 'Data source health', definition: 'A signal for whether the input systems feeding intelligence are current and trustworthy.' },
      ],
    },
  },
  {
    prefix: '/ceo',
    guide: {
      title: 'CEO One-Screen is the compressed boardroom view',
      summary: 'Use it when you need a highly compressed summary for yourself or when presenting the state of the business.',
      bestUse: 'Best for presentation, weekly founder review, and partner or investor conversations where detail should stay hidden until requested.',
      actions: [
        'Use it to orient the conversation, then drill into Today, Briefing, or Portfolio for proof.',
        'Do not treat it as the operational workspace for detailed follow-through.',
        'Pair it with executive mode when you want a cleaner read-only presentation view.',
      ],
      related: [
        { label: 'Open Today', href: '/today' },
        { label: 'Open Portfolio', href: '/portfolio' },
      ],
      glossary: [
        { term: 'Boardroom view', definition: 'A compressed summary view optimized for reading and presenting, not for detailed task interaction.' },
      ],
    },
  },
  // ── REVENUE ────────────────────────────────────────────────────────────────
  {
    prefix: '/revenue/faircase',
    guide: {
      title: 'FAIRCASE Funnel maps the full selling cycle from lead to close',
      summary: 'Every stage from Lead through Meeting, Demo, Proposal, Pilot, and Close with conversion rates and deal size data.',
      bestUse: 'Use during weekly revenue review or when a conversion rate drop needs diagnosis.',
      actions: [
        'Identify the stage with the highest drop-off and focus sales energy there first.',
        'Compare the deal register against funnel capacity to spot over-reliance on a few large deals.',
        'Use CAC estimates to prioritize prospects with the highest close probability and lowest cost to win.',
      ],
      related: [
        { label: 'Revenue Pipeline', href: '/revenue' },
        { label: 'Pilot Export', href: '/pilot/export' },
      ],
      glossary: [
        { term: 'Funnel Stage', definition: 'One of the sequential selling phases: Lead, Meeting, Demo, Proposal, Pilot, Close.' },
        { term: 'Conversion Rate', definition: 'The percentage of prospects moving from one stage to the next.' },
        { term: 'CAC', definition: 'Customer Acquisition Cost — the total spend required to win one new paying client.' },
        { term: 'Deal Register', definition: 'The complete list of identified opportunities with stage, value, and contact information.' },
      ],
    },
  },
  {
    prefix: '/revenue/renewals',
    guide: {
      title: 'Renewals is the CS account health and retention surface',
      summary: 'Upcoming renewals, account health scores, expansion candidates, and churn risk accounts in one view.',
      bestUse: 'Open weekly to prioritize proactive outreach and monthly to prepare renewal conversations.',
      actions: [
        'Sort by days-until-renewal and engage at-risk accounts at least 60 days before the date.',
        'Use expansion candidates as the upsell shortlist for the current quarter.',
        'Treat quiet-touch accounts as higher-risk than accounts with recent complaints — silence signals disengagement.',
      ],
      related: [
        { label: 'Revenue Pipeline', href: '/revenue' },
        { label: 'Client Accounts', href: '/itsm/clients' },
      ],
      glossary: [
        { term: 'Renewal Window', definition: 'The 90-day period before a contract expires during which renewal conversations should be active.' },
        { term: 'Quiet-Touch Risk', definition: 'A health signal for accounts where the sponsor has not been contacted recently — often an early churn indicator.' },
        { term: 'Expansion Candidate', definition: 'An account showing usage breadth or satisfaction signals that suggest readiness to grow their contract.' },
        { term: 'Churn Risk', definition: 'An account with health, usage, or engagement signals suggesting they may not renew.' },
      ],
    },
  },
  {
    prefix: '/revenue/executive',
    guide: {
      title: 'Executive RevOps is the AI-powered commercial intelligence surface',
      summary: 'The RevOps agent synthesizes commerce opportunities, pipeline velocity, and growth signals into actionable executive insights.',
      bestUse: 'Use when you need a cross-account commercial read rather than drilling into a single opportunity.',
      actions: [
        'Run the agent after updating deal stages to get fresh synthesis.',
        'Read insights before pipeline meetings so you enter with a pre-formed view.',
        'Use opportunity data to validate or challenge the sales team\'s pipeline estimate.',
      ],
      related: [
        { label: 'Revenue Pipeline', href: '/revenue' },
        { label: 'Renewals', href: '/revenue/renewals' },
      ],
      glossary: [
        { term: 'Commerce Opportunity', definition: 'A tracked deal or expansion signal in the commercial pipeline with stage, value, and probability.' },
        { term: 'Deal Velocity', definition: 'How quickly opportunities are progressing through pipeline stages on average.' },
        { term: 'RevOps Agent', definition: 'An AI agent that synthesizes commercial data into revenue operations insights.' },
      ],
    },
  },
  {
    prefix: '/revenue/partnerships',
    guide: {
      title: 'Partnerships tracks partner deals and commission pipeline',
      summary: 'Partner-sourced deals, commission status, and co-sell opportunities organized by partner and stage.',
      bestUse: 'Use during partner review meetings or when evaluating whether partner channels are contributing to pipeline.',
      actions: [
        'Compare partner-sourced pipeline against direct pipeline to measure channel effectiveness.',
        'Ensure commission records are updated when deals close to avoid partner relationship friction.',
        'Identify top-performing partners for deeper investment and co-marketing.',
      ],
      related: [
        { label: 'Revenue Pipeline', href: '/revenue' },
        { label: 'Executive RevOps', href: '/revenue/executive' },
      ],
      glossary: [
        { term: 'Partner Deal', definition: 'An opportunity sourced, co-sold, or referred by a registered partner.' },
        { term: 'Commission', definition: 'The agreed payment to a partner when a deal they influenced closes.' },
        { term: 'Co-sell', definition: 'A selling motion where Nzila and a partner jointly pursue a prospect together.' },
      ],
    },
  },
  {
    prefix: '/revenue/grants',
    guide: {
      title: 'Grants manages the non-dilutive funding pipeline',
      summary: 'Grant applications, stage tracking, award status, and reporting obligations in one place.',
      bestUse: 'Use when evaluating new grant opportunities or managing active drawdown and reporting obligations.',
      actions: [
        'Track application deadlines and set alerts at least 14 days before they close.',
        'Update drawdown status promptly after funding is received to keep runway calculations accurate.',
        'Review missed applications to understand whether capacity or prioritization caused the gap.',
      ],
      related: [
        { label: 'Burn & Runway', href: '/capital' },
        { label: 'Evidence Packs', href: '/evidence-packs' },
      ],
      glossary: [
        { term: 'Grant Stage', definition: 'The current status of a grant: prospecting, drafting, submitted, awarded, reporting, or missed.' },
        { term: 'Drawdown', definition: 'The process of claiming awarded grant funds in installments based on milestone completion.' },
        { term: 'Reporting Obligation', definition: 'A required progress update submitted to the funder to maintain compliance with grant terms.' },
      ],
    },
  },
  {
    prefix: '/revenue',
    guide: {
      title: 'Pipeline is the sales command center across all ventures',
      summary: 'Active quotes, pilots, and revenue events across the portfolio with venture-specific playbooks.',
      bestUse: 'Check here when Today flags a revenue gap or pipeline stall, or before any commercial planning session.',
      actions: [
        'Review open quotes by venture to see where sales motion is active vs stalled.',
        'Track active pilots separately from prospect pilots — active pilots are your near-term revenue.',
        'Work the Revenue Playbooks section for venture-specific closing tactics.',
      ],
      related: [
        { label: 'FAIRCASE Funnel', href: '/revenue/faircase' },
        { label: 'UE Revenue Cockpit', href: '/ue-revenue-cockpit' },
      ],
      glossary: [
        { term: 'Open Quote', definition: 'A commercial proposal sent to a prospect that is awaiting acceptance or rejection.' },
        { term: 'Active Pilot', definition: 'An organization currently in a paying or formally scoped trial phase.' },
        { term: 'Revenue Event', definition: 'Any billable transaction or commercial milestone captured in the system.' },
        { term: 'Revenue Playbook', definition: 'A venture-specific set of selling tactics and next actions recommended for moving deals forward.' },
      ],
    },
  },
  {
    prefix: '/ue-revenue-cockpit',
    guide: {
      title: 'UE Revenue Cockpit tracks Union Eyes commercial momentum',
      summary: 'Commerce opportunities, deal velocity, and growth signals for the UnionEyes venture.',
      bestUse: 'Use when Union Eyes is the priority venture or when renewal and expansion conversations are active.',
      actions: [
        'Review active opportunities by stage to confirm the pipeline is healthy.',
        'Check growth signals for expansion hints before renewal calls.',
        'Compare renewal pipeline against churn risk accounts to set the right cadence of outreach.',
      ],
      related: [
        { label: 'Revenue Pipeline', href: '/revenue' },
        { label: 'Renewals', href: '/revenue/renewals' },
      ],
      glossary: [
        { term: 'Commerce Opportunity', definition: 'A tracked deal or expansion signal in the Union Eyes pipeline.' },
        { term: 'Deal Velocity', definition: 'How fast opportunities are progressing through stages on average.' },
        { term: 'Expansion Signal', definition: 'Behavioral data suggesting an existing client is ready to grow their contract.' },
      ],
    },
  },
  {
    prefix: '/pilot/export',
    guide: {
      title: 'Pilot Export creates structured data packages for reporting',
      summary: 'Download active and historical pilot data for cross-venture analysis, investor reporting, or board packs.',
      bestUse: 'Use before investor updates, board packs, or when compiling commercial traction evidence.',
      actions: [
        'Choose the date range that matches the exact reporting period before exporting.',
        'Export all ventures for portfolio totals, or filter by venture for single-product summaries.',
        'Include the export in evidence packs when commercial proof is needed for due diligence.',
      ],
      related: [
        { label: 'Revenue Pipeline', href: '/revenue' },
        { label: 'Board Pack', href: '/board' },
      ],
      glossary: [
        { term: 'Pilot Export', definition: 'A structured download of active and historical pilot data.' },
        { term: 'Reporting Period', definition: 'The date range scoped for the data extract.' },
        { term: 'Commercial Traction', definition: 'Evidence that real organizations have paid for or formally trialled the product.' },
      ],
    },
  },
  // ── CAPITAL ────────────────────────────────────────────────────────────────
  {
    prefix: '/capital',
    guide: {
      title: 'Burn & Runway is the cash position control room',
      summary: 'Current burn rate, cash position, and months of runway under the current model.',
      bestUse: 'Check daily if runway is under 6 months. Weekly otherwise. Always before any material spend decision.',
      actions: [
        'Compare actuals against target burn before concluding runway has changed.',
        'Identify which venture is driving the largest spend increase this month.',
        'Use the runway projection to decide whether fundraising urgency has changed since last week.',
      ],
      related: [
        { label: 'Runway Detail', href: '/runway' },
        { label: 'Forecast', href: '/forecast' },
      ],
      glossary: [
        { term: 'Burn Rate', definition: 'Monthly cash outflow across all operating expenses.' },
        { term: 'Runway', definition: 'Estimated months of cash remaining at the current burn rate.' },
        { term: 'Cash Position', definition: 'Current available cash across all accounts.' },
        { term: 'Target Burn', definition: 'The planned monthly spend level agreed in the operating budget.' },
      ],
    },
  },
  {
    prefix: '/runway',
    guide: {
      title: 'Runway breaks down months remaining by venture',
      summary: 'Per-venture operating capital, funding milestone tracking, and capital allocation view.',
      bestUse: 'Use when allocating capital across ventures or when comparing spending efficiency.',
      actions: [
        'Find the venture with the shortest runway first — that is the most time-sensitive constraint.',
        'Check milestone dependencies that could extend runway before the next raise.',
        'Use the comparison view to decide whether capital reallocation between ventures is warranted.',
      ],
      related: [
        { label: 'Burn & Runway', href: '/capital' },
        { label: 'Forecast', href: '/forecast' },
      ],
      glossary: [
        { term: 'Venture Runway', definition: 'The estimated operating life of one specific venture given its current spend and revenue.' },
        { term: 'Milestone Dependency', definition: 'A funding trigger conditional on specific product or sales achievements.' },
        { term: 'Capital Allocation', definition: 'How available cash is distributed across ventures.' },
      ],
    },
  },
  {
    prefix: '/forecast',
    guide: {
      title: 'Forecast models future cash based on current trajectories',
      summary: 'Projection scenarios for revenue growth, burn reduction, and fundraising impact.',
      bestUse: 'Use when preparing for fundraising conversations or evaluating trade-offs in spend vs growth speed.',
      actions: [
        'Review the base case first, then stress-test with the downside scenario.',
        'Use the bridge analysis to find the smallest intervention that gets you to the next milestone.',
        'Update assumptions quarterly or whenever a material input changes.',
      ],
      related: [
        { label: 'Burn & Runway', href: '/capital' },
        { label: 'Cost Dashboard', href: '/cost' },
      ],
      glossary: [
        { term: 'Base Case', definition: 'The forecast assuming current trends continue unchanged.' },
        { term: 'Downside Scenario', definition: 'A projection assuming the top 2–3 risks materialize.' },
        { term: 'Bridge', definition: 'The cash or revenue gap between current trajectory and the next funding milestone.' },
      ],
    },
  },
  {
    prefix: '/cost',
    guide: {
      title: 'Cost Dashboard shows where cloud and infrastructure spend is going',
      summary: 'Real-time cost breakdown by service, environment, and venture with anomaly alerts.',
      bestUse: 'Check when infrastructure bills feel elevated or before any quarterly budget review.',
      actions: [
        'Identify the top three spend categories before investigating further.',
        'Compare dev vs prod environment costs — dev should not approach prod spending.',
        'Review anomaly alerts before dismissing them; spikes usually have a traceable cause.',
      ],
      related: [
        { label: 'Burn & Runway', href: '/capital' },
        { label: 'Platform Economics', href: '/platform-economics' },
      ],
      glossary: [
        { term: 'Environment Cost', definition: 'Spend attributed to development, staging, or production infrastructure.' },
        { term: 'Cost Anomaly', definition: 'A spend spike that deviates significantly from the rolling average.' },
        { term: 'Cost Allocation', definition: 'The mapping of shared infrastructure costs to individual ventures or teams.' },
      ],
    },
  },
  {
    prefix: '/platform-economics',
    guide: {
      title: 'Platform Economics shows how shared infrastructure costs are allocated',
      summary: 'Unit economics of the shared Nzila platform, broken down by venture usage and contribution.',
      bestUse: 'Use when evaluating which ventures are subsidizing others or when updating internal cost models.',
      actions: [
        'Compare per-venture platform contribution against actual usage.',
        'Identify which ventures have poor unit economics before the next pricing review.',
        'Use this data to update internal chargebacks or cross-venture cost sharing agreements.',
      ],
      related: [
        { label: 'Cost Dashboard', href: '/cost' },
        { label: 'Burn & Runway', href: '/capital' },
      ],
      glossary: [
        { term: 'Platform Contribution', definition: 'The revenue or cost offset a venture provides to justify its platform usage.' },
        { term: 'Unit Economics', definition: 'Revenue minus direct cost per customer or transaction.' },
        { term: 'Internal Chargeback', definition: 'An allocation of shared costs to the consuming venture or team.' },
      ],
    },
  },
  {
    prefix: '/business/finance',
    guide: {
      title: 'Finance Ops manages invoicing, transactions, and financial records',
      summary: 'Invoicing status, payment tracking, and accounts receivable for monthly close.',
      bestUse: 'Use when clients are overdue, invoices need issuing, or when preparing the monthly close.',
      actions: [
        'Review overdue receivables first — they directly affect cash position.',
        'Check outstanding invoices against the cash forecast before making spend decisions.',
        'Ensure payments received match expected contract values and flag discrepancies immediately.',
      ],
      related: [
        { label: 'Burn & Runway', href: '/capital' },
        { label: 'Approvals', href: '/business/approvals' },
      ],
      glossary: [
        { term: 'Accounts Receivable', definition: 'Money owed to Nzila from clients under active contracts.' },
        { term: 'Invoice Status', definition: 'Whether a bill has been sent, is overdue, or has been paid.' },
        { term: 'Monthly Close', definition: 'The process of reconciling financial records at the end of each month.' },
      ],
    },
  },
  // ── EXECUTION ──────────────────────────────────────────────────────────────
  {
    prefix: '/execution',
    guide: {
      title: 'Initiatives is the strategic execution tracker',
      summary: 'Every active initiative with an owner, deadline, and current progress status.',
      bestUse: 'Open at the start of each week to see what should be moving and what has stalled.',
      actions: [
        'Sort by deadline to find the most time-sensitive items first.',
        'Filter by venture when you need to focus on one priority area.',
        'Use blockers as the agenda for the next leadership sync — resolve before the meeting, not during it.',
      ],
      related: [
        { label: 'Accountability', href: '/accountability' },
        { label: 'Briefing', href: '/briefing' },
      ],
      glossary: [
        { term: 'Initiative', definition: 'A bounded project with a named owner and explicit completion criteria.' },
        { term: 'Blocker', definition: 'An unresolved dependency or decision preventing forward progress.' },
        { term: 'Owner', definition: 'The single person accountable for initiative completion — not just a contributor.' },
      ],
    },
  },
  {
    prefix: '/accountability',
    guide: {
      title: 'Accountability tracks OKR progress and commitment delivery',
      summary: 'Quantified targets, progress check-ins, and overdue commitments for the leadership team.',
      bestUse: 'Use weekly to review check-ins and monthly to assess OKR attainment.',
      actions: [
        'Flag any overdue check-ins before the leadership meeting so they cannot be glossed over.',
        'Compare actual progress against the trajectory needed to hit the target by deadline.',
        'Escalate missed commitments rather than letting them roll over silently.',
      ],
      related: [
        { label: 'Initiatives', href: '/execution' },
        { label: 'Decision Scoreback', href: '/decision-scoreback' },
      ],
      glossary: [
        { term: 'OKR', definition: 'Objective and Key Result — a goal paired with a measurable outcome.' },
        { term: 'Check-in', definition: 'A periodic progress update against a committed target.' },
        { term: 'Commitment', definition: 'A specific deliverable a person or team has agreed to produce by a specific date.' },
      ],
    },
  },
  {
    prefix: '/operator',
    guide: {
      title: 'Operator Mode is the tactical coordination layer',
      summary: 'Real-time task prioritization, team status, and same-week execution coordination.',
      bestUse: 'Use during sprint planning, daily standups, or when a blocker requires cross-team coordination.',
      actions: [
        'Scan the priority list and confirm it matches actual team capacity before adding more work.',
        'Use status flags to identify who is blocked and unblock them before the team sync.',
        'Resolve blockers before the team meeting so the meeting can focus on decisions, not status.',
      ],
      related: [
        { label: 'Initiatives', href: '/execution' },
        { label: 'Queues', href: '/business/queues' },
      ],
      glossary: [
        { term: 'Operator Priority', definition: 'A task with a short-horizon completion timeline, usually within the current week.' },
        { term: 'Capacity', definition: 'The actual hours or focus available on the team after meetings and context-switch overhead.' },
        { term: 'Cross-team Dependency', definition: 'A task or decision that requires input or action from more than one team.' },
      ],
    },
  },
  {
    prefix: '/decision-scoreback',
    guide: {
      title: 'Decision Scoreback is the outcome tracker for past leadership decisions',
      summary: 'Decisions made, time elapsed, and whether outcomes matched the reasoning at the time.',
      bestUse: 'Review monthly or whenever you want to calibrate the quality of strategic judgment.',
      actions: [
        'Compare decision confidence at the time against actual outcomes.',
        'Identify whether poor outcomes came from bad decisions or bad execution — they require different responses.',
        'Use patterns to improve future decision rationale, not to assign blame retroactively.',
      ],
      related: [
        { label: 'Briefing', href: '/briefing' },
        { label: 'Accountability', href: '/accountability' },
      ],
      glossary: [
        { term: 'Decision Confidence', definition: 'How certain the decision-maker was at the time the decision was made.' },
        { term: 'Outcome Quality', definition: 'Whether the decision produced the expected result.' },
        { term: 'Judgment Calibration', definition: 'The practice of improving decision accuracy by studying historical hits and misses.' },
      ],
    },
  },
  {
    prefix: '/business/approvals',
    guide: {
      title: 'Approvals is the governance gate for spend and commitment decisions',
      summary: 'Pending approvals, recent sign-offs, and escalation paths for business commitments.',
      bestUse: 'Check daily — delays in approvals directly stall execution and signal decision avoidance.',
      actions: [
        'Process the oldest pending approvals first to clear the deepest bottlenecks.',
        'Delegate approvals that are clearly below your decision threshold.',
        'Flag ambiguous approvals for a quick verbal clarification rather than leaving them pending.',
      ],
      related: [
        { label: 'Signatures', href: '/business/signatures' },
        { label: 'Initiatives', href: '/execution' },
      ],
      glossary: [
        { term: 'Approval Threshold', definition: 'The spend or commitment level that requires a specific approver.' },
        { term: 'Delegation', definition: 'Assigning approval authority to another person within defined limits.' },
        { term: 'Escalation', definition: 'Routing an approval to a higher authority when the normal approver is unavailable or the decision exceeds their scope.' },
      ],
    },
  },
  {
    prefix: '/business/queues',
    guide: {
      title: 'Queues manages work backlog and task prioritization',
      summary: 'Pending tasks organized by priority, assignee, and venture with aging metrics.',
      bestUse: 'Use to identify backlog pile-up, reassign overloaded team members, or prepare for sprint planning.',
      actions: [
        'Review tasks aging beyond the expected resolution window before adding new work.',
        'Look for clusters of work sitting with one person as a concentration risk signal.',
        'Confirm the backlog order matches current business priorities before the next planning session.',
      ],
      related: [
        { label: 'Operator Mode', href: '/operator' },
        { label: 'Approvals', href: '/business/approvals' },
      ],
      glossary: [
        { term: 'Queue Aging', definition: 'How long a task has been waiting since it was created or last updated.' },
        { term: 'Backlog', definition: 'All tasks that are pending but not yet in active progress.' },
        { term: 'Priority Flag', definition: 'A tag indicating whether a task should be addressed immediately, this week, or in the next cycle.' },
      ],
    },
  },
  {
    prefix: '/business/signatures',
    guide: {
      title: 'Signatures tracks documents awaiting digital sign-off',
      summary: 'Contracts, agreements, and authorizations pending signature from internal or external parties.',
      bestUse: 'Check before sending payment, starting contracted work, or when commitments feel uncertain.',
      actions: [
        'Identify overdue signature requests and follow up directly — do not wait for the system to escalate.',
        'Never start work on a contract that is not fully countersigned.',
        'Use the signature trail as audit evidence if a commitment is ever disputed.',
      ],
      related: [
        { label: 'Approvals', href: '/business/approvals' },
        { label: 'Evidence Packs', href: '/evidence-packs' },
      ],
      glossary: [
        { term: 'Signature Request', definition: 'A document sent to a specific person or organization for formal sign-off.' },
        { term: 'Countersignature', definition: 'A second signature required to make an agreement binding.' },
        { term: 'Audit Trail', definition: 'The timestamped record of who signed what and when.' },
      ],
    },
  },
  // ── RISK ───────────────────────────────────────────────────────────────────
  {
    prefix: '/risk',
    guide: {
      title: 'Risk Register is the central inventory of business threats',
      summary: 'Every identified risk across business, technical, financial, and operational domains with owner and mitigation plan.',
      bestUse: 'Review weekly in Command Center, monthly in full detail, and always before major decisions or fundraising.',
      actions: [
        'Update likelihood and impact scores when material circumstances change.',
        'Assign every high-severity risk to a named owner — unowned risks do not get mitigated.',
        'Treat the mitigation plan as a live document, not a static checklist created at setup.',
      ],
      related: [
        { label: 'Ops Score', href: '/ops-score' },
        { label: 'Audit Insights', href: '/audit-insights' },
      ],
      glossary: [
        { term: 'Risk Severity', definition: 'The combined score of likelihood and impact used to prioritize mitigation effort.' },
        { term: 'Mitigation Plan', definition: 'The specific actions designed to reduce the probability or impact of a risk.' },
        { term: 'Residual Risk', definition: 'The remaining exposure after mitigation actions have been applied.' },
      ],
    },
  },
  {
    prefix: '/ops-score',
    guide: {
      title: 'Ops Score measures the reliability and health of the operating platform',
      summary: 'Composite score from uptime, incident rate, SLA adherence, and deployment reliability.',
      bestUse: 'Check after any incident or deployment, and include it in the weekly operating review.',
      actions: [
        'Investigate any score drop above 5% before the next deployment.',
        'Correlate score movements with specific incidents or change events in the Change Log.',
        'Use the trend line to see whether platform quality is improving or degrading over time.',
      ],
      related: [
        { label: 'Risk Register', href: '/risk' },
        { label: 'System Health', href: '/system-health' },
      ],
      glossary: [
        { term: 'SLA Adherence', definition: 'The percentage of time a service meets its contracted availability or performance target.' },
        { term: 'Incident Rate', definition: 'The frequency of platform failures or degraded-service events in a given period.' },
        { term: 'Deployment Reliability', definition: 'The percentage of deployments that complete without causing an incident or rollback.' },
      ],
    },
  },
  {
    prefix: '/audit-insights',
    guide: {
      title: 'Audit Insights surfaces compliance gaps and control findings',
      summary: 'Active audit findings, control gaps, and remediation tracking across the operating platform.',
      bestUse: 'Use when preparing for external audits, regulatory reviews, or when governance asks for compliance status.',
      actions: [
        'Resolve all high-severity findings before external deadlines — do not let them accumulate.',
        'Assign a named owner and due date to every open finding.',
        'Treat recurring findings as systemic problems that require process fixes, not one-time patches.',
      ],
      related: [
        { label: 'Risk Register', href: '/risk' },
        { label: 'Compliance', href: '/compliance-snapshots' },
      ],
      glossary: [
        { term: 'Audit Finding', definition: 'A specific observation from an internal or external review that requires corrective action.' },
        { term: 'Control Gap', definition: 'A missing or insufficient internal control that increases risk exposure.' },
        { term: 'Remediation', definition: 'The specific corrective action taken to close a finding or control gap.' },
      ],
    },
  },
  {
    prefix: '/trend-detection',
    guide: {
      title: 'Trend Detection uses AI to flag anomalies across portfolio metrics',
      summary: 'Automatically detected shifts in revenue, cost, usage, and operational patterns that are statistically unusual.',
      bestUse: 'Check when Today or Command Center show a metric that looks off but does not have an obvious single cause.',
      actions: [
        'Investigate alerts with the highest confidence scores first.',
        'Check whether a detected trend is confirmed by more than one data source before acting.',
        'Use trend signals to update forecasts and risk assessments before they become formal problems.',
      ],
      related: [
        { label: 'Risk Register', href: '/risk' },
        { label: 'Intelligence', href: '/intelligence' },
      ],
      glossary: [
        { term: 'Anomaly Confidence', definition: 'How strongly the system believes the detected pattern is a real signal rather than noise.' },
        { term: 'Trend Window', definition: 'The time period over which the system is analyzing for directional change.' },
        { term: 'Leading Indicator', definition: 'A metric that tends to change before a business outcome changes, used for early warning.' },
      ],
    },
  },
  // ── GOVERNANCE ─────────────────────────────────────────────────────────────
  {
    prefix: '/governance',
    guide: {
      title: 'Governance is the policy and compliance framework hub',
      summary: 'Policies, standards, and compliance documentation organized by domain.',
      bestUse: 'Use when establishing new policies, onboarding vendors, or responding to due diligence requests.',
      actions: [
        'Keep every policy document dated and versioned so reviewers can confirm currency.',
        'Assign policy ownership so updates are managed proactively, not reactively.',
        'Cross-reference policies in Evidence Packs when providing compliance proof to third parties.',
      ],
      related: [
        { label: 'Compliance', href: '/compliance-snapshots' },
        { label: 'Evidence Packs', href: '/evidence-packs' },
      ],
      glossary: [
        { term: 'Policy', definition: 'A written rule that guides how decisions and actions should be taken across the organization.' },
        { term: 'Standard', definition: 'A specific technical or operational requirement derived from a higher-level policy.' },
        { term: 'Due Diligence', definition: 'A systematic review of business practices, usually by an investor, acquirer, or regulator.' },
      ],
    },
  },
  {
    prefix: '/board',
    guide: {
      title: 'Board Pack assembles the monthly executive reporting package',
      summary: 'Key metrics, decisions made, strategic updates, and risks for board or investor review.',
      bestUse: 'Compile at the end of each month or before any formal governance meeting.',
      actions: [
        'Fill the metrics section from real data before adding qualitative commentary.',
        'Ensure the decisions section is accurate — do not inflate completed decisions.',
        'Include uncomfortable risk updates; governors who receive sanitized packs make worse decisions.',
      ],
      related: [
        { label: 'Governance', href: '/governance' },
        { label: 'Weekly Briefing', href: '/briefing' },
      ],
      glossary: [
        { term: 'Board Pack', definition: 'The structured document package sent to directors before each governance meeting.' },
        { term: 'Executive Summary', definition: 'The condensed version governors should read before diving into supporting sections.' },
        { term: 'Resolution', definition: 'A formal decision recorded as an official corporate act.' },
      ],
    },
  },
  {
    prefix: '/business/governance',
    guide: {
      title: 'Corporate Governance manages board structure and meeting records',
      summary: 'Director information, meeting minutes, resolutions, and governance calendar.',
      bestUse: 'Use when scheduling board meetings, documenting resolutions, or preparing director materials.',
      actions: [
        'Record resolutions immediately after meetings to prevent ambiguity about what was decided.',
        'Maintain a current director register — outdated registers create legal and filing problems.',
        'Ensure minutes are formally approved at the subsequent meeting.',
      ],
      related: [
        { label: 'Board Pack', href: '/board' },
        { label: 'Compliance', href: '/compliance-snapshots' },
      ],
      glossary: [
        { term: 'Resolution', definition: 'A formal decision recorded as an official corporate act at a board meeting.' },
        { term: 'Director Register', definition: 'The official list of current and past directors with appointment and resignation dates.' },
        { term: 'Minutes', definition: 'The official record of what was discussed and decided at a formal governance meeting.' },
      ],
    },
  },
  {
    prefix: '/business/equity',
    guide: {
      title: 'Equity & Cap Table tracks share ownership across all ventures',
      summary: 'Who owns what, option pools, vesting schedules, and dilution impact of future raises.',
      bestUse: 'Use before any equity grant, new investor round, or when a team member asks about their stake.',
      actions: [
        'Update the cap table within 24 hours of any new equity issuance.',
        'Model dilution before agreeing to new investor terms so you understand the impact.',
        'Treat the option pool as a committed obligation even before options vest.',
      ],
      related: [
        { label: 'Corporate Gov', href: '/business/governance' },
        { label: 'Board Pack', href: '/board' },
      ],
      glossary: [
        { term: 'Cap Table', definition: 'Capitalization table — the complete register of equity ownership including shares, options, and convertibles.' },
        { term: 'Dilution', definition: 'The reduction in each shareholder\'s percentage caused by new share issuance.' },
        { term: 'Option Pool', definition: 'A reserve of shares set aside for employee equity grants.' },
        { term: 'Vesting Schedule', definition: 'The timeline over which an employee earns their equity allocation.' },
      ],
    },
  },
  {
    prefix: '/evidence-packs',
    guide: {
      title: 'Evidence Packs bundle compliance proof for external parties',
      summary: 'Structured document packages that demonstrate regulatory compliance, security controls, or commercial commitments.',
      bestUse: 'Use when responding to procurement questionnaires, regulatory requests, or investor due diligence.',
      actions: [
        'Build evidence packs from production data rather than staging or synthetic artifacts.',
        'Keep packs versioned so you know which version was shared with which party.',
        'Update regularly rather than scrambling before each external deadline.',
      ],
      related: [
        { label: 'Proof Center', href: '/proof-center' },
        { label: 'Compliance', href: '/compliance-snapshots' },
      ],
      glossary: [
        { term: 'Evidence Pack', definition: 'A curated collection of artifacts that prove compliance with a specific requirement or framework.' },
        { term: 'Artifact', definition: 'A specific document, screenshot, export, or signed record included as compliance proof.' },
        { term: 'Chain of Custody', definition: 'The documented trail showing where an artifact came from and who has handled it.' },
      ],
    },
  },
  {
    prefix: '/proof-center',
    guide: {
      title: 'Proof Center provides cryptographic attestation for governance artifacts',
      summary: 'Tamper-evident proof records for documents, approvals, and governance events.',
      bestUse: 'Use when artifacts need to be non-repudiable for regulatory or legal purposes.',
      actions: [
        'Generate proofs before submitting documents externally.',
        'Store proof hashes in a location independent from the original document.',
        'Include proof references in evidence packs submitted to third parties.',
      ],
      related: [
        { label: 'Evidence Packs', href: '/evidence-packs' },
        { label: 'Compliance', href: '/compliance-snapshots' },
      ],
      glossary: [
        { term: 'Attestation', definition: 'A cryptographic signature proving a document existed in a specific state at a specific time.' },
        { term: 'Hash', definition: 'A unique fingerprint of a document used to detect any changes after signing.' },
        { term: 'Non-repudiation', definition: 'The property preventing a signer from later denying they signed a document.' },
      ],
    },
  },
  {
    prefix: '/compliance-snapshots',
    guide: {
      title: 'Compliance tracks regulatory requirements and current adherence status',
      summary: 'Which frameworks apply to which ventures, current requirement status, and upcoming certification renewals.',
      bestUse: 'Use before audits, certification renewals, or when a prospect asks for compliance status during sales.',
      actions: [
        'Review upcoming certification renewals at least 90 days in advance.',
        'Assign remediation owners to any failing requirements — unowned gaps do not close.',
        'Use compliance snapshots in sales conversations to reduce procurement friction.',
      ],
      related: [
        { label: 'Audit Insights', href: '/audit-insights' },
        { label: 'Evidence Packs', href: '/evidence-packs' },
      ],
      glossary: [
        { term: 'Compliance Framework', definition: 'A structured set of requirements such as SOC 2, PIPEDA, or GDPR that the organization must satisfy.' },
        { term: 'Requirement', definition: 'A specific control or obligation within a compliance framework.' },
        { term: 'Certification Renewal', definition: 'The periodic re-assessment process for maintaining a compliance certification.' },
      ],
    },
  },
  // ── OPS TOOLKIT ────────────────────────────────────────────────────────────
  {
    prefix: '/system-health',
    guide: {
      title: 'System Health gives a real-time view of infrastructure status',
      summary: 'Service uptime, error rates, and platform health across all environments.',
      bestUse: 'Check immediately after a deployment or whenever a user reports unexpected behavior.',
      actions: [
        'Investigate any red or yellow status before treating it as a transient glitch.',
        'Correlate downtime events with deployment timestamps in the Change Log.',
        'Use the historical view to identify patterns in recurring issues rather than treating each one as isolated.',
      ],
      related: [
        { label: 'Ops Score', href: '/ops-score' },
        { label: 'Performance', href: '/performance' },
      ],
      glossary: [
        { term: 'Uptime', definition: 'The percentage of time a service is available and responding correctly.' },
        { term: 'Error Rate', definition: 'The proportion of requests that fail relative to total request volume.' },
        { term: 'Environment', definition: 'A distinct deployment context such as development, staging, or production.' },
      ],
    },
  },
  {
    prefix: '/ops',
    guide: {
      title: 'Ops is the incident management and operations control surface',
      summary: 'Active incidents, on-call assignments, and operational runbooks.',
      bestUse: 'Use during any active incident or when setting up on-call rotations and response procedures.',
      actions: [
        'Declare incidents early rather than waiting to confirm severity — you can downgrade later.',
        'Assign a single incident commander for any P1 or P2 event.',
        'Write a postmortem within 48 hours of any significant incident while memory is fresh.',
      ],
      related: [
        { label: 'System Health', href: '/system-health' },
        { label: 'Incidents', href: '/itsm/incidents' },
      ],
      glossary: [
        { term: 'Incident Commander', definition: 'The single person responsible for coordinating a live incident response.' },
        { term: 'Postmortem', definition: 'A structured review of what happened, why it happened, and what will prevent recurrence.' },
        { term: 'Runbook', definition: 'A documented set of steps for handling a specific operational scenario.' },
      ],
    },
  },
  {
    prefix: '/performance',
    guide: {
      title: 'Performance monitors application speed and resource efficiency',
      summary: 'Response times, throughput, and resource utilization across services and ventures.',
      bestUse: 'Use when users report slowness or after deploying changes that affect database queries or API calls.',
      actions: [
        'Compare p95 response times against the SLA target before concluding performance is acceptable.',
        'Investigate throughput drops before attributing them to traffic changes.',
        'Use profiling data before adding infrastructure capacity — optimize first, scale second.',
      ],
      related: [
        { label: 'System Health', href: '/system-health' },
        { label: 'Cost Dashboard', href: '/cost' },
      ],
      glossary: [
        { term: 'p95 Response Time', definition: 'The response time that 95% of all requests complete within — a standard measure of perceived performance.' },
        { term: 'Throughput', definition: 'The number of requests or operations processed per second.' },
        { term: 'Resource Utilization', definition: 'The percentage of available CPU, memory, or network capacity currently in use.' },
      ],
    },
  },
  {
    prefix: '/integrations-control-plane',
    guide: {
      title: 'Control Plane is the advanced routing and integration configuration layer',
      summary: 'Traffic routing rules, integration middleware settings, and advanced API configuration.',
      bestUse: 'Use when modifying integration behavior at the routing or transformation layer, not at the application level.',
      actions: [
        'Test routing changes in staging before applying to production.',
        'Document every rule change with a reason and a rollback procedure.',
        'Treat the control plane as infrastructure — not a place for quick experimental changes.',
      ],
      related: [
        { label: 'Integrations', href: '/integrations' },
        { label: 'System Health', href: '/system-health' },
      ],
      glossary: [
        { term: 'Routing Rule', definition: 'A configuration that determines how requests are directed between services or integrations.' },
        { term: 'Middleware', definition: 'A transformation or filtering layer applied to requests and responses in transit.' },
        { term: 'Traffic Shaping', definition: 'Controlling how requests are distributed or throttled across backend services.' },
      ],
    },
  },
  {
    prefix: '/integrations',
    guide: {
      title: 'Integrations manages third-party connections and API health',
      summary: 'Status of all external API integrations, webhook delivery rates, and authentication health.',
      bestUse: 'Check when an external workflow breaks or when onboarding a new third-party service.',
      actions: [
        'Review webhook failure rates before assuming the upstream service is working correctly.',
        'Rotate credentials before they expire rather than after they cause failures.',
        'Document integration dependencies so outages can be traced to a specific source quickly.',
      ],
      related: [
        { label: 'Control Plane', href: '/integrations-control-plane' },
        { label: 'System Health', href: '/system-health' },
      ],
      glossary: [
        { term: 'Webhook', definition: 'An HTTP callback that sends event data to an external system when something happens.' },
        { term: 'Credential Rotation', definition: 'Replacing API keys or secrets before they expire.' },
        { term: 'Integration Health', definition: 'The combined status of connection, authentication, and data delivery for a specific integration.' },
      ],
    },
  },
  // ── SERVICE OPERATIONS ─────────────────────────────────────────────────────
  {
    prefix: '/itsm/dashboard',
    guide: {
      title: 'Ops Dashboard is the service operations command view',
      summary: 'Ticket volume, SLA compliance, client health indicators, and team workload metrics.',
      bestUse: 'Check at the start of each support day and before any client-facing review meeting.',
      actions: [
        'Flag any SLA that will breach in the next 24 hours and assign it immediately.',
        'Compare ticket volume trends against team capacity to spot overload before it compounds.',
        'Use client health scores to prioritize proactive outreach, not just reactive ticket resolution.',
      ],
      related: [
        { label: 'Support Desk', href: '/itsm/queue' },
        { label: 'Client Accounts', href: '/itsm/clients' },
      ],
      glossary: [
        { term: 'SLA Compliance', definition: 'The percentage of support tickets resolved within the contracted time target.' },
        { term: 'Ticket Volume', definition: 'The number of support requests received in a given period.' },
        { term: 'Client Health Score', definition: 'A composite indicator of how well a client relationship is performing based on engagement, satisfaction, and support load.' },
      ],
    },
  },
  {
    prefix: '/itsm/queue',
    guide: {
      title: 'Support Desk is the ticketing queue for incoming client requests',
      summary: 'All open, in-progress, and recently resolved support tickets with priority and SLA status.',
      bestUse: 'Use throughout the support day to triage new tickets and update status on open items.',
      actions: [
        'Triage new tickets within the first-response SLA window — the clock starts at submission.',
        'Escalate anything above the team\'s resolution scope before it becomes SLA-critical.',
        'Update tickets with notes before transferring ownership so context is not lost.',
      ],
      related: [
        { label: 'Ops Dashboard', href: '/itsm/dashboard' },
        { label: 'Incidents', href: '/itsm/incidents' },
      ],
      glossary: [
        { term: 'First Response SLA', definition: 'The time limit within which a ticket must receive an initial reply.' },
        { term: 'Triage', definition: 'The process of reviewing and classifying a new ticket to assign it correctly.' },
        { term: 'Escalation Path', definition: 'The route a ticket takes when it exceeds the support tier\'s scope or capacity.' },
      ],
    },
  },
  {
    prefix: '/itsm/clients',
    guide: {
      title: 'Client Accounts is the relationship and account management surface',
      summary: 'Client profiles, contract details, usage metrics, and health status for every active account.',
      bestUse: 'Use before any client call, renewal conversation, or when a health score drops.',
      actions: [
        'Review health score and open ticket count before any client meeting.',
        'Update stakeholder contacts when people change — stale contacts cause missed communications.',
        'Use account history to prepare renewal conversation talking points.',
      ],
      related: [
        { label: 'Support Desk', href: '/itsm/queue' },
        { label: 'Renewals', href: '/revenue/renewals' },
      ],
      glossary: [
        { term: 'Account Health', definition: 'A composite view of client usage, satisfaction, support load, and renewal likelihood.' },
        { term: 'Stakeholder Map', definition: 'The list of people at a client organization who influence renewal or expansion decisions.' },
        { term: 'Usage Metric', definition: 'A behavioral indicator showing how actively and broadly a client is using the product.' },
      ],
    },
  },
  {
    prefix: '/itsm/incidents',
    guide: {
      title: 'Incidents tracks platform failures and service disruptions',
      summary: 'Active and historical incidents with severity, timeline, impact, and resolution status.',
      bestUse: 'Use during active incidents for real-time coordination and post-resolution for learning.',
      actions: [
        'Record impact accurately from the start — it directly affects postmortem quality later.',
        'Assign a severity level within the first 10 minutes of detection.',
        'Communicate proactively to affected clients before they ask — silence amplifies frustration.',
      ],
      related: [
        { label: 'Ops', href: '/ops' },
        { label: 'System Health', href: '/system-health' },
      ],
      glossary: [
        { term: 'Incident Severity', definition: 'The classification of an incident by impact level — typically P1 critical to P4 minor.' },
        { term: 'Impact Radius', definition: 'The set of clients, services, or teams affected by the incident.' },
        { term: 'Postmortem', definition: 'A structured review written after resolution to capture root cause and prevention steps.' },
      ],
    },
  },
  {
    prefix: '/itsm/changes',
    guide: {
      title: 'Change Log records all deployments and configuration changes',
      summary: 'Timestamped record of every change made to production with author, scope, and rollback notes.',
      bestUse: 'Use when investigating an incident or when correlating a behavior change in production with a specific deployment.',
      actions: [
        'Log every production change at the time it happens — not after the fact.',
        'Include a rollback procedure in the change record before deploying.',
        'Reference the change log first when diagnosing unexpected behavior, before assuming a code bug.',
      ],
      related: [
        { label: 'Incidents', href: '/itsm/incidents' },
        { label: 'System Health', href: '/system-health' },
      ],
      glossary: [
        { term: 'Change Record', definition: 'An entry capturing what changed, who changed it, when, and how to reverse it.' },
        { term: 'Rollback Procedure', definition: 'The specific steps needed to return to the previous state if a change causes problems.' },
        { term: 'Configuration Drift', definition: 'The gradual divergence between documented configuration and the actual state of production.' },
      ],
    },
  },
  {
    prefix: '/itsm/kb',
    guide: {
      title: 'Knowledge Base stores solutions and documentation for recurring questions',
      summary: 'Internal and client-facing articles, runbooks, and troubleshooting guides.',
      bestUse: 'Search here before raising a ticket for a recurring issue, and add an article after resolving any novel problem.',
      actions: [
        'Search before creating new tickets — many issues already have documented solutions.',
        'Write articles immediately after solving novel problems while context is fresh.',
        'Mark outdated content for review rather than deleting it — version history is valuable.',
      ],
      related: [
        { label: 'Support Desk', href: '/itsm/queue' },
        { label: 'Ops', href: '/ops' },
      ],
      glossary: [
        { term: 'Runbook', definition: 'A step-by-step guide for handling a specific operational or support scenario.' },
        { term: 'Knowledge Article', definition: 'A documented solution or explanation intended for reuse across similar situations.' },
        { term: 'Article Freshness', definition: 'How recently a knowledge article was verified to still be accurate.' },
      ],
    },
  },
  {
    prefix: '/itsm/assets',
    guide: {
      title: 'Assets & Vendors tracks IT assets and third-party contracts',
      summary: 'Hardware, software licenses, vendor contracts, and renewal dates.',
      bestUse: 'Use before onboarding a new vendor, during security reviews, or when software renewals are approaching.',
      actions: [
        'Flag vendor contracts expiring within 90 days to allow renegotiation time.',
        'Track license counts against actual usage to avoid overspending on unused seats.',
        'Review vendor security posture annually or after any reported breach affecting your vendor.',
      ],
      related: [
        { label: 'Cost Dashboard', href: '/cost' },
        { label: 'Integrations', href: '/integrations' },
      ],
      glossary: [
        { term: 'Asset Register', definition: 'The complete list of hardware and software items owned or licensed by the organization.' },
        { term: 'Vendor Contract', definition: 'The formal agreement governing the terms of a third-party service or product.' },
        { term: 'License Compliance', definition: 'Ensuring the number of software licenses in use does not exceed the number purchased.' },
      ],
    },
  },
  // ── ADMIN ──────────────────────────────────────────────────────────────────
  {
    prefix: '/orgs',
    guide: {
      title: 'Organizations manages the multi-tenant workspace structure',
      summary: 'All organizations in the system with user counts, admin contacts, and configuration settings.',
      bestUse: 'Use when onboarding a new client organization, resetting permissions, or auditing feature access.',
      actions: [
        'Create organizations before inviting users so permissions are correctly scoped from the start.',
        'Review inactive organizations periodically for cleanup.',
        'Treat organization-level configuration changes as high-risk and test in a staging tenant first.',
      ],
      related: [
        { label: 'Settings', href: '/settings' },
        { label: 'Audit Insights', href: '/audit-insights' },
      ],
      glossary: [
        { term: 'Tenant', definition: 'A logically isolated organization instance within the platform.' },
        { term: 'Organization Admin', definition: 'The user with top-level permissions within a specific tenant.' },
        { term: 'Permission Scope', definition: 'The set of features and data access granted to a specific role or user within an organization.' },
      ],
    },
  },
  {
    prefix: '/docs',
    guide: {
      title: 'Docs is the internal knowledge and documentation system',
      summary: 'Technical documentation, onboarding guides, and process references organized by domain.',
      bestUse: 'Check here before asking a question that might already be answered, and add documentation when you solve a novel problem.',
      actions: [
        'Use search before browsing — it is faster and surfaces cross-domain results.',
        'Keep documentation close to the code or process it describes.',
        'Mark outdated documents for review rather than deleting — version history is valuable.',
      ],
      related: [
        { label: 'Knowledge Base', href: '/itsm/kb' },
        { label: 'Settings', href: '/settings' },
      ],
      glossary: [
        { term: 'Documentation', definition: 'Written material describing how something works, how to use it, or why it was built a specific way.' },
        { term: 'Onboarding Guide', definition: 'Documentation designed for someone new to a system or process.' },
        { term: 'Technical Reference', definition: 'Detailed documentation of APIs, data models, or system behavior.' },
      ],
    },
  },
  {
    prefix: '/settings',
    guide: {
      title: 'Settings controls system-wide configuration and preferences',
      summary: 'Platform configuration, notification preferences, feature flags, and system-level behavior settings.',
      bestUse: 'Use only when a specific configuration change is required — treat settings as infrastructure-level decisions.',
      actions: [
        'Document every settings change with a reason and date before applying it.',
        'Test configuration changes in staging before applying to production.',
        'Avoid using feature flags as a permanent solution for features that should be shipped properly.',
      ],
      related: [
        { label: 'Organizations', href: '/orgs' },
        { label: 'Integrations', href: '/integrations' },
      ],
      glossary: [
        { term: 'Feature Flag', definition: 'A toggle that enables or disables a feature for a user, organization, or environment without a code deployment.' },
        { term: 'System Preference', definition: 'A setting that affects default behavior across the entire platform.' },
        { term: 'Configuration Drift', definition: 'The state where actual system settings have diverged from documented or expected values.' },
      ],
    },
  },
]

function getGuide(pathname: string): GuideConfig | null {
  const match = GUIDE_BY_ROUTE.find((item) => pathname === item.prefix || pathname.startsWith(item.prefix + '/'))
  return match?.guide ?? null
}

export function CommandSectionGuide() {
  const pathname = usePathname()
  const guide = getGuide(pathname)
  const sectionInfo = getSectionInfo(pathname)
  const [openPath, setOpenPath] = useState<string | null>(null)
  const isOpen = openPath === pathname

  if (!guide) return null

  const sectionName = sectionInfo?.name ?? 'Command'
  const sectionFlow = sectionInfo?.flow ?? COMMAND_FLOW
  const guideLabel = `${sectionName} Guide`

  return (
    <>
      <div className="pointer-events-none fixed inset-y-0 right-0 z-40 hidden items-center pr-0 lg:flex">
        <button
          type="button"
          aria-label={isOpen ? `Close ${guideLabel}` : `Open ${guideLabel}`}
          aria-expanded={isOpen}
          onClick={() => setOpenPath((current) => (current === pathname ? null : pathname))}
          className="pointer-events-auto flex items-center gap-2 rounded-l-2xl border border-r-0 border-blue-200 bg-white/95 px-3 py-3 text-sm font-semibold text-blue-700 shadow-lg backdrop-blur transition hover:bg-blue-50"
        >
          <BookOpenIcon className="h-5 w-5" />
          <span className="[writing-mode:vertical-rl] rotate-180 tracking-wide">{guideLabel}</span>
        </button>
      </div>

      {isOpen && (
        <button
          type="button"
          aria-label={`Close ${guideLabel} overlay`}
          onClick={() => setOpenPath(null)}
          className="fixed inset-0 z-40 bg-slate-950/20 backdrop-blur-[1px]"
        />
      )}

      <aside
        className={`fixed right-0 top-0 z-50 h-screen w-full max-w-md transform border-l border-blue-100 bg-linear-to-b from-white via-blue-50 to-slate-50 shadow-2xl transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        aria-hidden={!isOpen}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-blue-100 px-5 py-5">
            <div>
              <div className="flex items-center gap-2">
                <BookOpenIcon className="h-5 w-5 text-blue-600" />
                <p className="text-sm font-semibold text-gray-900">{guideLabel}</p>
              </div>
              <p className="mt-2 text-base font-semibold text-gray-900">{guide.title}</p>
              <p className="mt-1 text-sm text-gray-600">{guide.summary}</p>
            </div>
            <button
              type="button"
              aria-label={`Close ${guideLabel}`}
              onClick={() => setOpenPath(null)}
              className="rounded-full p-2 text-gray-400 transition hover:bg-white hover:text-gray-700"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
            <div className="rounded-2xl border border-blue-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm">
              <span className="font-semibold text-gray-900">Best use:</span> {guide.bestUse}
            </div>

            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                <ArrowPathIcon className="h-4 w-4 text-gray-400" />
                Recommended {sectionName.toLowerCase()} flow
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {sectionFlow.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpenPath(null)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${pathname === item.href ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:text-blue-700'}`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">How to use this page</p>
              <ul className="mt-3 space-y-2 text-sm text-gray-700">
                {guide.actions.map((action) => (
                  <li key={action} className="rounded-xl border border-white/80 bg-white/80 px-3 py-2 shadow-sm">
                    {action}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Glossary</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {guide.glossary.map((item) => (
                  <span key={item.term} className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm">
                    {item.term}
                    <HelpTooltip label={`Explain ${item.term}`} content={item.definition} />
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Related pages</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {guide.related.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpenPath(null)}
                    className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-blue-700 shadow-sm transition hover:border-blue-300 hover:text-blue-800"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}