/**
 * Governance Culture Models
 *
 * Data structures for longitudinal organizational governance culture analysis.
 *
 * SCOPE: Organizational governance culture — NOT individual employee behavior.
 * All outputs characterize how an institution collectively governs continuity.
 */

/** The dominant continuity culture posture observed. */
export type ContinuityCulturePosture =
  | 'proactive_governance'       // Regular planning, early intervention
  | 'responsive_governance'      // Reacts to incidents but adapts
  | 'procedural_governance'      // Process-heavy, structured, consistent
  | 'adaptive_governance'        // Flexibly iterates governance practices
  | 'fragmented_governance'      // Inconsistent engagement, gaps visible
  | 'nascent_governance';        // Early-stage, limited history

/** Continuity culture health signal. */
export type CultureHealthSignal =
  | 'strengthening'
  | 'stable'
  | 'weakening'
  | 'recovering'
  | 'insufficient_history';

/** A single observed governance culture indicator. */
export interface CultureIndicator {
  dimension: string;
  /** Label describing what was observed. */
  observation: string;
  /** Evidence backing the observation. */
  evidence: string;
  /** Positive or negative contribution to culture health. */
  valence: 'positive' | 'negative' | 'neutral';
  /** 0–100 confidence in this indicator. */
  confidence: number;
}

/** Longitudinal governance discipline observation. */
export interface GovernanceDisciplineProfile {
  /** How consistently the org engages with continuity governance. */
  engagementConsistency: 'high' | 'moderate' | 'low' | 'irregular';
  /** Total governance interactions in the analysis window. */
  totalInteractions: number;
  /** Average days between governance activities. */
  averageDaysBetweenActivities: number | null;
  /** Whether the org shows a documentation pattern. */
  documentationDiscipline: 'consistent' | 'sporadic' | 'absent';
  /** Whether mitigations are consistently followed through. */
  mitigationFollowThrough: 'strong' | 'partial' | 'weak' | 'unverified';
}

/** A culture evolution phase representing a distinct period. */
export interface CultureEvolutionPhase {
  id: string;
  label: string;
  /** ISO timestamp range start */
  startedAt: string;
  /** ISO timestamp range end (null if current) */
  endedAt: string | null;
  dominantPosture: ContinuityCulturePosture;
  /** Resilience score range during this phase */
  resilienceRange: { min: number; max: number } | null;
  characterization: string;
}

/** Full organizational governance culture profile. */
export interface GovernanceCultureProfile {
  organizationId: string;
  analyzedAt: string;
  /** Primary posture characterizing the organization's governance culture. */
  dominantPosture: ContinuityCulturePosture;
  /** Overall culture health trend. */
  cultureHealth: CultureHealthSignal;
  /** Narrative summary of the governance culture. */
  cultureSummary: string;
  /** Observed culture indicators (evidence-backed). */
  indicators: CultureIndicator[];
  /** Governance discipline metrics. */
  disciplineProfile: GovernanceDisciplineProfile;
  /** Observed culture evolution phases over time. */
  evolutionPhases: CultureEvolutionPhase[];
  /** Continuity culture score 0–100 (institutional discipline composite). */
  cultureScore: number;
  /** Entries analyzed. */
  entriesAnalyzed: number;
  /** Disclaimer for governance-safe interpretation. */
  interpretationGuidance: string;
}
