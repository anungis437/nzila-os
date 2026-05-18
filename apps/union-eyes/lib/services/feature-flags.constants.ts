/**
 * Feature Flag Constants
 *
 * Client-safe constants for feature flag names.
 * No server-only imports — safe to use in 'use client' components.
 */

/**
 * LRO Feature Flags (predefined)
 */
export const LRO_FEATURES = {
  // PR-7: Signals API
  SIGNALS_API: 'lro_signals_api',

  // PR-8: UI Components
  SIGNALS_UI: 'lro_signals_ui',
  CASE_LIST_FILTERS: 'lro_case_list_filters',
  DASHBOARD_WIDGET: 'lro_dashboard_widget',
  AUTO_REFRESH: 'lro_auto_refresh',
  SIGNAL_DETAILS: 'lro_signal_details',

  // PR-5/6: Workflow features
  FSM_WORKFLOW: 'lro_fsm_workflow',
  SLA_TRACKING: 'lro_sla_tracking',
  DEFENSIBILITY_EXPORTS: 'lro_defensibility_exports',

  // Future features
  PREDICTIVE_ANALYTICS: 'lro_predictive_analytics',
  BULK_ACTIONS: 'lro_bulk_actions',
  CUSTOM_WORKFLOWS: 'lro_custom_workflows',
} as const;

/**
 * AI Intelligence Feature Flags
 *
 * Each AI capability is independently gated.
 * All default to disabled — enable per-org via DB or admin API.
 */
export const AI_FEATURES = {
  /** Grievance triage: priority/category/complexity scoring */
  GRIEVANCE_TRIAGE: 'ai_grievance_triage',
  /** Clause reasoning: suggest & explain relevant CBA clauses */
  CLAUSE_REASONING: 'ai_clause_reasoning',
  /** Employer risk scoring: aggregate risk signals */
  EMPLOYER_RISK: 'ai_employer_risk',
  /** Steward copilot: timeline summary, suggested actions, draft responses */
  STEWARD_COPILOT: 'ai_steward_copilot',
  /** Executive insights: trend forecasts, hotspot predictions */
  EXECUTIVE_INSIGHTS: 'ai_executive_insights',
  /** Pension funding analysis: funding ratio interpretation + trustee recommendations */
  PENSION_FUNDING_ANALYSIS: 'ai_pension_funding_analysis',
  /** Pension benefit projection: member benefit estimates at target retirement age */
  PENSION_BENEFIT_PROJECTION: 'ai_pension_benefit_projection',
  /** Pension trustee summary: plain-language summary of actuarial valuations */
  PENSION_TRUSTEE_SUMMARY: 'ai_pension_trustee_summary',
  /** Financial analysis: collection anomalies, arrears risk, budget variance, NL summaries */
  FINANCIAL_ANALYSIS: 'ai_financial_analysis',
  /** AI keyword/vector search across knowledge and document surfaces */
  AI_SEARCH: 'ai_search',
  /** AI summarization of documents, cases, and records */
  AI_SUMMARIZE: 'ai_summarize',
  /** Semantic vector search across org-scoped knowledge */
  AI_SEMANTIC_SEARCH: 'ai_semantic_search',
  /** Chatbot conversational assistant */
  AI_CHATBOT: 'ai_chatbot',
  /** AI document ingest and extraction pipeline */
  AI_INGEST: 'ai_ingest',
  /** Mamba long-context reasoning model surface */
  AI_MAMBA: 'ai_mamba',
  /** AI feedback collection (thumbs up/down, corrections) */
  AI_FEEDBACK: 'ai_feedback',
  /** AI-powered grievance precedent matching */
  AI_MATCH_PRECEDENTS: 'ai_match_precedents',
  /** AI clause extraction from CBA / contract documents */
  AI_EXTRACT_CLAUSES: 'ai_extract_clauses',
  /** ML model query surface (custom model inference) */
  ML_QUERY: 'ml_query',
  /** ML predictions surface (SLA-breach risk, etc.) */
  ML_PREDICTIONS: 'ml_predictions',
  /** ML monitoring surface (drift, metrics, alerts, usage) */
  ML_MONITORING: 'ml_monitoring',
  /** ML-powered recommendations surface */
  ML_RECOMMENDATIONS: 'ml_recommendations',
} as const;
