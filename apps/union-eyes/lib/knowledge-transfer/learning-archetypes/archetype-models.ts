/**
 * Organizational Learning Archetype Models
 *
 * Data structures for clustering organizational continuity evolution styles.
 *
 * SCOPE: Organizational archetypes — NOT employee classifications.
 * These characterize how an institution as a whole approaches continuity learning.
 */

/** An organizational learning archetype. */
export type LearningArchetypeId =
  | 'proactive_stabilizer'      // Plans ahead, prevents crises
  | 'reactive_mitigator'        // Responds well when challenged
  | 'governance_centralized'    // Concentrated, structured governance
  | 'resilience_fragmented'     // Inconsistent, siloed resilience
  | 'continuity_maturing'       // On a clear maturity trajectory
  | 'operationally_adaptive'    // Flexibly evolves governance practices
  | 'documentation_builder'     // Focused on building organizational memory
  | 'governance_stagnant';      // Limited governance momentum

export interface LearningArchetype {
  id: LearningArchetypeId;
  /** Display name. */
  name: string;
  /** Concise description of this archetype's governance style. */
  description: string;
  /** Key characteristics. */
  characteristics: string[];
  /** Development focus for this archetype. */
  developmentFocus: string;
  /** Typical resilience trajectory for this archetype. */
  resilienceTrajectory: 'ascending' | 'descending' | 'fluctuating' | 'flat' | 'building';
}

/** Archetype fit scoring — how strongly this org matches each archetype. */
export interface Archetypefit {
  archetypeId: LearningArchetypeId;
  score: number;       // 0–100 match strength
  confidence: number;  // 0–100 confidence
}

/** The result of organizational archetype classification. */
export interface ArchetypeClassificationResult {
  organizationId: string;
  classifiedAt: string;
  /** Best-fitting archetype for this organization. */
  primaryArchetype: LearningArchetype;
  /** Secondary archetype (if close match). */
  secondaryArchetype: LearningArchetype | null;
  /** Archetype fit scores. */
  archetypeFits: Archetypefit[];
  /** Evidence backing the primary classification. */
  classificationEvidence: string[];
  /** Archetype evolution context — how this org has moved archetypically. */
  evolutionContext: string;
  /** Classification confidence 0–100. */
  classificationConfidence: number;
  /** Number of entries analyzed. */
  entriesAnalyzed: number;
  /** Governance-safe disclaimer. */
  interpretationGuidance: string;
}
