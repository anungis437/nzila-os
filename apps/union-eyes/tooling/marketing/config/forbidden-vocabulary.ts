/**
 * Forbidden / discouraged vocabulary for UnionEyes public marketing surfaces.
 *
 * This is the central narrative-CI ruleset. Hard-fail terms must never appear on
 * public marketing surfaces (`app/[locale]/(marketing)/**`, `messages/*.json`).
 * Warning-level terms are allowed but reported and counted toward narrative
 * drift scores.
 *
 * Authoring rules:
 *  - `term` is matched case-insensitively as a whole-phrase substring.
 *  - `publicOnly: true` => only enforced on public marketing surfaces.
 *  - `exceptions` => substrings whose presence in the matched line suppresses
 *    the violation (e.g., quoting a competitor, an explicit disclaimer).
 */

export type Severity = "hard-fail" | "warning";

export type Category =
  | "startup-saas"
  | "rip-and-replace"
  | "surveillance-ai"
  | "political"
  | "founder-optics"
  | "observability-guard"
  | "warning";

export interface ForbiddenTerm {
  term: string;
  severity: Severity;
  category: Category;
  publicOnly?: boolean;
  exceptions?: string[];
  suggestion?: string;
}

const startupSaas: ForbiddenTerm[] = [
  // Startup / Silicon Valley
  { term: "disrupt", severity: "hard-fail", category: "startup-saas", suggestion: "modernize | augment | layer onto" },
  { term: "revolutionize unions", severity: "hard-fail", category: "startup-saas" },
  { term: "growth hack", severity: "hard-fail", category: "startup-saas" },
  { term: "optimize workers", severity: "hard-fail", category: "startup-saas" },
  { term: "productivity-maximization", severity: "hard-fail", category: "startup-saas" },
  { term: "scale aggressively", severity: "hard-fail", category: "startup-saas" },
  { term: "move fast", severity: "hard-fail", category: "startup-saas" },
  { term: "dominate the market", severity: "hard-fail", category: "startup-saas" },
  { term: "automate democracy", severity: "hard-fail", category: "startup-saas" },
  { term: "AI-driven efficiency", severity: "hard-fail", category: "startup-saas" },
  { term: "workforce optimization", severity: "hard-fail", category: "startup-saas" },
  // Generic SaaS
  { term: "all-in-one", severity: "hard-fail", category: "startup-saas", suggestion: "overlay | continuity layer" },
  { term: "single source of truth", severity: "hard-fail", category: "startup-saas" },
  { term: "ultimate platform", severity: "hard-fail", category: "startup-saas" },
  { term: "productivity suite", severity: "hard-fail", category: "startup-saas" },
  { term: "workflow optimization", severity: "hard-fail", category: "startup-saas" },
  { term: "seamless automation", severity: "hard-fail", category: "startup-saas" },
  { term: "frictionless transformation", severity: "hard-fail", category: "startup-saas" },
  { term: "digital transformation leader", severity: "hard-fail", category: "startup-saas" },
  { term: "task management", severity: "hard-fail", category: "startup-saas" },
  { term: "team productivity", severity: "hard-fail", category: "startup-saas" },
  { term: "business optimization", severity: "hard-fail", category: "startup-saas" },
  // Phase 3: Conventions & Federated Governance — institutional framing guards
  { term: "transformation-first", severity: "hard-fail", category: "startup-saas" },
  { term: "event management", severity: "hard-fail", category: "startup-saas", suggestion: "convention coordination | governance coordination" },
  { term: "productivity optimization", severity: "hard-fail", category: "startup-saas" },
  { term: "automate governance", severity: "hard-fail", category: "startup-saas" },
  { term: "AI-led operations", severity: "hard-fail", category: "startup-saas" },
  { term: "workflow automation", severity: "hard-fail", category: "startup-saas" },
  { term: "attendee management", severity: "hard-fail", category: "startup-saas", suggestion: "delegate continuity" },
  // Phase 4: Buyer-facing SaaS-positioning guards (institutional infrastructure framing)
  { term: "operating system for unions", severity: "hard-fail", category: "startup-saas", suggestion: "institutional continuity infrastructure for unions" },
  { term: "another SaaS tool", severity: "hard-fail", category: "startup-saas" },
  { term: "another saas", severity: "hard-fail", category: "startup-saas" },
  { term: "SaaS tool", severity: "hard-fail", category: "startup-saas", exceptions: ["not a saas tool", "unlike saas tools"] },
  { term: "modules available", severity: "hard-fail", category: "startup-saas", suggestion: "continuity layers | governance domains" },
  { term: "module-level entitlements", severity: "hard-fail", category: "startup-saas", suggestion: "contractual scope | institutional licensing" },
  { term: "request a demo", severity: "hard-fail", category: "startup-saas", suggestion: "request an institutional briefing | request executive walkthrough" },
  { term: "book a demo", severity: "hard-fail", category: "startup-saas", suggestion: "book an institutional briefing" },
  { term: "AI-assisted triage", severity: "hard-fail", category: "startup-saas", suggestion: "reviewer-assisted intake under human oversight" },
];

const ripAndReplace: ForbiddenTerm[] = [
  { term: "rip and replace", severity: "hard-fail", category: "rip-and-replace", suggestion: "layer onto existing systems" },
  { term: "replace your systems", severity: "hard-fail", category: "rip-and-replace" },
  { term: "migration-first", severity: "hard-fail", category: "rip-and-replace" },
  { term: "fully replace", severity: "hard-fail", category: "rip-and-replace" },
  { term: "eliminate existing tools", severity: "hard-fail", category: "rip-and-replace" },
  { term: "one platform for everything", severity: "hard-fail", category: "rip-and-replace" },
];

const surveillanceAi: ForbiddenTerm[] = [
  { term: "organizer productivity scoring", severity: "hard-fail", category: "surveillance-ai" },
  { term: "worker scoring", severity: "hard-fail", category: "surveillance-ai" },
  { term: "behavioural analytics", severity: "hard-fail", category: "surveillance-ai" },
  { term: "behavioral analytics", severity: "hard-fail", category: "surveillance-ai" },
  { term: "workforce surveillance", severity: "hard-fail", category: "surveillance-ai" },
  { term: "predictive worker monitoring", severity: "hard-fail", category: "surveillance-ai" },
  { term: "engagement optimization", severity: "hard-fail", category: "surveillance-ai" },
  { term: "attention tracking", severity: "hard-fail", category: "surveillance-ai" },
  // Workstream D: AI semantic alignment — reject autonomous-AI framing
  { term: "AI-powered case triage", severity: "hard-fail", category: "surveillance-ai", suggestion: "reviewer-assisted case triage under entitlement governance" },
  { term: "AI-powered grievance triage", severity: "hard-fail", category: "surveillance-ai", suggestion: "reviewer-assisted grievance triage" },
  { term: "AI-led decisioning", severity: "hard-fail", category: "surveillance-ai", suggestion: "reviewer-led decisions assisted by governed reasoning" },
  { term: "governance automation", severity: "hard-fail", category: "surveillance-ai", suggestion: "governance of record | governed reasoning" },
  { term: "behavioural optimization", severity: "hard-fail", category: "surveillance-ai" },
  { term: "behavioral optimization", severity: "hard-fail", category: "surveillance-ai" },
  { term: "influence analysis", severity: "hard-fail", category: "surveillance-ai" },
  { term: "organizer scoring", severity: "hard-fail", category: "surveillance-ai" },
  // Workstream E: Continuity / trust / chronology semantic alignment — reject autonomous-AI oversight framing
  { term: "AI-led oversight", severity: "hard-fail", category: "surveillance-ai", suggestion: "reviewer-led oversight assisted by governed reasoning" },
  { term: "predictive governance", severity: "hard-fail", category: "surveillance-ai", suggestion: "governance of record | continuity-aware governance" },
  { term: "AI conclusions", severity: "hard-fail", category: "surveillance-ai", suggestion: "reviewer-confirmed conclusions | governed reasoning outputs" },
  { term: "automated governance interpretation", severity: "hard-fail", category: "surveillance-ai" },
  { term: "autonomous institutional reasoning", severity: "hard-fail", category: "surveillance-ai", suggestion: "reviewer-assisted institutional reasoning under human oversight" },
  // Workstream F: Inline runtime copy convergence — reject behavioural / scoring / war-room framing on internal surfaces
  { term: "behavioural governance", severity: "hard-fail", category: "surveillance-ai", suggestion: "governance of record | reviewer-led governance" },
  { term: "behavioral governance", severity: "hard-fail", category: "surveillance-ai", suggestion: "governance of record | reviewer-led governance" },
  { term: "organizational analytics", severity: "hard-fail", category: "surveillance-ai", suggestion: "institutional intelligence | continuity-aware reporting" },
  { term: "leadership analytics", severity: "hard-fail", category: "surveillance-ai", suggestion: "institutional intelligence" },
  { term: "institutional scoring", severity: "hard-fail", category: "surveillance-ai", suggestion: "reviewer-assisted institutional intelligence" },
  { term: "operational war room", severity: "hard-fail", category: "surveillance-ai", suggestion: "continuity console | continuity operations" },
];

// Workstream E: Continuity / operations-centre framing guards.
// These reject industrial command-centre / optimization-engine framing on
// public marketing surfaces. They are publicOnly to avoid disturbing internal
// runtime telemetry copy.
const continuitySaas: ForbiddenTerm[] = [
  { term: "monitoring engine", severity: "hard-fail", category: "startup-saas", publicOnly: true, suggestion: "continuity safeguards | chronology of record" },
  { term: "optimization layer", severity: "hard-fail", category: "startup-saas", publicOnly: true },
  { term: "operational command center", severity: "hard-fail", category: "startup-saas", publicOnly: true, suggestion: "continuity console | continuity operations" },
  { term: "operational control room", severity: "hard-fail", category: "startup-saas", publicOnly: true },
  { term: "executive optimization", severity: "hard-fail", category: "startup-saas", publicOnly: true },
  { term: "governance management system", severity: "hard-fail", category: "startup-saas", publicOnly: true, suggestion: "governance of record" },
  { term: "governance optimization engine", severity: "hard-fail", category: "startup-saas", publicOnly: true },
  { term: "event stream optimization", severity: "hard-fail", category: "startup-saas", publicOnly: true },
];

const political: ForbiddenTerm[] = [
  { term: "democratize unions", severity: "hard-fail", category: "political" },
  { term: "activist platform", severity: "hard-fail", category: "political" },
  { term: "movement organizing engine", severity: "hard-fail", category: "political" },
  { term: "power redistribution", severity: "hard-fail", category: "political" },
  { term: "governance reform engine", severity: "hard-fail", category: "political" },
];

// Founder-optics terms are now enforced **globally** (public marketing AND
// internal runtime surfaces). The narrative posture is institutional from the
// inside out — staff-facing dashboards, services, and lib copy must not lapse
// into founder-control framing either. Workstream B4.
const founderOptics: ForbiddenTerm[] = [
  { term: "golden share", severity: "hard-fail", category: "founder-optics" },
  { term: "governance lock", severity: "hard-fail", category: "founder-optics" },
  { term: "founder control", severity: "hard-fail", category: "founder-optics" },
  { term: "ownership protection structure", severity: "hard-fail", category: "founder-optics" },
  { term: "control mechanism", severity: "hard-fail", category: "founder-optics" },
];

const warningLevel: ForbiddenTerm[] = [
  { term: "transformation", severity: "warning", category: "warning" },
  { term: "automation", severity: "warning", category: "warning" },
  { term: "AI-powered", severity: "warning", category: "warning" },
  { term: "centralized", severity: "warning", category: "warning" },
  { term: "decentralized", severity: "warning", category: "warning" },
  { term: "revolutionary", severity: "warning", category: "warning" },
  { term: "disruption", severity: "warning", category: "warning" },
  { term: "platform", severity: "warning", category: "warning" },
  { term: "ecosystem", severity: "warning", category: "warning" },
  // Phase 4: Buyer-tone warnings (counted toward maturity drift; not hard-fails)
  { term: "operating system", severity: "warning", category: "warning" },
  { term: "module-level", severity: "warning", category: "warning" },
  { term: "request a demo", severity: "warning", category: "warning" },
  { term: "casework into", severity: "warning", category: "warning" },
  { term: "no commitment", severity: "warning", category: "warning" },
  // Workstream D: AI credit framing drifts toward consumer-SaaS posture
  { term: "AI credits", severity: "warning", category: "warning" },
  { term: "credits per billing cycle", severity: "warning", category: "warning" },
  // Workstream E: Continuity-drift warnings — counted toward maturity score
  { term: "knowledge management", severity: "warning", category: "warning" },
  { term: "document repository", severity: "warning", category: "warning", publicOnly: true },
  { term: "enterprise wiki", severity: "warning", category: "warning" },
  { term: "content library", severity: "warning", category: "warning" },
  { term: "process acceleration", severity: "warning", category: "warning" },
  { term: "operational sequencing", severity: "warning", category: "warning" },
  { term: "activity analytics", severity: "warning", category: "warning" },
  { term: "audit engine", severity: "warning", category: "warning" },
  { term: "compliance monitor", severity: "warning", category: "warning" },
  { term: "operational oversight", severity: "warning", category: "warning" },
  // Workstream F: Inline runtime copy convergence — soft warnings for command / intelligence drift
  { term: "decision intelligence", severity: "warning", category: "warning" },
  { term: "fragility analysis", severity: "warning", category: "warning" },
  { term: "governance intelligence", severity: "warning", category: "warning" },
  { term: "intelligence cockpit", severity: "warning", category: "warning" },
  { term: "executive command", severity: "warning", category: "warning" },
  // "governance" intentionally excluded from warning — counted via balance rule.
];

// Workstream G: Institutional Observability Surfaces.
// Observability surfaces must answer "how did this institutional state emerge?" —
// NEVER "how do we optimize institutional behaviour?". The following compound
// terms are scoring / ranking / prediction / behavioural-analytics framings that
// would re-introduce surveillance posture into observability views. Hard-fail on
// every surface. Compound phrases are used (instead of bare "score", "rank",
// "average", etc.) to avoid false positives in unrelated marketing copy while
// still catching the doctrine-violating constructions.
const observabilityGuards: ForbiddenTerm[] = [
  { term: "trust score", severity: "hard-fail", category: "observability-guard", suggestion: "explainability record | provenance coverage" },
  { term: "trustscore", severity: "hard-fail", category: "observability-guard" },
  { term: "influence score", severity: "hard-fail", category: "observability-guard" },
  { term: "influence ranking", severity: "hard-fail", category: "observability-guard" },
  { term: "behavioural prediction", severity: "hard-fail", category: "observability-guard" },
  { term: "behavioral prediction", severity: "hard-fail", category: "observability-guard" },
  { term: "behaviour forecast", severity: "hard-fail", category: "observability-guard" },
  { term: "behavior forecast", severity: "hard-fail", category: "observability-guard" },
  { term: "behavioural scoring", severity: "hard-fail", category: "observability-guard" },
  { term: "behavioral scoring", severity: "hard-fail", category: "observability-guard" },
  { term: "decision recommendation", severity: "hard-fail", category: "observability-guard", suggestion: "explainability record" },
  { term: "automated recommendation", severity: "hard-fail", category: "observability-guard" },
  { term: "predictive influence", severity: "hard-fail", category: "observability-guard" },
  { term: "stability index", severity: "hard-fail", category: "observability-guard" },
  { term: "stability score", severity: "hard-fail", category: "observability-guard" },
  { term: "efficiency rating", severity: "hard-fail", category: "observability-guard" },
  { term: "efficiency score", severity: "hard-fail", category: "observability-guard" },
  { term: "governance score", severity: "hard-fail", category: "observability-guard" },
  { term: "institutional ranking", severity: "hard-fail", category: "observability-guard" },
  { term: "caucus tracker", severity: "hard-fail", category: "observability-guard" },
  { term: "member sentiment score", severity: "hard-fail", category: "observability-guard" },
  { term: "engagement score", severity: "hard-fail", category: "observability-guard" },
  { term: "weighted decision", severity: "hard-fail", category: "observability-guard" },
  { term: "compliance percent", severity: "hard-fail", category: "observability-guard" },
  { term: "average compliance", severity: "hard-fail", category: "observability-guard" },
];

// Workstream J: Trust & Procurement Runtime Convergence.
// Reject framings that re-introduce platform-dominance, command-and-control
// deployment, monolithic-replacement, or autonomous-procurement posture into
// onboarding, procurement, evidence, sovereignty, and continuity surfaces.
// These extend (do not duplicate) prior startup-saas / surveillance-ai
// guards — they harden the trust + procurement + runtime convergence boundary.
const trustProcurementRuntime: ForbiddenTerm[] = [
  { term: "transformation platform", severity: "hard-fail", category: "startup-saas", suggestion: "institutional continuity infrastructure | continuity overlay" },
  { term: "platform dominance", severity: "hard-fail", category: "startup-saas" },
  { term: "institutional monitoring", severity: "hard-fail", category: "surveillance-ai", suggestion: "institutional observability of record | inspectable operational posture" },
  { term: "centralized control", severity: "hard-fail", category: "startup-saas", suggestion: "federation-aware operations | sovereignty-conscious deployment" },
  { term: "command-and-control deployment", severity: "hard-fail", category: "startup-saas", suggestion: "governance-safe deployment | continuity-aware deployment" },
  { term: "all-in-one replacement", severity: "hard-fail", category: "rip-and-replace", suggestion: "additive overlay | continuity layer" },
  { term: "single-vendor lock-in", severity: "hard-fail", category: "startup-saas", suggestion: "sovereignty-conscious procurement | federation-aware operations" },
  { term: "rip-and-replace deployment", severity: "hard-fail", category: "rip-and-replace", suggestion: "layered modernization | governance-safe deployment" },
  { term: "vendor lock-in", severity: "hard-fail", category: "startup-saas", exceptions: ["avoids vendor lock-in", "no vendor lock-in", "without vendor lock-in"] },
  { term: "AI-driven procurement", severity: "hard-fail", category: "surveillance-ai", suggestion: "reviewer-led procurement assisted by governed reasoning" },
  { term: "autonomous deployment", severity: "hard-fail", category: "surveillance-ai", suggestion: "reviewer-led, governance-safe deployment" },
  { term: "autonomous onboarding", severity: "hard-fail", category: "surveillance-ai", suggestion: "continuity-aware onboarding under reviewer oversight" },
  { term: "procurement automation", severity: "hard-fail", category: "surveillance-ai", suggestion: "reviewer-assisted procurement of record" },
  { term: "evidence automation", severity: "hard-fail", category: "surveillance-ai", suggestion: "evidence provenance under reviewer oversight" },
];

// Workstream K: Institutional Topology UX guards.
// Reject framings that reintroduce social-graph / influence-mapping /
// analytics-cockpit posture into hierarchy, affiliation, delegation,
// representation, lineage, or continuity-aware topology surfaces. These
// extend (do not duplicate) prior surveillance-ai / observability /
// ontology guards. Compound phrases avoid false positives.
const topologyUx: ForbiddenTerm[] = [
  { term: "influence network", severity: "hard-fail", category: "surveillance-ai", suggestion: "affiliation structure | continuity-linked relationships" },
  { term: "influence visualization", severity: "hard-fail", category: "surveillance-ai", suggestion: "institutional topology | inspectable institutional relationships" },
  { term: "social topology", severity: "hard-fail", category: "surveillance-ai", suggestion: "institutional topology" },
  { term: "social graph", severity: "hard-fail", category: "surveillance-ai", suggestion: "institutional topology | affiliation structure" },
  { term: "power relationships", severity: "hard-fail", category: "surveillance-ai", suggestion: "continuity-linked relationships | governance lineage" },
  { term: "leadership mapping", severity: "hard-fail", category: "surveillance-ai", suggestion: "representation continuity | governance lineage" },
  { term: "organizational monitoring", severity: "hard-fail", category: "surveillance-ai", suggestion: "institutional observability of record" },
  { term: "topology optimization", severity: "hard-fail", category: "surveillance-ai", suggestion: "inspectable institutional topology" },
  { term: "enterprise hierarchy dashboard", severity: "hard-fail", category: "surveillance-ai", suggestion: "institutional hierarchy view" },
  { term: "AI topology", severity: "hard-fail", category: "surveillance-ai", suggestion: "institutional topology under reviewer oversight" },
  { term: "graph theater", severity: "hard-fail", category: "surveillance-ai", suggestion: "inspectable institutional topology" },
  { term: "network mapping", severity: "hard-fail", category: "surveillance-ai", suggestion: "affiliation structure | governance lineage" },
];

// Workstream L: Governance Chronology UX guards.
// Reject framings that reintroduce activity-stream / behavioural-monitoring /
// productivity-analytics / executive-oversight posture into procedural
// timelines, evolution rails, lineage ladders, continuity progression,
// epoch dividers, or chronology explainability surfaces. Compound phrases
// avoid false positives.
const chronologyUx: ForbiddenTerm[] = [
  { term: "activity stream", severity: "hard-fail", category: "surveillance-ai", suggestion: "procedural timeline of record" },
  { term: "operational replay", severity: "hard-fail", category: "surveillance-ai", suggestion: "procedural history of record" },
  { term: "governance analytics", severity: "hard-fail", category: "surveillance-ai", suggestion: "governance chronology of record" },
  { term: "productivity timeline", severity: "hard-fail", category: "surveillance-ai", suggestion: "procedural timeline of record" },
  { term: "behavioural chronology", severity: "hard-fail", category: "surveillance-ai", suggestion: "governance chronology of record" },
  { term: "behavioral chronology", severity: "hard-fail", category: "surveillance-ai", suggestion: "governance chronology of record" },
  { term: "executive oversight timeline", severity: "hard-fail", category: "surveillance-ai", suggestion: "governance chronology of record" },
  { term: "governance optimization chronology", severity: "hard-fail", category: "surveillance-ai", suggestion: "governance chronology of record" },
  { term: "institutional scoring", severity: "hard-fail", category: "surveillance-ai", suggestion: "preserved institutional records | governance chronology of record" },
  { term: "timeline analytics", severity: "hard-fail", category: "surveillance-ai", suggestion: "procedural timeline of record" },
  { term: "chronology optimization", severity: "hard-fail", category: "surveillance-ai", suggestion: "governance chronology of record" },
  { term: "continuity scoring", severity: "hard-fail", category: "surveillance-ai", suggestion: "continuity progression of record" },
];

// Workstream I: Ontology reconciliation & institutional semantic governance.
// Reject framings that re-introduce optimization / autonomous-AI / topology-
// analytics / surveillance posture into governance language at the ontology
// boundary. Compound phrases avoid false positives in unrelated marketing
// copy. These extend (do not duplicate) prior surveillance-ai / observability
// guards.
const ontologyReconciliation: ForbiddenTerm[] = [
  { term: "governance optimization", severity: "hard-fail", category: "surveillance-ai", suggestion: "governance of record | continuity-aware governance" },
  { term: "organizational intelligence", severity: "hard-fail", category: "surveillance-ai", suggestion: "institutional intelligence | continuity-aware reporting" },
  { term: "topology analytics", severity: "hard-fail", category: "surveillance-ai", suggestion: "institutional structure of record" },
  { term: "governance topology analytics", severity: "hard-fail", category: "surveillance-ai" },
  { term: "governance AI", severity: "hard-fail", category: "surveillance-ai", suggestion: "reviewer-assisted governed reasoning under human oversight" },
  { term: "governance command system", severity: "hard-fail", category: "surveillance-ai", suggestion: "continuity console | governance of record" },
  { term: "governance command systems", severity: "hard-fail", category: "surveillance-ai" },
  { term: "institutional surveillance", severity: "hard-fail", category: "surveillance-ai", suggestion: "institutional observability of record" },
];

export const FORBIDDEN_VOCABULARY: ForbiddenTerm[] = [
  ...startupSaas,
  ...ripAndReplace,
  ...surveillanceAi,
  ...continuitySaas,
  ...political,
  ...founderOptics,
  ...observabilityGuards,
  ...ontologyReconciliation,
  ...trustProcurementRuntime,
  ...topologyUx,
  ...chronologyUx,
  ...warningLevel,
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ga-check:exempt — regex compile cache, not persistence
const TERM_REGEX_CACHE = new Map<string, RegExp>();
function regexFor(term: string): RegExp {
  let r = TERM_REGEX_CACHE.get(term);
  if (!r) {
    // Word-boundary match so "disrupt" doesn't match "disruption", etc.
    r = new RegExp(`\\b${escapeRegExp(term)}\\b`, "i");
    TERM_REGEX_CACHE.set(term, r);
  }
  return r;
}

export function findViolations(
  text: string,
  opts: { isPublicSurface: boolean },
): Array<{ term: ForbiddenTerm; line: number; excerpt: string }> {
  const lines = text.split(/\r?\n/);
  const hits: Array<{ term: ForbiddenTerm; line: number; excerpt: string }> = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();
    for (const term of FORBIDDEN_VOCABULARY) {
      if (term.publicOnly && !opts.isPublicSurface) continue;
      if (!regexFor(term.term).test(line)) continue;
      if (term.exceptions?.some((ex) => lower.includes(ex.toLowerCase()))) continue;
      hits.push({ term, line: i + 1, excerpt: line.trim().slice(0, 200) });
    }
  }
  return hits;
}
