/**
 * Multi-Domain Cognition Layer Models
 * 
 * Integrates multiple institutional cognition domains into a unified reasoning layer.
 * Domains: continuity, governance, procedural, operational, precedent, resilience, trust, memory.
 *
 * NOTE: `LegacyMultiDomainTaxonomy` is a module-internal taxonomy that predates the
 * canonical `CognitionDomain` exported by `@nzila/institutional-cognition-core`.
 * It is NOT the canonical institutional cognition domain set. Cognition routes,
 * envelopes, and orchestration must use the kernel's `CognitionDomain`.
 */

export type LegacyMultiDomainTaxonomy =
  | 'continuity_cognition'
  | 'governance_intelligence'
  | 'procedural_intelligence'
  | 'operational_coordination'
  | 'institutional_precedent'
  | 'resilience_intelligence'
  | 'operational_trust'
  | 'institutional_memory';

export interface DomainCognitionProfile {
  domain: LegacyMultiDomainTaxonomy;
  strength: number; // 0-100
  maturittyLevel: 'emergent' | 'developing' | 'mature' | 'advanced';
  integrationScore: number; // 0-100, how well integrated?
  evidence: string[];
}

export interface CrossDomainReasoning {
  sourcedomains: LegacyMultiDomainTaxonomy[];
  synthesizedInsight: string;
  confidence: number; // 0-100
  actionableImplications: string[];
}

export interface MultiDomainCognitionProfile {
  organizationId: string;
  domains: DomainCognitionProfile[];
  overallCognitionScore: number; // 0-100
  crossDomainReasoningChains: CrossDomainReasoning[];
  institutionalContextSynthesis: string;
  operationalDependencyFusion: string[];
  continuityPrecedentLinkage: string;
  cognitiveCohesionScore: number; // 0-100
  interpretationGuidance: string;
  entriesAnalyzed: number;
}
