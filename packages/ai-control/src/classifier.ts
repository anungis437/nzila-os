import type { OutputClassification } from './schemas'

// ─── Output Classifier ─────────────────────────────────────────────────────

export interface ClassificationRule {
  readonly id: string
  readonly pattern: RegExp
  readonly classification: OutputClassification
  readonly reason: string
}

export interface ClassificationResult {
  readonly classification: OutputClassification
  readonly matchedRules: string[]
  readonly reasons: string[]
}

// ─── Default Classification Rules ───────────────────────────────────────────

const DEFAULT_RESTRICTED_PATTERNS: ClassificationRule[] = [
  {
    id: 'pii-ssn',
    pattern: /\b\d{3}-\d{2}-\d{4}\b/,
    classification: 'restricted',
    reason: 'Contains potential SSN pattern',
  },
  {
    id: 'pii-credit-card',
    pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,
    classification: 'restricted',
    reason: 'Contains potential credit card number',
  },
]

const DEFAULT_WARNING_PATTERNS: ClassificationRule[] = [
  {
    id: 'email-address',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,
    classification: 'warning',
    reason: 'Contains email address',
  },
  {
    id: 'phone-number',
    pattern: /\b\+?\d{1,3}[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}\b/,
    classification: 'warning',
    reason: 'Contains potential phone number',
  },
]

// ─── Classifier ─────────────────────────────────────────────────────────────

export class OutputClassifier {
  private readonly rules: ClassificationRule[]

  constructor(rules?: ClassificationRule[]) {
    this.rules = rules ?? [...DEFAULT_RESTRICTED_PATTERNS, ...DEFAULT_WARNING_PATTERNS]
  }

  classify(content: string): ClassificationResult {
    const matchedRules: string[] = []
    const reasons: string[] = []
    let highestClassification: OutputClassification = 'safe'

    for (const rule of this.rules) {
      if (rule.pattern.test(content)) {
        matchedRules.push(rule.id)
        reasons.push(rule.reason)

        if (
          rule.classification === 'restricted' ||
          (rule.classification === 'warning' && highestClassification === 'safe')
        ) {
          highestClassification = rule.classification
        }
      }
    }

    return {
      classification: highestClassification,
      matchedRules,
      reasons,
    }
  }
}

export function classifyOutput(content: string): ClassificationResult {
  const classifier = new OutputClassifier()
  return classifier.classify(content)
}
