/**
 * AI Transparency & Governance Module
 * 
 * Provides comprehensive AI transparency features:
 * - AI disclosure badges and labels
 * - Confidence scoring
 * - Explanation generation (why AI said what it said)
 * - Model documentation (model cards)
 * - Human override controls
 * - Appeal mechanisms for AI decisions
 * 
 * @module lib/ai/transparency
 */

import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

/** Confidence level for AI responses */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/** AI disclosure metadata attached to responses */
export interface AIDisclosure {
  /** Always true - confirms AI-generated */
  isAIGenerated: boolean;
  /** Model used to generate response */
  model: string;
  /** Model version */
  modelVersion: string;
  /** Timestamp of generation */
  generatedAt: string;
  /** Confidence level */
  confidence: ConfidenceLevel;
  /** Confidence score 0-1 */
  confidenceScore: number;
  /** Whether human reviewed this response */
  humanReviewed: boolean;
  /** Disclosure version */
  disclosureVersion: string;
}

/** Explanation for AI response */
export interface AIExplanation {
  /** Unique explanation ID */
  id: string;
  /** Request ID this explanation is for */
  requestId: string;
  /** Summary of what AI was asked */
  querySummary: string;
  /** Key factors considered */
  factorsConsidered: ExplanationFactor[];
  /** Sources used (RAG context) */
  sourcesUsed: SourceReference[];
  /** Reasoning chain */
  reasoningChain: string[];
  /** Any assumptions made */
  assumptions: string[];
  /** Limitations/uncertainties */
  limitations: string[];
  /** Generated timestamp */
  generatedAt: string;
}

/** Factor considered in AI decision */
export interface ExplanationFactor {
  /** Factor name */
  name: string;
  /** How much weight this had */
  weight: number;
  /** Description */
  description: string;
}

/** Source reference from RAG */
export interface SourceReference {
  /** Source title */
  title: string;
  /** Source type */
  type: 'cba' | 'policy' | 'law' | 'precedent' | 'manual' | 'kb';
  /** Relevance score 0-1 */
  relevance: number;
  /** Snippet used */
  snippet: string;
}

/** Appeal status */
export type AppealStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | 'resolved';

/** Appeal for AI decision */
export interface AIAppeal {
  /** Appeal ID */
  id: string;
  /** Original request ID */
  requestId: string;
  /** User who filed appeal */
  filedBy: string;
  /** Reason for appeal */
  reason: string;
  /** Additional context user provided */
  context: string;
  /** Current status */
  status: AppealStatus;
  /** Who is reviewing */
  reviewer?: string;
  /** Review notes */
  reviewNotes?: string;
  /** Resolution */
  resolution?: string;
  /** Created timestamp */
  createdAt: string;
  /** Updated timestamp */
  updatedAt: string;
}

/** Human override request */
export interface HumanOverrideRequest {
  /** Request ID */
  requestId: string;
  /** User requesting override */
  requestedBy: string;
  /** Reason for override request */
  reason: string;
  /** Priority level */
  priority: 'low' | 'medium' | 'high' | 'urgent';
  /** Category of concern */
  category: 'accuracy' | 'appropriateness' | 'safety' | 'bias' | 'other';
  /** Current status */
  status: 'pending' | 'in_progress' | 'completed' | 'denied';
  /** Assigned reviewer */
  assignedTo?: string;
  /** Resolution notes */
  resolution?: string;
  /** Created timestamp */
  createdAt: string;
}

/** Model card - documentation about the AI model */
export interface ModelCard {
  /** Model name */
  modelName: string;
  /** Model version */
  modelVersion: string;
  /** Model type */
  modelType: 'chat' | 'embedding' | 'reranker';
  /** Provider */
  provider: string;
  /** Release date */
  releaseDate: string;
  /** Description */
  description: string;
  /** Intended use */
  intendedUse: string[];
  /** Limitations */
  limitations: string[];
  /** Known biases */
  knownBiases: string[];
  /** Training data cutoff */
  trainingDataCutoff: string;
  /** Performance metrics */
  performance: {
    accuracy?: number;
    latency?: string;
    contextLength?: number;
  };
  /** Safety measures */
  safetyMeasures: string[];
  /** Governance info */
  governance: {
    humanOversight: boolean;
    auditLogging: boolean;
    appealAvailable: boolean;
  };
}

// ============================================================================
// MODEL CARD
// ============================================================================

/** UnionEyes AI Model Card */
export const unionEyesModelCard: ModelCard = {
  modelName: 'UnionEyes-LLM',
  modelVersion: '1.0.0',
  modelType: 'chat',
  provider: 'Configurable (OpenAI/Anthropic/Google)',
  releaseDate: '2026-01-15',
  description: 'A domain-specialized LLM for union operations, grievance handling, and member services.',
  intendedUse: [
    'Answer member questions about union services',
    'Assist stewards with grievance handling',
    'Support collective bargaining research',
    'Provide governance and compliance guidance',
    'Help administrators with reporting'
  ],
  limitations: [
    'Does not provide legal advice - recommends consulting lawyers',
    'May not have latest CBA amendments - always verify with official documents',
    'Cannot access real-time data - use dashboards for current metrics',
    'May struggle with highly localized or niche workplace situations',
    'Translation quality varies for non-English queries'
  ],
  knownBiases: [
    'Pro-union perspective by design - represents union member interests',
    'May favor established grievance procedures over informal resolution',
    'Ontario/Canadian labor law emphasis (can specify jurisdiction)',
    'May recommend escalation for complex issues'
  ],
  trainingDataCutoff: '2025-12-31',
  performance: {
    accuracy: 0.87,
    latency: '<2s',
    contextLength: 128000,
  },
  safetyMeasures: [
    'Prompt injection detection',
    'PII filtering (input and output)',
    'Blocked topics list',
    'Sensitive keyword detection',
    'Content safety classification',
    'Human escalation triggers'
  ],
  governance: {
    humanOversight: true,
    auditLogging: true,
    appealAvailable: true
  }
};

// ============================================================================
// TRANSPARENCY ENGINE
// ============================================================================

/**
 * AI Transparency Engine
 * 
 * Handles all transparency features:
 * - Generating disclosures
 * - Creating explanations
 * - Managing appeals
 * - Human override requests
 */
export class AITransparencyEngine {
  /**
   * Generate AI disclosure for a response
   */
  generateDisclosure(params: {
    model: string;
    modelVersion: string;
    confidenceScore: number;
    humanReviewed: boolean;
  }): AIDisclosure {
    const confidence = this.scoreToLevel(params.confidenceScore);
    
    return {
      isAIGenerated: true,
      model: params.model,
      modelVersion: params.modelVersion,
      generatedAt: new Date().toISOString(),
      confidence,
      confidenceScore: params.confidenceScore,
      humanReviewed: params.humanReviewed,
      disclosureVersion: '1.0.0'
    };
  }

  /**
   * Convert numeric score to confidence level
   */
  private scoreToLevel(score: number): ConfidenceLevel {
    if (score >= 0.8) return 'high';
    if (score >= 0.5) return 'medium';
    return 'low';
  }

  /**
   * Generate explanation for AI response
   */
  async generateExplanation(params: {
    requestId: string;
    query: string;
    attentionBreakdown: Record<string, number>;
    sourcesUsed: Array<{ title: string; type: string; relevance: number; snippet: string }>;
    contextUsed: string[];
  }): Promise<AIExplanation> {
    const factors: ExplanationFactor[] = [];
    
    // Convert attention weights to factors
    for (const [key, value] of Object.entries(params.attentionBreakdown)) {
      if (value > 0.05) {
        factors.push({
          name: this.formatFactorName(key),
          weight: value,
          description: this.getFactorDescription(key, value)
        });
      }
    }

    // Generate reasoning chain
    const reasoningChain = this.generateReasoningChain(params.query, factors, params.sourcesUsed);

    // Identify limitations
    const limitations = this.identifyLimitations(params.query, factors);

    // Identify assumptions
    const assumptions = this.identifyAssumptions(params.query, factors);

    const explanation: AIExplanation = {
      id: `exp_${Date.now()}_${crypto.randomUUID().slice(0, 9)}`,
      requestId: params.requestId,
      querySummary: this.summarizeQuery(params.query),
      factorsConsidered: factors.sort((a, b) => b.weight - a.weight),
      sourcesUsed: params.sourcesUsed.map(s => ({
        title: s.title,
        type: s.type as SourceReference['type'],
        relevance: s.relevance,
        snippet: s.snippet.substring(0, 200) + (s.snippet.length > 200 ? '...' : '')
      })),
      reasoningChain,
      assumptions,
      limitations,
      generatedAt: new Date().toISOString()
    };

    logger.info('AI explanation generated', { requestId: params.requestId });
    return explanation;
  }

  /**
   * Format factor name for display
   */
  private formatFactorName(key: string): string {
    const names: Record<string, string> = {
      userQuery: 'Your Question',
      contextDocs: 'Reference Documents',
      sessionHistory: 'Conversation History',
      jurisdictionRules: 'Jurisdiction Rules',
      cbaClauses: 'CBA Provisions',
      timelineContext: 'Timeline/Deadlines'
    };
    return names[key] || key;
  }

  /**
   * Get factor description
   */
  private getFactorDescription(key: string, weight: number): string {
    const pct = Math.round(weight * 100);
    const descriptions: Record<string, string> = {
      userQuery: `Your specific question and intent was the primary focus (${pct}% weight)`,
      contextDocs: `Relevant documents from the knowledge base were referenced (${pct}% weight)`,
      sessionHistory: `Previous messages in this conversation informed the response (${pct}% weight)`,
      jurisdictionRules: `Canadian labor law and regulations for your province were considered (${pct}% weight)`,
      cbaClauses: `Specific collective agreement articles were consulted (${pct}% weight)`,
      timelineContext: `Important deadlines and time-sensitive factors were noted (${pct}% weight)`
    };
    return descriptions[key] || `This factor contributed ${pct}% to the response`;
  }

  /**
   * Generate reasoning chain
   */
  private generateReasoningChain(
    query: string,
    factors: ExplanationFactor[],
    sources: Array<{ title: string; type: string; relevance: number }>
  ): string[] {
    const chain: string[] = [];
    
    // Step 1: Understanding
    chain.push(`1. Analyzed your question: "${this.summarizeQuery(query)}"`);
    
    // Step 2: Key factors
    const topFactors = factors.slice(0, 3);
    if (topFactors.length > 0) {
      const factorNames = topFactors.map(f => f.name).join(', ');
      chain.push(`2. Key information sources: ${factorNames}`);
    }
    
    // Step 3: Sources
    if (sources.length > 0) {
      const sourceNames = sources.slice(0, 2).map(s => s.title).join(', ');
      chain.push(`3. Referenced documents: ${sourceNames}`);
    }
    
    // Step 4: Conclusion
    chain.push('4. Generated response based on above analysis');
    
    return chain;
  }

  /**
   * Identify limitations
   */
  private identifyLimitations(query: string, factors: ExplanationFactor[]): string[] {
    const limitations: string[] = [];
    
    // Check for low confidence factors
    const lowWeightFactors = factors.filter(f => f.weight < 0.1);
    if (lowWeightFactors.length > 2) {
      limitations.push('Some relevant factors had limited weight in the analysis');
    }
    
    // Check for query complexity
    if (query.length > 500) {
      limitations.push('Complex query may have reduced response precision');
    }
    
    // Always include standard limitations
    limitations.push('Always verify critical information with official documents');
    limitations.push('This is not legal advice - consult a lawyer for legal matters');
    
    return limitations;
  }

  /**
   * Identify assumptions
   */
  private identifyAssumptions(query: string, factors: ExplanationFactor[]): string[] {
    const assumptions: string[] = [];
    
    // Jurisdiction assumption
    if (factors.some(f => f.name === 'Jurisdiction Rules')) {
      assumptions.push('Assumed Canadian jurisdiction based on context');
    }
    
    // CBA assumption
    if (factors.some(f => f.name === 'CBA Provisions')) {
      assumptions.push('Assumed standard CBA structure and provisions');
    }
    
    // Member context assumption
    if (!query.toLowerCase().includes('employer') && !query.toLowerCase().includes('management')) {
      assumptions.push('Assumed question is from union member perspective');
    }
    
    return assumptions;
  }

  /**
   * Summarize query for display
   */
  private summarizeQuery(query: string): string {
    if (query.length <= 100) return query;
    return query.substring(0, 100) + '...';
  }

  /**
   * Calculate confidence score based on context
   */
  calculateConfidence(params: {
    hasSources: boolean;
    sourceRelevance: number;
    hasJurisdiction: boolean;
    queryClarity: number;
    contextQuality: number;
  }): number {
    let score = 0;
    
    // Sources (30%)
    if (params.hasSources) {
      score += 0.3 * params.sourceRelevance;
    }
    
    // Jurisdiction (20%)
    if (params.hasJurisdiction) {
      score += 0.2;
    }
    
    // Query clarity (25%)
    score += 0.25 * params.queryClarity;
    
    // Context quality (25%)
    score += 0.25 * params.contextQuality;
    
    return Math.min(1, Math.max(0, score));
  }
}

// ============================================================================
// APPEAL & OVERRIDE MANAGEMENT
// ============================================================================

/** In-memory storage for demo (use database in production) */
function createTransparencyStores() {
  return {
    appeals: new Map<string, AIAppeal>(),
    overrides: new Map<string, HumanOverrideRequest>(),
  }
}
const { appeals: appealsStore, overrides: overrideStore } = createTransparencyStores();

/**
 * AI Appeal Manager
 * Handles user appeals of AI decisions
 */
export class AIAppealManager {
  /**
   * File an appeal for AI response
   */
  async fileAppeal(params: {
    requestId: string;
    filedBy: string;
    reason: string;
    context: string;
  }): Promise<AIAppeal> {
    const appeal: AIAppeal = {
      id: `appeal_${Date.now()}_${crypto.randomUUID().slice(0, 9)}`,
      requestId: params.requestId,
      filedBy: params.filedBy,
      reason: params.reason,
      context: params.context,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    appealsStore.set(appeal.id, appeal);

    // Appeals are kept in a process-local Map. In a multi-replica ACA
    // deployment another instance will not see this appeal, and any restart
    // erases all filed appeals. Users see a successful filing but have no
    // durable recourse. Surface every filing loudly until a DB table exists.
    logger.error('AIAppealManager.fileAppeal: appeal stored in process-local Map only — NOT persisted, NOT visible across replicas, lost on restart', undefined, {
      appealId: appeal.id,
      requestId: params.requestId,
      filedBy: params.filedBy,
    });

    return appeal;
  }

  /**
   * Get appeal by ID
   */
  async getAppeal(appealId: string): Promise<AIAppeal | null> {
    return appealsStore.get(appealId) || null;
  }

  /**
   * Get appeals for a user
   */
  async getUserAppeals(userId: string): Promise<AIAppeal[]> {
    return Array.from(appealsStore.values())
      .filter(a => a.filedBy === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Update appeal status (for admin review)
   */
  async updateAppeal(params: {
    appealId: string;
    status: AppealStatus;
    reviewer: string;
    reviewNotes?: string;
    resolution?: string;
  }): Promise<AIAppeal | null> {
    const appeal = appealsStore.get(params.appealId);
    if (!appeal) return null;
    
    appeal.status = params.status;
    appeal.reviewer = params.reviewer;
    appeal.reviewNotes = params.reviewNotes;
    appeal.resolution = params.resolution;
    appeal.updatedAt = new Date().toISOString();
    
    appealsStore.set(params.appealId, appeal);
    
    logger.info('AI appeal updated', { 
      appealId: params.appealId, 
      status: params.status 
    });
    
    return appeal;
  }
}

/**
 * Human Override Manager
 * Handles requests for human review
 */
export class HumanOverrideManager {
  /**
   * Request human override/review
   */
  async requestOverride(params: {
    requestId: string;
    requestedBy: string;
    reason: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    category: 'accuracy' | 'appropriateness' | 'safety' | 'bias' | 'other';
  }): Promise<HumanOverrideRequest> {
    const override: HumanOverrideRequest = {
      requestId: params.requestId,
      requestedBy: params.requestedBy,
      reason: params.reason,
      priority: params.priority,
      category: params.category,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    
    overrideStore.set(override.requestId, override);
    
    logger.info('Human override requested', { 
      requestId: params.requestId,
      priority: params.priority,
      category: params.category
    });
    
    return override;
  }

  /**
   * Get override request
   */
  async getOverride(requestId: string): Promise<HumanOverrideRequest | null> {
    return overrideStore.get(requestId) || null;
  }

  /**
   * Get pending overrides (for human reviewers)
   */
  async getPendingOverrides(): Promise<HumanOverrideRequest[]> {
    return Array.from(overrideStore.values())
      .filter(o => o.status === 'pending')
      .sort((a, b) => {
        const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
  }

  /**
   * Resolve override
   */
  async resolveOverride(params: {
    requestId: string;
    assignedTo: string;
    status: 'completed' | 'denied';
    resolution: string;
  }): Promise<HumanOverrideRequest | null> {
    const override = overrideStore.get(params.requestId);
    if (!override) return null;
    
    override.status = params.status;
    override.assignedTo = params.assignedTo;
    override.resolution = params.resolution;
    
    overrideStore.set(params.requestId, override);
    
    logger.info('Human override resolved', { 
      requestId: params.requestId,
      status: params.status
    });
    
    return override;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const transparencyEngine = new AITransparencyEngine();
export const appealManager = new AIAppealManager();
export const overrideManager = new HumanOverrideManager();

/**
 * Add AI disclosure to any response
 */
export function addAIDisclosure(response: string, disclosure: AIDisclosure): string {
  const confidencePercent = Math.round(disclosure.confidenceScore * 100);
  const badge = `

---
🤖 **AI Assistant** • Generated: ${new Date(disclosure.generatedAt).toLocaleString()}

This response was generated by AI. Always verify important information with official sources.
Confidence: ${confidencePercent}% (${disclosure.confidence}) • [Explain this response](#) • [Request human review](#) • [Appeal](#)`;
  
  return response + badge;
}
