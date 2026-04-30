import { commerceRules } from '../commerce/rules'
import { applyJurisdictionModifiers } from '../jurisdiction'
import { labourRules } from '../labour/rules'
import { legalRules } from '../legal/rules'
import { mediaRightsRules } from '../media-rights/rules'
import { resolvePolicyDecisions } from './resolver'
import { buildOverrideSignals } from './signals'
import type {
  DomainName,
  DomainRule,
  PolicyContext,
  PolicyDecision,
  PolicyResolution,
} from './types'
import type { OverrideSignalSummary } from './signals'

export interface EvaluatePoliciesResult {
  decisions: PolicyDecision[]
  resolution: PolicyResolution
  signals: OverrideSignalSummary
}

const domainRuleRegistry: Record<DomainName, DomainRule[]> = {
  labour: labourRules,
  legal: legalRules,
  commerce: commerceRules,
  'media-rights': mediaRightsRules,
}

function policyVersionFromContext(context: PolicyContext): string {
  const fromPayload = context.payload?.['policyVersion']
  if (typeof fromPayload === 'string' && fromPayload.trim().length > 0) return fromPayload.trim()
  return process.env.NZILA_POLICY_VERSION ?? 'v1'
}

function isV2OrHigher(version: string): boolean {
  const match = /^v?(\d+)/i.exec(version)
  if (!match || !match[1]) return false
  return Number(match[1]) >= 2
}

function applyVersionModifiers(
  context: PolicyContext,
  decisions: PolicyDecision[],
  policyVersion: string,
): PolicyDecision[] {
  if (!isV2OrHigher(policyVersion)) return decisions

  return decisions.map((decision) => {
    if (
      decision.level === 'WARN' &&
      context.metadata.anomalyScore >= 0.7 &&
      context.action.sensitivity !== 'low'
    ) {
      return {
        ...decision,
        level: 'CHALLENGE',
        requiresApproval: true,
        requiresJustification: true,
        reason: `${decision.reason} | v2 escalation: elevated anomaly requires challenge.`,
      }
    }
    return decision
  })
}

function selectDomains(context: PolicyContext): DomainName[] {
  if (context.domain) return [context.domain]
  return ['labour', 'legal', 'commerce', 'media-rights']
}

export function evaluatePolicies(context: PolicyContext): PolicyDecision[] {
  const domains = selectDomains(context)
  const policyVersion = policyVersionFromContext(context)
  const decisions: PolicyDecision[] = []

  for (const domain of domains) {
    const rules = domainRuleRegistry[domain] ?? []
    for (const rule of rules) {
      const decision = rule.evaluate(context)
      if (decision) {
        decisions.push({
          ...decision,
          policyVersion,
        })
      }
    }
  }

  return applyVersionModifiers(context, decisions, policyVersion)
}

export function evaluatePoliciesWithResolution(context: PolicyContext): EvaluatePoliciesResult {
  const raw = evaluatePolicies(context)
  const jurisdictionAdjusted = applyJurisdictionModifiers(context, raw)
  const resolution = resolvePolicyDecisions(jurisdictionAdjusted)
  const signals = buildOverrideSignals(context, jurisdictionAdjusted)

  return {
    decisions: jurisdictionAdjusted,
    resolution,
    signals,
  }
}
