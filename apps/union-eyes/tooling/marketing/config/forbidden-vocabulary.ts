/**
 * Forbidden / discouraged vocabulary for Union Eyes public marketing surfaces.
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
];

const political: ForbiddenTerm[] = [
  { term: "democratize unions", severity: "hard-fail", category: "political" },
  { term: "activist platform", severity: "hard-fail", category: "political" },
  { term: "movement organizing engine", severity: "hard-fail", category: "political" },
  { term: "power redistribution", severity: "hard-fail", category: "political" },
  { term: "governance reform engine", severity: "hard-fail", category: "political" },
];

const founderOptics: ForbiddenTerm[] = [
  { term: "golden share", severity: "hard-fail", category: "founder-optics", publicOnly: true },
  { term: "governance lock", severity: "hard-fail", category: "founder-optics", publicOnly: true },
  { term: "founder control", severity: "hard-fail", category: "founder-optics", publicOnly: true },
  { term: "ownership protection structure", severity: "hard-fail", category: "founder-optics", publicOnly: true },
  { term: "control mechanism", severity: "hard-fail", category: "founder-optics", publicOnly: true },
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
  // "governance" intentionally excluded from warning — counted via balance rule.
];

export const FORBIDDEN_VOCABULARY: ForbiddenTerm[] = [
  ...startupSaas,
  ...ripAndReplace,
  ...surveillanceAi,
  ...political,
  ...founderOptics,
  ...warningLevel,
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
