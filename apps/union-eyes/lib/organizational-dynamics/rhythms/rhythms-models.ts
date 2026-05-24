/**
 * Organizational Operating Rhythm Analysis
 * 
 * Understands organizational operating cadence and temporal patterns.
 */

export interface GovernanceReviewRhythm {
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'ad_hoc' | 'irregular';
  consistency: number; // 0-100
  adherence: number; // 0-100, % of scheduled reviews completed
  evidence: string[];
}

export interface OperatingRhythmProfile {
  organizationId: string;
  governanceReviewRhythm: GovernanceReviewRhythm;
  continuityPlanningCadence: { frequency: string; consistency: number };
  mitigationImplementationCycles: { averageCycleDays: number; variance: number };
  operationalStabilizationTiming: { averageDays: number; predictability: number };
  resilienceAdaptationFrequency: { adaptationsPerYear: number; trend: string };
  rhythmProfile: string; // description of overall rhythm
  rhythmStability: number; // 0-100
  interpretationGuidance: string;
  entriesAnalyzed: number;
}
