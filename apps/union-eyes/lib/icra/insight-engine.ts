/**
 * ARTIFACT TYPE: Insight Engine
 * DOCTRINE_VERSION: 1.0.0
 * CHANGE CLASS: Operational
 *
 * ICRA Emotional Insight Engine — cross-dimensional institutional observation.
 *
 * This engine compares dimensions, detects institutional tensions, and surfaces
 * human observations that feel true rather than generated.
 *
 * Tone: calm, "quietly devastating," stewardship-oriented, operationally mature.
 * Never: fear-based, robotic, hype-driven, manipulative, or generic.
 *
 * No AI references. No opaque models. Every insight is deterministic and
 * traceable to the dimension scores that triggered it.
 */

import type {
  ContinuityBurdenIndex,
  ContinuityInsight,
  ContinuitySignal,
  DimensionId,
  DimensionScore,
  ExecutivePersonaId,
  SectionId,
  SectionScore,
  StewardshipSignal,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Thresholds — tuned for institutional sensitivity, not false-positive alarms
// ─────────────────────────────────────────────────────────────────────────────

const T = {
  /** Below this: dimension is materially weak */
  MATERIAL_LOW: 35,
  /** Below this: dimension is notable (attention) */
  NOTABLE_LOW: 55,
  /** Above this: dimension is strong */
  STRONG: 70,
  /** Modernization gap: governance posture outpaces memory by this margin */
  MODERNIZATION_GAP: 18,
  /** Evidence gap: governance structure outpaces evidence traceability */
  EVIDENCE_GAP: 15,
  /** Max insights surfaced — prevents flooding the report */
  MAX_INSIGHTS: 5,
} as const;

// Build a short evidence phrase: "institutional_continuity 28; operational_memory 31"
function evidence(scores: DimensionScore[], ids: DimensionId[]): string {
  return ids
    .map((id) => `${id} ${dim(scores, id)}`)
    .join('; ');
}

// ─────────────────────────────────────────────────────────────────────────────
// Score helpers
// ─────────────────────────────────────────────────────────────────────────────

function dim(scores: DimensionScore[], id: DimensionId): number {
  return scores.find((d) => d.dimension === id)?.score ?? 50;
}

function avgDims(scores: DimensionScore[], ids: DimensionId[]): number {
  const values = ids.map((id) => dim(scores, id));
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// ─────────────────────────────────────────────────────────────────────────────
// Detection rules — five institutional tension patterns
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect when modernization posture outpaces continuity preservation.
 * Sovereignty + explainability strong, but operational memory lags.
 */
function detectModernizationContinuityGap(
  scores: DimensionScore[],
  persona?: ExecutivePersonaId,
): ContinuityInsight | null {
  const modernizationProxy = avgDims(scores, ['institutional_continuity', 'trust_debt']);
  const memoryProxy = dim(scores, 'operational_memory');

  if (modernizationProxy - memoryProxy < T.MODERNIZATION_GAP) return null;

  const personaBody: Partial<Record<ExecutivePersonaId, string>> = {
    healthcare_ops:
      'Operational systems and governance structures may be evolving, but the institutional memory needed to orient new staff and absorb transitions appears not to be keeping pace.',
    union_leadership:
      'Governance and accountability structures appear to have developed faster than the preservation of precedent, negotiation history, and operational context.',
    cio_coo:
      'Technology and governance maturity may be outpacing institutional memory infrastructure — a pattern that often becomes visible during leadership transitions.',
  };

  return {
    id: 'insight_modernization_gap',
    category: 'modernization_continuity_gap',
    headline: 'Your modernization posture appears stronger than your continuity posture.',
    body:
      personaBody[persona ?? 'governance_board'] ??
      'Operational systems appear to be evolving faster than institutional memory preservation. The institution may be gaining capability while quietly losing context.',
    dimensionsInvolved: ['institutional_continuity', 'operational_memory'],
    severity: memoryProxy < T.MATERIAL_LOW ? 'material' : 'notable',
    affectedSections: ['institutional_memory', 'governance_visibility'],
    evidenceBasis: evidence(scores, ['institutional_continuity', 'operational_memory', 'trust_debt']),
  };
}

/**
 * Detect invisible continuity labour — high operational dependency on people.
 * The institution functions, but on informal human compensation.
 */
function detectInvisibleLabour(
  scores: DimensionScore[],
  persona?: ExecutivePersonaId,
): ContinuityInsight | null {
  const ic = dim(scores, 'institutional_continuity');
  const om = dim(scores, 'operational_memory');

  // Invisible labour appears when IC is moderate but memory infrastructure is weak
  // — the institution works, but people are doing the work systems should do
  if (ic >= T.STRONG && om >= T.NOTABLE_LOW) return null;
  if (ic < T.MATERIAL_LOW && om < T.MATERIAL_LOW) return null; // Covered by forgetting

  const personaBody: Partial<Record<ExecutivePersonaId, string>> = {
    union_leadership:
      'Critical continuity knowledge — precedent, negotiation history, operational context — may currently live inside individuals rather than institutional systems. When those individuals transition, so does the knowledge.',
    healthcare_ops:
      'Operational continuity may rely on staff compensating for gaps in institutional systems through informal coordination and personal knowledge. This burden is rarely visible until it is absent.',
    governance_board:
      'Governance continuity may currently depend more on the informal authority and memory of specific individuals than on structured institutional systems.',
  };

  return {
    id: 'insight_invisible_labour',
    category: 'invisible_labour',
    headline:
      'Your institution appears operationally functional, but heavily dependent on invisible continuity labour.',
    body:
      personaBody[persona ?? 'executive_director'] ??
      'Critical continuity knowledge may currently live inside individuals rather than institutional systems. The organization works — but it works because people are quietly compensating for what the systems have not been built to hold.',
    dimensionsInvolved: ['institutional_continuity', 'operational_memory'],
    severity: om < T.MATERIAL_LOW ? 'material' : 'notable',
    affectedSections: ['institutional_memory', 'operational_dependency'],
    evidenceBasis: evidence(scores, ['institutional_continuity', 'operational_memory']),
  };
}

/**
 * Detect governance drift — interpretation depends on institutional veterans.
 * Governance fragility scores indicate structural concentration.
 */
function detectGovernanceDrift(
  scores: DimensionScore[],
  persona?: ExecutivePersonaId,
): ContinuityInsight | null {
  const gf = dim(scores, 'governance_fragility');
  if (gf >= T.NOTABLE_LOW) return null;

  const personaBody: Partial<Record<ExecutivePersonaId, string>> = {
    union_leadership:
      'Governance interpretation — how policies are applied, how decisions are made, how precedent is read — may currently depend on institutional veterans rather than structured continuity systems. That dependency becomes a vulnerability during every transition.',
    governance_board:
      'The governance body may be receiving a coherent picture of operations while the actual mechanisms of governance depend on individuals who hold interpretive authority informally.',
    executive_director:
      'Governance procedures may exist in documented form while governance interpretation lives with a small number of people. Both are institutional assets. Only one of them compounds.',
  };

  return {
    id: 'insight_governance_drift',
    category: 'governance_drift',
    headline:
      'Governance interpretation may currently depend more on institutional veterans than structured continuity systems.',
    body:
      personaBody[persona ?? 'governance_board'] ??
      'Governance continuity appears to rely on the knowledge and interpretive authority of specific individuals. This is a quiet form of fragility — visible primarily during transitions, disputes, or external scrutiny.',
    dimensionsInvolved: ['governance_fragility', 'institutional_continuity'],
    severity: gf < T.MATERIAL_LOW ? 'material' : 'notable',
    affectedSections: ['governance_visibility', 'institutional_memory'],
    evidenceBasis: evidence(scores, ['governance_fragility', 'institutional_continuity']),
  };
}

/**
 * Detect reconstruction burden — teams repeatedly rebuild institutional understanding.
 * Both memory and transition readiness are weak.
 */
function detectReconstructionBurden(
  scores: DimensionScore[],
  sections: SectionScore[],
  persona?: ExecutivePersonaId,
): ContinuityInsight | null {
  const om = dim(scores, 'operational_memory');
  const tr = dim(scores, 'transition_readiness');

  if (om >= T.NOTABLE_LOW || tr >= T.NOTABLE_LOW) return null;

  const personaBody: Partial<Record<ExecutivePersonaId, string>> = {
    healthcare_ops:
      'Staff and leadership may be spending measurable operational time rebuilding context that should be available in institutional systems — a pattern that compounds quietly with each transition.',
    cio_coo:
      'Operational continuity may require repeated reconstruction of institutional understanding. This is a hidden cost — borne by individuals, absorbed into role transitions, rarely accounted for directly.',
  };

  return {
    id: 'insight_reconstruction_burden',
    category: 'reconstruction_burden',
    headline:
      'Teams may be repeatedly rebuilding institutional understanding from fragments.',
    body:
      personaBody[persona ?? 'executive_director'] ??
      'Weak institutional memory combined with underdeveloped transition readiness suggests a pattern where each major change requires rebuilding operational context rather than inheriting it. This is continuity debt made visible.',
    dimensionsInvolved: ['operational_memory', 'transition_readiness'],
    severity: om < T.MATERIAL_LOW && tr < T.MATERIAL_LOW ? 'material' : 'notable',
    affectedSections: ['institutional_memory', 'transition_readiness'],
    evidenceBasis: evidence(scores, ['operational_memory', 'transition_readiness']),
  };
}

/**
 * Detect institutional forgetting — multiple continuity dimensions simultaneously weak.
 * The institution may be systematically losing its operational memory.
 */
function detectInstitutionalForgetting(
  scores: DimensionScore[],
): ContinuityInsight | null {
  const weakDimensions = scores.filter((d) => d.score < T.NOTABLE_LOW);
  if (weakDimensions.length < 3) return null;

  const ic = dim(scores, 'institutional_continuity');
  const om = dim(scores, 'operational_memory');

  return {
    id: 'insight_institutional_forgetting',
    category: 'institutional_forgetting',
    headline:
      'Institutional memory fragmentation appears to be increasing operational fragility.',
    body:
      'Several continuity dimensions are weakening together. This is the signature of quiet institutional forgetting — not a single broken system, but the slow, parallel erosion of operational memory, governance coherence, and transition readiness, each making the others harder to sustain. Institutions in this pattern rarely notice the trajectory until a transition forces the ledger open.',
    dimensionsInvolved: weakDimensions.map((d) => d.dimension) as DimensionId[],
    severity: ic < T.MATERIAL_LOW && om < T.MATERIAL_LOW ? 'material' : 'notable',
    affectedSections: ['institutional_memory', 'governance_visibility', 'transition_readiness'],
    evidenceBasis: weakDimensions.map((d) => `${d.dimension} ${d.score}`).join('; '),
  };
}

/**
 * Detect when governance structure outpaces evidence/traceability.
 * Governance fragility is healthy (high score on the inverted dim) but trust_debt is weak —
 * a pattern where documented procedure exists but the evidence required to demonstrate
 * decisions is missing. Most consequential for audits, regulators, board reviews.
 */
function detectEvidenceGovernanceGap(
  scores: DimensionScore[],
  persona?: ExecutivePersonaId,
): ContinuityInsight | null {
  const gf = dim(scores, 'governance_fragility'); // continuity-positive (high = low fragility)
  const td = dim(scores, 'trust_debt'); // continuity-positive (high = low debt)
  if (gf < T.NOTABLE_LOW) return null; // governance not strong enough — covered by drift
  if (td >= gf - T.EVIDENCE_GAP) return null; // gap not significant

  const personaBody: Partial<Record<ExecutivePersonaId, string>> = {
    governance_board:
      'Governance procedures appear structured, but the evidentiary foundation that allows the governance body to defend its decisions during audits or external review may not yet match that structure. Structured governance without traceable evidence is vulnerable during scrutiny.',
    cio_coo:
      'Operational governance is reasonably structured, but the evidence trail required to demonstrate decisions — to auditors, regulators, or successor leadership — appears thinner than the governance posture would suggest.',
    union_leadership:
      'Governance and accountability structures appear in place, but the documented evidence of how decisions and precedents were reached — the kind that members and successor officers can review — may not be as developed as the structure itself.',
  };

  return {
    id: 'insight_evidence_governance_gap',
    category: 'evidence_governance_gap',
    headline:
      'Governance structure may currently outpace the evidence required to demonstrate it.',
    body:
      personaBody[persona ?? 'governance_board'] ??
      'Documented governance procedures exist, but the evidentiary base required to demonstrate how decisions were made may not yet match the structure of those procedures. This is a pattern that becomes visible during audits, regulator reviews, and contested transitions.',
    dimensionsInvolved: ['governance_fragility', 'trust_debt'],
    severity: td < T.MATERIAL_LOW ? 'material' : 'notable',
    affectedSections: ['explainability_trust', 'governance_visibility'],
    evidenceBasis: evidence(scores, ['governance_fragility', 'trust_debt']),
  };
}

/**
 * Detect stewardship concentration — moderate composite maturity but elevated burden.
 * Institution looks fine on paper, but a small number of people are quietly holding it together.
 * The most under-named pattern in mid-maturity institutions.
 */
function detectStewardshipConcentration(
  scores: DimensionScore[],
  burdenScore: number,
  persona?: ExecutivePersonaId,
): ContinuityInsight | null {
  const ic = dim(scores, 'institutional_continuity');
  // Only fires for institutions that look reasonable but carry hidden burden
  if (ic < T.NOTABLE_LOW) return null; // covered by invisible_labour
  if (burdenScore < 50) return null; // burden not concentrated enough

  const personaBody: Partial<Record<ExecutivePersonaId, string>> = {
    union_leadership:
      'The local appears to be functioning at a structured level, but a meaningful portion of its continuity load appears to be carried informally by experienced officers and stewards. That labour is rarely named in governance reporting, but it is what holds precedent together between elections.',
    healthcare_ops:
      'The organization appears to be operating at a reasonable level of structure, while a meaningful portion of day-to-day continuity is being held together by experienced clinical and administrative staff doing informal coordination work. This pattern is sustainable until simultaneous transitions occur.',
    governance_board:
      'The organization presents a structured operational picture, while a meaningful portion of continuity is being absorbed by a small number of experienced individuals. Governance bodies often only see this dynamic when one of those individuals departs.',
    federated_org:
      'The federation appears to operate at a structured level, but continuity coherence across affiliates may depend more on a small number of long-tenured regional coordinators than on the federation’s formal infrastructure.',
  };

  return {
    id: 'insight_stewardship_concentration',
    category: 'stewardship_concentration',
    headline:
      'The institution presents a structured posture while quietly relying on concentrated stewardship.',
    body:
      personaBody[persona ?? 'executive_director'] ??
      'The composite continuity posture is reasonable, but the Continuity Burden Index indicates that meaningful operational coherence is currently being absorbed by a small number of experienced people. This pattern is sustainable until it is not.',
    dimensionsInvolved: ['institutional_continuity', 'operational_memory', 'transition_readiness'],
    severity: burdenScore >= 65 ? 'material' : 'notable',
    affectedSections: ['operational_dependency', 'institutional_memory'],
    evidenceBasis: `${evidence(scores, ['institutional_continuity', 'operational_memory'])}; burden ${burdenScore}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Continuity Signals — recognizable institutional patterns
// ─────────────────────────────────────────────────────────────────────────────

function generateContinuitySignals(
  scores: DimensionScore[],
  sections: SectionScore[],
): ContinuitySignal[] {
  const ic = dim(scores, 'institutional_continuity');
  const gf = dim(scores, 'governance_fragility');
  const om = dim(scores, 'operational_memory');
  const tr = dim(scores, 'transition_readiness');
  const td = dim(scores, 'trust_debt');

  const sectionMap = new Map(sections.map((s) => [s.section, s.score]));

  return [
    {
      id: 'sig_leadership_dependency',
      label: 'Leadership-dependent operational continuity',
      observed: ic < T.NOTABLE_LOW,
    },
    {
      id: 'sig_governance_concentration',
      label: 'Governance interpretation concentration',
      observed: gf < T.NOTABLE_LOW,
    },
    {
      id: 'sig_informal_memory',
      label: 'Informal institutional memory preservation',
      observed: om < T.NOTABLE_LOW,
    },
    {
      id: 'sig_reconstruction_burden',
      label: 'Operational reconstruction burden',
      observed: om < T.NOTABLE_LOW && tr < T.NOTABLE_LOW,
    },
    {
      id: 'sig_onboarding_fragility',
      label: 'Fragmented onboarding continuity',
      observed: (sectionMap.get('transition_readiness') ?? 100) < T.NOTABLE_LOW,
    },
    {
      id: 'sig_trust_accumulation',
      label: 'Accumulated institutional trust debt',
      observed: td < T.NOTABLE_LOW,
    },
    {
      id: 'sig_sovereignty_risk',
      label: 'Institutional data sovereignty risk',
      observed: (sectionMap.get('sovereignty_governance') ?? 100) < T.NOTABLE_LOW,
    },
    {
      id: 'sig_coordination_fragility',
      label: 'Cross-team coordination fragility',
      observed: (sectionMap.get('operational_coordination') ?? 100) < T.NOTABLE_LOW,
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Stewardship Signals — institutional care and obligation signals
// ─────────────────────────────────────────────────────────────────────────────

function generateStewardshipSignals(scores: DimensionScore[]): StewardshipSignal[] {
  const ic = dim(scores, 'institutional_continuity');
  const gf = dim(scores, 'governance_fragility');
  const om = dim(scores, 'operational_memory');
  const tr = dim(scores, 'transition_readiness');
  const td = dim(scores, 'trust_debt');

  function severity(score: number): StewardshipSignal['severity'] {
    if (score < T.MATERIAL_LOW) return 'elevated';
    if (score < T.NOTABLE_LOW) return 'moderate';
    return 'low';
  }

  return [
    {
      id: 'stew_burden_concentration',
      label: 'Continuity burden concentration',
      severity: severity(ic),
    },
    {
      id: 'stew_undocumented_stewardship',
      label: 'Undocumented operational stewardship',
      severity: severity(om),
    },
    {
      id: 'stew_memory_fragility',
      label: 'Institutional memory fragility',
      severity: severity(om),
    },
    {
      id: 'stew_governance_resilience',
      label: 'Governance resilience gaps',
      severity: severity(gf),
    },
    {
      id: 'stew_transition_stewardship',
      label: 'Transition stewardship maturity',
      severity: severity(tr),
    },
  ].filter((s) => s.severity !== 'low'); // Only surface stewardship signals that are present
}

// ─────────────────────────────────────────────────────────────────────────────
// Continuity Burden Index™
// ─────────────────────────────────────────────────────────────────────────────

function computeBurdenIndex(
  scores: DimensionScore[],
  sections: SectionScore[],
): ContinuityBurdenIndex {
  const ic = dim(scores, 'institutional_continuity');
  const om = dim(scores, 'operational_memory');
  const tr = dim(scores, 'transition_readiness');

  // Burden is inverse of these continuity dimensions
  // High IC + OM + TR = low burden (humans don't have to compensate)
  const avgContinuity = (ic + om + tr) / 3;
  const score = Math.round(100 - avgContinuity);

  let interpretation: string;
  if (score >= 75)
    interpretation =
      'Continuity in this institution is currently held together largely by people, not by systems. The operational labour absorbed informally — to keep precedent intact, to translate between fragmented tools, to onboard newcomers, to remember why things are done — is material, and it is being paid quietly by a small group whose contribution does not appear in any formal report.';
  else if (score >= 55)
    interpretation =
      'A meaningful share of continuity is sustained through informal human effort rather than institutional infrastructure. Operations remain coherent, but coherence depends on stewardship that the organization has not yet named, measured, or distributed.';
  else if (score >= 40)
    interpretation =
      'Continuity burden is present and concentrated in specific areas. The institution is mostly carrying its own weight, but a few load-bearing dependencies on individuals remain — visible mainly during vacations, sick leave, and role transitions.';
  else
    interpretation =
      'Continuity burden is low. Institutional systems are absorbing the majority of continuity work, and the organization’s coherence is not unduly dependent on the continued presence of specific individuals.';

  // These are gated in Executive Continuity Brief
  const humanCompensationIndicators: string[] = [];

  if (ic < T.NOTABLE_LOW)
    humanCompensationIndicators.push(
      'Operational continuity is held in place by individual knowledge and informal authority rather than institutional procedure',
    );
  if (om < T.NOTABLE_LOW)
    humanCompensationIndicators.push(
      'Institutional memory lives in personal recall — precedent, exceptions, and rationale travel with people, not with the institution',
    );
  if (tr < T.NOTABLE_LOW)
    humanCompensationIndicators.push(
      'Leadership and role transitions rely on informal apprenticeship — the successor learns what the institution actually does by watching, not by inheriting',
    );

  const sectionMap = new Map(sections.map((s) => [s.section, s.score]));
  if ((sectionMap.get('operational_coordination') ?? 100) < T.NOTABLE_LOW)
    humanCompensationIndicators.push(
      'Cross-team coordination is sustained by relationship networks; when the relationships shift, the coordination shifts with them',
    );
  if ((sectionMap.get('governance_visibility') ?? 100) < T.NOTABLE_LOW)
    humanCompensationIndicators.push(
      'Governance bodies see the operation through trusted individual reporting rather than through independent, structurally-traceable visibility',
    );

  return { score, interpretation, humanCompensationIndicators };
}

// ─────────────────────────────────────────────────────────────────────────────
// Primary export
// ─────────────────────────────────────────────────────────────────────────────

export interface InsightEngineOutput {
  insights: ContinuityInsight[];
  continuitySignals: ContinuitySignal[];
  stewardshipSignals: StewardshipSignal[];
  burdenIndex: ContinuityBurdenIndex;
}

/**
 * Generate the full insight engine output from dimension + section scores.
 * Optionally accepts an executive persona for copy variant selection.
 *
 * All outputs are deterministic — the same scores produce the same insights.
 * No randomness. No opaque model. Every insight is traceable to a threshold.
 */
export function generateInsights(
  dimensionScores: DimensionScore[],
  sectionScores: SectionScore[],
  persona?: ExecutivePersonaId,
): InsightEngineOutput {
  const continuitySignals = generateContinuitySignals(dimensionScores, sectionScores);
  const stewardshipSignals = generateStewardshipSignals(dimensionScores);
  const burdenIndex = computeBurdenIndex(dimensionScores, sectionScores);

  const rawInsights: Array<ContinuityInsight | null> = [
    detectInvisibleLabour(dimensionScores, persona),
    detectGovernanceDrift(dimensionScores, persona),
    detectReconstructionBurden(dimensionScores, sectionScores, persona),
    detectModernizationContinuityGap(dimensionScores, persona),
    detectInstitutionalForgetting(dimensionScores),
    detectEvidenceGovernanceGap(dimensionScores, persona),
    detectStewardshipConcentration(dimensionScores, burdenIndex.score, persona),
  ];

  // Severity ordering: material (most consequential) first.
  const severityOrder: Record<ContinuityInsight['severity'], number> = {
    material: 0,
    notable: 1,
    observed: 2,
  };

  // Category priority — if two insights tie on severity, the more executively-relevant
  // (and emotionally precise) category surfaces first. Calibrated by hand, not learned.
  const categoryPriority: Record<ContinuityInsight['category'], number> = {
    institutional_forgetting: 0,
    invisible_labour: 1,
    governance_drift: 2,
    reconstruction_burden: 3,
    stewardship_concentration: 4,
    evidence_governance_gap: 5,
    modernization_continuity_gap: 6,
  };

  const insights = rawInsights
    .filter((i): i is ContinuityInsight => i !== null)
    .sort((a, b) => {
      const sevDelta = severityOrder[a.severity] - severityOrder[b.severity];
      if (sevDelta !== 0) return sevDelta;
      return categoryPriority[a.category] - categoryPriority[b.category];
    })
    .slice(0, T.MAX_INSIGHTS);

  return { insights, continuitySignals, stewardshipSignals, burdenIndex };
}
