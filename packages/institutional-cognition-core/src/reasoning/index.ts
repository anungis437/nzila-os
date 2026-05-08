/**
 * Cognition Reasoning Lifecycle
 *
 * Standard primitives for opening, advancing, and closing reasoning sessions.
 * Use these in place of ad-hoc reasoning state in domain engines.
 */

import type { CognitionDomain } from '../ontology/index.js';
import type { CognitionSession, ReasoningChain } from '../contracts/index.js';
import type { EvidenceItem } from '../explainability/index.js';

let monotonicCounter = 0;
function generateId(prefix: string): string {
  monotonicCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${monotonicCounter.toString(36)}`;
}

export function openReasoningSession(input: {
  organizationId: string;
  topic: string;
  domains: CognitionDomain[];
}): CognitionSession {
  return {
    id: generateId('session'),
    organizationId: input.organizationId,
    topic: input.topic,
    participatingDomains: input.domains,
    startedAt: new Date().toISOString(),
    status: 'open',
  };
}

export function closeReasoningSession(session: CognitionSession): CognitionSession {
  return {
    ...session,
    status: 'closed',
    closedAt: new Date().toISOString(),
  };
}

export function buildReasoningChain(input: {
  organizationId: string;
  sessionId?: string;
  insight: string;
  domains: CognitionDomain[];
  confidence: ReasoningChain['confidence'];
  evidence: EvidenceItem[];
  steps: Array<{ rationale: string; domain: CognitionDomain }>;
}): ReasoningChain {
  return {
    id: generateId('chain'),
    sessionId: input.sessionId,
    organizationId: input.organizationId,
    insight: input.insight,
    domains: input.domains,
    confidence: input.confidence,
    evidence: input.evidence,
    steps: input.steps.map((step, idx) => ({
      stepNumber: idx + 1,
      rationale: step.rationale,
      domain: step.domain,
    })),
  };
}
