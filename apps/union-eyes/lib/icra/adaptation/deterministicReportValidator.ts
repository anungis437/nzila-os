import type {
  AdaptiveReportAISlot,
  DeterministicReportContext,
} from './deterministicReportContracts';

export function validateDeterministicReportContext(
  context: DeterministicReportContext,
): string[] {
  const issues: string[] = [];

  if (!context.generatedAt) {
    issues.push('generatedAt is required');
  }
  if (!context.contextualResult.rawProfile.assessmentId) {
    issues.push('raw profile assessmentId is required');
  }
  if (context.contextualResult.rawProfile.composite < 0 || context.contextualResult.rawProfile.composite > 100) {
    issues.push('raw profile composite must be in [0,100]');
  }
  if (!context.adaptiveNarrative.bundleFingerprint) {
    issues.push('adaptive narrative fingerprint is required');
  }

  return issues;
}

export function validateAdaptiveReportAISlot(slot: AdaptiveReportAISlot): string[] {
  const issues: string[] = [];
  if (!slot.enabled) {
    issues.push('slot must be enabled');
  }
  if (slot.integrationMode !== 'deterministic_non_generative') {
    issues.push('integration mode must be deterministic_non_generative');
  }
  if (slot.executive.paragraphs.length === 0) {
    issues.push('executive summary must include paragraphs');
  }
  if (!slot.reviewWorkflow.pendingChecklist.length) {
    issues.push('review workflow must include checklist entries');
  }
  if (!slot.reviewWorkflow.auditTrail.length) {
    issues.push('review workflow must include audit trail entries');
  }
  return issues;
}
