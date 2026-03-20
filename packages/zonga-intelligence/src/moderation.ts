/**
 * @nzila/zonga-intelligence — Content Moderation Engine
 *
 * Rule-based content moderation with configurable thresholds.
 * Designed to be augmented with AI models in production.
 */
import type { ModerationCategory, ModerationVerdict } from './types'

// ── Default Moderation Rules ──────────────────────────────────────────────

export interface ModerationRule {
  readonly name: string
  readonly patterns: readonly RegExp[]
  readonly threshold: number // if matched count / total words > threshold → flagged
  readonly severity: 'low' | 'medium' | 'high'
}

/**
 * Built-in moderation rules for text content.
 * These are basic heuristics — production should use trained ML models.
 */
const TEXT_MODERATION_RULES: readonly ModerationRule[] = [
  {
    name: 'explicit_content',
    patterns: [], // patterns omitted — populated by loaded dictionaries in prod
    threshold: 0.05,
    severity: 'medium',
  },
  {
    name: 'hate_speech',
    patterns: [],
    threshold: 0.01,
    severity: 'high',
  },
  {
    name: 'violence',
    patterns: [],
    threshold: 0.03,
    severity: 'high',
  },
  {
    name: 'spam',
    patterns: [/\b(buy now|click here|free money|act fast)\b/i],
    threshold: 0.02,
    severity: 'low',
  },
  {
    name: 'contact_info',
    patterns: [
      /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, // Phone numbers
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Emails
    ],
    threshold: 0.01,
    severity: 'low',
  },
]

// ── Text Analysis ─────────────────────────────────────────────────────────

/**
 * Analyze text content against moderation rules.
 */
export function analyzeText(
  text: string,
  rules?: readonly ModerationRule[],
): ModerationCategory[] {
  const effectiveRules = rules ?? TEXT_MODERATION_RULES
  const words = text.split(/\s+/).filter(Boolean)
  const wordCount = Math.max(words.length, 1)

  return effectiveRules.map((rule) => {
    let matchCount = 0
    for (const pattern of rule.patterns) {
      const matches = text.match(new RegExp(pattern.source, 'gi'))
      matchCount += matches?.length ?? 0
    }

    const score = Math.min(1, matchCount / wordCount)
    return {
      name: rule.name,
      score: Math.round(score * 1000) / 1000,
      threshold: rule.threshold,
      triggered: score > rule.threshold,
    }
  })
}

/**
 * Determine moderation verdict from category scores.
 */
export function determineVerdict(
  categories: readonly ModerationCategory[],
): { verdict: ModerationVerdict; requiresHumanReview: boolean } {
  const triggered = categories.filter((c) => c.triggered)

  if (triggered.length === 0) {
    return { verdict: 'approved', requiresHumanReview: false }
  }

  // Any high-severity category triggered → reject
  const highSeverityRules = TEXT_MODERATION_RULES.filter((r) => r.severity === 'high')
  const highSeverityTriggered = triggered.some((t) =>
    highSeverityRules.some((r) => r.name === t.name),
  )

  if (highSeverityTriggered) {
    return { verdict: 'rejected', requiresHumanReview: true }
  }

  // Medium severity → needs review
  const mediumSeverityRules = TEXT_MODERATION_RULES.filter((r) => r.severity === 'medium')
  const mediumTriggered = triggered.some((t) =>
    mediumSeverityRules.some((r) => r.name === t.name),
  )

  if (mediumTriggered) {
    return { verdict: 'needs_review', requiresHumanReview: true }
  }

  // Low severity only → flag but approve
  return { verdict: 'flagged', requiresHumanReview: false }
}
