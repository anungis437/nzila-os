/**
 * CLC Labour Intelligence — NIL Briefing Service
 *
 * Produces structured intelligence briefings from CLC data products
 * using the NIL prompt contracts. Implements rule-based signal
 * extraction that can be upgraded to LLM-backed reasoning when
 * the full NIL reasoning pipeline is wired in.
 *
 * Each briefing function:
 * 1. Analyses aggregated data for actionable patterns
 * 2. Produces typed findings with confidence scores
 * 3. References the NIL prompt contract for audit traceability
 *
 * @module lib/clc/nil-briefing
 */

import type { SectorSignal, AffiliateTrend, SharedKnowledgeIndex, GovernanceSummary } from './data-products';
import {
  SECTOR_SIGNALS_BRIEFING,
  AFFILIATE_ENGAGEMENT_SUMMARY,
  KNOWLEDGE_INDEX_SUMMARY,
  GOVERNANCE_HEALTH_BRIEFING,
} from './nil-prompts';

// ── Types ───────────────────────────────────────────────────────────────────

export interface BriefingFinding {
  /** Short headline */
  title: string;
  /** 1–2 sentence explanation with data citation */
  detail: string;
  /** Confidence in the finding (0–1) */
  confidence: number;
  /** Severity: info, advisory, or action-required */
  severity: 'info' | 'advisory' | 'action-required';
}

export interface IntelligenceBriefing {
  /** NIL use-case key for traceability */
  useCase: string;
  /** When the briefing was generated */
  generatedAt: string;
  /** Overall confidence (0–1) — average of findings */
  overallConfidence: number;
  /** Ordered findings */
  findings: BriefingFinding[];
  /** Source prompt contract used */
  promptContract: string;
}

// ── Sector Signals Briefing ─────────────────────────────────────────────────

export function generateSectorSignalsBriefing(signals: SectorSignal[]): IntelligenceBriefing {
  const findings: BriefingFinding[] = [];

  if (signals.length === 0) {
    findings.push({
      title: 'Insufficient sector data',
      detail: 'No sector signals available from consenting affiliates. Briefing requires at least one sector with clause or precedent activity.',
      confidence: 1.0,
      severity: 'advisory',
    });
  } else {
    // Find sectors with highest clause activity
    const sorted = [...signals].sort((a, b) => b.clauseCount - a.clauseCount);
    const top = sorted[0];
    if (top && top.clauseCount > 0) {
      findings.push({
        title: `${top.sector} leads clause sharing`,
        detail: `${top.sector} has ${top.clauseCount} shared clauses across ${top.uniqueOrgs} affiliates, with ${top.totalCitations} citations — indicating active bargaining knowledge exchange.`,
        confidence: Math.min(0.9, 0.5 + top.uniqueOrgs * 0.1),
        severity: 'info',
      });
    }

    // Check for sectors with high precedent-to-clause ratio (unusual patterns)
    for (const s of signals) {
      if (s.clauseCount > 0 && s.precedentCount / s.clauseCount > 2) {
        findings.push({
          title: `${s.sector}: high precedent density`,
          detail: `${s.sector} has ${s.precedentCount} precedents vs. ${s.clauseCount} clauses (ratio ${(s.precedentCount / s.clauseCount).toFixed(1)}x). This may indicate frequent disputes relative to bargaining output.`,
          confidence: 0.7,
          severity: 'advisory',
        });
      }
    }

    // Cross-sector observation
    if (signals.length >= 3) {
      const totalClauses = signals.reduce((s, x) => s + x.clauseCount, 0);
      const totalOrgs = signals.reduce((s, x) => s + x.uniqueOrgs, 0);
      findings.push({
        title: 'Cross-sector knowledge base growing',
        detail: `${totalClauses} shared clauses across ${signals.length} sectors and ${totalOrgs} affiliates. Movement-wide knowledge sharing is active.`,
        confidence: 0.8,
        severity: 'info',
      });
    }
  }

  return buildBriefing(SECTOR_SIGNALS_BRIEFING.useCase, findings);
}

// ── Affiliate Engagement Briefing ───────────────────────────────────────────

export function generateAffiliateEngagementBriefing(trends: AffiliateTrend[]): IntelligenceBriefing {
  const findings: BriefingFinding[] = [];

  if (trends.length === 0) {
    findings.push({
      title: 'No affiliate engagement data',
      detail: 'No consenting affiliates have sharing activity. Outreach may be needed to build participation.',
      confidence: 1.0,
      severity: 'advisory',
    });
  } else {
    const totalAffiliates = trends.reduce((s, t) => s + t.affiliateCount, 0);
    const totalSharing = trends.reduce((s, t) => s + t.clauseSharingEnabledCount + t.precedentSharingEnabledCount, 0);
    const totalPossible = totalAffiliates * 2; // clause + precedent sharing per affiliate
    const adoptionRate = totalPossible > 0 ? totalSharing / totalPossible : 0;

    findings.push({
      title: `Sharing adoption at ${(adoptionRate * 100).toFixed(0)}%`,
      detail: `${totalSharing} sharing settings enabled across ${totalAffiliates} affiliates (${(adoptionRate * 100).toFixed(0)}% of possible). ${adoptionRate < 0.5 ? 'Outreach recommended to improve participation.' : 'Healthy adoption rate.'}`,
      confidence: 0.85,
      severity: adoptionRate < 0.3 ? 'action-required' : 'info',
    });

    // Check engagement by org type
    for (const t of trends) {
      if (t.affiliateCount > 0 && t.clausesShared === 0 && t.precedentsShared === 0) {
        findings.push({
          title: `${t.organizationType} affiliates: zero contributions`,
          detail: `${t.affiliateCount} ${t.organizationType}-type affiliates have not shared any clauses or precedents. Consider targeted outreach for this category.`,
          confidence: 0.9,
          severity: 'advisory',
        });
      }
    }

    // Most active type
    const mostActive = [...trends].sort((a, b) => (b.clausesShared + b.precedentsShared) - (a.clausesShared + a.precedentsShared))[0];
    if (mostActive && (mostActive.clausesShared + mostActive.precedentsShared) > 0) {
      findings.push({
        title: `${mostActive.organizationType} affiliates most active`,
        detail: `${mostActive.organizationType}-type affiliates contributed ${mostActive.clausesShared} clauses and ${mostActive.precedentsShared} precedents — leading network engagement.`,
        confidence: 0.85,
        severity: 'info',
      });
    }
  }

  return buildBriefing(AFFILIATE_ENGAGEMENT_SUMMARY.useCase, findings);
}

// ── Knowledge Index Briefing ────────────────────────────────────────────────

export function generateKnowledgeIndexBriefing(index: SharedKnowledgeIndex): IntelligenceBriefing {
  const findings: BriefingFinding[] = [];

  findings.push({
    title: `Knowledge base: ${index.totalClauses} clauses, ${index.totalPrecedents} precedents`,
    detail: `The shared knowledge base contains ${index.totalClauses} clauses and ${index.totalPrecedents} precedents from ${index.uniqueOrgs} contributing affiliates.`,
    confidence: 0.95,
    severity: 'info',
  });

  if (index.topCited.length > 0) {
    const top = index.topCited[0];
    findings.push({
      title: `Most-cited resource: ${top.type}`,
      detail: `"${top.title}" has ${top.citationCount} citations — making it the most referenced resource in the knowledge base.`,
      confidence: 0.9,
      severity: 'info',
    });
  }

  if (index.uniqueOrgs < 5) {
    findings.push({
      title: 'Low contributor diversity',
      detail: `Only ${index.uniqueOrgs} affiliates have contributed to the knowledge base. A broader contributor base would improve coverage and reduce bias.`,
      confidence: 0.8,
      severity: 'advisory',
    });
  }

  return buildBriefing(KNOWLEDGE_INDEX_SUMMARY.useCase, findings);
}

// ── Governance Health Briefing ──────────────────────────────────────────────

export function generateGovernanceBriefing(summary: GovernanceSummary): IntelligenceBriefing {
  const findings: BriefingFinding[] = [];

  // Consent rates per dimension
  const dimensions = [
    { dimension: 'Cross-Union Analytics', consented: summary.consentedCrossUnion },
    { dimension: 'Sector Benchmarks', consented: summary.consentedSectorBenchmarks },
    { dimension: 'National Signals', consented: summary.consentedNationalSignals },
  ];
  for (const dim of dimensions) {
    const rate = summary.totalAffiliates > 0 ? dim.consented / summary.totalAffiliates : 0;
    findings.push({
      title: `${dim.dimension}: ${(rate * 100).toFixed(0)}% consent`,
      detail: `${dim.consented} of ${summary.totalAffiliates} affiliates have consented to ${dim.dimension} data sharing (${(rate * 100).toFixed(0)}%).`,
      confidence: 0.95,
      severity: rate < 0.5 ? 'advisory' : 'info',
    });
  }

  // Cohort health
  if (summary.cohortHealth) {
    findings.push({
      title: `Cohort health: ${summary.cohortHealth}`,
      detail: `Aggregate analytics have ${summary.cohortHealth} statistical reliability with ${summary.consentedCrossUnion} participating affiliates. ${summary.cohortHealth === 'insufficient' ? 'More participants needed for meaningful insights.' : 'Sufficient for reliable analysis.'}`,
      confidence: 0.9,
      severity: summary.cohortHealth === 'insufficient' ? 'action-required' : 'info',
    });
  }

  return buildBriefing(GOVERNANCE_HEALTH_BRIEFING.useCase, findings);
}

// ── Internal Helpers ────────────────────────────────────────────────────────

function buildBriefing(useCase: string, findings: BriefingFinding[]): IntelligenceBriefing {
  const avgConfidence = findings.length > 0
    ? findings.reduce((s, f) => s + f.confidence, 0) / findings.length
    : 0;

  return {
    useCase,
    generatedAt: new Date().toISOString(),
    overallConfidence: Math.round(avgConfidence * 100) / 100,
    findings,
    promptContract: useCase,
  };
}
