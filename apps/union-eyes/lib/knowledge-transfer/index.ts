/**
 * Knowledge Transfer Intelligence Layer
 *
 * Barrel export for all knowledge continuity intelligence modules.
 *
 * Modules:
 *   indexing       — Semantic vector indexing into knowledge_base
 *   expertise      — AI-driven expertise pattern extraction
 *   summaries      — Traceable AI handoff summary generation
 *   continuity-risk — Org-level knowledge fragility detection
 *   topic-graph    — Operational knowledge relationship mapping
 *   governance     — Consent and sensitivity controls
 *   search         — Hybrid semantic + keyword search
 */

export * from './indexing/semantic-indexer';
export * from './expertise/expertise-extractor';
export * from './summaries/knowledge-summarizer';
export * from './continuity-risk/risk-detector';
export * from './topic-graph/topic-graph-builder';
export * from './governance/consent-controls';
export * from './search/hybrid-search';
export * from './explainability/insight-explainer';
export * from './succession/succession-analyzer';

// TIER 1: Core Reasoning Engines
export * from './propagation';
export * from './simulation';
export * from './graph-query';
export * from './forecasting';

// TIER 2: Specialized Analysis
export * from './cascade-analysis/cascade-analyzer';
export * from './scenarios/scenario-modeler';
export * from './simulation-explainability/simulation-explainer';
export * from './resilience-index/resilience-calculator';

// TIER 3: Cognition & Decision Intelligence
export * from './mitigation-comparison';
export * from './decision-intelligence';
export * from './resilience-strategies';

// TIER 4: Persistent Organizational Cognition & Governance Copilot
export * from './cognition-memory';
export * from './reasoning-sessions';
// Note: copilot-explainability not re-exported here (internal — use @/lib/knowledge-transfer/copilot-explainability directly)
export * from './copilot';

// TIER 5: Adaptive Organizational Cognition & Federated Governance Intelligence
export * from './institutional-learning';
export * from './adaptive-resilience';
export * from './governance-adaptation';
export * from './mitigation-effectiveness';
export * from './federated-intelligence';

// TIER 6: Institutional Behavior Modeling & Governance Culture Intelligence
export * from './governance-culture';
export * from './behavior-patterns';
export * from './learning-archetypes';
export * from './resilience-habits';
export * from './maturity-personalities';
export * from './learning-trajectories';

// TIER 8: Institutional Systems Dynamics Intelligence
export * from '../institutional-dynamics';

// TIER 9: Multi-Domain Institutional Operating Intelligence
export * from '../multi-domain-cognition';
