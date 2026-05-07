/**
 * Risk register pure helpers.
 *
 * Mirrors the trustcore_risks schema enums so consumers do not need
 * to import drizzle to reason about severity / status ordering.
 */

import { z } from 'zod'

export const RISK_REGISTER_CATEGORIES = [
  'governance',
  'data',
  'pia',
  'incidents',
  'dsr',
  'vendors',
  'security',
  'operational',
  'legal',
  'financial',
] as const
export type RiskRegisterCategory = (typeof RISK_REGISTER_CATEGORIES)[number]

export const RISK_REGISTER_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const
export type RiskRegisterSeverity = (typeof RISK_REGISTER_SEVERITIES)[number]

export const RISK_REGISTER_STATUSES = [
  'open',
  'mitigating',
  'accepted',
  'transferred',
  'closed',
] as const
export type RiskRegisterStatus = (typeof RISK_REGISTER_STATUSES)[number]

export const RISK_MITIGATION_STATUSES = [
  'planned',
  'in_progress',
  'completed',
  'blocked',
] as const
export type RiskMitigationStatus = (typeof RISK_MITIGATION_STATUSES)[number]

const SEVERITY_RANK: Record<RiskRegisterSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
}

/** Ordered comparator: critical first, low last. */
export function compareSeverityDesc(
  a: RiskRegisterSeverity,
  b: RiskRegisterSeverity,
): number {
  return SEVERITY_RANK[b] - SEVERITY_RANK[a]
}

/** True when a risk in this status still demands action. */
export function isOpenRisk(status: RiskRegisterStatus): boolean {
  return status === 'open' || status === 'mitigating'
}

// ── Validation schemas (zod) ──────────────────────────────────────────────

export const riskRegisterCategorySchema = z.enum(RISK_REGISTER_CATEGORIES)
export const riskRegisterSeveritySchema = z.enum(RISK_REGISTER_SEVERITIES)
export const riskRegisterStatusSchema = z.enum(RISK_REGISTER_STATUSES)
export const riskMitigationStatusSchema = z.enum(RISK_MITIGATION_STATUSES)
