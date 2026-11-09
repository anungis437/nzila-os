/**
 * Governance Copilot Models
 *
 * Data structures for the conversational continuity reasoning assistant.
 *
 * The copilot is a governance-aware continuity advisor — not an autonomous
 * decision-maker. All responses are explainable and organizationally framed.
 *
 * The copilot NEVER:
 * - Evaluates individual employees
 * - Recommends workforce reductions
 * - Generates labor-risk intelligence
 * - Produces disciplinary recommendations
 */

import type { CopilotExplainabilityEnvelope } from '../copilot-explainability/explainability-models';

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  /** The explainability envelope for this assistant message, persisted inline (JSONB) with the conversation. */
  explainability?: CopilotExplainabilityEnvelope | null;
}

export interface CopilotConversation {
  id: string;
  organizationId: string;
  sessionId: string | null;
  title: string;
  messages: CopilotMessage[];
  createdAt: string;
  updatedAt: string;
  /** Snapshot of continuity context at conversation start */
  contextSnapshot: Record<string, unknown> | null;
}

export interface CopilotQueryInput {
  /** The user's natural language query */
  query: string;
  /** Optional session ID to load context from */
  sessionId?: string | null;
  /** Optional conversation ID for multi-turn context */
  conversationId?: string | null;
  /** Prior messages for multi-turn context */
  /** Accepted for compatibility and ignored: the history is the caller's stored conversation. */
  priorMessages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** Current graph context (node IDs, filters) */
  graphContext?: {
    focusedNodeId?: string | null;
    overlay?: string | null;
  } | null;
}

export interface CopilotQueryResult {
  conversationId: string;
  messageId: string;
  /** The raw AI-generated answer */
  answer: string;
  /** Concise summary */
  summary: string;
  /** Evidence references */
  evidenceReferences: Array<{
    observation: string;
    dataPoint: string;
    sourceType: string;
    /** Evidence volume behind this reference, not a claim it is correct or verified. */
    evidenceCoverage: string;
  }>;
  /** Reasoning steps */
  reasoningChain: Array<{
    stepNumber: number;
    reasoning: string;
    conclusion: string;
    assumption: string | null;
  }>;
  /** Governance flags */
  governanceFlags: Array<{
    concern: string;
    implication: string;
    severity: string;
  }>;
  assumptions: string[];
  limitations: string[];
  /** Overall evidence volume behind the response, not a claim that its content is verified or correct. */
  overallEvidenceCoverage: string;
  followUpSuggestions: string[];
  organizationalContext: string;
  generatedAt: string;
  /** How many of the dependency nodes behind this response have at least one currently-verified relationship on
   *  file, out of how many nodes exist in total. The AI context and counts above are exploratory (label co-occurrence
   *  inference) unless covered here. */
  verifiedEvidenceCoverage: { nodesWithVerifiedEvidence: number; totalNodes: number };
}
