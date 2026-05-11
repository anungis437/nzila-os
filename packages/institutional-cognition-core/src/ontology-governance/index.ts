/**
 * Institutional Ontology Governance
 *
 * Elevates ontology from structural definitions to a governed semantic
 * infrastructure: canonical vocabularies, taxonomy registry, semantic
 * versioning, cognition-domain relationship rules, and drift detection.
 *
 * NOTHING in this module performs autonomous governance. It is a pure
 * read/validate surface used by CI, orchestration, and review surfaces.
 */

import {
  COGNITION_DOMAINS,
  INSTITUTIONAL_CONCEPTS,
  type CognitionDomain,
  type InstitutionalConcept,
} from '../ontology/index';

/* -------------------------------------------------------------------------- */
/* Semantic Version                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Current institutional ontology semantic version. Independent from package
 * SemVer — increments when canonical dictionaries / domain set / concept set
 * changes. Major: domain breaking. Minor: additive concept. Patch: docs.
 */
export const INSTITUTIONAL_ONTOLOGY_VERSION = '1.0.0';

/* -------------------------------------------------------------------------- */
/* Canonical Institutional Dictionaries                                        */
/* -------------------------------------------------------------------------- */

/**
 * Canonical institutional vocabulary. The terms a cognition surface, narrative,
 * or UI label is allowed to use when describing institutional reasoning.
 * Synonyms outside this list are considered semantic drift.
 */
export const GOVERNANCE_VOCABULARY = [
  'governance review',
  'governance action',
  'governance coherence',
  'governance momentum',
  'institutional precedent',
  'institutional memory',
  'institutional learning',
  'continuity plan',
  'continuity forecast',
  'continuity simulation',
  'resilience baseline',
  'resilience trajectory',
  'operational coherence',
  'operational trust',
  'procedural continuity',
  'systems coherence',
  'cross-domain correlation',
  'cognition session',
  'cognition envelope',
  'evidence lineage',
  'reasoning chain',
  'human review',
  'organizational scope',
] as const;

export type GovernanceTerm = (typeof GOVERNANCE_VOCABULARY)[number];

/**
 * Continuity-specific lexicon — used by continuity engines, simulators, and
 * narrative summarizers.
 */
export const CONTINUITY_LEXICON = [
  'continuity gap',
  'continuity momentum',
  'continuity drift',
  'recovery posture',
  'restoration confidence',
  'redundancy depth',
  'cascade exposure',
  'mitigation maturity',
] as const;

export type ContinuityTerm = (typeof CONTINUITY_LEXICON)[number];

/**
 * Forbidden labor / surveillance vocabulary. CI fails if any of these appear
 * in cognition payloads, narratives, or surface labels. This is enforced.
 */
export const FORBIDDEN_LABOR_VOCABULARY = [
  'employee score',
  'employee ranking',
  'workforce optimization',
  'attrition prediction',
  'performance prediction',
  'discipline prediction',
  'retention risk',
  'surveillance',
  'sentiment of',
  'personality of',
  'productivity score',
] as const;

export type ForbiddenLaborTerm = (typeof FORBIDDEN_LABOR_VOCABULARY)[number];

/* -------------------------------------------------------------------------- */
/* Cognition-Domain Relationship Rules                                         */
/* -------------------------------------------------------------------------- */

export interface DomainRelationshipRule {
  from: CognitionDomain;
  to: CognitionDomain;
  /** "feeds" = supplies evidence/inputs. "informs" = informs reasoning. "guards" = governance constraint. */
  kind: 'feeds' | 'informs' | 'guards';
  rationale: string;
}

/**
 * Canonical cross-domain relationships. The orchestrator may use these to
 * order execution; CI uses them to validate that cognition contracts respect
 * declared semantics.
 */
export const DOMAIN_RELATIONSHIP_RULES: readonly DomainRelationshipRule[] = [
  { from: 'institutional_memory', to: 'precedent', kind: 'feeds', rationale: 'Memory captures supply precedent reasoning.' },
  { from: 'precedent', to: 'governance', kind: 'informs', rationale: 'Precedent reasoning informs governance review.' },
  { from: 'governance', to: 'continuity', kind: 'informs', rationale: 'Governance posture informs continuity planning.' },
  { from: 'continuity', to: 'resilience', kind: 'feeds', rationale: 'Continuity assessments feed resilience modeling.' },
  { from: 'resilience', to: 'systems_coherence', kind: 'feeds', rationale: 'Resilience metrics feed cross-domain coherence.' },
  { from: 'procedural_intelligence', to: 'operational_trust', kind: 'feeds', rationale: 'Procedural integrity drives operational trust.' },
  { from: 'coordination', to: 'systems_coherence', kind: 'feeds', rationale: 'Coordination signals contribute to systemic coherence.' },
  { from: 'adaptation', to: 'institutional_memory', kind: 'feeds', rationale: 'Adaptation events become memory.' },
  { from: 'governance', to: 'adaptation', kind: 'guards', rationale: 'Governance guards adaptation against unsafe drift.' },
] as const;

/**
 * Returns the upstream-feeder domains for a given domain (transitively
 * through `feeds` edges). Used by intelligent orchestration scheduling.
 */
export function feedersOf(domain: CognitionDomain): CognitionDomain[] {
  const seen = new Set<CognitionDomain>();
  const stack: CognitionDomain[] = [domain];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const rule of DOMAIN_RELATIONSHIP_RULES) {
      if (rule.kind === 'feeds' && rule.to === current && !seen.has(rule.from)) {
        seen.add(rule.from);
        stack.push(rule.from);
      }
    }
  }
  return Array.from(seen);
}

/* -------------------------------------------------------------------------- */
/* Concept ↔ Domain Mapping                                                    */
/* -------------------------------------------------------------------------- */

export const CONCEPT_DOMAIN_MAP: Readonly<Record<InstitutionalConcept, CognitionDomain>> = {
  governance_action: 'governance',
  governance_review: 'governance',
  continuity_plan: 'continuity',
  continuity_assessment: 'continuity',
  mitigation_decision: 'resilience',
  risk_response: 'resilience',
  resilience_baseline: 'resilience',
  precedent_record: 'precedent',
  procedural_artifact: 'procedural_intelligence',
  trust_signal: 'operational_trust',
  memory_capture: 'institutional_memory',
  adaptation_event: 'adaptation',
  coordination_session: 'coordination',
};

export function domainOfConcept(concept: InstitutionalConcept): CognitionDomain {
  return CONCEPT_DOMAIN_MAP[concept];
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                  */
/* -------------------------------------------------------------------------- */

export interface OntologyValidationIssue {
  code:
    | 'unknown_domain'
    | 'unknown_concept'
    | 'forbidden_term'
    | 'unmapped_concept'
    | 'invalid_relationship';
  message: string;
  /** Optional location / context (file path, payload id, narrative key). */
  location?: string;
}

export interface OntologyValidationReport {
  ontologyVersion: string;
  validatedAt: string;
  issues: OntologyValidationIssue[];
  ok: boolean;
}

/**
 * Validate a free-form text fragment (label, narrative, payload field) for
 * forbidden labor/surveillance vocabulary. Case-insensitive substring match.
 */
export function detectForbiddenVocabulary(text: string, location?: string): OntologyValidationIssue[] {
  const issues: OntologyValidationIssue[] = [];
  const lower = text.toLowerCase();
  for (const term of FORBIDDEN_LABOR_VOCABULARY) {
    if (lower.includes(term)) {
      issues.push({
        code: 'forbidden_term',
        message: `Forbidden labor/surveillance vocabulary detected: "${term}".`,
        location,
      });
    }
  }
  return issues;
}

/**
 * Validate that a domain string is part of the canonical closed set.
 */
export function validateDomain(domain: string, location?: string): OntologyValidationIssue | null {
  if (!(COGNITION_DOMAINS as readonly string[]).includes(domain)) {
    return {
      code: 'unknown_domain',
      message: `Unknown cognition domain: "${domain}". Closed set: ${COGNITION_DOMAINS.join(', ')}.`,
      location,
    };
  }
  return null;
}

/**
 * Validate that a concept string is part of the canonical closed set.
 */
export function validateConcept(concept: string, location?: string): OntologyValidationIssue | null {
  if (!(INSTITUTIONAL_CONCEPTS as readonly string[]).includes(concept)) {
    return {
      code: 'unknown_concept',
      message: `Unknown institutional concept: "${concept}".`,
      location,
    };
  }
  return null;
}

/**
 * Compose a validation report from a series of items (text + optional
 * domain/concept declarations). Pure function — no I/O.
 */
export function validateOntology(input: {
  texts?: Array<{ text: string; location?: string }>;
  domains?: Array<{ domain: string; location?: string }>;
  concepts?: Array<{ concept: string; location?: string }>;
}): OntologyValidationReport {
  const issues: OntologyValidationIssue[] = [];
  for (const t of input.texts ?? []) {
    issues.push(...detectForbiddenVocabulary(t.text, t.location));
  }
  for (const d of input.domains ?? []) {
    const issue = validateDomain(d.domain, d.location);
    if (issue) issues.push(issue);
  }
  for (const c of input.concepts ?? []) {
    const issue = validateConcept(c.concept, c.location);
    if (issue) issues.push(issue);
  }
  return {
    ontologyVersion: INSTITUTIONAL_ONTOLOGY_VERSION,
    validatedAt: new Date().toISOString(),
    issues,
    ok: issues.length === 0,
  };
}

/* -------------------------------------------------------------------------- */
/* Semantic Drift Detection                                                    */
/* -------------------------------------------------------------------------- */

export interface OntologySnapshot {
  version: string;
  domains: readonly string[];
  concepts: readonly string[];
  capturedAt: string;
}

export function snapshotOntology(): OntologySnapshot {
  return {
    version: INSTITUTIONAL_ONTOLOGY_VERSION,
    domains: [...COGNITION_DOMAINS],
    concepts: [...INSTITUTIONAL_CONCEPTS],
    capturedAt: new Date().toISOString(),
  };
}

export interface OntologyDriftReport {
  fromVersion: string;
  toVersion: string;
  addedDomains: string[];
  removedDomains: string[];
  addedConcepts: string[];
  removedConcepts: string[];
  /** A drift is "breaking" if anything was REMOVED. */
  breaking: boolean;
}

export function diffOntology(
  prev: OntologySnapshot,
  next: OntologySnapshot,
): OntologyDriftReport {
  const prevDomains = new Set(prev.domains);
  const nextDomains = new Set(next.domains);
  const prevConcepts = new Set(prev.concepts);
  const nextConcepts = new Set(next.concepts);

  const addedDomains = [...nextDomains].filter((d) => !prevDomains.has(d));
  const removedDomains = [...prevDomains].filter((d) => !nextDomains.has(d));
  const addedConcepts = [...nextConcepts].filter((c) => !prevConcepts.has(c));
  const removedConcepts = [...prevConcepts].filter((c) => !nextConcepts.has(c));

  return {
    fromVersion: prev.version,
    toVersion: next.version,
    addedDomains,
    removedDomains,
    addedConcepts,
    removedConcepts,
    breaking: removedDomains.length > 0 || removedConcepts.length > 0,
  };
}
