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

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  /** Linked explainability data for assistant messages */
  explainabilityRef?: string | null;
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
    confidence: string;
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
  overallConfidence: string;
  followUpSuggestions: string[];
  organizationalContext: string;
  generatedAt: string;
}
