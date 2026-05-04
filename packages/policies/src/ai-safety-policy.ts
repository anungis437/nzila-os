/**
 * OWASP AI Testing Guide — AI Surface Safety Policy
 *
 * Core constraint: AI may assist users, but AI must never become an authority layer.
 * AI must never: execute mutations directly, bypass RBAC, bypass org isolation,
 * bypass decision-core, write or modify NAR/audit records directly, expose
 * cross-org data, be treated as authoritative decision output, or run without
 * feature flag + entitlement + rate limit + audit event.
 */

export const AI_SAFETY_POLICY = {
  /** AI surfaces may return read-only results */
  allowReadOnly: true,

  /** AI surfaces must NEVER perform direct mutations */
  allowMutation: false,

  /** Every AI route must be guarded by a feature flag */
  requireFeatureFlag: true,

  /** Every AI route must check org-level entitlement */
  requireEntitlement: true,

  /** Every AI route must enforce rate limiting */
  requireRateLimit: true,

  /** Every AI route must scope results to the caller's organization */
  requireOrgScope: true,

  /** AI-generated content that drives decisions requires a human review step */
  requireHumanReview: true,

  /** AI routes must NEVER return cross-organization data */
  allowCrossOrgAccess: false,

  /** All AI surface invocations must emit an audit event */
  requireAuditEvent: true,
} as const;

export type AISafetyPolicy = typeof AI_SAFETY_POLICY;

/**
 * Sensitivity classification for data that flows through AI surfaces.
 * Maps to OWASP LLM Top 10 — LLM06: Sensitive Information Disclosure.
 */
export type AISurfaceDataClass =
  | 'public'
  | 'internal'
  | 'confidential'
  | 'restricted'
  | 'pension_financial'
  | 'member_personal'
  | 'grievance_legal';

/**
 * Origin tag identifying which AI capability is being invoked.
 * Used in audit events and violation errors for traceability.
 */
export type AISurfaceOrigin =
  | 'copilot'
  | 'summarize'
  | 'search'
  | 'semantic-search'
  | 'triage'
  | 'clause-reasoning'
  | 'insights'
  | 'pension'
  | 'finance'
  | 'mamba'
  | 'ingest'
  | 'chatbot'
  | 'risk'
  | 'ml'
  | 'feedback'
  | 'copilot-query'
  | 'copilot-session'
  | 'employer-risk'
  | 'extract-clauses'
  | 'finance-analysis'
  | 'grievance-triage'
  | 'grievance-triage-id'
  | 'ai-insights'
  | 'ai-insights-summary'
  | 'match-precedents'
  | 'pension-projection'
  | 'pension-funding'
  | 'pension-trustee-summary'
  | 'chatbot-sessions'
  | 'ml-monitoring-alerts'
  | 'ml-monitoring-metrics'
  | 'churn-risk'
  | 'sla-breach-risk'
  | 'sla-breach-risk-feedback'
  | 'ml-query';
