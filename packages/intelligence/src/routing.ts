/**
 * @nzila/intelligence — Adaptive Capability Routing
 */

import type {
  CapabilityRouteDecision,
  IntelligenceCapability,
  IntelligenceRequest,
} from './types'
import { getCapabilityHealth, listCapabilities } from './registry'

function tokenizeUseCase(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/[\s_-]+/)
    .filter((token) => token.length > 1)
}

function overlapScore(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const setB = new Set(b)
  const overlap = a.filter((token) => setB.has(token)).length
  return overlap / Math.max(a.length, b.length)
}

function parseSemverWeight(version: string): number {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!match) return 0.5
  const major = Number(match[1])
  const minor = Number(match[2])
  const patch = Number(match[3])
  // Compress semver into a bounded score in [0, 1].
  const raw = major * 100 + minor * 10 + patch
  return Math.min(1, raw / 1000)
}

function scoreCapability(capability: IntelligenceCapability, request: IntelligenceRequest): number {
  const useCaseTokens = tokenizeUseCase(request.useCase)
  const capabilityUseCases = capability.useCases.map((useCase) => tokenizeUseCase(useCase).join(' '))

  let bestLexicalFit = 0
  for (const candidate of capability.useCases) {
    const candidateTokens = tokenizeUseCase(candidate)
    const score = overlapScore(useCaseTokens, candidateTokens)
    if (score > bestLexicalFit) bestLexicalFit = score
  }

  const exactMatchBoost = capabilityUseCases.includes(useCaseTokens.join(' ')) ? 1 : 0
  const health = getCapabilityHealth(capability.id)
  const healthScore = health ? health.availabilityScore : 0.5
  const versionScore = parseSemverWeight(capability.version)

  // Weighted blend: lexical fit + exact match + runtime reliability + maturity.
  return (
    bestLexicalFit * 0.4 +
    exactMatchBoost * 0.15 +
    healthScore * 0.35 +
    versionScore * 0.1
  )
}

/**
 * Select the best capability for a request and expose alternatives for
 * explainability/fallback orchestration.
 */
export function routeCapability(request: IntelligenceRequest): CapabilityRouteDecision {
  const candidates = listCapabilities(request.app).filter((capability) =>
    capability.useCases.some((useCase) =>
      tokenizeUseCase(useCase).some((token) => tokenizeUseCase(request.useCase).includes(token)),
    ),
  )

  if (candidates.length === 0) {
    return {
      selected: undefined,
      alternatives: [],
      reason: 'No candidate capability matched the request use-case',
    }
  }

  const ranked = candidates
    .map((capability) => ({ capability, score: scoreCapability(capability, request) }))
    .sort((a, b) => b.score - a.score)

  return {
    selected: ranked[0]?.capability,
    alternatives: ranked.slice(1).map((r) => r.capability),
    reason: `Selected highest-scoring capability using lexical-fit and health routing (${ranked[0]?.score.toFixed(3) ?? '0.000'})`,
  }
}
