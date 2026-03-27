/**
 * @nzila/ue-assistant — Intent Classification Engine (Phase 2)
 *
 * Classifies every user query into a domain intent. Uses keyword-based
 * classification with fallback to 'unknown'. The classified intent
 * combined with role and context determines the execution path.
 */
import { IntentTypes, type IntentType, type UEAssistantRole } from './types'
import { isIntentAllowed } from './roles'

// ── Intent Keywords ─────────────────────────────────────────────────────────

const INTENT_KEYWORDS: Record<IntentType, readonly string[]> = {
  [IntentTypes.GRIEVANCE]: [
    'grievance', 'grieve', 'file a grievance', 'complaint', 'unfair treatment',
    'discipline', 'termination', 'fired', 'suspended', 'written up',
    'progressive discipline', 'unjust', 'wrongful',
  ],
  [IntentTypes.RIGHTS]: [
    'rights', 'entitled to', 'am i allowed', 'can i', 'my right',
    'union rights', 'weingarten', 'representation', 'duty of fair representation',
    'right to refuse', 'protected activity',
  ],
  [IntentTypes.CONTRACT]: [
    'contract', 'collective agreement', 'cba', 'clause', 'article',
    'section', 'provision', 'bargaining', 'collective bargaining',
    'seniority', 'overtime', 'scheduling',
  ],
  [IntentTypes.SAFETY]: [
    'safety', 'hazard', 'dangerous', 'injury', 'incident', 'accident',
    'ohs', 'occupational health', 'ppe', 'unsafe', 'emergency',
    'chemical', 'exposure', 'ergonomic', 'workplace violence',
  ],
  [IntentTypes.BENEFITS]: [
    'benefits', 'dental', 'medical', 'insurance', 'pension',
    'sick leave', 'vacation', 'leave of absence', 'maternity',
    'parental leave', 'disability', 'long-term disability', 'ltd',
    'health spending', 'coverage',
  ],
  [IntentTypes.VOTING]: [
    'vote', 'voting', 'election', 'ballot', 'ratification',
    'referendum', 'poll', 'nominate', 'candidate',
  ],
  [IntentTypes.EDUCATION]: [
    'training', 'education', 'course', 'workshop', 'learn',
    'certification', 'orientation', 'onboarding', 'webinar',
  ],
  [IntentTypes.NAVIGATION]: [
    'where', 'how do i find', 'navigate', 'go to', 'show me',
    'open', 'page', 'dashboard', 'settings', 'menu',
  ],
  [IntentTypes.CASE_ANALYSIS]: [
    'analyze case', 'case analysis', 'review case', 'case summary',
    'case status', 'case history', 'case timeline', 'case trend',
    'similar cases', 'precedent',
  ],
  [IntentTypes.DRAFTING]: [
    'draft', 'write', 'compose', 'prepare', 'template',
    'grievance letter', 'formal complaint', 'response letter',
  ],
  [IntentTypes.OVERSIGHT]: [
    'oversight', 'dashboard', 'workload', 'metrics', 'report',
    'aggregate', 'trend', 'cross-local', 'performance',
    'caseload', 'backlog',
  ],
  [IntentTypes.UNKNOWN]: [],
}

// ── Classification ──────────────────────────────────────────────────────────

export function classifyIntent(query: string): IntentType {
  const lower = query.toLowerCase()

  // Score each intent by number of keyword matches (weighted by specificity)
  let bestIntent: IntentType = IntentTypes.UNKNOWN
  let bestScore = 0

  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    if (intent === IntentTypes.UNKNOWN) continue
    let score = 0
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        // Multi-word keywords are more specific, weight them higher
        score += kw.split(' ').length
      }
    }
    if (score > bestScore) {
      bestScore = score
      bestIntent = intent as IntentType
    }
  }

  return bestIntent
}

/**
 * Classify intent and filter through role permissions. Returns the
 * classified intent only if the role is allowed to use it, otherwise
 * returns 'unknown'.
 */
export function classifyIntentForRole(
  query: string,
  role: UEAssistantRole,
): IntentType {
  const intent = classifyIntent(query)
  if (intent === IntentTypes.UNKNOWN) return intent
  return isIntentAllowed(role, intent) ? intent : IntentTypes.UNKNOWN
}

/**
 * Returns the confidence score for the classified intent. Higher scores
 * indicate stronger keyword matches.
 */
export function getIntentConfidence(query: string): number {
  const lower = query.toLowerCase()

  let totalScore = 0
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    if (intent === IntentTypes.UNKNOWN) continue
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        totalScore += kw.split(' ').length
      }
    }
  }

  // Normalize: 0 matches → 0.1, 1+ match → 0.5..0.95
  if (totalScore === 0) return 0.1
  return Math.min(0.95, 0.5 + totalScore * 0.1)
}
