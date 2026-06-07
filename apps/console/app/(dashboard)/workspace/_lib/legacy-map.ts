/**
 * Legacy surface map — the subordination source of truth.
 *
 * Per the Workspace Doctrine (docs/doctrine/NZILA_CONSOLE_WORKSPACE_MAP.md §5),
 * every legacy `(dashboard)` route is framed inside the workspace + sub-tab that
 * owns it. This file is the single, testable map from workspace → sub-tab →
 * the legacy surfaces rendered there as a `LegacyBridge` panel.
 *
 * Keyed by workspace, then by sub-tab key. The empty-string key `''` is the
 * root panel for tab-less workspaces (Overview, Ventures, Settings) or a panel
 * shown on every sub-tab of a workspace (Sales).
 *
 * A contract test asserts every href in `lib/nav-config` legacy groups appears
 * here, so nothing in the old console can fall out of the new house.
 */
import type { WorkspaceKey } from './nav'

export interface BridgeLink {
  name: string
  href: string
  description: string
}

export interface BridgePanel {
  title: string
  intro?: string
  links: BridgeLink[]
}

export const LEGACY_SURFACES: Record<WorkspaceKey, Record<string, BridgePanel>> = {
  // ── Overview — the CEO daily pulse ─────────────────────────────────────────
  overview: {
    '': {
      title: 'Command surfaces',
      intro: 'The daily-pulse command surfaces from the previous console — morning read, weekly cadence, and the deep intelligence engine.',
      links: [
        { name: 'CEO One-Screen', href: '/ceo', description: 'Compressed boardroom summary for founder, partner, or investor conversations.' },
        { name: 'Today', href: '/today', description: 'First stop every morning — immediate cash, pipeline, pilot, and approval signals.' },
        { name: 'Briefing', href: '/briefing', description: 'Decision-oriented memo for leadership review and weekly founder planning.' },
        { name: 'Focus', href: '/focus', description: 'Founder time allocation and capacity — what gets real attention this week.' },
        { name: 'Command Center', href: '/command-center', description: 'Operating snapshot across clients, renewals, support load, and founder priorities.' },
        { name: 'Weekly Review', href: '/weekly-review', description: 'The same operating review across daily, weekly, and monthly rhythms.' },
        { name: 'Autopilot', href: '/autopilot', description: 'High-confidence system-generated actions awaiting human approval.' },
        { name: 'Intelligence', href: '/intelligence', description: 'Cross-domain research surface for funding, deals, partners, products, and signals.' },
        { name: 'Intelligence · Focus', href: '/intelligence/focus', description: 'Focused intelligence on the highest-signal opportunities and risks right now.' },
      ],
    },
  },

  // ── Portfolio — what exists, allocation, capital ───────────────────────────
  portfolio: {
    overview: {
      title: 'Allocation & analytics surfaces',
      intro: 'The legacy allocation view, cross-portfolio analytics, and the hiring cockpit subordinated under Portfolio.',
      links: [
        { name: 'Portfolio Allocation', href: '/portfolio', description: 'Which ventures deserve build, sell, hold, or maintenance effort — the allocation view.' },
        { name: 'Analytics', href: '/analytics', description: 'Cross-portfolio analytics, cohort trends, and performance breakdowns.' },
        { name: 'Audit Graph', href: '/audit-graph', description: 'Visual graph of audit events, lineage, and decision provenance.' },
        { name: 'Hiring Cockpit', href: '/portfolio/executive/hiring', description: 'Portfolio-wide hiring plan, open roles, and headcount allocation.' },
      ],
    },
    funding: {
      title: 'Capital & finance surfaces',
      intro: 'Cash, burn, runway, and corporate finance subordinated under Portfolio → Funding.',
      links: [
        { name: 'Burn & Runway', href: '/capital', description: 'Cash position, burn rate, and runway across all ventures with path-to-sustainability tracking.' },
        { name: 'Runway', href: '/runway', description: 'Detailed runway analysis by venture — months of operating capital and funding milestones.' },
        { name: 'Forecast', href: '/forecast', description: 'Financial projections and forecasting model for portfolio-wide cash planning.' },
        { name: 'Cost Dashboard', href: '/cost', description: 'Cloud and infrastructure cost visibility with optimization recommendations.' },
        { name: 'Platform Economics', href: '/platform-economics', description: 'Shared platform economics and cost allocation across ventures.' },
        { name: 'Finance Ops', href: '/business/finance', description: 'Finance operations, invoicing, and transaction records.' },
        { name: 'Business Compliance', href: '/business/compliance', description: 'Corporate compliance posture, filings, and regulatory obligations.' },
        { name: 'Year-End Pack', href: '/business/finance/year-end-pack', description: 'Year-end financial close package and accountant-ready export.' },
        { name: 'Year-End Close', href: '/business/yearend', description: 'Annual close checklist and fiscal year wrap-up workflow.' },
      ],
    },
  },

  // ── Observatory — market validation ────────────────────────────────────────
  observatory: {
    assessments: {
      title: 'Discovery & growth surfaces',
      intro: 'Healthcare discovery and growth-signal surfaces subordinated under Observatory.',
      links: [
        { name: 'Discovery Surveys', href: '/healthcare/discovery/surveys', description: 'Short privacy-conscious unit surveys before selecting one tiny healthcare workflow wedge.' },
        { name: 'Pilot Readiness', href: '/healthcare/discovery/pilot-readiness', description: 'Discovery-to-pilot framing for selecting one governed first workflow.' },
        { name: 'Growth', href: '/growth', description: 'Growth experiments, funnel metrics, and acquisition signals.' },
      ],
    },
  },

  // ── Sales — the revenue motion (panel shown on every sub-tab) ───────────────
  sales: {
    '': {
      title: 'Revenue surfaces',
      intro: 'Deeper GTM cockpits subordinated under Sales — the full pipeline command center and Union Eyes revenue engine.',
      links: [
        { name: 'Revenue Pipeline', href: '/revenue', description: 'Sales command center — quotes, active pilots, prospect pipeline, and revenue playbooks by account.' },
        { name: 'UE Revenue Cockpit', href: '/ue-revenue-cockpit', description: 'Union Eyes revenue agent — commerce opportunities, growth signals, and deal velocity.' },
        { name: 'UE Pipeline', href: '/ue-pipeline', description: 'Union Eyes pipeline detail across the commerce funnel.' },
        { name: 'FAIRCASE Funnel', href: '/revenue/faircase', description: 'FAIRCASE-specific funnel: leads → meetings → demos → proposals → pilots → close.' },
        { name: 'Pilot Export', href: '/pilot/export', description: 'Export active pilots and revenue events for cross-venture analysis.' },
      ],
    },
  },

  // ── Ventures — per-venture maturity (cards are the content) ─────────────────
  ventures: {},

  // ── Operations — the founder cockpit + operational surfaces ─────────────────
  operations: {
    tasks: {
      title: 'Initiatives & accountability',
      intro: 'What is being moved and by whom.',
      links: [
        { name: 'Initiatives', href: '/execution', description: 'Active strategic initiatives with owners, deadlines, and execution progress.' },
        { name: 'Accountability', href: '/accountability', description: 'OKR tracking, status updates, and blocker resolution.' },
        { name: 'Operator Mode', href: '/operator', description: 'Tactical operations control and real-time coordination for the operating team.' },
        { name: 'Approvals', href: '/business/approvals', description: 'Approval workflows and signature tracking for business decisions and commitments.' },
        { name: 'Queues', href: '/business/queues', description: 'Work queue management and task prioritization across the organization.' },
      ],
    },
    risks: {
      title: 'Risk & health surfaces',
      intro: 'Business, technical, and financial threats with mitigation plans.',
      links: [
        { name: 'Risk Register', href: '/risk', description: 'Central registry of risks with mitigation tracking.' },
        { name: 'Ops Score', href: '/ops-score', description: 'Real-time operations health score showing system reliability and incident risk.' },
        { name: 'Audit Insights', href: '/audit-insights', description: 'Audit findings and compliance gaps with remediation tracking.' },
        { name: 'Trend Detection', href: '/trend-detection', description: 'AI-powered anomaly and trend detection across portfolio metrics.' },
      ],
    },
    decisions: {
      title: 'Decision ledger',
      intro: 'The decision ledger and what each decision produced.',
      links: [
        { name: 'Decision Audit', href: '/audit', description: 'Signed decision ledger and verification/export entry points.' },
        { name: 'Decision Scoreback', href: '/decision-scoreback', description: 'Outcomes and lessons from leadership decisions.' },
        { name: 'Decision Intelligence', href: '/intelligence?section=decision-intelligence', description: 'Decision analytics, policy drift, and benchmark intelligence monetized by tier.' },
      ],
    },
    governance: {
      title: 'Governance & evidence',
      intro: 'Governance framework, policies, board materials, and cryptographic evidence.',
      links: [
        { name: 'Governance', href: '/governance', description: 'Framework, policies, and compliance documentation.' },
        { name: 'Board Pack', href: '/board', description: 'Monthly board package with metrics and decisions.' },
        { name: 'Corporate Gov', href: '/business/governance', description: 'Corporate governance structure and board meeting management.' },
        { name: 'Equity & Cap Table', href: '/business/equity', description: 'Equity tracking, cap table, and share distribution across ventures.' },
        { name: 'Evidence Packs', href: '/evidence-packs', description: 'Compliance evidence and audit documentation for regulatory requirements.' },
        { name: 'Governance Experience', href: '/governance-experience', description: 'End-to-end governance experience across policies, evidence, and attestations.' },
        { name: 'Proof Center', href: '/proof-center', description: 'Cryptographic proof and attestation center for audit trail.' },
        { name: 'Compliance Snapshots', href: '/compliance-snapshots', description: 'Compliance status snapshots and regulatory requirement tracking.' },
        { name: 'Signatures', href: '/business/signatures', description: 'Digital signature collection and document signing workflow.' },
      ],
    },
    documentation: {
      title: 'Documentation',
      intro: 'Internal documentation and operating knowledge.',
      links: [
        { name: 'Docs', href: '/docs', description: 'Curated internal documentation and guides.' },
        { name: 'Knowledge Base', href: '/itsm/kb', description: 'Support documentation and FAQ knowledge base.' },
      ],
    },
    platform: {
      title: 'Platform & infrastructure',
      intro: 'System health, performance, integrations, automation, and the platform admin console.',
      links: [
        { name: 'Platform Cockpit', href: '/platform', description: 'Platform leadership cockpit across reliability, security, and FinOps.' },
        { name: 'System Health', href: '/system-health', description: 'Platform infrastructure and service health dashboard.' },
        { name: 'Ops', href: '/ops', description: 'Operations control center and incident management.' },
        { name: 'UX Performance', href: '/ops/performance', description: 'Web Vitals, server route timings, and failed-action telemetry for the Console itself.' },
        { name: 'Performance', href: '/performance', description: 'Application performance monitoring and optimization insights.' },
        { name: 'Perf Regressions', href: '/performance/regressions', description: 'Detected performance regressions across routes and releases.' },
        { name: 'Integrations', href: '/integrations', description: 'Third-party integrations and API management.' },
        { name: 'Integration Chaos', href: '/integrations/chaos', description: 'Chaos and fault-injection testing for integration resilience.' },
        { name: 'Control Plane', href: '/integrations-control-plane', description: 'Advanced integration control and routing configuration.' },
        { name: 'Automation', href: '/automation', description: 'Automation runs, schedules, and operational workflow orchestration.' },
        { name: 'Admin Console', href: '/console', description: 'Internal platform administration home.' },
        { name: 'Retention Admin', href: '/console/admin/retention', description: 'Data retention policy administration and purge controls.' },
      ],
    },
    ai: {
      title: 'AI platform admin',
      intro: 'Deep ML platform-admin surfaces subordinated under AI Management — model registry, run history, and the Stripe scoring tracks.',
      links: [
        { name: 'ML Overview', href: '/console/ml/overview', description: 'Machine-learning platform overview and model fleet health.' },
        { name: 'ML Models', href: '/console/ml/models', description: 'Registered ML models, versions, and deployment status.' },
        { name: 'ML Runs', href: '/console/ml/runs', description: 'Training and inference run history with metrics.' },
        { name: 'ML · Stripe Daily', href: '/console/ml/stripe/daily', description: 'Daily Stripe revenue rollups feeding ML billing models.' },
        { name: 'ML · Stripe Transactions', href: '/console/ml/stripe/transactions', description: 'Raw Stripe transaction stream for reconciliation and ML inputs.' },
      ],
    },
    service: {
      title: 'Service desk',
      intro: 'The ITSM service-operations layer — tickets, incidents, clients, and assets.',
      links: [
        { name: 'Ops Dashboard', href: '/itsm/dashboard', description: 'Service operations metrics and KPI dashboard.' },
        { name: 'Support Desk', href: '/itsm/queue', description: 'Ticket queue and support request management.' },
        { name: 'Client Accounts', href: '/itsm/clients', description: 'Client account management and relationship tracking.' },
        { name: 'Incidents', href: '/itsm/incidents', description: 'Incident tracking and resolution workflow.' },
        { name: 'Change Log', href: '/itsm/changes', description: 'Change management and deployment tracking.' },
        { name: 'Assets & Vendors', href: '/itsm/assets', description: 'IT assets, vendor contracts, and service tracking.' },
        { name: 'Contracts', href: '/itsm/contracts', description: 'Service contracts, SLAs, and renewal tracking for client accounts.' },
        { name: 'Problems', href: '/itsm/problems', description: 'Problem management — root-cause analysis behind recurring incidents.' },
      ],
    },
    proving: {
      title: 'Proving & readiness',
      intro: 'Operational proving, go/no-go evidence, and resilience simulations.',
      links: [
        { name: 'Assurance', href: '/assurance', description: 'Assurance posture across reliability, security, and operational controls.' },
        { name: 'Proof Pack', href: '/proof-pack', description: 'Compiled cryptographic proof pack for external attestation.' },
        { name: 'Operational Proving', href: '/operational-proving-summary', description: 'Summary of operational proving runs and readiness evidence.' },
        { name: 'Rollout Readiness', href: '/rollout-readiness', description: 'Go/no-go readiness checklist for staged rollouts.' },
        { name: 'Scale Simulation', href: '/scale-simulation', description: 'Load and scale simulation results for capacity planning.' },
        { name: 'Failure Simulation', href: '/failure-simulation', description: 'Failure-mode simulation and resilience validation runs.' },
        { name: 'Deployment Profile', href: '/deployment-profile', description: 'Deployment topology, environment profile, and release configuration.' },
        { name: 'Final Go Briefing', href: '/final-go-briefing', description: 'Final go-live briefing pack with sign-off checklist.' },
        { name: 'Field Operations Briefing', href: '/field-operations-briefing', description: 'Field operations readiness briefing for launch teams.' },
        { name: 'NACP Integrity', href: '/nacp-integrity', description: 'NACP data integrity verification and exam pipeline checks.' },
        { name: 'Isolation Certification', href: '/isolation-certification', description: 'Tenant isolation certification evidence and controls.' },
      ],
    },
  },

  // ── Settings — account & workspace configuration ───────────────────────────
  settings: {
    '': {
      title: 'Configuration surfaces',
      intro: 'Account, organization, and integration configuration.',
      links: [
        { name: 'System Settings', href: '/settings', description: 'Preferences, configuration, and account.' },
        { name: 'Organizations', href: '/orgs', description: 'Multi-tenant organization and workspace management.' },
        { name: 'Profile', href: '/settings/profile', description: 'Personal profile, identity, and notification preferences.' },
        { name: 'Organisation', href: '/settings/organisation', description: 'Organisation-level settings, branding, and workspace defaults.' },
        { name: 'Integration Settings', href: '/settings/integrations', description: 'Connect and configure third-party integrations for this workspace.' },
      ],
    },
  },
}

/** Resolve the bridge panel for a workspace + sub-tab (or '' root). */
export function bridgeFor(workspace: WorkspaceKey, subTab: string): BridgePanel | null {
  return LEGACY_SURFACES[workspace]?.[subTab] ?? null
}

/** Every legacy href accounted for in the map — used by the coverage contract test. */
export function allMappedHrefs(): string[] {
  const out: string[] = []
  for (const byTab of Object.values(LEGACY_SURFACES)) {
    for (const panel of Object.values(byTab)) {
      for (const link of panel.links) out.push(link.href)
    }
  }
  return out
}
