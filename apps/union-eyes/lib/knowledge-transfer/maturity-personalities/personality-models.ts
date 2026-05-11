/**
 * Governance Maturity Personality Models
 *
 * Data structures for characterizing organizational governance posture styles.
 *
 * SCOPE: Organizational governance identities — NOT people analytics.
 * Personalities model how an institution structurally approaches governance.
 */

/** The governance posture personality type. */
export type GovernancePersonalityType =
  | 'centralized_governance'     // Concentrated, formal, structured
  | 'distributed_resilience'     // Resilience distributed across functions
  | 'continuity_reactive'        // Responds to challenges, less proactive
  | 'governance_maturing'        // On a growth trajectory
  | 'resilience_fragile'         // Governance gaps risk institutional stability
  | 'continuity_progressive';    // Leading-edge, adaptive governance culture

/** Governance stability rating. */
export type GovernanceStabilityRating = 'highly_stable' | 'stable' | 'variable' | 'unstable' | 'insufficient_data';

/** A governance personality dimension assessment. */
export interface PersonalityDimension {
  dimension: string;
  /** 0–100 score on this dimension. */
  score: number;
  /** Brief observation. */
  observation: string;
}

/** Governance stability profile. */
export interface GovernanceStabilityProfile {
  /** Consistency score 0–100 — how consistent resilience scores are over time. */
  consistencyScore: number;
  /** Volatility score 0–100 — higher means more volatile. */
  volatilityScore: number;
  /** Overall stability rating. */
  stabilityRating: GovernanceStabilityRating;
  /** Trend direction narrative. */
  trendNarrative: string;
}

/** The full governance maturity personality profile. */
export interface GovernancePersonalityProfile {
  organizationId: string;
  profiledAt: string;
  /** Primary personality type. */
  personalityType: GovernancePersonalityType;
  /** Human-readable personality name. */
  personalityName: string;
  /** Detailed description. */
  personalityDescription: string;
  /** Key governance characteristics. */
  governanceCharacteristics: string[];
  /** Personality dimension scores. */
  dimensions: PersonalityDimension[];
  /** Governance stability profile. */
  stabilityProfile: GovernanceStabilityProfile;
  /** Maturity score 0–100. */
  maturityScore: number;
  /** Recommended strategic focus for this personality. */
  strategicFocus: string;
  /** Governance identity statement (human-readable). */
  identityStatement: string;
  /** Entries analyzed. */
  entriesAnalyzed: number;
  /** Governance-safe disclaimer. */
  interpretationGuidance: string;
}
