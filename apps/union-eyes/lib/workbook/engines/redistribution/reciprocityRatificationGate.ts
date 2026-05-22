/**
 * OCI Reciprocity Ratification Gate — deterministic gate enforcing
 * Section 11 reciprocity terms of the Stewardship Redistribution
 * playbook. Refuses to allow the playbook to advance unless every
 * required term is ratified.
 *
 * Pure. No DB writes.
 *
 * Doctrine:
 *   docs/oci/stabilization/playbooks/STEWARDSHIP_REDISTRIBUTION.md §11
 *   docs/oci/stabilization/workflows/STEWARDSHIP_REDISTRIBUTION_WORKFLOW.md
 */

export const ENGINE_VERSION = '2.0.0';

export type ReciprocityTermKey =
  | 'originating_steward_named_as_source'
  | 'standing_preserved_or_enhanced'
  | 'compensation_preserved_or_enhanced'
  | 'role_preserved_or_enhanced'
  | 'broadened_carrier_set_recorded_as_institutional';

export const REQUIRED_RECIPROCITY_TERMS: readonly ReciprocityTermKey[] = [
  'originating_steward_named_as_source',
  'standing_preserved_or_enhanced',
  'compensation_preserved_or_enhanced',
  'role_preserved_or_enhanced',
  'broadened_carrier_set_recorded_as_institutional',
];

export interface ReciprocityRatificationInput {
  readonly ratifiedTerms: readonly ReciprocityTermKey[];
}

export type ReciprocityGateDisposition = 'permitted' | 'refused';

export interface ReciprocityGateSignal {
  readonly signalId: string;
  readonly severity: 'note' | 'observation' | 'warning' | 'critical';
  readonly category:
    | 'reciprocity_terms_ratified'
    | 'reciprocity_terms_missing'
    | 'reciprocity_terms_unrecognised';
  readonly statement: string;
  readonly evidence: Readonly<Record<string, unknown>>;
}

export interface ReciprocityRatificationResult {
  readonly engineVersion: typeof ENGINE_VERSION;
  readonly disposition: ReciprocityGateDisposition;
  readonly ratifiedTerms: readonly ReciprocityTermKey[];
  readonly missingTerms: readonly ReciprocityTermKey[];
  readonly unrecognisedTerms: readonly string[];
  readonly signals: readonly ReciprocityGateSignal[];
}

export function evaluateReciprocityRatification(
  input: ReciprocityRatificationInput,
): ReciprocityRatificationResult {
  const allowed = new Set<string>(REQUIRED_RECIPROCITY_TERMS);
  const supplied = new Set<string>(input.ratifiedTerms);

  const unrecognised: string[] = [];
  for (const t of supplied) {
    if (!allowed.has(t)) unrecognised.push(t);
  }
  const ratified = REQUIRED_RECIPROCITY_TERMS.filter((t) => supplied.has(t));
  const missing = REQUIRED_RECIPROCITY_TERMS.filter((t) => !supplied.has(t));

  const signals: ReciprocityGateSignal[] = [];
  if (missing.length === 0) {
    signals.push({
      signalId: 'reciprocity:ratified',
      severity: 'observation',
      category: 'reciprocity_terms_ratified',
      statement:
        'All Section 11 reciprocity terms are ratified. Stewardship redistribution may advance.',
      evidence: { ratifiedTerms: ratified },
    });
  } else {
    signals.push({
      signalId: 'reciprocity:missing',
      severity: 'critical',
      category: 'reciprocity_terms_missing',
      statement: `Stewardship redistribution is refused. Missing reciprocity terms: ${missing.join(', ')}.`,
      evidence: { ratifiedTerms: ratified, missingTerms: missing },
    });
  }
  if (unrecognised.length > 0) {
    signals.push({
      signalId: 'reciprocity:unrecognised',
      severity: 'warning',
      category: 'reciprocity_terms_unrecognised',
      statement: `Unrecognised reciprocity term keys were provided and ignored: ${unrecognised.join(', ')}.`,
      evidence: { unrecognisedTerms: unrecognised },
    });
  }

  return {
    engineVersion: ENGINE_VERSION,
    disposition: missing.length === 0 ? 'permitted' : 'refused',
    ratifiedTerms: ratified,
    missingTerms: missing,
    unrecognisedTerms: unrecognised,
    signals,
  };
}
