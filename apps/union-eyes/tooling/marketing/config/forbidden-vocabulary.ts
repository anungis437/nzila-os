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
  { term: "transformation", severity: "warning", category: "warning", publicOnly: true },
  { term: "automation", severity: "warning", category: "warning", publicOnly: true },
  { term: "AI-powered", severity: "warning", category: "warning", publicOnly: true },
  { term: "centralized", severity: "warning", category: "warning", publicOnly: true },
  { term: "decentralized", severity: "warning", category: "warning", publicOnly: true },
  { term: "revolutionary", severity: "warning", category: "warning", publicOnly: true },
  { term: "disruption", severity: "warning", category: "warning", publicOnly: true },
  {
    // Wave 18.1 — "platform" is fenced against drift in marketing prose, but
    // permitted in a narrow allowlist of structural product-noun contexts where
    // the term is a faithful noun, not a startup-SaaS positioning move. Each
    // exception is a case-insensitive substring; if any matches the line, the
    // hit is suppressed. To extend the allowlist, the new context must be a
    // structural surface (label, breadcrumb, legal noun, redirect metadata,
    // proper-name compound) — not new marketing copy.
    term: "platform",
    severity: "warning",
    category: "warning",
    publicOnly: true,
    suggestion: "substrate | continuity layer | operating environment",
    exceptions: [
      // Product-name compound (titles, redirect metadata, sign-in surfaces).
      "unioneyes platform",
      // Feature-module badge label.
      "platform module",
      // Pricing CTA secondary action label.
      "platform overview",
      // Breadcrumb hierarchy label `Platform · X`.
      "platform · ",
      // Legacy /platform/* redirect description.
      "canonical platform",
      // Legal / Terms / Privacy / Trust noun-language ("the platform is",
      // "every action on the platform", "misuse the platform", "the platform
      // provides", "validate the platform"). Codifies legal noun usage.
      "the platform",
      // Accessibility Statement ("Our platform is regularly audited").
      "our platform",
      // Status page convention ("UnionEyes platform services").
      "platform services",
      // Financial reconciliation noun ("Match platform billing", "Platform
      // billing reconciles").
      "platform billing",
      // Home proof section structural label ("Built-in platform guarantees").
      "platform guarantees",
      // Terms of Service definitional clause ("is a platform designed for…").
      "platform designed",
      // JSON nav/section structural label (key + identical value).
      '"platform": "platform"',
    ],
  },
  { term: "ecosystem", severity: "warning", category: "warning", publicOnly: true },
  // Phase 4: Buyer-tone warnings (counted toward maturity drift; not hard-fails)
  { term: "operating system", severity: "warning", category: "warning", publicOnly: true },
  { term: "module-level", severity: "warning", category: "warning", publicOnly: true },
  { term: "request a demo", severity: "warning", category: "warning", publicOnly: true },
  { term: "casework into", severity: "warning", category: "warning", publicOnly: true },
  { term: "no commitment", severity: "warning", category: "warning", publicOnly: true },
  // Workstream D: AI credit framing drifts toward consumer-SaaS posture
  { term: "AI credits", severity: "warning", category: "warning", publicOnly: true },
  { term: "credits per billing cycle", severity: "warning", category: "warning", publicOnly: true },
  // Workstream E: Continuity-drift warnings — counted toward maturity score
  { term: "knowledge management", severity: "warning", category: "warning", publicOnly: true },
  { term: "document repository", severity: "warning", category: "warning", publicOnly: true },
  { term: "enterprise wiki", severity: "warning", category: "warning", publicOnly: true },
  { term: "content library", severity: "warning", category: "warning", publicOnly: true },
  { term: "process acceleration", severity: "warning", category: "warning", publicOnly: true },
  { term: "operational sequencing", severity: "warning", category: "warning", publicOnly: true },
  { term: "activity analytics", severity: "warning", category: "warning", publicOnly: true },
  { term: "audit engine", severity: "warning", category: "warning", publicOnly: true },
  { term: "compliance monitor", severity: "warning", category: "warning", publicOnly: true },
  { term: "operational oversight", severity: "warning", category: "warning", publicOnly: true },
  // Workstream F: Inline runtime copy convergence — soft warnings for command / intelligence drift
  { term: "decision intelligence", severity: "warning", category: "warning", publicOnly: true },
  { term: "fragility analysis", severity: "warning", category: "warning", publicOnly: true },
  { term: "governance intelligence", severity: "warning", category: "warning", publicOnly: true },
  { term: "intelligence cockpit", severity: "warning", category: "warning", publicOnly: true },
  { term: "executive command", severity: "warning", category: "warning", publicOnly: true },
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
  { term: "governance monitoring", severity: "hard-fail", category: "surveillance-ai", suggestion: "governance chronology of record | governance-safe visibility" },
  { term: "influence mapping", severity: "hard-fail", category: "surveillance-ai", suggestion: "institutional topology | inspectable institutional relationships" },
  { term: "predictive governance", severity: "hard-fail", category: "surveillance-ai", suggestion: "governance chronology of record" },
  { term: "organizational scoring", severity: "hard-fail", category: "surveillance-ai", suggestion: "inspectable institutional state" },
  { term: "behavioural governance", severity: "hard-fail", category: "surveillance-ai", suggestion: "governance of record" },
  { term: "behavioral governance", severity: "hard-fail", category: "surveillance-ai", suggestion: "governance of record" },
];

// Wave 2 — Depth convergence narrative governance expansion.
// As Wave 2 hydrates continuity, chronology, topology, provenance, and
// explainability overlays into more institutional surfaces, these compound
// terms are explicitly forbidden so the deeper hydration cannot quietly
// reintroduce analytics / surveillance / scoring / autonomous-governance
// posture under a "richer" footer. Compound phrases avoid false positives.
const wave2DepthConvergence: ForbiddenTerm[] = [
  { term: "governance scoring", severity: "hard-fail", category: "surveillance-ai", suggestion: "governance of record | explainability record" },
  { term: "continuity optimization", severity: "hard-fail", category: "surveillance-ai", suggestion: "continuity safeguards | continuity progression of record" },
  { term: "continuity scoring", severity: "hard-fail", category: "surveillance-ai", suggestion: "continuity progression of record" },
  { term: "operational optimization", severity: "hard-fail", category: "surveillance-ai", suggestion: "governance-safe operations | continuity-aware operations" },
  { term: "executive oversight engine", severity: "hard-fail", category: "surveillance-ai", suggestion: "governance chronology of record" },
  { term: "provenance scoring", severity: "hard-fail", category: "surveillance-ai", suggestion: "provenance record | explainability record" },
  { term: "explainability scoring", severity: "hard-fail", category: "surveillance-ai", suggestion: "explainability record" },
  { term: "topology scoring", severity: "hard-fail", category: "surveillance-ai", suggestion: "institutional structure of record" },
  { term: "lineage scoring", severity: "hard-fail", category: "surveillance-ai", suggestion: "lineage record | continuity progression of record" },
  { term: "memory scoring", severity: "hard-fail", category: "surveillance-ai", suggestion: "preserved institutional record" },
  { term: "AI governance orchestration", severity: "hard-fail", category: "surveillance-ai", suggestion: "reviewer-led governance | governance of record" },
  { term: "autonomous continuity", severity: "hard-fail", category: "surveillance-ai", suggestion: "reviewer-assisted continuity under human oversight" },
  { term: "predictive continuity", severity: "hard-fail", category: "surveillance-ai", suggestion: "continuity progression of record" },
];

// Wave 3 — Continuity cognition narrative governance expansion.
// Wave 3 introduces a substrate-presence cognition overlay (counts and refs)
// over the Wave 2 continuity foundations. These compound phrases would imply
// AI orchestration, scoring, ranking, alerting, automation, or behavioural
// governance posture that Wave 3 explicitly refuses to take on. Hard-fail
// keeps the cognition layer institutional rather than predictive.
const wave3ContinuityCognition: ForbiddenTerm[] = [
  { term: "continuity AI", severity: "hard-fail", category: "surveillance-ai", suggestion: "continuity cognition (substrate presence) | continuity progression of record" },
  { term: "institutional risk scoring", severity: "hard-fail", category: "surveillance-ai", suggestion: "institutional continuity of record" },
  { term: "succession scoring", severity: "hard-fail", category: "surveillance-ai", suggestion: "succession pathway of record" },
  { term: "memory-gap scoring", severity: "hard-fail", category: "surveillance-ai", suggestion: "institutional memory gap (presence count)" },
  { term: "fragility scoring", severity: "hard-fail", category: "surveillance-ai", suggestion: "procedural fragility refs (substrate presence)" },
  { term: "continuity ranking", severity: "hard-fail", category: "surveillance-ai", suggestion: "continuity progression of record" },
  { term: "continuity automation", severity: "hard-fail", category: "surveillance-ai", suggestion: "reviewer-led continuity stewardship" },
  { term: "intervention recommendation", severity: "hard-fail", category: "surveillance-ai", suggestion: "reviewer-led stewardship pathway" },
  { term: "executive alerting", severity: "hard-fail", category: "surveillance-ai", suggestion: "explainability record | reviewer attention prompt" },
  { term: "governance optimization engine", severity: "hard-fail", category: "surveillance-ai", suggestion: "governance of record | reviewer-led governance" },
  { term: "behavioural continuity", severity: "hard-fail", category: "surveillance-ai", suggestion: "institutional continuity (structural)" },
  { term: "continuity surveillance", severity: "hard-fail", category: "surveillance-ai", suggestion: "continuity visibility (read-only, provenance-stamped)" },
];

// Wave 4 — Institutional language, label & surface convergence.
// Wave 4 converges runtime language: navigation labels, route headings,
// chips, helper copy, onboarding/admin posture, and locale parity. These
// compound terms are explicitly forbidden so the platform cannot quietly
// re-adopt enterprise-SaaS, executive-dashboard, operational-analytics,
// or organizational-monitoring posture under refactored labels. The
// rewarded direction is stewardship-oriented, chronology-aware,
// provenance-stamped, governance-safe institutional vocabulary.
const wave4LanguageConvergence: ForbiddenTerm[] = [
  { term: "executive dashboard", severity: "hard-fail", category: "startup-saas", publicOnly: false, suggestion: "executive continuity coordination | governance visibility surface" },
  { term: "operational review", severity: "hard-fail", category: "surveillance-ai", suggestion: "continuity review | governance review of record" },
  { term: "operational dashboard", severity: "hard-fail", category: "startup-saas", suggestion: "continuity coordination surface | runtime visibility surface" },
  { term: "operational analytics", severity: "hard-fail", category: "surveillance-ai", suggestion: "continuity visibility (read-only)" },
  { term: "executive insights", severity: "hard-fail", category: "surveillance-ai", suggestion: "executive continuity context | governance visibility" },
  { term: "executive analytics", severity: "hard-fail", category: "surveillance-ai", suggestion: "executive continuity context (read-only)" },
  { term: "organizational intelligence", severity: "hard-fail", category: "surveillance-ai", suggestion: "institutional continuity context" },
  { term: "organizational monitoring", severity: "hard-fail", category: "surveillance-ai", suggestion: "institutional visibility (read-only, provenance-stamped)" },
  { term: "performance management", severity: "hard-fail", category: "surveillance-ai", suggestion: "stewardship of record | continuity review" },
  { term: "management oversight", severity: "hard-fail", category: "surveillance-ai", suggestion: "human oversight | reviewer-led oversight" },
  { term: "management posture", severity: "hard-fail", category: "surveillance-ai", suggestion: "stewardship posture" },
  { term: "command and control", severity: "hard-fail", category: "startup-saas", suggestion: "coexistence-safe coordination | federation-safe coordination" },
  { term: "operational telemetry posture", severity: "hard-fail", category: "surveillance-ai", suggestion: "runtime visibility posture (read-only)" },
  { term: "enterprise control posture", severity: "hard-fail", category: "startup-saas", suggestion: "stewardship-oriented administration | coexistence-safe administration" },
  { term: "alert semantics", severity: "hard-fail", category: "surveillance-ai", suggestion: "reviewer attention prompt (human-reviewed)" },
];

// Wave 5 — Quebec & multilingual institutional parity guards.
// Wave 5 extends narrative governance into fr / fr-CA / pt / it so SaaS,
// executive-dashboard, surveillance, operational-management, and
// governance-scoring posture cannot quietly re-enter through localized copy.
// Rewarded direction: continuité institutionnelle, chronologie, provenance,
// explicabilité, supervision humaine, traçabilité procédurale, mémoire
// institutionnelle, visibilité de gouvernance, coordination fédérative,
// coexistence, garanties de continuité.
const wave5MultilingualParity: ForbiddenTerm[] = [
  // English variants strengthened for multilingual parity
  { term: "command center", severity: "hard-fail", category: "startup-saas", suggestion: "coordination workspace | continuity workspace" },
  { term: "operations center", severity: "hard-fail", category: "startup-saas", suggestion: "operational continuity workspace | continuity workspace" },
  // Quebec / France French SaaS, executive-dashboard, surveillance variants
  { term: "tableau de bord exécutif", severity: "hard-fail", category: "startup-saas", suggestion: "coordination de continuité | espace de coordination de gouvernance" },
  { term: "centre de commande", severity: "hard-fail", category: "startup-saas", suggestion: "espace de coordination | espace de continuité" },
  { term: "centre des opérations", severity: "hard-fail", category: "startup-saas", suggestion: "espace de continuité opérationnelle" },
  { term: "centre d'opérations", severity: "hard-fail", category: "startup-saas", suggestion: "espace de continuité opérationnelle" },
  { term: "analytique opérationnelle", severity: "hard-fail", category: "surveillance-ai", suggestion: "visibilité opérationnelle (lecture seule) | visibilité de gouvernance" },
  { term: "surveillance institutionnelle", severity: "hard-fail", category: "surveillance-ai", suggestion: "visibilité institutionnelle en lecture seule" },
  { term: "supervision opérationnelle", severity: "hard-fail", category: "surveillance-ai", suggestion: "supervision humaine | validation humaine requise" },
  { term: "optimisation de gouvernance", severity: "hard-fail", category: "surveillance-ai", suggestion: "gouvernance de référence | traçabilité procédurale" },
  { term: "notation institutionnelle", severity: "hard-fail", category: "surveillance-ai", suggestion: "registre institutionnel (sans notation automatisée)" },
  { term: "gouvernance prédictive", severity: "hard-fail", category: "surveillance-ai", suggestion: "raisonnement de gouvernance explicable (validé par humain)" },
  { term: "pilotage exécutif", severity: "hard-fail", category: "startup-saas", suggestion: "coordination exécutive de continuité" },
  // Portuguese extension-locale safety
  { term: "painel executivo", severity: "hard-fail", category: "startup-saas", suggestion: "coordenação de continuidade | espaço de continuidade" },
  { term: "centro de comando", severity: "hard-fail", category: "startup-saas", suggestion: "espaço de coordenação" },
  { term: "vigilância institucional", severity: "hard-fail", category: "surveillance-ai", suggestion: "visibilidade institucional somente leitura" },
  { term: "otimização de governança", severity: "hard-fail", category: "surveillance-ai", suggestion: "governança de referência | rastreabilidade procedural" },
  // Italian extension-locale safety
  { term: "pannello esecutivo", severity: "hard-fail", category: "startup-saas", suggestion: "coordinamento di continuità | spazio di continuità" },
  { term: "cruscotto esecutivo", severity: "hard-fail", category: "startup-saas", suggestion: "coordinamento di continuità" },
  { term: "centro di comando", severity: "hard-fail", category: "startup-saas", suggestion: "spazio di coordinamento" },
  { term: "sorveglianza istituzionale", severity: "hard-fail", category: "surveillance-ai", suggestion: "visibilità istituzionale in sola lettura" },
  { term: "ottimizzazione della governance", severity: "hard-fail", category: "surveillance-ai", suggestion: "governance di riferimento | tracciabilità procedurale" },
];

// Wave 6 — Runtime Cockpit Convergence & Hydration Completion.
// Fence runtime-cockpit / telemetry / analytics-orchestration drift that
// could quietly re-enter as runtime surfaces deepen their hydration. These
// terms target the runtime-cockpit category specifically (chronology,
// topology, continuity, cognition, provenance analytics/orchestration
// variants), enterprise-administration posture in admin/onboarding copy,
// and "executive cockpit" framings on observability surfaces. Rewarded
// substitutes lean on continuity, stewardship, traceability, explainable
// reasoning, and read-only institutional visibility.
const wave6RuntimeCockpit: ForbiddenTerm[] = [
  // Runtime cockpit / executive cockpit posture
  { term: "runtime cockpit", severity: "hard-fail", category: "startup-saas", suggestion: "runtime continuity workspace | continuity-aware runtime visibility" },
  { term: "executive cockpit", severity: "hard-fail", category: "startup-saas", suggestion: "coordination workspace | continuity coordination surface" },
  { term: "governance cockpit", severity: "hard-fail", category: "startup-saas", suggestion: "governance coordination surface | governance-of-record workspace" },
  { term: "institutional cockpit", severity: "hard-fail", category: "startup-saas", suggestion: "institutional coordination surface" },
  // Telemetry posture (extends Wave 1's operational-telemetry-posture)
  { term: "institutional telemetry", severity: "hard-fail", category: "surveillance-ai", suggestion: "institutional visibility of record (read-only, provenance-stamped)" },
  { term: "continuity telemetry", severity: "hard-fail", category: "surveillance-ai", suggestion: "continuity visibility of record" },
  { term: "topology telemetry", severity: "hard-fail", category: "surveillance-ai", suggestion: "topology visibility of record" },
  { term: "chronology telemetry", severity: "hard-fail", category: "surveillance-ai", suggestion: "chronology of record" },
  { term: "cognition telemetry", severity: "hard-fail", category: "surveillance-ai", suggestion: "cognition reasoning trace (reviewer-validated)" },
  { term: "governance telemetry", severity: "hard-fail", category: "surveillance-ai", suggestion: "governance chronology of record" },
  // Analytics-posture spread into substrate categories
  { term: "chronology analytics", severity: "hard-fail", category: "surveillance-ai", suggestion: "chronology of record | procedural chronology" },
  { term: "continuity analytics", severity: "hard-fail", category: "surveillance-ai", suggestion: "continuity progression of record" },
  { term: "provenance analytics", severity: "hard-fail", category: "surveillance-ai", suggestion: "provenance ledger | provenance lineage" },
  { term: "cognition analytics", severity: "hard-fail", category: "surveillance-ai", suggestion: "cognition reasoning trace | explainable cognition" },
  { term: "institutional analytics", severity: "hard-fail", category: "surveillance-ai", suggestion: "institutional visibility of record" },
  // Orchestration drift into substrate categories
  { term: "continuity orchestration", severity: "hard-fail", category: "surveillance-ai", suggestion: "continuity coordination (reviewer-led)" },
  { term: "topology orchestration", severity: "hard-fail", category: "surveillance-ai", suggestion: "topology coordination of record" },
  { term: "chronology orchestration", severity: "hard-fail", category: "surveillance-ai", suggestion: "chronology of record" },
  { term: "institutional orchestration", severity: "hard-fail", category: "surveillance-ai", suggestion: "institutional coordination (reviewer-led)" },
  // Admin / onboarding cockpit posture
  { term: "enterprise administration", severity: "hard-fail", category: "startup-saas", suggestion: "institutional stewardship | coexistence-aware administration" },
  { term: "operational command", severity: "hard-fail", category: "startup-saas", suggestion: "operational continuity coordination" },
  { term: "executive command", severity: "hard-fail", category: "startup-saas", suggestion: "executive continuity coordination" },
];

// Wave 7 — Institutional Deployment Readiness & Operationalization.
// Fence deployment/onboarding/rollout/provisioning/lifecycle drift that
// could quietly re-enter as operationalization surfaces deepen. These
// terms target rollout/deployment analytics + telemetry + cockpit posture,
// tenant-provisioning SaaS framing, organizational-engineering posture,
// migration-first/consolidation deployment posture, and command/automation
// drift in admin/lifecycle copy. Rewarded substitutes lean on coexistence,
// federation-safe rollout, continuity-preserving operationalization,
// stewardship-grade administration, and continuity-linked deployment
// evidence.
const wave7DeploymentReadiness: ForbiddenTerm[] = [
  // Rollout / deployment cockpit + command posture
  { term: "deployment cockpit", severity: "hard-fail", category: "startup-saas", suggestion: "deployment continuity workspace | coexistence-aware deployment surface" },
  { term: "rollout cockpit", severity: "hard-fail", category: "startup-saas", suggestion: "rollout continuity workspace | federation-aware rollout surface" },
  { term: "deployment command", severity: "hard-fail", category: "startup-saas", suggestion: "deployment continuity coordination" },
  { term: "rollout command", severity: "hard-fail", category: "startup-saas", suggestion: "rollout continuity coordination" },
  { term: "operational centralization", severity: "hard-fail", category: "startup-saas", suggestion: "coexistence-aware coordination | federation-safe coordination" },
  // Rollout / deployment analytics + telemetry drift
  { term: "rollout analytics", severity: "hard-fail", category: "surveillance-ai", suggestion: "rollout chronology of record | continuity-linked rollout evidence" },
  { term: "deployment analytics", severity: "hard-fail", category: "surveillance-ai", suggestion: "deployment chronology of record | continuity-linked deployment evidence" },
  { term: "onboarding analytics", severity: "hard-fail", category: "surveillance-ai", suggestion: "onboarding chronology of record" },
  { term: "provisioning analytics", severity: "hard-fail", category: "surveillance-ai", suggestion: "provisioning chronology of record" },
  { term: "deployment telemetry", severity: "hard-fail", category: "surveillance-ai", suggestion: "deployment visibility of record (read-only)" },
  { term: "rollout telemetry", severity: "hard-fail", category: "surveillance-ai", suggestion: "rollout visibility of record (read-only)" },
  { term: "onboarding telemetry", severity: "hard-fail", category: "surveillance-ai", suggestion: "onboarding visibility of record (read-only)" },
  // Rollout / deployment optimization + scoring posture
  { term: "rollout optimization", severity: "hard-fail", category: "startup-saas", suggestion: "phased federation onboarding | continuity-preserving rollout" },
  { term: "deployment optimization", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preserving deployment | governance-safe deployment" },
  { term: "rollout acceleration", severity: "hard-fail", category: "startup-saas", suggestion: "staged continuity-aware rollout" },
  { term: "deployment scoring", severity: "hard-fail", category: "surveillance-ai", suggestion: "deployment evidence of record" },
  { term: "onboarding scoring", severity: "hard-fail", category: "surveillance-ai", suggestion: "onboarding evidence of record" },
  // Automation drift in deployment / lifecycle posture
  { term: "deployment automation", severity: "hard-fail", category: "startup-saas", suggestion: "reviewer-led deployment | governance-safe deployment" },
  { term: "onboarding automation", severity: "hard-fail", category: "startup-saas", suggestion: "reviewer-led onboarding | stewardship-aware onboarding" },
  { term: "provisioning automation", severity: "hard-fail", category: "startup-saas", suggestion: "reviewer-led provisioning | coexistence-safe provisioning" },
  // Consolidation / migration-first / tenant-provisioning posture
  { term: "platform consolidation", severity: "hard-fail", category: "rip-and-replace", suggestion: "overlay infrastructure | coexistence-native operationalization" },
  { term: "consolidation deployment", severity: "hard-fail", category: "rip-and-replace", suggestion: "coexistence-aware deployment | overlay deployment" },
  { term: "tenant provisioning", severity: "hard-fail", category: "startup-saas", suggestion: "institutional provisioning | federation-aware provisioning" },
  { term: "executive administration", severity: "hard-fail", category: "startup-saas", suggestion: "institutional stewardship | stewardship-grade administration" },
  { term: "organizational engineering", severity: "hard-fail", category: "startup-saas", suggestion: "institutional lifecycle stewardship | continuity-aware lifecycle" },
];

// Wave 8 — Institutional Observability & Continuity UX Maturity.
// Additive narrative-governance fence preventing observability UX maturation
// from drifting toward dashboard / telemetry / graph-analytics / command-center /
// live-monitoring / predictive-observability aesthetics. Rewarded substitutes
// lean on chronology-aware visibility, topology-aware visibility, continuity
// overlays, provenance overlays, explainability layers, federation-safe
// coordination visibility, and archival-modern institutional UX.
const wave8ObservabilityUxMaturity: ForbiddenTerm[] = [
  // Dashboard posture drift on observability surfaces
  { term: "observability dashboard", severity: "hard-fail", category: "startup-saas", suggestion: "institutional observability workspace | governance-safe visibility surface" },
  { term: "institutional dashboard", severity: "hard-fail", category: "startup-saas", suggestion: "institutional continuity workspace | governance-safe visibility surface" },
  { term: "chronology dashboard", severity: "hard-fail", category: "startup-saas", suggestion: "chronology workspace | procedural chronology surface" },
  { term: "topology dashboard", severity: "hard-fail", category: "startup-saas", suggestion: "topology workspace | institutional structure surface" },
  // Observability surface analytics / telemetry / scoring / monitoring drift
  { term: "observability analytics", severity: "hard-fail", category: "surveillance-ai", suggestion: "observability chronology of record | continuity-linked observability evidence" },
  { term: "observability telemetry", severity: "hard-fail", category: "surveillance-ai", suggestion: "observability visibility of record (read-only)" },
  { term: "observability scoring", severity: "hard-fail", category: "surveillance-ai", suggestion: "observability evidence of record" },
  { term: "observability monitoring", severity: "hard-fail", category: "surveillance-ai", suggestion: "institutional observability of record (read-only)" },
  { term: "continuity monitoring", severity: "hard-fail", category: "surveillance-ai", suggestion: "continuity visibility of record (read-only)" },
  { term: "chronology monitoring", severity: "hard-fail", category: "surveillance-ai", suggestion: "chronology of record (read-only)" },
  // Graph / network / influence UI drift on topology surfaces
  { term: "graph analytics", severity: "hard-fail", category: "surveillance-ai", suggestion: "institutional topology of record | inspectable institutional structure" },
  { term: "network analytics", severity: "hard-fail", category: "surveillance-ai", suggestion: "institutional topology of record | inspectable affiliation structure" },
  { term: "influence graph", severity: "hard-fail", category: "surveillance-ai", suggestion: "institutional topology | inspectable institutional relationships" },
  { term: "node graph", severity: "hard-fail", category: "surveillance-ai", suggestion: "institutional structure panel | lineage-linked continuity" },
  { term: "network monitoring", severity: "hard-fail", category: "surveillance-ai", suggestion: "federation-safe coordination visibility (read-only)" },
  // Command-center posture drift on observability surfaces
  { term: "operational command center", severity: "hard-fail", category: "startup-saas", suggestion: "operational continuity workspace | stewardship-grade visibility" },
  { term: "governance command center", severity: "hard-fail", category: "startup-saas", suggestion: "governance continuity workspace | governance-of-record surface" },
  { term: "continuity command center", severity: "hard-fail", category: "startup-saas", suggestion: "continuity workspace | continuity-aware coordination surface" },
  { term: "observability command center", severity: "hard-fail", category: "startup-saas", suggestion: "observability workspace | governance-safe visibility surface" },
  // Live / activity / performance aesthetics drift
  { term: "live monitoring", severity: "hard-fail", category: "surveillance-ai", suggestion: "read-only institutional visibility | chronology-linked visibility" },
  { term: "real-time monitoring", severity: "hard-fail", category: "surveillance-ai", suggestion: "chronology-linked visibility (read-only)" },
  { term: "performance graph", severity: "hard-fail", category: "surveillance-ai", suggestion: "procedural chronology panel | continuity-linked evidence panel" },
  { term: "activity stream", severity: "hard-fail", category: "surveillance-ai", suggestion: "procedural chronology of record | continuity-linked timeline" },
  // Predictive / optimization observability drift
  { term: "predictive observability", severity: "hard-fail", category: "surveillance-ai", suggestion: "explainable observability of record | continuity-aware observability" },
  { term: "observability optimization", severity: "hard-fail", category: "startup-saas", suggestion: "explainable observability maturation | continuity-preserving observability" },
];

// Wave 9 — Trust, Procurement & Institutional Assurance Industrialization.
// Additive narrative-governance fence preventing trust / procurement / assurance
// surfaces from drifting toward compliance-theater portals, audit-cockpit
// posture, assurance dashboards, trust/assurance/procurement analytics &
// telemetry, organizational scoring, executive-oversight posture, and
// governance automation. Rewarded substitutes lean on procurement-grade
// institutional assurance, continuity-native assurance evidence, provenance-
// aware trust infrastructure, chronology-integrity guarantees, explainable
// institutional assurance, governance-safe observability assurances, and
// archival-modern institutional assurance UX.
const wave9AssuranceIndustrialization: ForbiddenTerm[] = [
  // Compliance-theater / audit-cockpit posture drift
  { term: "compliance theater", severity: "hard-fail", category: "startup-saas", suggestion: "procurement-grade institutional assurance | continuity-native assurance evidence" },
  { term: "compliance portal", severity: "hard-fail", category: "startup-saas", suggestion: "institutional trust surface | procurement-grade assurance workspace" },
  { term: "audit cockpit", severity: "hard-fail", category: "startup-saas", suggestion: "institutional evidence workspace | procedural assurance surface" },
  { term: "enterprise audit cockpit", severity: "hard-fail", category: "startup-saas", suggestion: "institutional assurance workspace | continuity-native evidence surface" },
  // Assurance / trust / procurement / stewardship dashboard posture drift
  { term: "assurance dashboard", severity: "hard-fail", category: "startup-saas", suggestion: "institutional assurance workspace | procurement-grade assurance surface" },
  { term: "trust dashboard", severity: "hard-fail", category: "startup-saas", suggestion: "institutional trust workspace | continuity-aware trust surface" },
  { term: "procurement dashboard", severity: "hard-fail", category: "startup-saas", suggestion: "procurement-grade assurance workspace | institutional procurement surface" },
  { term: "stewardship dashboard", severity: "hard-fail", category: "startup-saas", suggestion: "institutional stewardship workspace | continuity-aware stewardship surface" },
  // Assurance / trust / procurement / governance analytics drift
  { term: "assurance analytics", severity: "hard-fail", category: "surveillance-ai", suggestion: "assurance evidence of record | continuity-linked assurance" },
  { term: "trust analytics", severity: "hard-fail", category: "surveillance-ai", suggestion: "trust evidence of record | provenance-linked trust surface" },
  { term: "procurement analytics", severity: "hard-fail", category: "surveillance-ai", suggestion: "procurement evidence of record | institutional procurement chronology" },
  { term: "governance analytics", severity: "hard-fail", category: "surveillance-ai", suggestion: "governance of record (read-only) | continuity-linked governance evidence" },
  // Assurance / trust telemetry & monitoring drift
  { term: "assurance telemetry", severity: "hard-fail", category: "surveillance-ai", suggestion: "assurance evidence of record (read-only) | continuity-linked assurance visibility" },
  { term: "trust telemetry", severity: "hard-fail", category: "surveillance-ai", suggestion: "trust evidence of record (read-only) | provenance-linked trust visibility" },
  { term: "operational telemetry", severity: "hard-fail", category: "surveillance-ai", suggestion: "operational chronology of record (read-only) | continuity-linked operational evidence" },
  { term: "deployment telemetry", severity: "hard-fail", category: "surveillance-ai", suggestion: "deployment evidence of record | continuity-linked deployment chronology" },
  { term: "assurance monitoring", severity: "hard-fail", category: "surveillance-ai", suggestion: "institutional assurance of record (read-only)" },
  { term: "trust monitoring", severity: "hard-fail", category: "surveillance-ai", suggestion: "institutional trust of record (read-only)" },
  { term: "institutional monitoring", severity: "hard-fail", category: "surveillance-ai", suggestion: "institutional visibility of record (read-only) | governance-safe institutional visibility" },
  { term: "audit monitoring", severity: "hard-fail", category: "surveillance-ai", suggestion: "audit chronology of record | procedural audit evidence" },
  // Assurance / trust / governance / compliance scoring drift
  { term: "assurance scoring", severity: "hard-fail", category: "surveillance-ai", suggestion: "assurance evidence of record | explainable institutional assurance" },
  { term: "trust scoring", severity: "hard-fail", category: "surveillance-ai", suggestion: "trust evidence of record | provenance-aware trust framing" },
  { term: "compliance scoring", severity: "hard-fail", category: "surveillance-ai", suggestion: "compliance evidence of record | procedural compliance chronology" },
  // Executive-oversight / governance-automation posture drift
  { term: "executive oversight", severity: "hard-fail", category: "startup-saas", suggestion: "institutional stewardship | governance-of-record visibility" },
  { term: "governance automation", severity: "hard-fail", category: "startup-saas", suggestion: "governance-safe operationalization | reviewer-led governance continuity" },
];

// Wave 10 — Definitive Category Consolidation.
// Additive narrative-governance fence eliminating residual platform / product /
// SaaS / governance-software / workflow-tool / enterprise-governance posture so
// the runtime can no longer be read as "an advanced governance platform" but
// only as "institutional continuity infrastructure." Rewarded substitutes lean
// on institutional continuity infrastructure, continuity substrate, procedural
// continuity infrastructure, institutional stewardship, and archival-grade
// institutional records.
const wave10DefinitiveCategoryConsolidation: ForbiddenTerm[] = [
  // Governance-platform / governance-software / governance-tooling posture drift
  { term: "governance platform", severity: "hard-fail", category: "startup-saas", suggestion: "institutional continuity infrastructure | continuity substrate" },
  { term: "enterprise governance platform", severity: "hard-fail", category: "startup-saas", suggestion: "institutional continuity infrastructure | procedural continuity infrastructure" },
  { term: "governance software", severity: "hard-fail", category: "startup-saas", suggestion: "institutional continuity infrastructure | governance-safe institutional substrate" },
  { term: "governance application", severity: "hard-fail", category: "startup-saas", suggestion: "institutional continuity infrastructure | continuity substrate" },
  { term: "governance app", severity: "hard-fail", category: "startup-saas", suggestion: "institutional continuity infrastructure | continuity substrate" },
  { term: "governance tooling", severity: "hard-fail", category: "startup-saas", suggestion: "institutional continuity infrastructure | governance-safe institutional substrate" },
  { term: "enterprise governance tooling", severity: "hard-fail", category: "startup-saas", suggestion: "institutional continuity infrastructure | procedural continuity infrastructure" },
  // SaaS-governance / SaaS-suite posture drift
  { term: "SaaS governance", severity: "hard-fail", category: "startup-saas", suggestion: "institutional continuity infrastructure" },
  { term: "institutional SaaS", severity: "hard-fail", category: "startup-saas", suggestion: "institutional continuity infrastructure | continuity substrate" },
  { term: "operational SaaS", severity: "hard-fail", category: "startup-saas", suggestion: "institutional continuity infrastructure | continuity-native operationalization" },
  { term: "institutional software suite", severity: "hard-fail", category: "startup-saas", suggestion: "institutional continuity infrastructure | institutional substrate" },
  // Workflow-platform / workflow-tooling posture drift
  { term: "workflow platform", severity: "hard-fail", category: "startup-saas", suggestion: "procedural continuity infrastructure | continuity-native operationalization" },
  { term: "workflow SaaS", severity: "hard-fail", category: "startup-saas", suggestion: "procedural continuity infrastructure | continuity-native operationalization" },
  { term: "workflow tooling", severity: "hard-fail", category: "startup-saas", suggestion: "procedural continuity operationalization | continuity-aware coordination" },
  { term: "enterprise workflow", severity: "hard-fail", category: "startup-saas", suggestion: "institutional procedural continuity | continuity-native coordination" },
  // Operational-platform / observability-software / deployment-tooling posture drift
  { term: "operational platform", severity: "hard-fail", category: "startup-saas", suggestion: "operational continuity infrastructure | continuity-native operationalization" },
  { term: "observability software", severity: "hard-fail", category: "startup-saas", suggestion: "institutional observability infrastructure | governance-safe institutional visibility" },
  { term: "deployment tooling", severity: "hard-fail", category: "startup-saas", suggestion: "coexistence-safe operationalization | continuity-safe operationalization" },
  // Case-management platform / compliance-tooling posture drift
  { term: "case-management platform", severity: "hard-fail", category: "startup-saas", suggestion: "institutional continuity infrastructure | continuity substrate" },
  { term: "case-management infrastructure", severity: "hard-fail", category: "startup-saas", suggestion: "institutional continuity infrastructure | continuity substrate" },
  { term: "compliance tooling", severity: "hard-fail", category: "startup-saas", suggestion: "procurement-grade institutional assurance | continuity-native assurance evidence" },
  // Transformation-consulting / modernization-platform posture drift
  { term: "digital transformation", severity: "hard-fail", category: "startup-saas", suggestion: "coexistence-safe operationalization | continuity-safe institutional integration" },
  { term: "digital-transformation tooling", severity: "hard-fail", category: "startup-saas", suggestion: "coexistence-safe operationalization | continuity-safe institutional integration" },
  { term: "transformation consulting", severity: "hard-fail", category: "startup-saas", suggestion: "institutional continuity stewardship | reviewer-led continuity operationalization" },
  { term: "modernization platform", severity: "hard-fail", category: "startup-saas", suggestion: "institutional continuity infrastructure | continuity-native modernization (reviewer-led)" },
];

// ---------------------------------------------------------------------------
// Wave 11 — Institutional Livedness & Continuity Saturation
// ---------------------------------------------------------------------------
// Additive narrative-governance fence eliminating *anti-livedness* vocabulary —
// terms that frame the runtime as greenfield, empty, sparse, freshly installed,
// just-deployed, demo-tenant, placeholder-template, or instant-setup. These
// frames implicitly deny the institutional continuity residue, stewardship
// lineage, procedural history, coexistence evolution, and inherited governance
// state that Wave 11 makes structurally visible. Rewarded substitutes lean on
// inherited institutional state, continuity residue, stewardship lineage,
// procedural history, and reviewer-inhabited continuity substrate.
const wave11InstitutionalLivednessSaturation: ForbiddenTerm[] = [
  // Greenfield-deployment drift (denies institutional continuity residue)
  { term: "brand-new deployment", severity: "hard-fail", category: "startup-saas", suggestion: "inherited continuity substrate | continuity-residue-bearing runtime" },
  { term: "fresh deployment", severity: "hard-fail", category: "startup-saas", suggestion: "inherited continuity substrate | continuity-residue-bearing runtime" },
  { term: "fresh install", severity: "hard-fail", category: "startup-saas", suggestion: "inherited institutional state | continuity-residue-bearing runtime" },
  { term: "greenfield deployment", severity: "hard-fail", category: "startup-saas", suggestion: "coexistence-safe operationalization atop inherited institutional state" },
  // Empty / sparse / under-inhabited drift (denies institutional inhabitation)
  { term: "empty workspace", severity: "hard-fail", category: "startup-saas", suggestion: "reviewer-inhabited continuity substrate | stewardship-lineage-bearing workspace" },
  { term: "empty tenant", severity: "hard-fail", category: "startup-saas", suggestion: "reviewer-inhabited continuity substrate | stewardship-lineage-bearing institutional tenancy" },
  { term: "empty environment", severity: "hard-fail", category: "startup-saas", suggestion: "reviewer-inhabited continuity substrate | continuity-residue-bearing runtime" },
  { term: "blank slate", severity: "hard-fail", category: "startup-saas", suggestion: "inherited institutional state | continuity-residue-bearing substrate" },
  { term: "clean slate", severity: "hard-fail", category: "startup-saas", suggestion: "inherited institutional state | continuity-residue-bearing substrate" },
  // Demo / sandbox / trial drift (denies institutional production-grade inhabitation)
  { term: "demo environment", severity: "hard-fail", category: "startup-saas", suggestion: "reviewer-inhabited continuity substrate | institutional reviewer-led continuity instance" },
  { term: "demo tenant", severity: "hard-fail", category: "startup-saas", suggestion: "reviewer-inhabited institutional tenancy | stewardship-lineage-bearing instance" },
  { term: "sandbox tenant", severity: "hard-fail", category: "startup-saas", suggestion: "reviewer-inhabited institutional tenancy | continuity-residue-bearing instance" },
  { term: "trial environment", severity: "hard-fail", category: "startup-saas", suggestion: "reviewer-inhabited continuity substrate | institutional reviewer-led continuity instance" },
  // Placeholder / template-tenant drift (denies inherited procedural history)
  { term: "placeholder tenant", severity: "hard-fail", category: "startup-saas", suggestion: "stewardship-lineage-bearing institutional tenancy | inherited continuity substrate" },
  { term: "placeholder workspace", severity: "hard-fail", category: "startup-saas", suggestion: "stewardship-lineage-bearing workspace | inherited continuity substrate" },
  { term: "starter template", severity: "hard-fail", category: "startup-saas", suggestion: "inherited continuity substrate | procedural-history-bearing institutional baseline" },
  { term: "starter kit", severity: "hard-fail", category: "startup-saas", suggestion: "inherited continuity substrate | procedural-history-bearing institutional baseline" },
  // Quick-setup / instant-deploy drift (denies coexistence evolution + governance maturation)
  { term: "deploy in minutes", severity: "hard-fail", category: "startup-saas", suggestion: "coexistence-safe operationalization over a reviewer-led continuity cadence" },
  { term: "ready in minutes", severity: "hard-fail", category: "startup-saas", suggestion: "coexistence-safe operationalization over a reviewer-led continuity cadence" },
  { term: "live in minutes", severity: "hard-fail", category: "startup-saas", suggestion: "coexistence-safe operationalization over a reviewer-led continuity cadence" },
  { term: "set up in minutes", severity: "hard-fail", category: "startup-saas", suggestion: "coexistence-safe operationalization over a reviewer-led continuity cadence" },
  // Toy / vanilla / pristine / stock-config drift (denies lived institutional configuration history)
  { term: "toy deployment", severity: "hard-fail", category: "startup-saas", suggestion: "reviewer-inhabited continuity substrate | institutional reviewer-led continuity instance" },
  { term: "vanilla deployment", severity: "hard-fail", category: "startup-saas", suggestion: "stewardship-lineage-bearing institutional instance | inherited continuity substrate" },
  { term: "pristine deployment", severity: "hard-fail", category: "startup-saas", suggestion: "stewardship-lineage-bearing institutional instance | continuity-residue-bearing runtime" },
  { term: "stock configuration", severity: "hard-fail", category: "startup-saas", suggestion: "stewardship-lineage-bearing institutional configuration | inherited governance state" },
];

// ---------------------------------------------------------------------------
// Wave 12 — Longitudinal Continuity Accumulation
// ---------------------------------------------------------------------------
// Additive narrative-governance fence eliminating *anti-longitudinal* vocabulary —
// terms that frame the runtime as present-state-only, live-timeline, event-feed,
// activity-stream, governance-feed, telemetry-timeline, history-analytics, or
// deployment/migration/onboarding/continuity dashboard. These frames deny the
// historical accumulation, governance epochs, stewardship periods, continuity
// intervals, coexistence phases, procedural inheritance, and archival continuity
// references that Wave 12 makes structurally visible. Rewarded substitutes lean
// on governance epoch, stewardship period, continuity interval, coexistence
// phase, procedural inheritance, continuity preserved through transitions,
// inherited governance state, historically accumulated continuity, procedural
// carry-forward, institutional-memory continuity, chronology-linked continuity,
// representation continuity, committee continuity, stewardship succession,
// continuity-preservation period, historically associated continuity, archival
// continuity, inherited institutional state, and continuity-native accumulation.
const wave12LongitudinalAccumulation: ForbiddenTerm[] = [
  // A. Current-state / present-state-dominant drift (denies longitudinal accumulation)
  { term: "current operational state", severity: "hard-fail", category: "startup-saas", suggestion: "historically accumulated continuity | inherited institutional state preserved through successive governance epochs" },
  { term: "current operational view", severity: "hard-fail", category: "startup-saas", suggestion: "historically accumulated continuity view | governance-epoch-linked continuity view" },
  // B. Live / real-time timeline drift (denies institutional permanence)
  { term: "live governance timeline", severity: "hard-fail", category: "startup-saas", suggestion: "governance-epoch chronology | inherited governance lineage" },
  { term: "real-time timeline", severity: "hard-fail", category: "startup-saas", suggestion: "governance-epoch chronology | stewardship-period chronology" },
  { term: "activity timeline", severity: "hard-fail", category: "startup-saas", suggestion: "procedural carry-forward chronology | stewardship-period continuity chronology" },
  // C. Event / governance / operational / activity stream + governance-feed drift
  { term: "event stream", severity: "hard-fail", category: "startup-saas", suggestion: "procedural carry-forward chronology | continuity-preservation chronology" },
  { term: "governance stream", severity: "hard-fail", category: "startup-saas", suggestion: "governance-epoch chronology | inherited governance lineage" },
  { term: "operational stream", severity: "hard-fail", category: "startup-saas", suggestion: "procedural carry-forward chronology | continuity-preservation chronology" },
  { term: "activity stream", severity: "hard-fail", category: "startup-saas", suggestion: "procedural carry-forward chronology | continuity-preservation chronology" },
  { term: "governance feed", severity: "hard-fail", category: "startup-saas", suggestion: "governance-epoch chronology | inherited governance lineage" },
  // D. Timeline / telemetry analytics + historical analytics drift
  { term: "timeline analytics", severity: "hard-fail", category: "startup-saas", suggestion: "governance-epoch chronology references | historically associated continuity references" },
  { term: "governance telemetry timeline", severity: "hard-fail", category: "startup-saas", suggestion: "governance-epoch chronology | inherited governance lineage" },
  { term: "historical analytics", severity: "hard-fail", category: "startup-saas", suggestion: "historically accumulated continuity | archival continuity references" },
  { term: "historical telemetry", severity: "hard-fail", category: "startup-saas", suggestion: "historically accumulated continuity | archival continuity references" },
  // E. Metrics-history drift (denies archival continuity framing)
  { term: "governance metrics history", severity: "hard-fail", category: "startup-saas", suggestion: "governance-epoch continuity references | inherited governance state across stewardship periods" },
  { term: "operational metrics history", severity: "hard-fail", category: "startup-saas", suggestion: "procedural carry-forward continuity references | continuity-preservation references across stewardship periods" },
  // F. Deployment / migration / rollout / onboarding / continuity dashboard drift
  { term: "deployment timeline", severity: "hard-fail", category: "startup-saas", suggestion: "coexistence-evolution phases | continuity-preservation periods" },
  { term: "migration timeline", severity: "hard-fail", category: "startup-saas", suggestion: "coexistence-evolution phases | continuity-preservation periods" },
  { term: "rollout history", severity: "hard-fail", category: "startup-saas", suggestion: "coexistence-evolution phases | continuity-preservation periods" },
  { term: "onboarding history dashboard", severity: "hard-fail", category: "startup-saas", suggestion: "stewardship-succession chronology | continuity-inheritance references" },
  { term: "continuity dashboard", severity: "hard-fail", category: "startup-saas", suggestion: "archival continuity references | continuity-preservation chronology" },
  { term: "operational timeline", severity: "hard-fail", category: "startup-saas", suggestion: "procedural carry-forward chronology | continuity-preservation chronology" },
  { term: "telemetry timeline", severity: "hard-fail", category: "startup-saas", suggestion: "governance-epoch chronology references | historically associated continuity references" },
  { term: "deployment dashboard", severity: "hard-fail", category: "startup-saas", suggestion: "coexistence-evolution references | continuity-preservation references" },
  { term: "migration dashboard", severity: "hard-fail", category: "startup-saas", suggestion: "coexistence-evolution references | continuity-preservation references" },
];

// ---------------------------------------------------------------------------
// Wave 13 — Universal Surface Saturation
// ---------------------------------------------------------------------------
// Additive narrative-governance fence eliminating *anti-saturation* vocabulary —
// terms that frame meaningful runtime surfaces as helper-grade, utility-panel,
// operational-sidebar, productivity-tool, workflow-shortcut, app/feature module,
// task-assistant, or support-tooling. These frames produce maturity asymmetry
// across the runtime by making secondary surfaces read as application-layer
// helpers rather than continuity-preserved institutional surfaces. Rewarded
// substitutes lean on continuity-preserved transition, governance-era continuity,
// institutional-memory layering, stewardship-linked continuity, chronology-linked
// inheritance, coexistence continuity, federation continuity, procedural carry-
// forward, archival continuity texture, continuity-aware institutional state,
// inherited continuity, historically accumulated continuity, continuity-
// preservation layering, governance-linked procedural continuity, institutionally
// inhabited infrastructure, continuity-native procedural layering, and archival-
// modern continuity density.
const wave13UniversalSurfaceSaturation: ForbiddenTerm[] = [
  // A. Helper-grade utility drift (denies institutional saturation)
  { term: "helper dashboard", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-aware institutional surface | continuity-preservation layering" },
  { term: "utility panel", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-aware institutional surface | institutional-memory layering" },
  { term: "helper tool", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-aware institutional surface | continuity-preserved procedural surface" },
  { term: "helper module", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-aware institutional surface | continuity-preserved institutional surface" },
  { term: "app helper", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-aware institutional surface | institutionally inhabited infrastructure surface" },
  // B. Operational sidebar / panel drift
  { term: "operational sidebar", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preservation overlay | institutional-memory overlay" },
  { term: "control sidebar", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preservation overlay | institutional-memory overlay" },
  { term: "operational helper", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-aware institutional surface | continuity-preserved procedural surface" },
  { term: "activity helper", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-aware institutional surface | procedural carry-forward surface" },
  // C. Workflow / productivity tool drift
  { term: "lightweight workflow", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preserved procedural continuity | governance-linked procedural continuity" },
  { term: "productivity tooling", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-native procedural layering | continuity-preservation layering" },
  { term: "workflow shortcut", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preserved procedural transition | procedural carry-forward reference" },
  { term: "workflow utility", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preserved procedural continuity | governance-linked procedural continuity" },
  { term: "productivity utility", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-native procedural layering | continuity-preservation layering" },
  // D. Admin / management / runtime utility drift
  { term: "admin utility", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-aware institutional surface | institutional-memory layering" },
  { term: "management utility", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-aware institutional surface | stewardship-linked continuity surface" },
  { term: "runtime utility", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-aware institutional surface | continuity-preservation layering" },
  { term: "operational utility", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-aware institutional surface | continuity-preservation layering" },
  { term: "utility module", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-aware institutional surface | continuity-preserved institutional surface" },
  // E. Operational / app / feature module drift
  { term: "operational module", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preserved institutional surface | institutional-memory layering" },
  { term: "app module", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preserved institutional surface | institutionally inhabited infrastructure surface" },
  { term: "feature module", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preserved institutional surface | institutionally inhabited infrastructure surface" },
  // F. Operational widget / task-assistant / support-tooling drift
  { term: "operational widget", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preservation overlay | institutional-memory overlay" },
  { term: "task assistant", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-aware institutional surface | procedural carry-forward surface" },
  { term: "support tooling", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-aware institutional surface | continuity-preservation layering" },
];

// ---------------------------------------------------------------------------
// Wave 14 — Runtime Phenomenology
// ---------------------------------------------------------------------------
// Additive narrative-governance fence eliminating *runtime-mechanics-visible*
// vocabulary — terms that expose the runtime as app-shell, runtime-shell,
// state-machine, loading-workflow, runtime-engine, session/UI-management,
// context-scope, page-transition, app-navigation, or interface-layer
// infrastructure. These frames break phenomenological inevitability by
// re-introducing software-centric perception (routes, modules, hydration
// edges, app shells) into surfaces that should read as continuity-preserved
// institutional space. Rewarded substitutes lean on continuity persistence,
// chronology persistence, stewardship persistence, coexistence continuity,
// institutional-memory persistence, continuity-preserved rendering, archival
// continuity atmosphere, governance-era continuity, continuity-native flow,
// phenomenologically institutional framing, continuity-preserved institutional
// state, continuity-aware persistence, inherited continuity, procedurally
// accumulated continuity, institutional permanence, continuity-linked
// rendering, governance-preserved continuity, and continuity-native interaction
// rhythm.
const wave14RuntimePhenomenology: ForbiddenTerm[] = [
  // A. App / runtime shell drift (exposes software shell)
  { term: "application shell", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preserved institutional space | institutional permanence" },
  { term: "app shell", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preserved institutional space | institutional permanence" },
  { term: "runtime shell", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preserved runtime atmosphere | institutional permanence" },
  { term: "interface layer", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preserved institutional surface | continuity-linked rendering" },
  // B. State-mechanics drift (exposes runtime state machines)
  { term: "app state", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preserved institutional state | continuity-aware persistence" },
  { term: "route state", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preserved institutional state | continuity-native flow" },
  { term: "navigation state", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preserved institutional state | continuity-native flow" },
  { term: "application state", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preserved institutional state | inherited continuity" },
  // C. Loading-mechanics drift (exposes hydration / loading workflows)
  { term: "loading spinner", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preserved rendering | continuity-linked rendering" },
  { term: "loading workflow", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preserved rendering | continuity-native flow" },
  { term: "application loading", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preserved rendering | institutional-memory persistence" },
  // D. Workflow / runtime-engine drift
  { term: "runtime workflow", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-native flow | continuity-native interaction rhythm" },
  { term: "interaction workflow", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-native interaction rhythm | continuity-preserved interaction rhythm" },
  { term: "runtime engine", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preserved runtime atmosphere | continuity-native flow" },
  { term: "interaction layer", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-native interaction rhythm | continuity-preserved institutional surface" },
  // E. Management posture drift (exposes client-side management semantics)
  { term: "client-side management", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preserved institutional state | continuity-aware persistence" },
  { term: "UI management", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preserved institutional surface | continuity-linked rendering" },
  { term: "session management", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preserved institutional state | inherited continuity" },
  // F. Context-scope / runtime-context / navigation drift
  { term: "application context", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preserved institutional context | inherited continuity" },
  { term: "runtime context", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preserved institutional context | continuity-aware persistence" },
  { term: "feature context", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preserved institutional context | governance-era continuity" },
  { term: "operational context panel", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preservation overlay | institutional-memory overlay" },
  { term: "application runtime", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preserved runtime atmosphere | institutional permanence" },
  { term: "page transition", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preserved transition | continuity-native flow" },
  { term: "app navigation", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preserved transition | continuity-native flow" },
];

// ---------------------------------------------------------------------------
// Wave 15 — Operational Inevitability
// ---------------------------------------------------------------------------
// Additive narrative-governance fence eliminating *uptime-marketing /
// DevOps-theater / infrastructure-management / operations-center / deployment-
// orchestration / reliability-engineering / operational-monitoring /
// infrastructure-control* posture. These frames break operational inevitability
// by re-introducing SaaS-reliability rhetoric, infrastructure-marketing posture,
// and operational theater into surfaces that should read as continuity-preserved
// institutional infrastructure. Rewarded substitutes lean on continuity
// survivability, governance-preserved recovery, continuity-preserved rollback,
// coexistence durability, federation continuity durability, institutional
// persistence, stewardship continuity, operational inheritance, continuity
// under disruption, archival operational continuity, governance-preserved
// survivability, continuity durability, continuity-preserved operational
// evolution, operational calmness, continuity-native operational resilience,
// institutional continuity persistence, coexistence-safe operational
// continuity, and continuity-preserved restoration.
const wave15OperationalInevitability: ForbiddenTerm[] = [
  // A. Uptime / availability theater
  { term: "high availability", severity: "hard-fail", category: "startup-saas", suggestion: "continuity survivability | continuity durability under disruption" },
  { term: "uptime guarantee", severity: "hard-fail", category: "startup-saas", suggestion: "continuity survivability | governance-preserved survivability" },
  { term: "service availability", severity: "hard-fail", category: "startup-saas", suggestion: "continuity survivability | institutional continuity persistence" },
  { term: "five nines", severity: "hard-fail", category: "startup-saas", suggestion: "continuity survivability | continuity durability under disruption" },
  // B. Failover / incident posture drift
  { term: "failover system", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preserved restoration | continuity-native operational resilience" },
  { term: "incident management", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preserved restoration | governance-preserved recovery" },
  { term: "runbook execution", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preserved restoration | continuity-preserved operational evolution" },
  // C. Deployment / release pipeline drift
  { term: "deployment pipeline", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preserved deployment evolution | continuity-preserved operational evolution" },
  { term: "deployment workflow", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preserved deployment evolution | continuity-preserved operational evolution" },
  { term: "deployment orchestration", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preserved deployment evolution | coexistence-safe operational continuity" },
  { term: "release pipeline", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preserved deployment evolution | continuity-preserved operational evolution" },
  // D. Operations-center / command-ops drift
  { term: "operations center", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preserved institutional surface | institutional continuity persistence" },
  { term: "command operations", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preserved operational evolution | continuity-native operational resilience" },
  { term: "ops center", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preserved institutional surface | institutional continuity persistence" },
  { term: "platform operations", severity: "hard-fail", category: "startup-saas", suggestion: "institutional continuity persistence | continuity-preserved operational evolution" },
  // E. Infrastructure-management / control drift
  { term: "infrastructure operations", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preserved operational evolution | institutional continuity persistence" },
  { term: "infrastructure management", severity: "hard-fail", category: "startup-saas", suggestion: "continuity durability | institutional continuity persistence" },
  { term: "infrastructure control", severity: "hard-fail", category: "startup-saas", suggestion: "continuity durability | governance-preserved survivability" },
  { term: "runtime operations", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preserved operational evolution | continuity-native operational resilience" },
  { term: "SLA management", severity: "hard-fail", category: "startup-saas", suggestion: "continuity survivability | governance-preserved survivability" },
  // F. Reliability / DevOps / monitoring posture drift
  { term: "reliability engineering", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-native operational resilience | continuity durability under disruption" },
  { term: "site reliability", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-native operational resilience | continuity durability under disruption" },
  { term: "DevOps operations", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preserved operational evolution | continuity-native operational resilience" },
  { term: "operational monitoring", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preserved operational evolution | governance-preserved survivability" },
  { term: "release orchestration", severity: "hard-fail", category: "startup-saas", suggestion: "continuity-preserved deployment evolution | continuity-preserved operational evolution" },
];

// ---------------------------------------------------------------------------
// Wave 16 — Real Continuity Accumulation
// ---------------------------------------------------------------------------
// Additive narrative-governance fence eliminating *synthetic-continuity /
// generated-history / fake-governance / demo-data / continuity-theater /
// maturity-performance* posture. These frames break the authored→lived
// transition by re-introducing sample/demo/example/mock/placeholder/
// simulated/synthetic/generated/fabricated/fictional/illustrative/prototype
// posture into surfaces that should read as institutionally inhabited
// continuity infrastructure. Rewarded substitutes lean on actual continuity
// grounding, provenance-linked continuity, continuity-preserved operational
// history, stewardship continuity inheritance, coexistence continuity
// accumulation, federation continuity grounding, archival continuity
// preservation, continuity residue, continuity carry-forward, operational
// continuity inheritance, chronology-grounded continuity, governance-preserved
// continuity, institutionally inhabited continuity, continuity survivability,
// real continuity accumulation, and continuity restoration traces.
const wave16RealContinuityAccumulation: ForbiddenTerm[] = [
  // A. Sample / demo / example governance posture
  { term: "sample governance history", severity: "hard-fail", category: "startup-saas", suggestion: "actual governance continuity inheritance | provenance-linked governance history" },
  { term: "demo continuity record", severity: "hard-fail", category: "startup-saas", suggestion: "actual continuity residue | provenance-linked continuity record" },
  { term: "example governance record", severity: "hard-fail", category: "startup-saas", suggestion: "actual governance continuity record | governance-preserved continuity" },
  { term: "example continuity timeline", severity: "hard-fail", category: "startup-saas", suggestion: "actual continuity chronology | chronology-grounded continuity" },
  { term: "sample institutional history", severity: "hard-fail", category: "startup-saas", suggestion: "actual institutional-memory accumulation | historically inhabited continuity" },
  // B. Mock / placeholder posture
  { term: "mock federation structure", severity: "hard-fail", category: "startup-saas", suggestion: "actual federation continuity grounding | federation-grounded continuity" },
  { term: "placeholder governance lineage", severity: "hard-fail", category: "startup-saas", suggestion: "actual governance lineage | governance-preserved continuity inheritance" },
  { term: "mock continuity inheritance", severity: "hard-fail", category: "startup-saas", suggestion: "actual continuity inheritance | continuity carry-forward" },
  // C. Simulated / synthetic continuity posture
  { term: "simulated governance event", severity: "hard-fail", category: "startup-saas", suggestion: "actual governance continuity event | governance-preserved continuity event" },
  { term: "synthetic continuity state", severity: "hard-fail", category: "startup-saas", suggestion: "actual continuity state | institutionally inhabited continuity" },
  { term: "simulated coexistence history", severity: "hard-fail", category: "startup-saas", suggestion: "actual coexistence continuity accumulation | coexistence-grounded continuity" },
  { term: "synthetic chronology layer", severity: "hard-fail", category: "startup-saas", suggestion: "actual chronology accumulation | chronology-grounded continuity" },
  { term: "synthetic timeline", severity: "hard-fail", category: "startup-saas", suggestion: "actual chronology accumulation | chronology-grounded continuity" },
  // D. Generated / fabricated history posture
  { term: "generated stewardship history", severity: "hard-fail", category: "startup-saas", suggestion: "actual stewardship continuity inheritance | stewardship-grounded continuity" },
  { term: "generated continuity narrative", severity: "hard-fail", category: "startup-saas", suggestion: "actual continuity residue | continuity restoration traces" },
  { term: "generated federation history", severity: "hard-fail", category: "startup-saas", suggestion: "actual federation continuity grounding | federation-grounded continuity" },
  { term: "generated timeline", severity: "hard-fail", category: "startup-saas", suggestion: "actual chronology accumulation | provenance-linked chronology" },
  { term: "fabricated continuity", severity: "hard-fail", category: "startup-saas", suggestion: "actual continuity residue | institutionally inhabited continuity" },
  // E. Fictional / illustrative / prototype posture
  { term: "fictional continuity event", severity: "hard-fail", category: "startup-saas", suggestion: "actual continuity event | continuity-preserved operational history" },
  { term: "fictional chronology", severity: "hard-fail", category: "startup-saas", suggestion: "actual chronology accumulation | chronology-grounded continuity" },
  { term: "illustrative governance event", severity: "hard-fail", category: "startup-saas", suggestion: "actual governance continuity event | governance-preserved continuity event" },
  { term: "illustrative continuity", severity: "hard-fail", category: "startup-saas", suggestion: "actual continuity residue | institutionally inhabited continuity" },
  // F. Demo / operational-history theater
  { term: "demo operational history", severity: "hard-fail", category: "startup-saas", suggestion: "actual operational continuity inheritance | continuity-preserved operational history" },
  { term: "prototype continuity state", severity: "hard-fail", category: "startup-saas", suggestion: "actual continuity state | institutionally inhabited continuity" },
  { term: "mock governance", severity: "hard-fail", category: "startup-saas", suggestion: "actual governance continuity | governance-preserved continuity" },
];

// ---------------------------------------------------------------------------
// Wave 17 — Constitutional Category Formation
// ---------------------------------------------------------------------------
// Closes residual governance-software / governance-platform / governance-suite
// / enterprise-governance / governance-tooling / continuity-feature /
// continuity-engine / continuity-platform / continuity-management /
// governance-product / governance-solution / governance-stack /
// governance-toolkit framings. These terms hold Union Eyes in the
// generic-enterprise-governance-software category. Constitutionalizing the
// category requires routing language away from "governance system / platform
// / suite / tooling / product / solution / stack / toolkit" toward
// constitutional continuity substrate, constitutional continuity
// infrastructure, constitutional continuity ontology, constitutionally
// inevitable continuity, constitutional federation continuity, constitutional
// stewardship continuity, constitutional operational continuity,
// chronology-grounded constitutional continuity, archival constitutional
// continuity, governance-preserved constitutional continuity, institutionally
// inhabited constitutional continuity, and continuity-native constitutional
// realism. The intent is doctrinal: Union Eyes is not a governance product —
// it is constitutional category infrastructure.
const wave17ConstitutionalCategoryFormation: ForbiddenTerm[] = [
  // A. Governance-software / platform / suite / application / system posture
  { term: "governance software", severity: "hard-fail", category: "startup-saas", suggestion: "constitutional continuity substrate | constitutional continuity infrastructure" },
  { term: "governance platform", severity: "hard-fail", category: "startup-saas", suggestion: "constitutional continuity substrate | constitutional continuity infrastructure" },
  { term: "governance suite", severity: "hard-fail", category: "startup-saas", suggestion: "constitutional continuity substrate | constitutional continuity ontology" },
  { term: "governance application", severity: "hard-fail", category: "startup-saas", suggestion: "constitutional continuity substrate | constitutionally inhabited continuity" },
  { term: "governance system", severity: "hard-fail", category: "startup-saas", suggestion: "constitutional continuity substrate | governance-preserved constitutional continuity" },
  // B. Enterprise-governance / governance-infrastructure / governance-runtime posture
  { term: "enterprise governance", severity: "hard-fail", category: "startup-saas", suggestion: "constitutional continuity infrastructure | constitutional federation continuity" },
  { term: "enterprise governance tooling", severity: "hard-fail", category: "startup-saas", suggestion: "constitutional continuity infrastructure | constitutional stewardship continuity" },
  { term: "governance infrastructure", severity: "hard-fail", category: "startup-saas", suggestion: "constitutional continuity infrastructure | continuity-native constitutional infrastructure" },
  { term: "governance runtime", severity: "hard-fail", category: "startup-saas", suggestion: "constitutional continuity runtime | constitutional operational continuity" },
  // C. Governance-tooling / module / engine / institutional-governance-tooling posture
  { term: "governance tooling", severity: "hard-fail", category: "startup-saas", suggestion: "constitutional continuity substrate | continuity-native constitutional realism" },
  { term: "governance module", severity: "hard-fail", category: "startup-saas", suggestion: "constitutional continuity capability | constitutionally inhabited continuity" },
  { term: "governance engine", severity: "hard-fail", category: "startup-saas", suggestion: "constitutional continuity substrate | governance-preserved constitutional continuity" },
  { term: "institutional governance tooling", severity: "hard-fail", category: "startup-saas", suggestion: "constitutional continuity infrastructure | institutionally inhabited constitutional continuity" },
  // D. Continuity-feature / capability / management / operational-governance posture
  { term: "continuity feature", severity: "hard-fail", category: "startup-saas", suggestion: "constitutional continuity capability | constitutionally inevitable continuity" },
  { term: "governance capability", severity: "hard-fail", category: "startup-saas", suggestion: "constitutional continuity capability | governance-preserved constitutional continuity" },
  { term: "continuity management", severity: "hard-fail", category: "startup-saas", suggestion: "constitutional continuity stewardship | constitutional stewardship continuity" },
  { term: "operational governance", severity: "hard-fail", category: "startup-saas", suggestion: "constitutional operational continuity | governance-preserved constitutional continuity" },
  // E. Continuity-engine / tooling / platform posture
  { term: "continuity engine", severity: "hard-fail", category: "startup-saas", suggestion: "constitutional continuity substrate | continuity-native constitutional infrastructure" },
  { term: "continuity tooling", severity: "hard-fail", category: "startup-saas", suggestion: "constitutional continuity substrate | continuity-native constitutional realism" },
  { term: "continuity platform", severity: "hard-fail", category: "startup-saas", suggestion: "constitutional continuity substrate | constitutional continuity infrastructure" },
  // F. Anti-governance-product / solution / stack / toolkit posture
  { term: "governance product", severity: "hard-fail", category: "startup-saas", suggestion: "constitutional continuity infrastructure | constitutional category infrastructure" },
  { term: "governance solution", severity: "hard-fail", category: "startup-saas", suggestion: "constitutional continuity substrate | constitutional category infrastructure" },
  { term: "continuity solution", severity: "hard-fail", category: "startup-saas", suggestion: "constitutional continuity substrate | constitutional continuity infrastructure" },
  { term: "governance stack", severity: "hard-fail", category: "startup-saas", suggestion: "constitutional continuity substrate | constitutional continuity ontology" },
  { term: "governance toolkit", severity: "hard-fail", category: "startup-saas", suggestion: "constitutional continuity substrate | continuity-native constitutional infrastructure" },
];

// Top-level i18n bundle keys that surface on PUBLIC marketing routes. Used by
// both the narrative-audit CLI and the marketing-vocabulary contract test to
// scope `publicOnly` enforcement to customer-facing namespaces. Admin /
// dashboard / ops namespaces (sidebar, *AdminPage, dashboard*Page, etc.) are
// internal operator surfaces where literal-noun usage is accurate and should
// not generate marketing-tone violations. Keep this list in sync with the
// `PUBLIC_MARKETING_ROUTES` array in the contract test and any new public
// marketing routes added under `app/[locale]/(marketing)/`.
export const PUBLIC_MESSAGES_NAMESPACES: ReadonlySet<string> = new Set<string>([
  // Primary marketing namespace cluster
  "marketing",
  "home",
  "homePage",
  "footer",
  "navigation",
  "navMain",
  "alerts",
  "buttons",
  "challenges",
  "continuityNotes",
  "goals",
  "phase6",
  "pillarItems",
  "sectors",
  "solutionsItems",
  "step1",
  "step2",
  "step3",
  "step4",
  "step5",
  "step6",
  "stepLabels",
  // Marketing route page namespaces (mirror PUBLIC_MARKETING_ROUTES)
  "trustPage",
  "trust",
  "storyPage",
  "story",
  "governancePage",
  "governance",
  "contactPage",
  "contact",
  "pilotRequestPage",
  "pilotRequest",
  "pricingPage",
  "pricing",
  "solutionsPage",
  "solutions",
  "statusPage",
  "status",
  "platformPage",
  "featuresPage",
  "features",
  "executiveIntelligencePage",
  "executiveIntelligence",
  "insightsPage",
  "insights",
  "institutionalContinuityPage",
  "institutionalContinuity",
  "conventionsPage",
  "conventions",
  "proofPage",
  "proof",
  "caseStudiesPage",
  "forClcPage",
  "forFederationsPage",
  "forLeadershipPage",
  "forMembersPage",
  "forRepresentativesPage",
  // Continuity simulation marketing page
  "continuitySimulationPage",
  "continuitySimulation",
  // NOTE: `platform` and `signInPage*` deliberately EXCLUDED — those namespaces
  // contain admin section labels and auth metadata descriptions where literal
  // noun usage is accurate. The route-level `(marketing)/platform/*` pages
  // pull copy from `marketing.*` keys, which remain fenced.
]);

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
  ...wave2DepthConvergence,
  ...wave3ContinuityCognition,
  ...wave4LanguageConvergence,
  ...wave5MultilingualParity,
  ...wave6RuntimeCockpit,
  ...wave7DeploymentReadiness,
  ...wave8ObservabilityUxMaturity,
  ...wave9AssuranceIndustrialization,
  ...wave10DefinitiveCategoryConsolidation,
  ...wave11InstitutionalLivednessSaturation,
  ...wave12LongitudinalAccumulation,
  ...wave13UniversalSurfaceSaturation,
  ...wave14RuntimePhenomenology,
  ...wave15OperationalInevitability,
  ...wave16RealContinuityAccumulation,
  ...wave17ConstitutionalCategoryFormation,
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
    // Wave 18: also skip URL path segments (`/platform/...`), file paths
    // (`platform.ts`), and identifier-hyphenated tokens (`platform-utils`).
    // These are structural references — not user-visible marketing prose.
    r = new RegExp(`(?<![\\/\\.\\-])\\b${escapeRegExp(term)}\\b(?![\\/\\.\\-])`, "i");
    TERM_REGEX_CACHE.set(term, r);
  }
  return r;
}

export function findViolations(
  text: string,
  opts: {
    isPublicSurface: boolean;
    /**
     * Wave 18 — Namespace-aware messages scanning.
     * When provided (typically for `messages/*.json`), the scanner tracks the
     * current top-level JSON namespace per line. `publicOnly` terms are only
     * enforced on lines whose top-level namespace is in this allow-list. This
     * prevents warning-tier vocabulary (e.g., "platform" used as a literal
     * navigation noun in admin labels) from flooding the audit while keeping
     * marketing-tone namespaces (marketing.*, platform.*, etc.) fully fenced.
     */
    publicMessagesNamespaces?: ReadonlySet<string>;
  },
): Array<{ term: ForbiddenTerm; line: number; excerpt: string }> {
  const lines = text.split(/\r?\n/);
  const hits: Array<{ term: ForbiddenTerm; line: number; excerpt: string }> = [];
  // Wave 18 — JSON-key exemption: lines that read as `"key": "value"` (i18n
  // bundles) match `\bterm\b` against the VALUE half only. Pure key-name
  // collisions (e.g., `"platform": "Substrate"` after a nav rename) are
  // structural identifiers, not user-visible prose, and should not generate
  // warnings.
  const jsonKvRe = /^(\s*"([^"\\]+)"\s*:\s*)(.*)$/;
  // Wave 18 — namespace tracker: a top-level JSON key in 2-space-indented
  // i18n bundles always appears at exactly 2 leading spaces.
  const topLevelKeyRe = /^  "([^"\\]+)"\s*:/;
  let currentNamespace: string | null = null;
  const namespaceAware = !!opts.publicMessagesNamespaces;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (namespaceAware) {
      const ns = topLevelKeyRe.exec(line);
      if (ns) currentNamespace = ns[1];
    }
    const kv = jsonKvRe.exec(line);
    const valueScope = kv ? kv[3] : line;
    const lower = valueScope.toLowerCase();
    const linePublic = namespaceAware
      ? (currentNamespace !== null &&
         opts.publicMessagesNamespaces!.has(currentNamespace))
      : opts.isPublicSurface;
    for (const term of FORBIDDEN_VOCABULARY) {
      if (term.publicOnly && !linePublic) continue;
      if (!regexFor(term.term).test(valueScope)) continue;
      if (term.exceptions?.some((ex) => lower.includes(ex.toLowerCase()))) continue;
      hits.push({ term, line: i + 1, excerpt: line.trim().slice(0, 200) });
    }
  }
  return hits;
}
