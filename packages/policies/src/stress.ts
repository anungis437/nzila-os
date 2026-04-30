import { evaluatePoliciesWithResolution, toPolicyContext } from './index'
import type { DomainName, LegacyPolicyContext, PolicyDecisionLevel } from './types'

type ExpectedOutcome = 'allow' | 'block' | 'override'

export interface PolicyStressSummary {
  domain: DomainName
  totalCases: number
  allowCount: number
  warnCount: number
  challengeCount: number
  blockCount: number
  overrideCount: number
  falsePositives: number
  falseNegatives: number
  overrideRate: number
  decisionDistribution: Record<PolicyDecisionLevel, number>
  accuracy: number
}

export interface PolicyStressResult {
  generatedAt: string
  domains: PolicyStressSummary[]
  totals: {
    totalCases: number
    falsePositives: number
    falseNegatives: number
    accuracy: number
  }
}

export interface PolicyRegressionDomainSummary {
  domain: DomainName
  baselineDecisionDistribution: Record<PolicyDecisionLevel, number>
  candidateDecisionDistribution: Record<PolicyDecisionLevel, number>
  changedDecisions: number
  regressionRate: number
  riskFlag: 'low' | 'medium' | 'high'
}

export interface PolicyRegressionAnalysisResult {
  generatedAt: string
  baselineVersion: string
  candidateVersion: string
  perDomain: number
  totalChangedDecisions: number
  overallRegressionRate: number
  riskFlag: 'low' | 'medium' | 'high'
  domains: PolicyRegressionDomainSummary[]
}

const domains: DomainName[] = ['labour', 'legal', 'commerce', 'media-rights']

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick<T>(values: T[]): T {
  return values[randomInt(0, values.length - 1)] as T
}

function buildCase(domain: DomainName, index: number): { context: LegacyPolicyContext; expected: ExpectedOutcome } {
  const isOverride = index % 3 === 1
  const isBlock = index % 3 === 2

  const actorRole = isOverride ? 'platform_admin' : pick(['viewer', 'ops', 'platform_admin'])
  const base: LegacyPolicyContext = {
    orgId: `org-${String(index % 100).padStart(3, '0')}`,
    actorId: `actor-${index}`,
    actorRole,
    domain,
    action: `stress:${domain}`,
    resource: `${domain}:resource:${index}`,
    environment: pick(['dev', 'staging', 'production']),
    payload: {},
    overrideReason: isOverride ? `override-${domain}-${index}` : undefined,
    ticketRef: isOverride ? `TKT-${domain.toUpperCase()}-${index}` : undefined,
  }

  switch (domain) {
    case 'labour': {
      const piiRedacted = !isBlock
      const mutatesCollectiveAgreement = isOverride || isBlock
      const seniorSignoff = !isBlock
      base.payload = { piiRedacted, mutatesCollectiveAgreement, seniorSignoff }
      break
    }
    case 'legal': {
      const citationCount = isBlock ? 0 : randomInt(1, 4)
      const riskLevel = isOverride || isBlock ? pick(['high', 'critical']) : pick(['low', 'medium'])
      const humanReviewed = !isBlock
      base.payload = { citationCount, riskLevel, humanReviewed }
      break
    }
    case 'commerce': {
      const floorPrice = randomInt(25, 250)
      const nextPrice = isBlock ? floorPrice - randomInt(1, 20) : floorPrice + randomInt(1, 30)
      const plannedSpend = isOverride || isBlock ? randomInt(6000, 25000) : randomInt(1000, 4500)
      const approvalThreshold = 5000
      const budgetApproved = !isBlock
      base.payload = { floorPrice, nextPrice, plannedSpend, approvalThreshold, budgetApproved }
      break
    }
    case 'media-rights': {
      const withinRightsWindow = !isBlock
      const payoutDeltaPct = isOverride || isBlock ? randomInt(10, 30) : randomInt(1, 9)
      const producerApproved = !isBlock
      base.payload = { withinRightsWindow, payoutDeltaPct, producerApproved }
      break
    }
  }

  const expected: ExpectedOutcome = isBlock ? 'block' : isOverride ? 'override' : 'allow'
  return { context: base, expected }
}

function actualOutcome(level: PolicyDecisionLevel): ExpectedOutcome {
  if (level === 'BLOCK') return 'block'
  if (level === 'CHALLENGE') return 'override'
  return 'allow'
}

export function runPolicyStressTest(perDomain = 60, policyVersion?: string): PolicyStressResult {
  const summaries: PolicyStressSummary[] = []

  for (const domain of domains) {
    let allowCount = 0
    let warnCount = 0
    let challengeCount = 0
    let blockCount = 0
    let overrideCount = 0
    let falsePositives = 0
    let falseNegatives = 0
    const decisionDistribution: Record<PolicyDecisionLevel, number> = {
      ALLOW: 0,
      WARN: 0,
      CHALLENGE: 0,
      BLOCK: 0,
    }

    for (let i = 0; i < perDomain; i += 1) {
      const { context, expected } = buildCase(domain, i)
      if (policyVersion) context.policyVersion = policyVersion
      const result = evaluatePoliciesWithResolution(toPolicyContext(context))
      const level = result.resolution.finalDecision.level
      const actual = actualOutcome(level)

      decisionDistribution[level] += 1

      if (actual === 'allow') allowCount += 1
      if (level === 'WARN') warnCount += 1
      if (level === 'CHALLENGE') challengeCount += 1
      if (actual === 'block') blockCount += 1
      if (actual === 'override') overrideCount += 1

      if (expected === 'allow' && actual !== 'allow') falsePositives += 1
      if (expected !== 'allow' && actual === 'allow') falseNegatives += 1
    }

    const totalCases = perDomain
    const correct = totalCases - falsePositives - falseNegatives

    summaries.push({
      domain,
      totalCases,
      allowCount,
      warnCount,
      challengeCount,
      blockCount,
      overrideCount,
      falsePositives,
      falseNegatives,
      overrideRate: Number((overrideCount / Math.max(totalCases, 1)).toFixed(4)),
      decisionDistribution,
      accuracy: Number((correct / totalCases).toFixed(4)),
    })
  }

  const totalCases = summaries.reduce((acc, row) => acc + row.totalCases, 0)
  const falsePositives = summaries.reduce((acc, row) => acc + row.falsePositives, 0)
  const falseNegatives = summaries.reduce((acc, row) => acc + row.falseNegatives, 0)
  const accuracy = totalCases > 0 ? Number(((totalCases - falsePositives - falseNegatives) / totalCases).toFixed(4)) : 1

  return {
    generatedAt: new Date().toISOString(),
    domains: summaries,
    totals: {
      totalCases,
      falsePositives,
      falseNegatives,
      accuracy,
    },
  }
}

function riskFromRate(rate: number): 'low' | 'medium' | 'high' {
  if (rate >= 0.2) return 'high'
  if (rate >= 0.08) return 'medium'
  return 'low'
}

export function runPolicyRegressionAnalysis(
  candidateVersion: string,
  baselineVersion = 'v1',
  perDomain = 75,
): PolicyRegressionAnalysisResult {
  const domainsSummary: PolicyRegressionDomainSummary[] = []
  let totalChangedDecisions = 0
  const totalCases = perDomain * domains.length

  for (const domain of domains) {
    const baselineDistribution: Record<PolicyDecisionLevel, number> = {
      ALLOW: 0,
      WARN: 0,
      CHALLENGE: 0,
      BLOCK: 0,
    }
    const candidateDistribution: Record<PolicyDecisionLevel, number> = {
      ALLOW: 0,
      WARN: 0,
      CHALLENGE: 0,
      BLOCK: 0,
    }

    let changedDecisions = 0
    for (let i = 0; i < perDomain; i += 1) {
      const baselineCase = buildCase(domain, i).context
      baselineCase.policyVersion = baselineVersion
      const baselineDecision = evaluatePoliciesWithResolution(toPolicyContext(baselineCase)).resolution.finalDecision.level
      baselineDistribution[baselineDecision] += 1

      const candidateCase = buildCase(domain, i).context
      candidateCase.policyVersion = candidateVersion
      const candidateDecision = evaluatePoliciesWithResolution(toPolicyContext(candidateCase)).resolution.finalDecision.level
      candidateDistribution[candidateDecision] += 1

      if (baselineDecision !== candidateDecision) changedDecisions += 1
    }

    totalChangedDecisions += changedDecisions
    const regressionRate = Number((changedDecisions / Math.max(perDomain, 1)).toFixed(4))
    domainsSummary.push({
      domain,
      baselineDecisionDistribution: baselineDistribution,
      candidateDecisionDistribution: candidateDistribution,
      changedDecisions,
      regressionRate,
      riskFlag: riskFromRate(regressionRate),
    })
  }

  const overallRegressionRate = Number((totalChangedDecisions / Math.max(totalCases, 1)).toFixed(4))
  return {
    generatedAt: new Date().toISOString(),
    baselineVersion,
    candidateVersion,
    perDomain,
    totalChangedDecisions,
    overallRegressionRate,
    riskFlag: riskFromRate(overallRegressionRate),
    domains: domainsSummary,
  }
}
