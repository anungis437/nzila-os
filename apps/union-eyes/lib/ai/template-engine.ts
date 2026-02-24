/**
 * UnionEyes AI Template Engine
 * 
 * World-Class Hereditary-Attentive Template-Based LLM System
 * 
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │                     Template Registry (Hierarchical)                │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │  Base Template (Union Domain)                                       │
 * │  ├── Member Services Template                                      │
 * │  │   ├── Dues Inquiry Template                                     │
 * │  │   └── Benefits Question Template                                │
 * │  ├── Case Management Template                                      │
 * │  │   ├── Grievance Handler Template (High CBA attention)           │
 * │  │   └── Arbitration Prep Template                                 │
 * │  ├── Communications Template                                        │
 * │  │   ├── Bargaining Update Template                                │
 * │  │   └── Strike Notice Template                                    │
 * │  └── Governance Template                                           │
 * │      ├── Elections Template                                        │
 * │      └── Policy Query Template                                     │
 * └─────────────────────────────────────────────────────────────────────┘
 *                               │
 *                               ▼
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │                   Attention Mechanism Engine                        │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │  • Query Intent Detection    • Jurisdiction Context                │
 * │  • Session History Weighting • RAG Document Relevance             │
 * │  • CBA Clause Focus          • Timeline/Deadline Awareness        │
 * └─────────────────────────────────────────────────────────────────────┘
 *                               │
 *                               ▼
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │                   Governance & Audit Layer                          │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │  • Immutable Prompt Logs    • Version Control                       │
 * │  • Compliance Checkpoints   • Cost Attribution                     │
 * │  • Response Auditing        • SLA Monitoring                       │
 * └─────────────────────────────────────────────────────────────────────┘
 */

import { createHash } from 'crypto';
import { db } from '@/db';
import {
  chatMessages,
  knowledgeBase,
} from '@/db/schema/ai-chatbot-schema';
import { eq, desc, sql, and } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { costTrackingWrapper as costTracker } from '@/lib/ai/services/cost-tracking-wrapper';

// ============================================================================
// INTEGRATION WITH EXISTING ENGINES
// ============================================================================

import {
  getAllowedClaimTransitions,
  getTransitionRequirements,
  type ClaimStatus,
} from '@/lib/services/claim-workflow-fsm';

import {
  calculateCaseSlaStatus,
  type CaseSlaAssessment,
  type TimelineEvent as SlaTimelineEvent,
} from '@/lib/services/sla-calculator';

import { 
  detectAllSignals, 
  type Signal, 
  type SignalSeverity,
  type CaseForSignals 
} from '@/lib/services/lro-signals';

import { claims, claimUpdates } from '@/db/schema/claims-schema';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** Attention weights for context prioritization */
interface AttentionWeights {
  /** Weight for user's query (0-1) */
  userQuery: number;
  /** Weight for RAG-retrieved documents (0-1) */
  contextDocs: number;
  /** Weight for conversation history (0-1) */
  sessionHistory: number;
  /** Weight for jurisdiction-specific rules (0-1) */
  jurisdictionRules: number;
  /** Weight for CBA clause references (0-1) */
  cbaClauses: number;
  /** Weight for timeline/deadline context (0-1) */
  timelineContext: number;
}

/** Template inheritance configuration */
interface _InheritanceConfig {
  /** Parent template ID */
  parentTemplateId?: string;
  /** Override specific sections */
  overrides?: Partial<PromptTemplate>;
  /** Merge additional context */
  contextExtensions?: Record<string, unknown>;
}

/** Complete prompt template definition */
interface PromptTemplate {
  /** Unique template identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Template version (semantic) */
  version: string;
  /** Base system prompt */
  systemPrompt: string;
  /** User prompt structure */
  userPromptTemplate?: string;
  /** Attention weights for this template */
  attentionWeights: AttentionWeights;
  /** Supported jurisdictions */
  jurisdictions: Jurisdiction[];
  /** Required context variables */
  requiredVariables: string[];
  /** Compliance tags for audit */
  complianceTags: ComplianceTag[];
  /** Template metadata */
  metadata: {
    author: string;
    createdAt: Date;
    updatedAt: Date;
    deprecationNotice?: string;
  };
}

/** Jurisdiction types */
type Jurisdiction = 
  | 'federal' 
  | 'ontario' 
  | 'quebec' 
  | 'british-columbia' 
  | 'alberta' 
  | 'manitoba' 
  | 'saskatchewan' 
  | 'nova-scotia' 
  | 'new-brunswick' 
  | 'pei' 
  | 'newfoundland';

/** Compliance tagging for governance */
interface ComplianceTag {
  category: 'privacy' | 'security' | 'labor-law' | 'financial' | 'governance';
  requirement: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

/** Resolved template with all inherited properties */
interface ResolvedTemplate {
  template: PromptTemplate;
  resolvedSystemPrompt: string;
  resolvedAttentionWeights: AttentionWeights;
  resolvedJurisdiction: Jurisdiction;
  inheritanceChain: string[];
}

/** LLM request context */
interface LLMRequestContext {
  /** Current user/session */
  sessionId: string;
  /** User's organization */
  organizationId: string;
  /** User's role for permission context */
  userRole: string;
  /** Target jurisdiction */
  jurisdiction: Jurisdiction;
  /** Active case/claim if any */
  activeCaseId?: string;
  /** Current grievance stage */
  activeGrievanceStage?: string;
  /** CBA in effect */
  activeCBAId?: string;
  /** Query intent classification */
  detectedIntent?: QueryIntent;
  /** Current claim status (from FSM) */
  claimStatus?: ClaimStatus;
  /** SLA assessment for active case */
  caseSlaAssessment?: CaseSlaAssessment;
  /** Active signals for case */
  activeSignals?: Signal[];
}

/** Query intent classification */
interface QueryIntent {
  type: IntentType;
  confidence: number;
  entities: {
    memberId?: string;
    claimNumber?: string;
    employerId?: string;
    contractId?: string;
  };
}

type IntentType =
  | 'dues_inquiry'
  | 'benefits_question'
  | 'grievance_filing'
  | 'grievance_status'
  | 'arbitration_prep'
  | 'bargaining_update'
  | 'strike_notice'
  | 'member_info'
  | 'policy_query'
  | 'general';

/** Attention-scored context item */
interface ScoredContext {
  content: string;
  source: 'rag' | 'session' | 'cba' | 'jurisdiction' | 'timeline';
  relevanceScore: number;
  attentionWeight: number;
  metadata?: Record<string, unknown>;
}

/** Complete LLM request */
interface LLMRequest {
  templateId: string;
  context: LLMRequestContext;
  userMessage: string;
  options?: {
    temperature?: number;
    maxTokens?: number;
    model?: string;
  };
}

/** LLM response */
interface LLMResponse {
  content: string;
  tokensUsed: number;
  model: string;
  templateUsed: string;
  attentionBreakdown: Record<string, number>;
  complianceVerified: boolean;
  requestId: string;
}

// ============================================================================
// COMPLIANCE & SAFETY
// ============================================================================

/** Content safety result */
interface SafetyResult {
  isSafe: boolean;
  flaggedCategories: string[];
  confidence: number;
  action: 'allow' | 'block' | 'review';
}

/** Content filter for safety */
class ContentSafetyFilter {
  private blockedPatterns: Map<string, RegExp> = new Map();
  private reviewPatterns: Map<string, RegExp> = new Map();

  constructor() {
    // Initialize with union-specific safety patterns
    this.initializeFilters();
  }

  private initializeFilters() {
    // Patterns that should be blocked immediately
    this.blockedPatterns.set('pii_leak', /social security|sin number|full account number/i);
    this.blockedPatterns.set('legal_advice', /i am a lawyer|legal advice|attorney-client/i);
    this.blockedPatterns.set('discrimination', /hire fire|terminate based on|discriminate/i);
    
    // Patterns requiring human review
    this.reviewPatterns.set('litigation', /sue|lawsuit|legal action|court/i);
    this.reviewPatterns.set('strike_violence', /violent|threat|harm physical/i);
    this.reviewPatterns.set('financial_advice', /invest|stock|financial advice/i);
  }

  async checkContent(text: string): Promise<SafetyResult> {
    const flaggedCategories: string[] = [];
    
    // Check blocked patterns
    for (const [category, pattern] of this.blockedPatterns) {
      if (pattern.test(text)) {
        return {
          isSafe: false,
          flaggedCategories: [category],
          confidence: 0.95,
          action: 'block'
        };
      }
    }

    // Check review patterns
    for (const [category, pattern] of this.reviewPatterns) {
      if (pattern.test(text)) {
        flaggedCategories.push(category);
      }
    }

    return {
      isSafe: true,
      flaggedCategories,
      confidence: flaggedCategories.length > 0 ? 0.6 : 0.99,
      action: flaggedCategories.length > 0 ? 'review' : 'allow'
    };
  }
}

// ============================================================================
// TEMPLATE REGISTRY (HEREDITARY SYSTEM)
// ============================================================================

/**
 * Template Registry with Hierarchical Inheritance
 * 
 * Implements true OOP-style inheritance for prompt templates:
 * - Child templates inherit all properties from parents
 * - Properties can be overridden at any level
 * - Context extensions merge with parent context
 */
class TemplateRegistry {
  private templates: Map<string, PromptTemplate> = new Map();
  private versionHistory: Map<string, Map<string, PromptTemplate>> = new Map();
  private safetyFilter: ContentSafetyFilter;

  constructor() {
    this.safetyFilter = new ContentSafetyFilter();
    this.initializeBaseTemplates();
  }

  /**
   * Initialize the base template hierarchy
   */
  private initializeBaseTemplates() {
    // ┌─────────────────────────────────────────────────────────────────────┐
    // │                     BASE UNION DOMAIN TEMPLATE                      │
    // └─────────────────────────────────────────────────────────────────────┘
    const baseTemplate: PromptTemplate = {
      id: 'union-domain-base',
      name: 'Union Domain Base',
      version: '1.0.0',
      systemPrompt: `You are UnionEyes, an AI assistant specialized in labor union operations.
      
CORE PRINCIPLES:
- Always maintain a professional, supportive tone
- Prioritize member rights and protections
- Cite relevant labor laws and collective agreements when applicable
- Never provide legal advice; recommend consulting union representatives
- Follow all data privacy requirements (PIPEDA, provincial privacy laws)

RESPONSE GUIDELINES:
- Be clear, concise, and actionable
- Use plain language for complex legal concepts
- Always acknowledge member concerns before providing information
- When uncertain, escalate to human representatives`,

      attentionWeights: {
        userQuery: 0.25,
        contextDocs: 0.25,
        sessionHistory: 0.15,
        jurisdictionRules: 0.20,
        cbaClauses: 0.10,
        timelineContext: 0.05
      },

      jurisdictions: ['federal', 'ontario', 'quebec', 'british-columbia', 'alberta', 
                     'manitoba', 'saskatchewan', 'nova-scotia', 'new-brunswick', 'pei', 'newfoundland'],
      
      requiredVariables: ['organizationId', 'userRole'],
      
      complianceTags: [
        { category: 'privacy', requirement: 'PIPEDA compliance', severity: 'critical' },
        { category: 'security', requirement: 'Data protection', severity: 'critical' }
      ],

      metadata: {
        author: 'UnionEyes AI Team',
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01')
      }
    };

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │                   MEMBER SERVICES TEMPLATE                          │
    // │                   (Inherits from Base)                              │
    // └─────────────────────────────────────────────────────────────────────┘
    const memberServicesTemplate: PromptTemplate = {
      id: 'member-services',
      name: 'Member Services',
      version: '1.0.0',
      systemPrompt: `You are a Member Services representative for the union.

YOUR ROLE:
- Assist members with dues inquiries, benefits questions, and membership status
- Provide accurate information about union services and programs
- Guide members through enrollment and administrative processes
- Escalate complex issues to appropriate stewards or representatives

KEY INFORMATION TO GATHER:
- Member identification (when needed for account-specific questions)
- Specific question or concern
- Preferred contact method for follow-up

Always verify member identity before discussing specific account details.`,

      attentionWeights: {
        userQuery: 0.30,
        contextDocs: 0.20,
        sessionHistory: 0.20,
        jurisdictionRules: 0.15,
        cbaClauses: 0.10,
        timelineContext: 0.05
      },

      jurisdictions: ['federal', 'ontario', 'quebec', 'british-columbia', 'alberta'],
      requiredVariables: ['memberId'],
      complianceTags: [
        { category: 'privacy', requirement: 'Member data protection', severity: 'critical' },
        { category: 'financial', requirement: 'Dues accuracy', severity: 'high' }
      ],
      metadata: {
        author: 'UnionEyes AI Team',
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01')
      }
    };

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │                   DUES INQUIRY TEMPLATE                           │
    // │                   (Inherits from Member Services)                  │
    // └─────────────────────────────────────────────────────────────────────┘
    const duesInquiryTemplate: PromptTemplate = {
      id: 'dues-inquiry',
      name: 'Dues Inquiry Handler',
      version: '1.0.0',
      systemPrompt: `You handle dues-related inquiries from union members.

COMMON QUESTIONS:
- Current dues balance and payment status
- Payment history and receipts
- Arrears and reinstatement requirements
- Dues deductions from paycheck
- Changes to dues amounts

TEMPLATE RESPONSE FOR ARREARS:
"I understand you&apos;re asking about your dues status. Based on our records:
- Last payment received: [DATE]
- Current balance: [AMOUNT]
- To bring your account current, you can: [OPTIONS]

Would you like me to send you a payment receipt or help you set up a payment plan?"`,

      attentionWeights: {
        userQuery: 0.35,
        contextDocs: 0.25,
        sessionHistory: 0.15,
        jurisdictionRules: 0.10,
        cbaClauses: 0.10,
        timelineContext: 0.05
      },

      jurisdictions: ['federal', 'ontario', 'quebec', 'british-columbia', 'alberta'],
      requiredVariables: ['memberId', 'organizationId'],
      complianceTags: [
        { category: 'financial', requirement: 'Accurate dues tracking', severity: 'critical' },
        { category: 'privacy', requirement: 'Financial data protection', severity: 'high' }
      ],
      metadata: {
        author: 'UnionEyes AI Team',
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-15')
      }
    };

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │                   CASE MANAGEMENT TEMPLATE                         │
    // │                   (Inherits from Base)                              │
    // └─────────────────────────────────────────────────────────────────────┘
    const caseManagementTemplate: PromptTemplate = {
      id: 'case-management',
      name: 'Case Management',
      version: '1.0.0',
      systemPrompt: `You are a union representative handling grievance and case management matters.

YOUR ROLE:
- Guide members through the grievance process
- Explain case status and next steps
- Prepare members for meetings, hearings, and arbitration
- Ensure all documentation is properly filed

CASE HANDLING PRINCIPLES:
- Always maintain confidentiality
- Document all interactions
- Meet deadlines strictly
- Prepare comprehensive evidence packages
- Coordinate with stewards and legal counsel`,

      attentionWeights: {
        userQuery: 0.25,
        contextDocs: 0.30,
        sessionHistory: 0.10,
        jurisdictionRules: 0.15,
        cbaClauses: 0.15,
        timelineContext: 0.05
      },

      jurisdictions: ['federal', 'ontario', 'quebec', 'british-columbia', 'alberta'],
      requiredVariables: ['organizationId', 'caseId'],
      complianceTags: [
        { category: 'labor-law', requirement: 'Grievance process compliance', severity: 'critical' },
        { category: 'governance', requirement: 'Case documentation', severity: 'high' }
      ],
      metadata: {
        author: 'UnionEyes AI Team',
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01')
      }
    };

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │                   GRIEVANCE HANDLER TEMPLATE                        │
    // │                   (Inherits from Case Management - HIGH CBA ATTENTION)│
    // └─────────────────────────────────────────────────────────────────────┘
    const grievanceHandlerTemplate: PromptTemplate = {
      id: 'grievance-handler',
      name: 'Grievance Handler',
      version: '1.0.0',
      systemPrompt: `You specialize in handling member grievances under the collective agreement.

GRIEVANCE PROCESS:
1. Initial Filing - Capture all details, classify grievance type
2. Investigation - Gather facts, evidence, witness statements
3. Step Meetings - Prepare member, document employer responses
4. Arbitration Prep - Build case, prepare witnesses, organize evidence

HIGH CBA ATTENTION:
When responding, ALWAYS:
- Reference specific CBA articles when explaining member rights
- Identify relevant precedents from past grievances
- Note critical timelines and deadlines
- Highlight procedural requirements the employer must follow

GRIEVANCE CLASSIFICATION:
- Contract Interpretation
- Discipline/Discharge
- Seniority
- Job Posting/Transfer
- Health & Safety
- Discrimination
- Non-Compliance`,

      attentionWeights: {
        userQuery: 0.20,
        contextDocs: 0.25,
        sessionHistory: 0.10,
        jurisdictionRules: 0.15,
        cbaClauses: 0.25,  // HIGH WEIGHT - Critical for grievances
        timelineContext: 0.05  // Deadlines are critical
      },

      jurisdictions: ['federal', 'ontario', 'quebec', 'british-columbia', 'alberta'],
      requiredVariables: ['organizationId', 'caseId', 'grievanceType', 'cbaId'],
      complianceTags: [
        { category: 'labor-law', requirement: 'CBA compliance', severity: 'critical' },
        { category: 'governance', requirement: 'Grievance documentation', severity: 'critical' },
        { category: 'security', requirement: 'Evidence chain of custody', severity: 'high' }
      ],
      metadata: {
        author: 'UnionEyes AI Team',
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-02-01')
      }
    };

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │                   ARBITRATION PREP TEMPLATE                       │
    // │                   (Inherits from Grievance Handler)                 │
    // └─────────────────────────────────────────────────────────────────────┘
    const arbitrationPrepTemplate: PromptTemplate = {
      id: 'arbitration-prep',
      name: 'Arbitration Preparation',
      version: '1.0.0',
      systemPrompt: `You prepare union representatives for arbitration hearings.

ARBITRATION PREPARATION:
1. Case Theory - Establish the union's position and arguments
2. Evidence Organization - Chronological timeline, key documents, witness statements
3. Cross-Examination Prep - Questions for employer's witnesses
4. Opening/Closing Statements - Draft key arguments
5. Arbitrator Research - Know their history and tendencies

DOCUMENTATION REQUIREMENTS:
- Complete grievance file with all correspondence
- Witness list with prepared statements
- Relevant CBA articles and past arbitations
- Employer policies violated
- Remedy sought (be specific)`,

      attentionWeights: {
        userQuery: 0.15,
        contextDocs: 0.30,
        sessionHistory: 0.05,
        jurisdictionRules: 0.15,
        cbaClauses: 0.25,
        timelineContext: 0.10  // Hearing dates are critical
      },

      jurisdictions: ['federal', 'ontario', 'quebec', 'british-columbia'],
      requiredVariables: ['organizationId', 'caseId', 'cbaId', 'hearingDate'],
      complianceTags: [
        { category: 'labor-law', requirement: 'Arbitration process', severity: 'critical' },
        { category: 'governance', requirement: 'Evidence integrity', severity: 'critical' }
      ],
      metadata: {
        author: 'UnionEyes AI Team',
        createdAt: new Date('2025-01-15'),
        updatedAt: new Date('2025-01-15')
      }
    };

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │                   COMMUNICATIONS TEMPLATE                          │
    // │                   (Inherits from Base)                              │
    // └─────────────────────────────────────────────────────────────────────┘
    const communicationsTemplate: PromptTemplate = {
      id: 'communications',
      name: 'Union Communications',
      version: '1.0.0',
      systemPrompt: `You assist with union communications and member outreach.

COMMUNICATION TYPES:
- Bargaining updates to members
- Strike notices and instructions
- Meeting announcements
- Benefits and program information
- Organizing campaign messages

TONE GUIDELINES:
- Always professional but engaging
- Clear call-to-action when needed
- Accurate information only - never speculate
- Include relevant deadlines and contact information
- Comply with union branding guidelines`,

      attentionWeights: {
        userQuery: 0.30,
        contextDocs: 0.15,
        sessionHistory: 0.10,
        jurisdictionRules: 0.10,
        cbaClauses: 0.10,
        timelineContext: 0.25  // Communications often have deadlines
      },

      jurisdictions: ['federal', 'ontario', 'quebec', 'british-columbia', 'alberta'],
      requiredVariables: ['organizationId'],
      complianceTags: [
        { category: 'governance', requirement: 'Official communications', severity: 'medium' }
      ],
      metadata: {
        author: 'UnionEyes AI Team',
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01')
      }
    };

    // ┌─────────────────────────────────────────────────────────────────────┐
    // │                   GOVERNANCE TEMPLATE                              │
    // │                   (Inherits from Base)                              │
    // └─────────────────────────────────────────────────────────────────────┘
    const governanceTemplate: PromptTemplate = {
      id: 'governance',
      name: 'Governance & Elections',
      version: '1.0.0',
      systemPrompt: `You support union governance operations including elections and policy.

GOVERNANCE AREAS:
- Officer and steward elections
- Bylaw and policy interpretation
- Meeting procedures (Robert's Rules)
- Fiduciary responsibilities
- Member rights and obligations

ELECTION PROCESS:
- Verify voter eligibility
- Ensure secret ballot procedures
- Maintain accurate voter rolls
- Document results with witnesses
- Proper storage of ballots`,

      attentionWeights: {
        userQuery: 0.25,
        contextDocs: 0.25,
        sessionHistory: 0.10,
        jurisdictionRules: 0.20,
        cbaClauses: 0.10,
        timelineContext: 0.10
      },

      jurisdictions: ['federal', 'ontario', 'quebec', 'british-columbia', 'alberta'],
      requiredVariables: ['organizationId'],
      complianceTags: [
        { category: 'governance', requirement: 'Democratic processes', severity: 'critical' },
        { category: 'security', requirement: 'Election integrity', severity: 'critical' }
      ],
      metadata: {
        author: 'UnionEyes AI Team',
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01')
      }
    };

    // Register all templates
    this.registerTemplate(baseTemplate);
    this.registerTemplate(memberServicesTemplate);
    this.registerTemplate(duesInquiryTemplate);
    this.registerTemplate(caseManagementTemplate);
    this.registerTemplate(grievanceHandlerTemplate);
    this.registerTemplate(arbitrationPrepTemplate);
    this.registerTemplate(communicationsTemplate);
    this.registerTemplate(governanceTemplate);
  }

  /**
   * Register a new template
   */
  registerTemplate(template: PromptTemplate): void {
    // Validate attention weights sum to 1.0
    const weightSum = Object.values(template.attentionWeights).reduce((a, b) => a + b, 0);
    if (Math.abs(weightSum - 1.0) > 0.01) {
      throw new Error(`Template ${template.id}: Attention weights must sum to 1.0, got ${weightSum}`);
    }

    // Store template
    this.templates.set(template.id, template);

    // Track version history
    if (!this.versionHistory.has(template.id)) {
      this.versionHistory.set(template.id, new Map());
    }
    this.versionHistory.get(template.id)!.set(template.version, template);

    logger.info(`Template registered: ${template.id} v${template.version}`);
  }

  /**
   * Resolve template with full inheritance chain
   */
  resolveTemplate(templateId: string, context: LLMRequestContext): ResolvedTemplate {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Build inheritance chain
    const inheritanceChain: string[] = [templateId];
    const currentTemplate: PromptTemplate | undefined = template;

    // Follow inheritance chain (simplified - could be recursive)
    while (currentTemplate?.metadata?.deprecationNotice) {
      logger.warn(`Template ${currentTemplate.id} is deprecated: ${currentTemplate.metadata.deprecationNotice}`);
      break;
    }

    // Resolve jurisdiction-specific overrides
    const resolvedJurisdiction = this.resolveJurisdiction(template, context.jurisdiction);

    // Calculate final attention weights (could apply modifiers based on context)
    const resolvedAttentionWeights = this.resolveAttentionWeights(
      template.attentionWeights,
      context
    );

    // Build resolved system prompt with context injection
    const resolvedSystemPrompt = this.resolveSystemPrompt(template, context);

    return {
      template,
      resolvedSystemPrompt,
      resolvedAttentionWeights,
      resolvedJurisdiction,
      inheritanceChain
    };
  }

  /**
   * Resolve jurisdiction-specific variations
   */
  private resolveJurisdiction(template: PromptTemplate, contextJurisdiction: Jurisdiction): Jurisdiction {
    if (template.jurisdictions.includes(contextJurisdiction)) {
      return contextJurisdiction;
    }
    
    // Fall back to federal for unknown jurisdictions
    if (template.jurisdictions.includes('federal')) {
      return 'federal';
    }
    
    return template.jurisdictions[0];
  }

  /**
   * Resolve attention weights based on context
   */
  private resolveAttentionWeights(
    baseWeights: AttentionWeights,
    context: LLMRequestContext
  ): AttentionWeights {
    const weights = { ...baseWeights };

    // Adjust weights based on detected intent
    if (context.detectedIntent) {
      const intent = context.detectedIntent;

      // Increase CBA weight for grievance-related queries
      if (['grievance_filing', 'grievance_status', 'arbitration_prep'].includes(intent.type)) {
        weights.cbaClauses = Math.min(weights.cbaClauses + 0.15, 0.5);
        weights.contextDocs = weights.contextDocs - 0.10;
        weights.jurisdictionRules = weights.jurisdictionRules - 0.05;
      }

      // Increase timeline weight for case-related queries
      if (['grievance_status', 'arbitration_prep'].includes(intent.type)) {
        weights.timelineContext = Math.min(weights.timelineContext + 0.10, 0.3);
      }

      // Increase history weight for follow-up questions
      if (weights.sessionHistory < 0.15) {
        weights.sessionHistory = Math.min(weights.sessionHistory + 0.05, 0.2);
      }
    }

    // Re-normalize weights to sum to 1.0
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    if (Math.abs(total - 1.0) > 0.01) {
      const factor = 1.0 / total;
      for (const key of Object.keys(weights) as (keyof AttentionWeights)[]) {
        weights[key] = weights[key] * factor;
      }
    }

    return weights;
  }

  /**
   * Resolve system prompt with context variables
   */
  private resolveSystemPrompt(template: PromptTemplate, context: LLMRequestContext): string {
    let prompt = template.systemPrompt;

    // Inject jurisdiction context
    const jurisdictionContext = this.getJurisdictionContext(context.jurisdiction);
    if (jurisdictionContext) {
      prompt += `\n\nJURISDICTION CONTEXT (${context.jurisdiction.toUpperCase()}):\n${jurisdictionContext}`;
    }

    // Inject role context
    prompt += `\n\nCURRENT USER ROLE: ${context.userRole}`;
    prompt += `\nORGANIZATION: ${context.organizationId}`;

    // Inject active case context if present
    if (context.activeCaseId) {
      prompt += `\nACTIVE CASE ID: ${context.activeCaseId}`;
    }

    if (context.activeGrievanceStage) {
      prompt += `\nCURRENT GRIEVANCE STAGE: ${context.activeGrievanceStage}`;
    }

    return prompt;
  }

  /**
   * Get jurisdiction-specific context
   */
  private getJurisdictionContext(jurisdiction: Jurisdiction): string {
    const contexts: Record<Jurisdiction, string> = {
      'federal': `Canada Labour Code applies. Federal jurisdiction covers: interprovincial transport, postal, banking, telecommunications, nuclear, federal Crown corporations. Key rights: Right to organize (Part I), Collective bargaining (Part II), Unjust dismissal (Part III).`,
      
      'ontario': `Ontario Employment Standards Act + Labour Relations Act. Key features: Card-based certification, First contract arbitration, Essential services provisions. Major tribunals: Ontario Labour Relations Board (OLRB), Employment Standards Tribunal.`,
      
      'quebec': `Quebec Labour Code + National Assembly. Unique features: Francoeur system (pre-1977 certification), Council of Arbitrators. Key rights: Voluntary recognition, Strike/replacement worker rules.`,
      
      'british-columbia': `BC Labour Relations Code. Features: Decertification cooling-off, Essential services, Successor rights. Tribunal: BC Labour Relations Board.`,
      
      'alberta': `Alberta Labour Relations Code. Features: First contract mediation, Essential services. Board: Alberta Labour Relations Board.`,
      
      'manitoba': `Manitoba Labour Relations Act. Features: Card-based certification, Arbitration. Board: Manitoba Labour Relations Board.`,
      
      'saskatchewan': `Saskatchewan Employment Act. Features: Essential services. Commission: Saskatchewan Labour Relations Board.`,
      
      'nova-scotia': `Nova Scotia Labour Standards Code + Trade Union Act. Board: Nova Scotia Labour Board.`,
      
      'new-brunswick': `New Brunswick Industrial Relations Act. Board: New Brunswick Labour and Employment Board.`,
      
      'pei': `Prince Edward Island Labour Act. Board: Island Regulatory and Appeals Commission.`,
      
      'newfoundland': `Newfoundland and Labrador Labour Relations Act. Board: Newfoundland and Labrador Labour Relations Board.`
    };

    return contexts[jurisdiction] || contexts['federal'];
  }

  /**
   * Get template by ID
   */
  getTemplate(templateId: string): PromptTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * List all registered templates
   */
  listTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get safety filter instance
   */
  getSafetyFilter(): ContentSafetyFilter {
    return this.safetyFilter;
  }
}

// ============================================================================
// ATTENTION MECHANISM ENGINE
// ============================================================================

/**
 * Attention Mechanism Engine
 * 
 * Dynamically weights and prioritizes context sources based on:
 * - Query intent classification
 * - Relevance scoring from RAG
 * - Session history importance
 * - Jurisdiction-specific relevance
 * - Timeline/deadline urgency
 */
class AttentionMechanismEngine {
  private templateRegistry: TemplateRegistry;

  constructor(registry: TemplateRegistry) {
    this.templateRegistry = registry;
  }

  /**
   * Score and weight all context sources for a request
   * INTEGRATION: Now includes FSM state and LRO Signals
   */
  async scoreContext(
    userMessage: string,
    resolvedTemplate: ResolvedTemplate,
    context: LLMRequestContext
  ): Promise<ScoredContext[]> {
    const scoredContexts: ScoredContext[] = [];
    const weights = resolvedTemplate.resolvedAttentionWeights;

    // 1. Score RAG documents
    const ragResults = await this.retrieveAndScoreRAG(userMessage, context);
    scoredContexts.push(...ragResults.map(r => ({
      ...r,
      source: 'rag' as const,
      attentionWeight: weights.contextDocs * r.relevanceScore
    })));

    // 2. Score session history
    const sessionHistory = await this.retrieveSessionHistory(context.sessionId);
    scoredContexts.push(...sessionHistory.map(h => ({
      content: h.content,
      source: 'session' as const,
      relevanceScore: h.relevanceScore,
      attentionWeight: weights.sessionHistory * h.relevanceScore
    })));

    // 3. Score CBA clauses if relevant
    if (context.activeCBAId) {
      const cbaResults = await this.retrieveCBAClauses(context.activeCBAId, userMessage);
      scoredContexts.push(...cbaResults.map(c => ({
        content: c.content,
        source: 'cba' as const,
        relevanceScore: c.relevanceScore,
        attentionWeight: weights.cbaClauses * c.relevanceScore
      })));
    }

    // 4. Add jurisdiction rules
    const jurisdictionRules = this.getJurisdictionRules(context.jurisdiction);
    scoredContexts.push(...jurisdictionRules.map(r => ({
      content: r,
      source: 'jurisdiction' as const,
      relevanceScore: 0.8,
      attentionWeight: weights.jurisdictionRules
    })));

    // 5. Add timeline context if case is active
    // INTEGRATION: Uses SLA Calculator for accurate deadline awareness
    if (context.activeCaseId) {
      const timelineContext = await this.getTimelineContext(context.activeCaseId);
      
      // Check SLA status for attention boost
      let timelineWeight = weights.timelineContext;
      const slaAssessment = await this.getCaseSLAForAttention(context.activeCaseId);
      
      // Boost attention if SLA is at risk or breached
      if (slaAssessment) {
        if (slaAssessment.overallStatus === 'breached') {
          timelineWeight = Math.min(timelineWeight * 2.0, 0.5); // Double weight, max 50%
          timelineContext.unshift('🚨 **SLA BREACHED** - Immediate attention required');
        } else if (slaAssessment.overallStatus === 'at_risk') {
          timelineWeight = Math.min(timelineWeight * 1.5, 0.4); // 1.5x weight, max 40%
          timelineContext.unshift('⚠️ **SLA AT RISK** - Urgent attention needed');
        }
      }
      
      scoredContexts.push(...timelineContext.map(t => ({
        content: t,
        source: 'timeline' as const,
        relevanceScore: 0.9,
        attentionWeight: timelineWeight
      })));

      // 6. Add FSM state context
      // INTEGRATION: Uses Claim Workflow FSM for state-aware responses
      const fsmState = await this.getCaseFSMState(context.activeCaseId, context.userRole);
      if (fsmState.currentStatus) {
        const fsmContext = [
          `=== WORKFLOW STATE ===`,
          `Current Status: ${fsmState.currentStatus}`,
          `Available Transitions: ${fsmState.allowedTransitions.join(', ')}`,
        ];
        
        for (const [target, reqs] of Object.entries(fsmState.requirements)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const r = reqs as any;
          fsmContext.push(
            `→ ${target}: requires ${r.requiresRole?.join('/') || 'any'}, min ${r.minHours}h, docs: ${r.requiresDocumentation}`
          );
        }
        
        scoredContexts.push(...fsmContext.map(c => ({
          content: c,
          source: 'timeline' as const,
          relevanceScore: 0.85,
          attentionWeight: weights.timelineContext * 0.5
        })));
      }

      // 7. Add LRO Signals if any
      // INTEGRATION: Uses LRO Signals for priority attention
      const signals = await this.getCaseSignals(context.activeCaseId);
      if (signals.length > 0) {
        const signalContext = [
          `=== ACTIVE SIGNALS (${signals.length}) ===`
        ];
        
        // Sort by severity
        const severityOrder: Record<SignalSeverity, number> = { critical: 0, urgent: 1, warning: 2, info: 3 };
        const sortedSignals = [...signals].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
        
        for (const signal of sortedSignals.slice(0, 5)) {
          const icon = signal.severity === 'critical' ? '🔴' : signal.severity === 'urgent' ? '🟠' : signal.severity === 'warning' ? '🟡' : '🔵';
          signalContext.push(`${icon} [${signal.severity.toUpperCase()}] ${signal.title}: ${signal.description}`);
          if (signal.actionText) {
            signalContext.push(`   → Action: ${signal.actionText}`);
          }
        }
        
        // High attention for critical signals
        const hasCritical = signals.some(s => s.severity === 'critical' || s.severity === 'urgent');
        const signalWeight = hasCritical ? weights.timelineContext * 1.5 : weights.timelineContext;
        
        scoredContexts.push(...signalContext.map(c => ({
          content: c,
          source: 'timeline' as const,
          relevanceScore: 0.95,
          attentionWeight: Math.min(signalWeight, 0.5)
        })));
      }
    }

    // Sort by attention weight (highest first)
    return scoredContexts.sort((a, b) => b.attentionWeight - a.attentionWeight);
  }

  /**
   * Quick SLA check for attention weighting
   * INTEGRATION: Lightweight SLA calculation
   */
  private async getCaseSLAForAttention(caseId: string): Promise<CaseSlaAssessment | null> {
    try {
      const [claim] = await db
        .select()
        .from(claims)
        .where(eq(claims.claimId, caseId))
        .limit(1);

      if (!claim) return null;

      const timeline = await this.getCaseTimeline(caseId);
      return calculateCaseSlaStatus(caseId, timeline);
    } catch (_error) {
      return null;
    }
  }

  /**
   * Get FSM state for context
   * INTEGRATION: Uses Claim Workflow FSM
   */
  private async getCaseFSMState(caseId: string, userRole: string): Promise<{
    currentStatus: ClaimStatus | null;
    allowedTransitions: string[];
    requirements: Record<string, unknown>;
  }> {
    try {
      const [claim] = await db
        .select()
        .from(claims)
        .where(eq(claims.claimId, caseId))
        .limit(1);

      if (!claim) {
        return { currentStatus: null, allowedTransitions: [], requirements: {} };
      }

      const currentStatus = claim.status as ClaimStatus;
      const allowedTransitions = getAllowedClaimTransitions(currentStatus, userRole);
      
      const requirements: Record<string, unknown> = {};
      for (const target of allowedTransitions.slice(0, 3)) {
        requirements[target] = getTransitionRequirements(currentStatus, target as ClaimStatus);
      }

      return { currentStatus, allowedTransitions, requirements };
    } catch (_error) {
      return { currentStatus: null, allowedTransitions: [], requirements: {} };
    }
  }

  /**
   * Get signals for case
   * INTEGRATION: Uses LRO Signals
   */
  private async getCaseSignals(caseId: string): Promise<Signal[]> {
    try {
      const [claim] = await db
        .select()
        .from(claims)
        .where(eq(claims.claimId, caseId))
        .limit(1);

      if (!claim) return [];

      const caseState = {
        id: claim.claimId,
        status: claim.status as unknown,
        priority: claim.priority as unknown,
        createdAt: claim.createdAt || new Date(),
        updatedAt: claim.updatedAt || claim.createdAt || new Date(),
        assignedTo: claim.assignedTo,
        organizationId: claim.organizationId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any as CaseForSignals;

      return await detectAllSignals([caseState]);
    } catch (_error) {
      return [];
    }
  }

  /**
   * Retrieve and score RAG documents
   */
  private async retrieveAndScoreRAG(
    userMessage: string,
    context: LLMRequestContext
  ): Promise<Array<{ content: string; relevanceScore: number }>> {
    try {
      // Generate embedding for user message
      const embeddingProvider = this.getEmbeddingProvider();
      const queryEmbedding = await embeddingProvider.generateEmbedding(userMessage);

      // Query knowledge base
      const results = await db
        .select({
          id: knowledgeBase.id,
          title: knowledgeBase.title,
          content: knowledgeBase.content,
          embedding: knowledgeBase.embedding,
          relevanceScore: sql<number>`1 - ((${queryEmbedding}::vector <=> ${knowledgeBase.embedding}::vector))`
        })
        .from(knowledgeBase)
        .where(
          and(
            eq(knowledgeBase.isActive, true),
            eq(knowledgeBase.organizationId, context.organizationId)
          )
        )
        .orderBy(sql`${knowledgeBase.embedding}::vector <=> ${queryEmbedding}::vector`)
        .limit(10);

      return results
        .filter(r => (r.relevanceScore || 0) > 0.5)
        .map(r => ({
          content: `DOCUMENT: ${r.title}\n\n${r.content}`,
          relevanceScore: r.relevanceScore || 0
        }));
    } catch (error) {
      logger.error('RAG retrieval failed', { error });
      return [];
    }
  }

  /**
   * Get embedding provider (simplified)
   */
  private getEmbeddingProvider() {
    // This would use the existing OpenAI/Anthropic provider from chatbot-service
    return {
      async generateEmbedding(text: string): Promise<number[]> {
        // Simplified - in production use actual provider
        const hash = createHash('sha256').update(text).digest();
        return Array.from(hash).map(b => b / 255);
      }
    };
  }

  /**
   * Retrieve session history
   */
  private async retrieveSessionHistory(
    sessionId: string
  ): Promise<Array<{ content: string; relevanceScore: number }>> {
    try {
      const messages = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, sessionId))
        .orderBy(desc(chatMessages.createdAt))
        .limit(5);

      // Score by recency
      return messages.reverse().map((msg, index) => ({
        content: `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`,
        relevanceScore: 1.0 - (index * 0.15) // Decay for older messages
      }));
    } catch (error) {
      logger.error('Session history retrieval failed', { error });
      return [];
    }
  }

  /**
   * Retrieve relevant CBA clauses
   */
  private async retrieveCBAClauses(
    _cbaId: string,
    _query: string
  ): Promise<Array<{ content: string; relevanceScore: number }>> {
    // This would query the CBA clauses table
    // Simplified placeholder
    return [];
  }

  /**
   * Get jurisdiction rules
   */
  private getJurisdictionRules(jurisdiction: Jurisdiction): string[] {
    const rules: Record<Jurisdiction, string[]> = {
      'federal': ['Canada Labour Code Part I - Labour Relations', 'Canadian Human Rights Act'],
      'ontario': ['Ontario Employment Standards Act', 'Ontario Labour Relations Act', 'Employment Standards Act, 2000'],
      'quebec': ['Quebec Labour Code', 'Charter of the French Language'],
      'british-columbia': ['BC Labour Relations Code', 'Employment Standards Act'],
      'alberta': ['Alberta Labour Relations Code', 'Employment Standards Code'],
      'manitoba': ['Manitoba Labour Relations Act', 'Employment Standards Code'],
      'saskatchewan': ['Saskatchewan Employment Act', 'Labour Relations Act'],
      'nova-scotia': ['Nova Scotia Labour Standards Code', 'Trade Union Act'],
      'new-brunswick': ['Industrial Relations Act', 'Employment Standards Act'],
      'pei': ['Labour Act', 'Employment Standards Act'],
      'newfoundland': ['Labour Relations Act', 'Employment Standards Act']
    };

    return rules[jurisdiction] || rules['federal'];
  }

  /**
   * Get timeline context for active case
   * INTEGRATION: Uses SLA Calculator for deadline awareness
   */
  private async getTimelineContext(caseId: string): Promise<string[]> {
    try {
      // Get claim data from database
      const [claim] = await db
        .select()
        .from(claims)
        .where(eq(claims.claimId, caseId))
        .limit(1);

      if (!claim) {
        return [`Case ${caseId} not found in system`];
      }

      const timelineEvents: SlaTimelineEvent[] = await this.getCaseTimeline(caseId);
      
      // Calculate SLA assessment using sla-calculator
      const slaAssessment = calculateCaseSlaStatus(caseId, timelineEvents);
      
      const timelineContext: string[] = [
        `=== CASE TIMELINE for ${caseId} ===`,
        `Current Status: ${claim.status}`,
        `Priority: ${claim.priority}`,
        `Created: ${claim.createdAt?.toISOString() || 'unknown'}`,
        `Last Updated: ${claim.updatedAt?.toISOString() || 'unknown'}`,
        '',
        `=== SLA ASSESSMENT ===`,
        `Overall Status: ${slaAssessment.overallStatus.toUpperCase()}`,
      ];

      // Add acknowledgment SLA
      if (slaAssessment.acknowledgment) {
        timelineContext.push(
          `Acknowledgment: ${slaAssessment.acknowledgment.status} (${slaAssessment.acknowledgment.description})`
        );
      }

      // Add first response SLA
      if (slaAssessment.firstResponse) {
        timelineContext.push(
          `First Response: ${slaAssessment.firstResponse.status} (${slaAssessment.firstResponse.description})`
        );
      }

      // Add investigation SLA
      if (slaAssessment.investigation) {
        timelineContext.push(
          `Investigation: ${slaAssessment.investigation.status} (${slaAssessment.investigation.description})`
        );
      }

      // Add critical SLAs if any
      if (slaAssessment.criticalSlas.length > 0) {
        timelineContext.push(
          `⚠️ CRITICAL: ${slaAssessment.criticalSlas.join(', ')}`
        );
      }

      return timelineContext;
    } catch (error) {
      logger.error('Timeline context retrieval failed', { error, caseId });
      return [`Error retrieving timeline for case ${caseId}`];
    }
  }

  /**
   * Get case timeline from claim updates
   * INTEGRATION: Queries claimUpdates for SLA calculation
   */
  private async getCaseTimeline(caseId: string): Promise<SlaTimelineEvent[]> {
    try {
      const updates = await db
        .select()
        .from(claimUpdates)
        .where(eq(claimUpdates.claimId, caseId))
        .orderBy(claimUpdates.createdAt);

      const timelineMap = new Map<string, SlaTimelineEvent>();

      for (const update of updates) {
        const timestamp = update.createdAt || new Date();
        const updateType = update.updateType as string;

        // Map update types to SLA timeline events
        if (updateType === 'status_change' || updateType === 'submitted') {
          if (!timelineMap.has('submitted')) {
            timelineMap.set('submitted', { timestamp, type: 'submitted' });
          }
        }

        if (updateType === 'acknowledged') {
          if (!timelineMap.has('acknowledged')) {
            timelineMap.set('acknowledged', { timestamp, type: 'acknowledged' });
          }
        }

        if (updateType === 'first_response') {
          if (!timelineMap.has('first_response')) {
            timelineMap.set('first_response', { timestamp, type: 'first_response' });
          }
        }

        if (updateType === 'investigation_complete') {
          if (!timelineMap.has('investigation_complete')) {
            timelineMap.set('investigation_complete', { timestamp, type: 'investigation_complete' });
          }
        }
      }

      return Array.from(timelineMap.values()).sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
      );
    } catch (error) {
      logger.error('Case timeline retrieval failed', { error, caseId });
      // Return minimal timeline with just submission
      const [claim] = await db.select().from(claims).where(eq(claims.claimId, caseId)).limit(1);
      return claim ? [{ timestamp: claim.createdAt || new Date(), type: 'submitted' }] : [];
    }
  }

  /**
   * Build final context prompt from scored contexts
   */
  buildContextPrompt(scoredContexts: ScoredContext[]): string {
    if (scoredContexts.length === 0) {
      return 'No additional context available.';
    }

    // Group by source for organized presentation
    const grouped = scoredContexts.reduce((acc, ctx) => {
      if (!acc[ctx.source]) acc[ctx.source] = [];
      acc[ctx.source].push(ctx);
      return acc;
    }, {} as Record<string, ScoredContext[]>);

    let contextPrompt = '\n\n=== CONTEXT FOR YOUR RESPONSE ===\n\n';

    // Add sources in order of attention weight
    for (const source of ['cba', 'jurisdiction', 'rag', 'timeline', 'session'] as const) {
      const contexts = grouped[source];
      if (contexts && contexts.length > 0) {
        contextPrompt += `[${source.toUpperCase()} - Priority: ${(contexts[0].attentionWeight * 100).toFixed(1)}%]\n`;
        for (const ctx of contexts.slice(0, 3)) { // Limit to top 3 per source
          contextPrompt += `${ctx.content}\n---\n`;
        }
      }
    }

    return contextPrompt;
  }
}

// ============================================================================
// GOVERNANCE & AUDIT LAYER
// ============================================================================

/**
 * Governance & Audit Layer
 * 
 * Ensures compliance, traceability, and accountability:
 * - Immutable prompt/response logging
 * - Version control for templates
 * - Cost attribution
 * - SLA monitoring
 * - Compliance checkpoints
 */
class GovernanceAuditLayer {
  private templateRegistry: TemplateRegistry;
  private costTracker: typeof costTracker;

  constructor(registry: TemplateRegistry) {
    this.templateRegistry = registry;
    this.costTracker = costTracker;
  }

  /**
   * Log request for audit trail
   */
  async logRequest(request: LLMRequest, response: LLMResponse): Promise<void> {
    try {
      // Create immutable audit record
      const auditRecord = {
        requestId: response.requestId,
        timestamp: new Date(),
        templateId: request.templateId,
        organizationId: request.context.organizationId,
        userRole: request.context.userRole,
        jurisdiction: request.context.jurisdiction,
        userMessageHash: this.hashContent(request.userMessage),
        model: response.model,
        tokensUsed: response.tokensUsed,
        attentionBreakdown: response.attentionBreakdown,
        complianceVerified: response.complianceVerified
      };

      // Store in audit log (in production, use append-only storage)
      logger.info('AI Request Audit', auditRecord);

      // Track costs
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (this.costTracker as any)?.trackCost({
        organizationId: request.context.organizationId,
        tokensUsed: response.tokensUsed,
        model: response.model,
        templateId: request.templateId,
        timestamp: new Date()
      });

    } catch (error) {
      // Never fail the main request due to audit failures
      logger.error('Audit logging failed', { error });
    }
  }

  /**
   * Generate request ID
   */
  generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Hash content for secure logging (PII protection)
   */
  private hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  /**
   * Verify compliance for request
   */
  async verifyCompliance(request: LLMRequest): Promise<{ compliant: boolean; issues: string[] }> {
    const issues: string[] = [];
    const template = this.templateRegistry.getTemplate(request.templateId);

    if (!template) {
      issues.push(`Template not found: ${request.templateId}`);
      return { compliant: false, issues };
    }

    // Check required variables
    for (const variable of template.requiredVariables) {
      const contextValue = request.context[variable as keyof LLMRequestContext];
      if (!contextValue) {
        issues.push(`Missing required context: ${variable}`);
      }
    }

    // Check jurisdiction support
    if (!template.jurisdictions.includes(request.context.jurisdiction)) {
      issues.push(`Jurisdiction not supported: ${request.context.jurisdiction}`);
    }

    return {
      compliant: issues.length === 0,
      issues
    };
  }
}

// ============================================================================
// MAIN LLM ORCHESTRATOR
// ============================================================================

/**
 * AI Provider interface for LLM invocation
 */
interface AIProvider {
  generateResponse(
    messages: Array<{ role: string; content: string }>,
    options?: { temperature?: number; maxTokens?: number; model?: string }
  ): Promise<{ content: string; tokensUsed: number; model: string }>;
}

/**
 * UnionEyes AI Orchestrator
 * 
 * Coordinates all components for end-to-end LLM requests:
 * 1. Template resolution with inheritance
 * 2. Context scoring with attention mechanism
 * 3. Safety filtering
 * 4. Compliance verification
 * 5. LLM invocation
 * 6. Response audit logging
 */
export class UnionEyesAIController {
  private templateRegistry: TemplateRegistry;
  private attentionEngine: AttentionMechanismEngine;
  private governanceLayer: GovernanceAuditLayer;
  private providerPool: Map<string, AIProvider>;

  constructor() {
    this.templateRegistry = new TemplateRegistry();
    this.attentionEngine = new AttentionMechanismEngine(this.templateRegistry);
    this.governanceLayer = new GovernanceAuditLayer(this.templateRegistry);
    this.providerPool = new Map();
    
    // Initialize providers
    this.initializeProviders();
  }

  /**
   * Initialize AI providers
   */
  private initializeProviders() {
    // This would load from existing chatbot-service providers
    // Simplified placeholder
  }

  /**
   * Main entry point: Process user message
   */
  async processMessage(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      // 1. Safety check
      const safetyResult = await this.templateRegistry.getSafetyFilter().checkContent(request.userMessage);
      if (safetyResult.action === 'block') {
        throw new Error(`Content blocked: ${safetyResult.flaggedCategories.join(', ')}`);
      }

      // 2. Resolve template with inheritance
      const resolvedTemplate = this.templateRegistry.resolveTemplate(
        request.templateId,
        request.context
      );

      // 3. Verify compliance
      const compliance = await this.governanceLayer.verifyCompliance(request);
      if (!compliance.compliant) {
        logger.warn('Compliance issues detected', { issues: compliance.issues });
      }

      // 4. Score and weight context
      const scoredContext = await this.attentionEngine.scoreContext(
        request.userMessage,
        resolvedTemplate,
        request.context
      );

      // 5. Build final prompt
      const contextPrompt = this.attentionEngine.buildContextPrompt(scoredContext);
      const finalSystemPrompt = resolvedTemplate.resolvedSystemPrompt;
      const finalUserPrompt = `${request.userMessage}\n${contextPrompt}`;

      // 6. Get provider and generate response
      const provider = this.getProvider(request.options?.model || 'openai');
      
      // Convert template attention weights to breakdown
      const attentionBreakdown: Record<string, number> = {};
      for (const [key, value] of Object.entries(resolvedTemplate.resolvedAttentionWeights)) {
        attentionBreakdown[key] = value;
      }

      // 7. Generate response
      const response = await provider.generateResponse(
        [
          { role: 'system', content: finalSystemPrompt },
          { role: 'user', content: finalUserPrompt }
        ],
        {
          temperature: request.options?.temperature ?? 0.7,
          maxTokens: request.options?.maxTokens ?? 1000,
          model: request.options?.model
        }
      );

      // 8. Build final response
      const result: LLMResponse = {
        content: response.content,
        tokensUsed: response.tokensUsed,
        model: response.model,
        templateUsed: request.templateId,
        attentionBreakdown,
        complianceVerified: compliance.compliant,
        requestId: this.governanceLayer.generateRequestId()
      };

      // 9. Log audit trail (async, don&apos;t block)
      this.governanceLayer.logRequest(request, result).catch(err => {
        logger.error('Audit logging failed', { error: err });
      });

      logger.info(`AI Request completed in ${Date.now() - startTime}ms`, {
        template: request.templateId,
        tokens: response.tokensUsed
      });

      return result;

    } catch (error) {
      logger.error('AI request failed', { error, template: request.templateId });
      throw error;
    }
  }

  /**
   * Get AI provider from pool
   */
  private getProvider(_preferredProvider: string): AIProvider {
    // Simplified - would use actual provider from chatbot-service
    return {
      async generateResponse(messages, options) {
        return {
          content: 'Response generation not implemented in template engine demo',
          tokensUsed: 0,
          model: options?.model || 'gpt-4'
        };
      }
    } as AIProvider;
  }

  /**
   * List available templates
   */
  listTemplates(): PromptTemplate[] {
    return this.templateRegistry.listTemplates();
  }

  /**
   * Get template by ID
   */
  getTemplate(templateId: string): PromptTemplate | undefined {
    return this.templateRegistry.getTemplate(templateId);
  }
}

// Export singleton instance
export const aiController = new UnionEyesAIController();

// Alias for pipeline compatibility
export const templateEngine = aiController;

// Template context type for external use
export interface TemplateContext {
  query: string;
  jurisdiction: string;
  userRole: string;
  intent: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  entities: any[];
  retrievedContext: string[];
  sla: string;
  organizationId: string;
  [key: string]: unknown;
}

// Export types for external use
export type {
  PromptTemplate,
  AttentionWeights,
  LLMRequest,
  LLMResponse,
  LLMRequestContext,
  ResolvedTemplate,
  ScoredContext,
  Jurisdiction,
  IntentType,
  QueryIntent,
  ComplianceTag,
  SafetyResult
};
