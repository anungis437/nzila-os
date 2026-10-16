/**
 * CIVITAS doctrine. Closed set. Statements outside this set are not doctrine.
 * Pseudolaw is rejected in `pseudolaw.ts` and can never be inserted here.
 */

export const FIRST_PRINCIPLE =
  'Maximize lawful control, optionality, resilience, privacy, reversibility, and continuity while identifying and respecting mandatory legal obligations. Autonomy is never an exemption from law.'

export const GOVERNING_MAXIM =
  'Know the authority. Understand the obligation. Exercise the right. Structure the choice. Preserve the evidence. Protect the option. Build for continuity.'

export interface DoctrineRule {
  readonly id: string
  readonly statement: string
}

export const DOCTRINE_RULES = [
  { id: 'law-before-folklore', statement: 'Law before folklore.' },
  { id: 'jurisdiction-before-conclusion', statement: 'Jurisdiction before conclusion.' },
  { id: 'authority-before-assertion', statement: 'Authority before assertion.' },
  { id: 'rights-and-obligations-together', statement: 'Rights and obligations are analyzed together.' },
  { id: 'mandatory-vs-discretionary', statement: 'Mandatory and discretionary obligations are distinguished.' },
  { id: 'substance-over-labels', statement: 'Substance over labels.' },
  { id: 'privacy-not-concealment', statement: 'Privacy optimization is never unlawful concealment.' },
  { id: 'tax-optimization-not-evasion', statement: 'Tax optimization is never evasion.' },
  {
    id: 'asset-protection-not-fraudulent-conveyance',
    statement: 'Asset protection is never a fraudulent conveyance.',
  },
  {
    id: 'corporate-separation-real-personality',
    statement: 'Corporate separation must reflect real legal personality and real governance.',
  },
  { id: 'evidence-supports-material-assertions', statement: 'Evidence supports material assertions.' },
  { id: 'current-vs-historical-law', statement: 'Current law and historical law are distinguished.' },
  { id: 'uncertainty-stays-uncertain', statement: 'Uncertainty stays uncertain.' },
  { id: 'professional-risk-escalates', statement: 'Material professional-risk matters escalate.' },
  { id: 'never-counsel-of-record', statement: 'CIVITAS never represents itself as counsel of record.' },
] as const satisfies readonly DoctrineRule[]

export type DoctrineRuleId = (typeof DOCTRINE_RULES)[number]['id']

const RULES_BY_STATEMENT = new Map<string, DoctrineRule>(
  DOCTRINE_RULES.map((rule) => [normalize(rule.statement), rule]),
)

export function normalize(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function listDoctrine(): readonly DoctrineRule[] {
  return DOCTRINE_RULES
}

export function isCanonicalDoctrine(statement: string): boolean {
  return RULES_BY_STATEMENT.has(normalize(statement))
}
