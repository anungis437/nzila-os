import type { ContextualAssessmentResult } from './adaptiveScoringModel';
import type { SupportedLocale } from './adaptivePassageLibrary';
import type { AdaptiveNarrativeBundle } from './adaptiveNarrativeEngine';
import type { FacilitatorGuide } from './facilitatorAdaptationGuide';

export const DETERMINISTIC_REPORT_AI_VERSION = '1.0.0' as const;

export type ReviewStatus = 'pending_review' | 'approved' | 'rejected';
export type ReviewerRole = 'facilitator' | 'governance_reviewer' | 'exec_sponsor';

export interface DeterministicReportContext {
  readonly doctrineVersion: typeof DETERMINISTIC_REPORT_AI_VERSION;
  readonly generatedAt: string;
  readonly locale: SupportedLocale;
  readonly contextualResult: ContextualAssessmentResult;
  readonly adaptiveNarrative: AdaptiveNarrativeBundle;
  readonly facilitatorGuide: FacilitatorGuide;
}

export interface NarrativeSynthesisPacket {
  readonly packetId: string;
  readonly locale: SupportedLocale;
  readonly headerStatement: string;
  readonly continuityContext: readonly string[];
  readonly emphasisOrder: readonly { dimension: string; weight: number }[];
}

export interface ExecutiveSummaryPacket {
  readonly packetId: string;
  readonly title: string;
  readonly maturityBand: string;
  readonly compositeScore: number;
  readonly paragraphs: readonly string[];
}

export interface FacilitatorPacket {
  readonly packetId: string;
  readonly profileBand: string;
  readonly interpretationCautions: readonly string[];
  readonly adaptationDecisions: readonly {
    area: 'routing' | 'emphasis' | 'interpretation' | 'warning_filter';
    ruleId: string;
    statement: string;
  }[];
}

export interface TranslationPacket {
  readonly packetId: string;
  readonly locale: SupportedLocale;
  readonly labels: {
    executiveSummary: string;
    facilitatorGuide: string;
    disclosure: string;
    reviewRequired: string;
  };
}

export interface DisclosurePacket {
  readonly packetId: string;
  readonly isAIGenerated: true;
  readonly generationMode: 'deterministic_template';
  readonly doctrineVersion: string;
  readonly confidenceClass: 'traceable';
  readonly requiresHumanReview: true;
  readonly disclosureCopy: string;
}

export interface ReviewRecord {
  readonly reviewId: string;
  readonly status: ReviewStatus;
  readonly reviewerRole: ReviewerRole;
  readonly reviewedAt: string;
  readonly summary: string;
}

export interface ReviewAuditEntry {
  readonly auditId: string;
  readonly action:
    | 'workflow_initialized'
    | 'review_recorded'
    | 'report_approved'
    | 'report_rejected';
  readonly at: string;
  readonly actorRole: ReviewerRole | 'system';
  readonly details: Record<string, string>;
}

export interface ReviewWorkflowState {
  readonly workflowId: string;
  readonly status: ReviewStatus;
  readonly disclosure: DisclosurePacket;
  readonly pendingChecklist: readonly string[];
  readonly reviews: readonly ReviewRecord[];
  readonly auditTrail: readonly ReviewAuditEntry[];
}

export interface AdaptiveReportAISlot {
  readonly slotId: string;
  readonly enabled: true;
  readonly doctrineVersion: string;
  readonly integrationMode: 'deterministic_non_generative';
  readonly locale: SupportedLocale;
  readonly narrative: NarrativeSynthesisPacket;
  readonly executive: ExecutiveSummaryPacket;
  readonly facilitator: FacilitatorPacket;
  readonly translation: TranslationPacket;
  readonly reviewWorkflow: ReviewWorkflowState;
}
