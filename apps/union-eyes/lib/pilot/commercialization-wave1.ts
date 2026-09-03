export interface PilotEconomicsTier {
  id: 'starter-local' | 'mid-local' | 'regional-council' | 'provincial-org';
  label: string;
  memberRange: {
    min: number;
    max: number | null;
  };
  targetPriceRange: string;
  summary: string;
}

export const PILOT_ECONOMICS_LADDER: PilotEconomicsTier[] = [
  {
    id: 'starter-local',
    label: 'Starter Local',
    memberRange: { min: 1, max: 499 },
    targetPriceRange: '$5K-$10K',
    summary: 'Single local activation with bounded onboarding and initial workflow instrumentation.',
  },
  {
    id: 'mid-local',
    label: 'Mid-size Local',
    memberRange: { min: 500, max: 2499 },
    targetPriceRange: '$10K-$25K',
    summary: 'Expanded local operations with deeper workflow adoption and governance review cadence.',
  },
  {
    id: 'regional-council',
    label: 'Regional Council',
    memberRange: { min: 2500, max: 9999 },
    targetPriceRange: '$25K-$75K',
    summary: 'Cross-unit coordination pilot with elevated operational complexity and leadership reporting.',
  },
  {
    id: 'provincial-org',
    label: 'Provincial Organization',
    memberRange: { min: 10000, max: null },
    targetPriceRange: '$75K-$250K',
    summary: 'Large-scale organizational pilot requiring broader onboarding and structured expansion planning.',
  },
];

export type CommercialState =
  | 'lead'
  | 'qualified'
  | 'pilot'
  | 'proposal'
  | 'approved'
  | 'contract_sent'
  | 'contract_signed'
  | 'invoice_issued'
  | 'pilot_active'
  | 'pilot_complete'
  | 'subscription_offered'
  | 'subscription_active';

export type CommercialPilotStatus = 'submitted' | 'review' | 'approved' | 'active' | 'completed' | 'declined';

export const COMMERCIAL_STATE_ORDER: CommercialState[] = [
  'lead',
  'qualified',
  'pilot',
  'proposal',
  'approved',
  'contract_sent',
  'contract_signed',
  'invoice_issued',
  'pilot_active',
  'pilot_complete',
  'subscription_offered',
  'subscription_active',
];

export interface PilotApplicationCommercialInput {
  id: string;
  organizationName: string;
  organizationType: 'local' | 'regional' | 'national';
  contactName: string;
  contactEmail: string;
  memberCount: number;
  jurisdictions: string[];
  sectors: string[];
  currentSystem?: string | null;
  challenges: string[];
  goals: string[];
  readinessScore?: string | number | null;
}

export interface CommercialSignals {
  adoptionScore: number;
  activityScore: number;
  championScore: number;
  riskScore: number;
  renewalLikelihood: 'low' | 'medium' | 'high';
  expansionLikelihood: 'low' | 'medium' | 'high';
  arrPotentialBand: 'small' | 'medium' | 'large';
}

export type OpportunityTier = 'A' | 'B' | 'C';

export interface PilotQualificationScores {
  pilotFitScore: number;
  pilotRiskScore: number;
  pilotRevenueScore: number;
  pilotReadinessScore: number;
  pilotStrategicValueScore: number;
  overallOpportunityScore: number;
  opportunityTier: OpportunityTier;
}

export interface ProposalPackage {
  generatedAt: string;
  qualification: 'qualified' | 'review-required' | 'defer';
  economicsTier: PilotEconomicsTier;
  commercialState: CommercialState;
  commercialStateOrder: CommercialState[];
  signals: CommercialSignals;
  qualificationScores: PilotQualificationScores;
  artifacts: PilotArtifactBundle;
  markdown: string;
}

export interface PilotArtifact {
  title: string;
  sections: Array<{
    heading: string;
    items: string[];
  }>;
  markdown: string;
}

export interface PilotArtifactBundle {
  proposal: PilotArtifact;
  statementOfWork: PilotArtifact;
  successMetrics: PilotArtifact;
  pilotPlan: PilotArtifact;
}

export interface PilotArtifactVersionRecord {
  versionId: string;
  createdAt: string;
  source: string;
  milestone?: string;
  notes?: string;
  commercialState: CommercialState;
  qualificationScores: PilotQualificationScores;
  artifacts: PilotArtifactBundle;
  checksum: string;
}

export interface PilotReferenceVersionRecord {
  versionId: string;
  createdAt: string;
  source: string;
  milestone?: string;
  notes?: string;
  referenceProfile: Record<string, unknown>;
  caseStudy: Record<string, unknown>;
  benchmarkDataset: Record<string, unknown>;
  checksum: string;
}

export interface PilotArtifactDiffSummary {
  fromVersionId: string;
  toVersionId: string;
  changedArtifactKeys: Array<keyof PilotArtifactBundle>;
  changedSectionCount: number;
  changedItemCount: number;
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function getOpportunityTier(overallOpportunityScore: number): OpportunityTier {
  if (overallOpportunityScore >= 80) return 'A';
  if (overallOpportunityScore >= 65) return 'B';
  return 'C';
}

export function calculatePilotQualificationScores(
  application: PilotApplicationCommercialInput,
  input: {
    readinessScore: number | null;
    commercialState: CommercialState;
  },
): PilotQualificationScores {
  const readiness = input.readinessScore ?? 55;
  const memberCount = Math.max(1, application.memberCount || 1);
  const stateIndex = Math.max(0, COMMERCIAL_STATE_ORDER.indexOf(input.commercialState));
  const processProgress = Math.round((stateIndex / (COMMERCIAL_STATE_ORDER.length - 1)) * 100);
  const coverageBreadth = Math.min(100, application.jurisdictions.length * 15 + application.sectors.length * 12);
  const challengeLoad = application.challenges.length;
  const hasKnownSystem = Boolean(application.currentSystem && application.currentSystem.trim().length > 0);

  const memberScale = Math.log10(memberCount + 1) / Math.log10(10001);
  const memberScaleScore = clampScore(memberScale * 100);

  const strategicBaseByType =
    application.organizationType === 'national'
      ? 90
      : application.organizationType === 'regional'
        ? 78
        : 65;

  const pilotFitScore = clampScore(
    readiness * 0.45 +
      processProgress * 0.2 +
      (100 - Math.min(80, challengeLoad * 8)) * 0.15 +
      (hasKnownSystem ? 12 : 0) +
      8,
  );

  const pilotRiskScore = clampScore(
    100 - (readiness * 0.5 + processProgress * 0.25 + (hasKnownSystem ? 10 : 0) + Math.min(15, memberScaleScore * 0.15)),
  );

  const pilotRevenueScore = clampScore(memberScaleScore * 0.7 + processProgress * 0.3);
  const pilotReadinessScore = clampScore(readiness * 0.8 + processProgress * 0.2);
  const pilotStrategicValueScore = clampScore(strategicBaseByType * 0.6 + coverageBreadth * 0.4);

  const overallOpportunityScore = clampScore(
    pilotFitScore * 0.25 +
      pilotReadinessScore * 0.25 +
      pilotRevenueScore * 0.2 +
      pilotStrategicValueScore * 0.2 +
      (100 - pilotRiskScore) * 0.1,
  );

  return {
    pilotFitScore,
    pilotRiskScore,
    pilotRevenueScore,
    pilotReadinessScore,
    pilotStrategicValueScore,
    overallOpportunityScore,
    opportunityTier: getOpportunityTier(overallOpportunityScore),
  };
}

function toArtifactMarkdown(title: string, sections: Array<{ heading: string; items: string[] }>): string {
  const lines: string[] = [`# ${title}`, ''];
  for (const section of sections) {
    lines.push(`## ${section.heading}`);
    for (const item of section.items) {
      lines.push(`- ${item}`);
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}

function stableStringify(value: any): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const objectValue = value as Record<string, unknown>;
  const keys = Object.keys(objectValue).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`)
    .join(',')}}`;
}

function deterministicChecksum(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function buildPilotArtifactVersionRecord(input: {
  generatedAt: string;
  source: string;
  milestone?: string;
  notes?: string;
  commercialState: CommercialState;
  qualificationScores: PilotQualificationScores;
  artifacts: PilotArtifactBundle;
}): PilotArtifactVersionRecord {
  const canonical = stableStringify({
    commercialState: input.commercialState,
    qualificationScores: input.qualificationScores,
    artifacts: input.artifacts,
  });
  const checksum = deterministicChecksum(canonical);
  const versionStamp = input.generatedAt.replace(/[-:.TZ]/g, '').slice(0, 14);

  return {
    versionId: `art_${versionStamp}_${checksum}`,
    createdAt: input.generatedAt,
    source: input.source,
    milestone: input.milestone,
    notes: input.notes,
    commercialState: input.commercialState,
    qualificationScores: input.qualificationScores,
    artifacts: input.artifacts,
    checksum,
  };
}

export function buildPilotReferenceVersionRecord(input: {
  generatedAt: string;
  source: string;
  milestone?: string;
  notes?: string;
  referenceProfile: Record<string, unknown>;
  caseStudy: Record<string, unknown>;
  benchmarkDataset: Record<string, unknown>;
}): PilotReferenceVersionRecord {
  const canonical = stableStringify({
    referenceProfile: input.referenceProfile,
    caseStudy: input.caseStudy,
    benchmarkDataset: input.benchmarkDataset,
  });
  const checksum = deterministicChecksum(canonical);
  const versionStamp = input.generatedAt.replace(/[-:.TZ]/g, '').slice(0, 14);

  return {
    versionId: `ref_${versionStamp}_${checksum}`,
    createdAt: input.generatedAt,
    source: input.source,
    milestone: input.milestone,
    notes: input.notes,
    referenceProfile: input.referenceProfile,
    caseStudy: input.caseStudy,
    benchmarkDataset: input.benchmarkDataset,
    checksum,
  };
}

export function buildPilotArtifactDiffSummary(
  older: PilotArtifactVersionRecord,
  newer: PilotArtifactVersionRecord,
): PilotArtifactDiffSummary {
  const keys: Array<keyof PilotArtifactBundle> = [
    'proposal',
    'statementOfWork',
    'successMetrics',
    'pilotPlan',
  ];

  const changedArtifactKeys: Array<keyof PilotArtifactBundle> = [];
  let changedSectionCount = 0;
  let changedItemCount = 0;

  for (const key of keys) {
    const oldArtifact = older.artifacts[key];
    const newArtifact = newer.artifacts[key];

    if (oldArtifact.markdown !== newArtifact.markdown) {
      changedArtifactKeys.push(key);
    }

    const oldSections = oldArtifact.sections;
    const newSections = newArtifact.sections;
    const maxSections = Math.max(oldSections.length, newSections.length);

    for (let sectionIndex = 0; sectionIndex < maxSections; sectionIndex += 1) {
      const oldSection = oldSections[sectionIndex];
      const newSection = newSections[sectionIndex];

      if (!oldSection || !newSection) {
        changedSectionCount += 1;
        changedItemCount += Math.max(oldSection?.items.length ?? 0, newSection?.items.length ?? 0);
        continue;
      }

      if (oldSection.heading !== newSection.heading) {
        changedSectionCount += 1;
      }

      const maxItems = Math.max(oldSection.items.length, newSection.items.length);
      for (let itemIndex = 0; itemIndex < maxItems; itemIndex += 1) {
        if (oldSection.items[itemIndex] !== newSection.items[itemIndex]) {
          changedItemCount += 1;
        }
      }
    }
  }

  return {
    fromVersionId: older.versionId,
    toVersionId: newer.versionId,
    changedArtifactKeys,
    changedSectionCount,
    changedItemCount,
  };
}

function buildPilotArtifacts(input: {
  application: PilotApplicationCommercialInput;
  economicsTier: PilotEconomicsTier;
  qualification: 'qualified' | 'review-required' | 'defer';
  qualificationScores: PilotQualificationScores;
  signals: CommercialSignals;
}): PilotArtifactBundle {
  const pilotFee = input.economicsTier.targetPriceRange;
  const organizationName = input.application.organizationName;

  const proposalSections = [
    {
      heading: 'Executive Summary',
      items: [
        `${organizationName} qualifies as Tier ${input.qualificationScores.opportunityTier} with opportunity score ${input.qualificationScores.overallOpportunityScore}.`,
        `Recommended pilot economics: ${input.economicsTier.label} (${pilotFee}).`,
        `Qualification result: ${input.qualification}.`,
      ],
    },
    {
      heading: 'Commercial Terms',
      items: [
        'Pilot term: fixed 90-day pilot.',
        `Pilot fee band: ${pilotFee}.`,
        '100% pilot fee credit-forward on conversion to annual subscription.',
      ],
    },
    {
      heading: 'Expected Outcomes',
      items: [
        `Adoption trajectory score target: >= ${Math.max(70, input.signals.adoptionScore)}.`,
        `Renewal likelihood target: ${input.signals.renewalLikelihood}.`,
        `Expansion likelihood target: ${input.signals.expansionLikelihood}.`,
      ],
    },
  ];

  const statementOfWorkSections = [
    {
      heading: 'Scope of Work',
      items: [
        'Pilot kickoff and implementation workshop.',
        'Configuration, data onboarding, and operational enablement.',
        'Weekly pilot operating cadence with commercial checkpointing.',
      ],
    },
    {
      heading: 'Deliverables',
      items: [
        'Configured Union Eyes workspace with agreed workflow scope.',
        'Pilot success metrics dashboard and progress snapshots.',
        'End-of-pilot conversion recommendation package.',
      ],
    },
    {
      heading: 'Assumptions and Dependencies',
      items: [
        `${organizationName} provides stakeholder access and implementation owner.`,
        'Weekly business review attendance from sponsor and operations lead.',
        'Data and process access provided within first two weeks.',
      ],
    },
  ];

  const successMetricsSections = [
    {
      heading: 'Primary Success Metrics',
      items: [
        `Pilot Fit Score target: >= ${Math.max(75, input.qualificationScores.pilotFitScore)}.`,
        `Pilot Readiness Score target: >= ${Math.max(70, input.qualificationScores.pilotReadinessScore)}.`,
        `Pilot Revenue Score target: >= ${Math.max(65, input.qualificationScores.pilotRevenueScore)}.`,
        `Pilot Strategic Value Score target: >= ${Math.max(75, input.qualificationScores.pilotStrategicValueScore)}.`,
      ],
    },
    {
      heading: 'Risk and Retention Indicators',
      items: [
        `Pilot Risk Score target: <= ${Math.min(35, input.qualificationScores.pilotRiskScore)}.`,
        `Renewal likelihood target: ${input.signals.renewalLikelihood}.`,
        `Expansion likelihood target: ${input.signals.expansionLikelihood}.`,
      ],
    },
    {
      heading: 'Commercial Milestones',
      items: [
        'Contract signed by end of week 2.',
        'Invoice issued by end of week 3.',
        'Subscription decision by end of week 12.',
      ],
    },
  ];

  const pilotPlanSections = [
    {
      heading: 'Phase 1: Mobilize (Weeks 1-2)',
      items: [
        'Kickoff governance and stakeholder alignment.',
        'Confirm scope lock, milestones, and reporting cadence.',
        'Baseline qualification and success metrics.',
      ],
    },
    {
      heading: 'Phase 2: Operate (Weeks 3-8)',
      items: [
        'Execute operational workflows and adoption motions.',
        'Track friction, blockers, and stakeholder sentiment.',
        'Run midpoint commercial checkpoint and remediation plan.',
      ],
    },
    {
      heading: 'Phase 3: Convert (Weeks 9-12)',
      items: [
        'Assess pilot outcomes against success metrics.',
        'Finalize proposal for subscription conversion.',
        'Prepare reference narrative and deployment benchmark package.',
      ],
    },
  ];

  return {
    proposal: {
      title: 'Pilot Proposal',
      sections: proposalSections,
      markdown: toArtifactMarkdown('Pilot Proposal', proposalSections),
    },
    statementOfWork: {
      title: 'Statement of Work',
      sections: statementOfWorkSections,
      markdown: toArtifactMarkdown('Statement of Work', statementOfWorkSections),
    },
    successMetrics: {
      title: 'Pilot Success Metrics',
      sections: successMetricsSections,
      markdown: toArtifactMarkdown('Pilot Success Metrics', successMetricsSections),
    },
    pilotPlan: {
      title: 'Pilot Plan',
      sections: pilotPlanSections,
      markdown: toArtifactMarkdown('Pilot Plan', pilotPlanSections),
    },
  };
}

export function getRecommendedEconomicsTier(memberCount: number): PilotEconomicsTier {
  const count = Number.isFinite(memberCount) && memberCount > 0 ? memberCount : 1;

  for (const tier of PILOT_ECONOMICS_LADDER) {
    const inLowerBound = count >= tier.memberRange.min;
    const inUpperBound = tier.memberRange.max === null ? true : count <= tier.memberRange.max;
    if (inLowerBound && inUpperBound) return tier;
  }

  return PILOT_ECONOMICS_LADDER[PILOT_ECONOMICS_LADDER.length - 1];
}

export function normalizeCommercialState(value: any): CommercialState {
  if (typeof value === 'string' && COMMERCIAL_STATE_ORDER.includes(value as CommercialState)) {
    return value as CommercialState;
  }
  return 'lead';
}

export function nextCommercialState(state: CommercialState): CommercialState {
  const idx = COMMERCIAL_STATE_ORDER.indexOf(state);
  if (idx < 0 || idx === COMMERCIAL_STATE_ORDER.length - 1) return state;
  return COMMERCIAL_STATE_ORDER[idx + 1];
}

export function previousCommercialState(state: CommercialState): CommercialState {
  const idx = COMMERCIAL_STATE_ORDER.indexOf(state);
  if (idx <= 0) return state;
  return COMMERCIAL_STATE_ORDER[idx - 1];
}

export function isCommercialTransitionAllowed(from: CommercialState, to: CommercialState): boolean {
  const fromIdx = COMMERCIAL_STATE_ORDER.indexOf(from);
  const toIdx = COMMERCIAL_STATE_ORDER.indexOf(to);

  if (fromIdx < 0 || toIdx < 0) return false;
  if (fromIdx === toIdx) return true;

  return Math.abs(toIdx - fromIdx) === 1;
}

export function inferPilotStatusFromCommercialState(state: CommercialState): CommercialPilotStatus {
  if (state === 'lead') return 'submitted';
  if (state === 'qualified' || state === 'pilot' || state === 'proposal') return 'review';
  if (state === 'approved' || state === 'contract_sent' || state === 'contract_signed' || state === 'invoice_issued') {
    return 'approved';
  }
  if (state === 'pilot_active') return 'active';
  return 'completed';
}

/**
 * Deterministic contract-number key for a pilot application (PR #752 round
 * 21). Shared between commercial-transition (which creates the
 * `commercialContracts` row under this number) and pilot-ownership's
 * rebind-organization correction flow (which checks for this row's
 * existence to decide whether a rebind would misattribute real financial
 * artifacts). Keep these two call sites using the SAME function rather than
 * two independently-maintained string templates.
 */
export function buildPilotContractNumber(pilotApplicationId: string): string {
  return `PILOT-${pilotApplicationId.slice(0, 8).toUpperCase()}`;
}

export function getQualification(readinessScore: number | null, memberCount: number): 'qualified' | 'review-required' | 'defer' {
  if (readinessScore === null) return 'review-required';
  if (readinessScore >= 75 && memberCount <= 500) return 'qualified';
  if (readinessScore >= 55) return 'review-required';
  return 'defer';
}

export function calculateCommercialSignals(input: {
  readinessScore: number | null;
  championScore?: number;
  activityScore?: number;
  commercialState: CommercialState;
  memberCount: number;
}): CommercialSignals {
  const readiness = input.readinessScore ?? 55;
  const stateIndex = COMMERCIAL_STATE_ORDER.indexOf(input.commercialState);
  const processProgress = stateIndex >= 0 ? Math.round((stateIndex / (COMMERCIAL_STATE_ORDER.length - 1)) * 100) : 0;
  const adoptionScore = Math.max(0, Math.min(100, Math.round(readiness * 0.7 + processProgress * 0.3)));
  const activityScore = Math.max(0, Math.min(100, Math.round((input.activityScore ?? processProgress) * 0.8 + readiness * 0.2)));
  const championScore = Math.max(0, Math.min(100, Math.round(input.championScore ?? readiness * 0.75)));
  const riskScore = Math.max(0, Math.min(100, Math.round(100 - ((adoptionScore + activityScore + championScore) / 3))));

  const renewalLikelihood: 'low' | 'medium' | 'high' =
    adoptionScore >= 75 && riskScore <= 30 ? 'high' : adoptionScore >= 55 ? 'medium' : 'low';

  const expansionLikelihood: 'low' | 'medium' | 'high' =
    championScore >= 70 && activityScore >= 65 ? 'high' : championScore >= 50 ? 'medium' : 'low';

  const arrPotentialBand: 'small' | 'medium' | 'large' =
    input.memberCount >= 10000 ? 'large' : input.memberCount >= 2500 ? 'medium' : 'small';

  return {
    adoptionScore,
    activityScore,
    championScore,
    riskScore,
    renewalLikelihood,
    expansionLikelihood,
    arrPotentialBand,
  };
}

export function buildProposalPackage(
  application: PilotApplicationCommercialInput,
  options?: {
    commercialState?: CommercialState;
    championScore?: number;
    activityScore?: number;
  },
): ProposalPackage {
  const scoreNumber =
    application.readinessScore === null || application.readinessScore === undefined
      ? null
      : Number(application.readinessScore);
  const readinessScore = Number.isFinite(scoreNumber as number) ? (scoreNumber as number) : null;

  const commercialState = normalizeCommercialState(options?.commercialState);
  const economicsTier = getRecommendedEconomicsTier(application.memberCount);
  const qualification = getQualification(readinessScore, application.memberCount);
  const signals = calculateCommercialSignals({
    readinessScore,
    championScore: options?.championScore,
    activityScore: options?.activityScore,
    commercialState,
    memberCount: application.memberCount,
  });
  const qualificationScores = calculatePilotQualificationScores(application, {
    readinessScore,
    commercialState,
  });
  const artifacts = buildPilotArtifacts({
    application,
    economicsTier,
    qualification,
    qualificationScores,
    signals,
  });

  const generatedAt = new Date().toISOString();
  const date = generatedAt.slice(0, 10);

  const markdown = [
    '# Union Eyes Pilot Proposal Package',
    '',
    `Date: ${date}`,
    `Application ID: ${application.id}`,
    `Organization: ${application.organizationName}`,
    `Contact: ${application.contactName} <${application.contactEmail}>`,
    '',
    '## Qualification',
    `- Result: ${qualification}`,
    `- Readiness score: ${application.readinessScore ?? 'not provided'}`,
    `- Commercial state: ${commercialState}`,
    `- Opportunity score: ${qualificationScores.overallOpportunityScore} (${qualificationScores.opportunityTier})`,
    '',
    '## Pilot Economics',
    `- Recommended tier: ${economicsTier.label}`,
    `- Target price band: ${economicsTier.targetPriceRange}`,
    `- Tier rationale: ${economicsTier.summary}`,
    '',
    '## Scope',
    '- Fixed-price 90-day pilot',
    '- Kickoff workshop + deployment + onboarding + success review',
    '- Product-led adoption with bounded implementation support',
    '',
    '## Timeline',
    '- Month 0: kickoff and setup',
    '- Month 1: deployment and onboarding completion',
    '- Month 2: operational use and telemetry-driven adjustments',
    '- Month 3: success review and commercial decision',
    '',
    '## Customer Success Signals',
    `- Adoption score: ${signals.adoptionScore}`,
    `- Activity score: ${signals.activityScore}`,
    `- Champion score: ${signals.championScore}`,
    `- Risk score: ${signals.riskScore}`,
    `- Renewal likelihood: ${signals.renewalLikelihood}`,
    `- Expansion likelihood: ${signals.expansionLikelihood}`,
    `- ARR potential band: ${signals.arrPotentialBand}`,
    '',
    '## Qualification Engine Scores',
    `- Pilot fit score: ${qualificationScores.pilotFitScore}`,
    `- Pilot risk score: ${qualificationScores.pilotRiskScore}`,
    `- Pilot revenue score: ${qualificationScores.pilotRevenueScore}`,
    `- Pilot readiness score: ${qualificationScores.pilotReadinessScore}`,
    `- Pilot strategic value score: ${qualificationScores.pilotStrategicValueScore}`,
    `- Overall opportunity score: ${qualificationScores.overallOpportunityScore}`,
    `- Opportunity tier: ${qualificationScores.opportunityTier}`,
    '',
    '## Intake Highlights',
    `- Organization type: ${application.organizationType}`,
    `- Member count: ${application.memberCount}`,
    `- Jurisdictions: ${application.jurisdictions.join(', ') || 'n/a'}`,
    `- Sectors: ${application.sectors.join(', ') || 'n/a'}`,
    `- Current system: ${application.currentSystem ?? 'n/a'}`,
    `- Challenges: ${application.challenges.join('; ') || 'n/a'}`,
    `- Goals: ${application.goals.join('; ') || 'n/a'}`,
    '',
    '## Next Steps',
    '- Confirm pilot agreement and scope lock',
    '- Advance commercial state to contract and billing milestones',
    '- Activate pilot and capture week-2 success signals',
  ].join('\n');

  return {
    generatedAt,
    qualification,
    economicsTier,
    commercialState,
    commercialStateOrder: COMMERCIAL_STATE_ORDER,
    signals,
    qualificationScores,
    artifacts,
    markdown,
  };
}
