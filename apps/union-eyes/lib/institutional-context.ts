export const institutionalModes = [
  'executive',
  'governance',
  'operations',
  'procurement',
  'conference',
] as const;

export type InstitutionalMode = (typeof institutionalModes)[number];

export const defaultInstitutionalMode: InstitutionalMode = 'executive';

const institutionalModeSet = new Set<string>(institutionalModes);

export type InstitutionalModeProfile = {
  label: string;
  concern: string;
  continuityCallout: string;
  heroFraming: string;
  methodologyFocus: string;
  rhythmEntryPoint:
    | 'Institutional Problem'
    | 'Governance Risk'
    | 'Continuity Impact'
    | 'Operational Visibility'
    | 'Trust Reinforcement'
    | 'Explainable Intelligence';
};

export const institutionalModeProfiles: Record<InstitutionalMode, InstitutionalModeProfile> = {
  executive: {
    label: 'Executive',
    concern: 'Continuity and resilience',
    continuityCallout: 'Leadership transitions should not destabilize continuity.',
    heroFraming: 'Resilience-first continuity framing for strategic leadership confidence.',
    methodologyFocus: 'Institutional Continuity Intelligence Framework',
    rhythmEntryPoint: 'Continuity Impact',
  },
  governance: {
    label: 'Governance',
    concern: 'Explainability and accountability',
    continuityCallout: 'Modernization must remain explainable and reviewable.',
    heroFraming: 'Oversight-first framing to preserve governance legitimacy through change.',
    methodologyFocus: 'Governance Explainability Standard',
    rhythmEntryPoint: 'Governance Risk',
  },
  operations: {
    label: 'Operations',
    concern: 'Coordination and organizational coherence',
    continuityCallout: 'Fragmentation compounds operational fragility over time.',
    heroFraming: 'Coordination-first framing for workflow stabilization and coherence.',
    methodologyFocus: 'Anti-Fragmentation Governance Model',
    rhythmEntryPoint: 'Institutional Problem',
  },
  procurement: {
    label: 'Procurement',
    concern: 'Trust and reviewability',
    continuityCallout: 'Governance-safe modernization reduces deployment risk.',
    heroFraming: 'Trust-first framing focused on reviewability and deployment safety.',
    methodologyFocus: 'Operational Trust Framework',
    rhythmEntryPoint: 'Trust Reinforcement',
  },
  conference: {
    label: 'Conference',
    concern: 'Narrative simplicity and memorability',
    continuityCallout: 'Continuity is infrastructure, not operational overhead.',
    heroFraming: 'Memorability-first framing for live storytelling clarity.',
    methodologyFocus: 'Continuity Flow System',
    rhythmEntryPoint: 'Explainable Intelligence',
  },
};

export function parseInstitutionalMode(input?: string | null): InstitutionalMode {
  if (input && institutionalModeSet.has(input)) {
    return input as InstitutionalMode;
  }

  return defaultInstitutionalMode;
}

export function getInstitutionalModeProfile(mode: InstitutionalMode): InstitutionalModeProfile {
  return institutionalModeProfiles[mode];
}

export function withInstitutionalContext(href: string, mode: InstitutionalMode): string {
  const joiner = href.includes('?') ? '&' : '?';
  return `${href}${joiner}context=${mode}`;
}

export function rotateNarrativePathway<T extends { stage: string }>(
  pathway: T[],
  mode: InstitutionalMode,
): T[] {
  const entry = institutionalModeProfiles[mode].rhythmEntryPoint;
  const idx = pathway.findIndex((item) => item.stage === entry);

  if (idx <= 0) {
    return pathway;
  }

  return [...pathway.slice(idx), ...pathway.slice(0, idx)];
}
