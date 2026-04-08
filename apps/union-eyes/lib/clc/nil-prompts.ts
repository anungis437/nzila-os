/**
 * CLC Labour Intelligence — NIL Prompt Contracts
 *
 * Pre-built use-case definitions for the Nzila Intelligence Layer (NIL)
 * that produce CLC-grade briefings from governed cross-union data.
 *
 * Each prompt contract specifies:
 * - A stable `useCase` key for the NIL routing table
 * - A system prompt framing the CLC analyst persona
 * - A structured `input` builder that formats aggregated data
 *
 * @module lib/clc/nil-prompts
 */

import type { SectorSignal, SharedKnowledgeIndex, GovernanceSummary, AffiliateTrend } from './data-products';

// ── Types ───────────────────────────────────────────────────────────────────

/**
 * A NIL prompt contract for CLC intelligence use-cases.
 * Maps directly to IntelligenceRequest fields.
 */
export interface CLCPromptContract {
  /** Stable use-case key for NIL routing */
  useCase: string;
  /** App identifier */
  app: 'union-eyes';
  /** System prompt / persona */
  systemPrompt: string;
  /** Builds the input payload from typed data */
  buildInput: (...args: unknown[]) => Record<string, unknown>;
}

// ── Shared System Prompt Preamble ───────────────────────────────────────────

export const CLC_ANALYST_PREAMBLE = `You are a senior labour intelligence analyst for the Canadian Labour Congress (CLC).
Your audience is CLC executive leadership and national staff.
You provide concise, actionable briefings grounded in aggregate data from consenting affiliates.
All data has been anonymized to the sector or regional level — never name individual locals or members.
Use plain, direct language appropriate for senior union decision-makers.`;

// ── Prompt Contracts ────────────────────────────────────────────────────────

/**
 * Sector Signals Briefing — synthesizes cross-sector trends
 */
export const SECTOR_SIGNALS_BRIEFING: CLCPromptContract = {
  useCase: 'clc.sector-signals-briefing',
  app: 'union-eyes',
  systemPrompt: `${CLC_ANALYST_PREAMBLE}

Produce a concise sector intelligence briefing (3-5 key findings).
Highlight:
- Sectors with rapidly growing clause activity (emerging bargaining trends)
- Sectors with unusual precedent patterns (e.g. high dismissal rates)
- Cross-sector patterns that suggest movement-wide shifts
- Opportunities for CLC to coordinate national responses

Format each finding as: **Finding Title** — 1-2 sentence explanation with data citation.`,

  buildInput: (signals: unknown) => ({
    dataType: 'sector-signals',
    sectorSignals: signals,
    requestedFormat: 'briefing',
  }),
};

/**
 * Affiliate Engagement Summary — flags under- and over-contributing affiliates
 */
export const AFFILIATE_ENGAGEMENT_SUMMARY: CLCPromptContract = {
  useCase: 'clc.affiliate-engagement-summary',
  app: 'union-eyes',
  systemPrompt: `${CLC_ANALYST_PREAMBLE}

Produce a concise affiliate engagement report (3-5 key observations).
Focus on:
- Affiliates that are actively sharing and contributing (commend)
- Affiliates with low sharing adoption (opportunity for outreach)
- Patterns in engagement by organization type (congress vs. federation vs. union vs. local)
- Suggestions for improving network-wide participation

Do NOT name individual members. Refer to affiliates by organization name only.`,

  buildInput: (trends: unknown) => ({
    dataType: 'affiliate-trends',
    affiliateTrends: trends,
    requestedFormat: 'engagement-report',
  }),
};

/**
 * Knowledge Index Summary — overview of shared knowledge health
 */
export const KNOWLEDGE_INDEX_SUMMARY: CLCPromptContract = {
  useCase: 'clc.knowledge-index-summary',
  app: 'union-eyes',
  systemPrompt: `${CLC_ANALYST_PREAMBLE}

Produce a knowledge index health report (3-5 key insights).
Cover:
- Overall size and growth of the shared clause library and precedent database
- Most-cited resources and why they matter to the movement
- Gaps in coverage (under-represented sectors, clause types, or jurisdictions)
- Recommendations for strengthening the knowledge base

Include specific numbers from the data.`,

  buildInput: (index: unknown) => ({
    dataType: 'knowledge-index',
    knowledgeIndex: index,
    requestedFormat: 'health-report',
  }),
};

/**
 * Governance Health Briefing — consent and participation status
 */
export const GOVERNANCE_HEALTH_BRIEFING: CLCPromptContract = {
  useCase: 'clc.governance-health-briefing',
  app: 'union-eyes',
  systemPrompt: `${CLC_ANALYST_PREAMBLE}

Produce a governance health briefing (3-4 key points).
Cover:
- Current consent and participation rates across dimensions
- Cohort health (whether aggregate analytics are statistically meaningful)
- Sharing adoption rates and trends
- Recommendations for improving participation without pressuring affiliates

This is a compliance-adjacent report — be precise with numbers.`,

  buildInput: (summary: unknown) => ({
    dataType: 'governance-summary',
    governanceSummary: summary,
    requestedFormat: 'governance-briefing',
  }),
};

// ── Helper: Build NIL request input ─────────────────────────────────────────

/**
 * Build a complete NIL input payload for a sector signals briefing.
 */
export function buildSectorSignalsInput(signals: SectorSignal[]) {
  return SECTOR_SIGNALS_BRIEFING.buildInput(signals);
}

/**
 * Build a complete NIL input payload for an affiliate engagement summary.
 */
export function buildAffiliateEngagementInput(trends: AffiliateTrend[]) {
  return AFFILIATE_ENGAGEMENT_SUMMARY.buildInput(trends);
}

/**
 * Build a complete NIL input payload for a knowledge index summary.
 */
export function buildKnowledgeIndexInput(index: SharedKnowledgeIndex) {
  return KNOWLEDGE_INDEX_SUMMARY.buildInput(index);
}

/**
 * Build a complete NIL input payload for a governance health briefing.
 */
export function buildGovernanceHealthInput(summary: GovernanceSummary) {
  return GOVERNANCE_HEALTH_BRIEFING.buildInput(summary);
}
