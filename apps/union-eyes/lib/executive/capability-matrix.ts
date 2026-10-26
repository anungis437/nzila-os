/**
 * UE-OFFICER-EXECUTIVE-CANONICAL-2.1 — O01–O26 capability coverage matrix.
 *
 * This is a curated disposition ledger, not an inventory of routes. A domain is
 * never OPERATIONAL because a schema, route, component, diagram or synthetic
 * test exists (contract §XV). Nothing here is OPERATIONAL: no executive action
 * has been proven end to end with a verified office/delegation source, a server
 * workflow engine, persisted state, audit, negative tests, native browser
 * completion and exact deployment provenance.
 *
 * Complements (does not replace) lib/reality/capability-registry.ts, which keeps
 * its own REAL/LIMITED/... vocabulary for route-level truth.
 */

export type ExecutiveDisposition =
  | 'OPERATIONAL'
  | 'LIMITED'
  | 'UNAVAILABLE'
  | 'BLOCKED'
  | 'NOT_APPLICABLE';

export const EXECUTIVE_DESTINATION_KEYS = [
  'today',
  'members-service',
  'governance-organization',
  'bargaining-collective-action',
  'finance-resources',
  'communications-relations',
  'continuity-intelligence',
] as const;

export type ExecutiveDestinationKey = (typeof EXECUTIVE_DESTINATION_KEYS)[number];

export type ExecutiveDomainId =
  | 'O01' | 'O02' | 'O03' | 'O04' | 'O05' | 'O06' | 'O07' | 'O08' | 'O09'
  | 'O10' | 'O11' | 'O12' | 'O13' | 'O14' | 'O15' | 'O16' | 'O17' | 'O18'
  | 'O19' | 'O20' | 'O21' | 'O22' | 'O23' | 'O24' | 'O25' | 'O26';

export interface ExecutiveDomain {
  id: ExecutiveDomainId;
  name: string;
  destination: ExecutiveDestinationKey;
  disposition: ExecutiveDisposition;
  /** Existing surfaces actually inspected. Their presence is not proof of operation. */
  sources: readonly string[];
  /** The missing proof or prerequisite that prevents a higher disposition. */
  gap: string;
}

export const EXECUTIVE_DOMAINS: readonly ExecutiveDomain[] = [
  {
    id: 'O01', name: 'Office, term, institutional mandate and delegated authority',
    destination: 'today', disposition: 'BLOCKED',
    sources: ['lib/auth/roles.ts (role labels only)', 'lib/executive/mandate.ts (evaluator, no store)'],
    gap: 'No authoritative office/term/delegation store. Roles are labels and a numeric hierarchy; mandate-gated actions fail closed. Needs schema + RLS census entry and governing-instrument verification.',
  },
  {
    id: 'O02', name: 'Executive priorities and actionable decisions',
    destination: 'today', disposition: 'LIMITED',
    sources: ['app/[locale]/dashboard/executive', '/dashboard/priorities', 'lib/services/dashboard-kpi-service.ts'],
    gap: 'Today shows source-backed grievance service aggregates and links to priorities. No decision queue exists, so pending decisions are reported UNAVAILABLE.',
  },
  {
    id: 'O03', name: 'Member-service oversight and representation capacity',
    destination: 'members-service', disposition: 'LIMITED',
    sources: ['/dashboard/leadership', 'app/api/dashboard/leadership/route.ts', 'lib/services/dashboard-kpi-service.ts'],
    gap: 'Organization-scoped aggregates with provenance (officer+). Steward-level workload is named per steward; no exception-to-intervention routing; not runtime or staging proven.',
  },
  {
    id: 'O04', name: 'Representation accountability without universal file access',
    destination: 'members-service', disposition: 'BLOCKED',
    sources: ['app/api/executive/dashboard/route.ts', 'lib/auth/roles.ts (VIEW_ALL_CLAIMS on executive roles)'],
    gap: 'Executive API no longer returns grievance rows, but executive roles still hold VIEW_ALL_CLAIMS/EDIT_ALL_CLAIMS and steward+ may read any grievance. Matter-level grants need the Representative 2.2 / Senior Representative 2.1 mandate store.',
  },
  {
    id: 'O05', name: 'Motions, resolutions, decisions and authorized execution',
    destination: 'governance-organization', disposition: 'BLOCKED',
    sources: ['lib/executive/decision-lifecycle.ts (pure kernel, not persisted)', 'app/api/governance/lifecycle/policies/[id]/approvals/route.ts (platform policy chains, caller-asserted actorRole)'],
    gap: 'No motion/decision store, no quorum or decision-rule source, no organization-scoped adoption record. The kernel is test-proven only; nothing is persisted or exposed.',
  },
  {
    id: 'O06', name: 'Meetings, agendas, quorum, minutes and obligations',
    destination: 'governance-organization', disposition: 'LIMITED',
    sources: ['app/api/committees/[id]/meetings', 'app/api/committees/[id]/action-items'],
    gap: 'Committee meetings, minutes and action items have routes; quorum, notice and executive-board scope are not evidenced. Not runtime proven.',
  },
  {
    id: 'O07', name: 'Bylaws, policies, effective versions and exceptions',
    destination: 'governance-organization', disposition: 'LIMITED',
    sources: ['db/schema/domains/governance/bylaws.ts', 'app/api/governance/bylaws/route.ts'],
    gap: 'Bylaw records exist; effective-version binding to decisions and exception handling are not wired. Governing text is not verified for any organization.',
  },
  {
    id: 'O08', name: 'Offices, committees, appointments and delegation',
    destination: 'governance-organization', disposition: 'BLOCKED',
    sources: ['app/api/committees/route.ts'],
    gap: 'Committees exist; appointments, terms and delegation instruments do not (see O01).',
  },
  {
    id: 'O09', name: 'Elections, nominations, consultations and ratifications',
    destination: 'governance-organization', disposition: 'UNAVAILABLE',
    sources: ['app/api/elections/route.ts (global council_elections)', 'app/api/voting/*', 'app/api/governance/elections/sessions/*'],
    gap: 'council_elections is a globally scoped record table reachable only by clc_staff/clc_executive/system_admin; it is not a local-union election engine. The vote-increment endpoint now answers 501. No electorate, ballot secrecy, independent tabulation or certification procedure is qualified.',
  },
  {
    id: 'O10', name: 'Bargaining strategy, authorization and mandates',
    destination: 'bargaining-collective-action', disposition: 'LIMITED',
    sources: ['/dashboard/bargaining', 'app/api/bargaining/negotiations', 'app/api/bargaining/proposals'],
    gap: 'Negotiation and proposal records exist; mandate and proposal authorization are not separated from recording. Not runtime proven.',
  },
  {
    id: 'O11', name: 'Collective agreement approval, signing and implementation',
    destination: 'bargaining-collective-action', disposition: 'BLOCKED',
    sources: ['app/api/bargaining/tentative-agreements/route.ts'],
    gap: 'A tentative agreement record is not ratification. No qualified member ratification engine and no signing-authority source; nothing may be shown as ratified or signed.',
  },
  {
    id: 'O12', name: 'Authorized campaigns, mobilization and collective action',
    destination: 'bargaining-collective-action', disposition: 'UNAVAILABLE',
    sources: ['app/api/strike-fund/dashboard/route.ts'],
    gap: 'No authorization chain for collective action. The strike-fund dashboard returned a constant $0 payload; it now answers 501 (no fund-balance or applications source) and is limited to Secretary-Treasurer and above.',
  },
  {
    id: 'O13', name: 'Budget, actuals, commitments and financial visibility',
    destination: 'finance-resources', disposition: 'UNAVAILABLE',
    sources: ['app/api/financial/budgets/route.ts (deprecated: table never created)', 'app/api/finance/dashboard/route.ts (platform billing)'],
    gap: 'Budget tables were never created. The finance dashboard is platform billing, not union budget/actuals. Dues remittances are not budget spend and are no longer reported as such.',
  },
  {
    id: 'O14', name: 'Expenditure decisions, segregation of duties and approvals',
    destination: 'finance-resources', disposition: 'BLOCKED',
    sources: ['app/api/financial/expenses/route.ts (deprecated: table never created)', 'lib/executive/mandate.ts (limit and self-approval rules)'],
    gap: 'No expenditure or approval engine. APPROVE_FINANCIAL, MANAGE_FINANCES and AUDIT_FINANCES are combined on one role. Delegation limits and independent-review policy are unknown.',
  },
  {
    id: 'O15', name: 'Dues, funds, financial obligations and exceptions',
    destination: 'finance-resources', disposition: 'LIMITED',
    sources: ['app/api/dues/*', 'lib/reality/capability-registry.ts (UE-FIN-DUES-*)'],
    gap: 'Dues engine is parked/LIMITED per the registry; steward-level callers can read org dues dashboards. Fund-specific governance is not modelled. Deferred to the Secretary-Treasurer persona.',
  },
  {
    id: 'O16', name: 'Membership governance, eligibility and appeals',
    destination: 'members-service', disposition: 'UNAVAILABLE',
    sources: [],
    gap: 'No eligibility-rule or membership-appeal engine was found in the executive dependency set.',
  },
  {
    id: 'O17', name: 'Employer relations and authorized institutional correspondence',
    destination: 'communications-relations', disposition: 'LIMITED',
    sources: ['/dashboard/correspondence', 'lib/auth/roles.ts (SIGN/DISPATCH_CORRESPONDENCE)'],
    gap: 'Draft/sign/dispatch permissions exist per role; signing authority is role-label based and sent is not receipt. Delivery confirmation is not evidenced.',
  },
  {
    id: 'O18', name: 'Affiliations, federations, councils and partnerships',
    destination: 'communications-relations', disposition: 'UNAVAILABLE',
    sources: ['/dashboard/federation'],
    gap: 'Cross-local/federation rollup is explicitly parked (docs/union-eyes/README.md §5). Organizational autonomy rules are unverified.',
  },
  {
    id: 'O19', name: 'WorkAid, counsel and professional engagement oversight',
    destination: 'members-service', disposition: 'UNAVAILABLE',
    sources: [],
    gap: 'No qualified live WorkAid connector. Referral acknowledgement/acceptance, filing validity and released outcomes are WorkAid-owned and cannot be inferred from union-side dispatch.',
  },
  {
    id: 'O20', name: 'Conflicts, recusals, ethics and independent complaints',
    destination: 'governance-organization', disposition: 'LIMITED',
    sources: ['db/schema/domains/governance/conflicts.ts', 'app/api/governance/lifecycle/conflicts'],
    gap: 'Conflict/recusal tables exist in the platform governance lifecycle; recusal is not enforced on executive actions and there is no independent complaint channel.',
  },
  {
    id: 'O21', name: 'Risk, compliance, privacy and institutional accountability',
    destination: 'continuity-intelligence', disposition: 'LIMITED',
    sources: ['/dashboard/leadership (compliance summary)', '/dashboard/governance-center'],
    gap: 'Compliance counts are derived aggregates; no compliance certification is claimed or supported.',
  },
  {
    id: 'O22', name: 'Authorized institutional reporting and evidence',
    destination: 'continuity-intelligence', disposition: 'LIMITED',
    sources: ['/dashboard/intelligence', 'app/api/executive/metrics/route.ts'],
    gap: 'Executive metrics carry provenance and now use truthful names; export/evidence packaging for decisions is not wired.',
  },
  {
    id: 'O23', name: 'Officer changes, vacancies, transitions and succession',
    destination: 'continuity-intelligence', disposition: 'BLOCKED',
    sources: ['lib/executive/mandate.ts (expiry/revocation evaluated)'],
    gap: 'Authority re-evaluation on term end is modelled in the evaluator only. No successor mandate, handover workflow or provider-side revocation source exists; role reassignment is not succession.',
  },
  {
    id: 'O24', name: 'Institutional memory, decision rationale and obligations',
    destination: 'continuity-intelligence', disposition: 'LIMITED',
    sources: ['/dashboard/institutional-memory', 'app/api/continuity/*'],
    gap: 'Institutional-memory surface is parked and not in any persona nav. Decision rationale is not persisted (see O05).',
  },
  {
    id: 'O25', name: 'Human-reviewed OCRA/continuity intelligence',
    destination: 'continuity-intelligence', disposition: 'LIMITED',
    sources: ['/dashboard/continuity-intelligence', '/dashboard/governance-center'],
    gap: 'Pages label output assistive and review-required. Provenance, freshness and per-organization scope of the underlying graph are not proven here.',
  },
  {
    id: 'O26', name: 'Bilingual, accessible and mobile institutional workflows',
    destination: 'today', disposition: 'LIMITED',
    sources: ['app/[locale]/dashboard/executive', 'messages/*.json'],
    gap: 'Executive navigation labels are English literals; no native browser, bilingual, mobile or assistive-technology run has been performed.',
  },
];

export function getExecutiveDomain(id: ExecutiveDomainId): ExecutiveDomain {
  const domain = EXECUTIVE_DOMAINS.find((d) => d.id === id);
  if (!domain) throw new Error(`Unknown executive domain ${id}`);
  return domain;
}

export function executiveDomainsByDestination(key: ExecutiveDestinationKey): ExecutiveDomain[] {
  return EXECUTIVE_DOMAINS.filter((d) => d.destination === key);
}
