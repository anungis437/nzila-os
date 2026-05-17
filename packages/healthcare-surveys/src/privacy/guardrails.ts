import type { HealthcareSurveyTemplate } from '../types'

const PROHIBITED_PATTERNS = [
  /patient\s*name/i,
  /patient\s*id/i,
  /employee\s*name/i,
  /nurse\s*name/i,
  /manager\s*name/i,
  /email/i,
  /grievance/i,
]

export const FREE_TEXT_WARNING =
  'Please do not include names, patient details, manager names, grievance details, or identifying details.'

export function containsProhibitedPrompting(text: string): boolean {
  return PROHIBITED_PATTERNS.some((pattern) => pattern.test(text))
}

export function assertTemplatePrivacySafe(template: HealthcareSurveyTemplate): void {
  for (const question of template.questions) {
    if (containsProhibitedPrompting(question.text)) {
      throw new Error(`Question ${question.id} includes prohibited identifying prompt language`)
    }
  }
}

export function shouldWarnLowResponses(responseCount: number): boolean {
  return responseCount < 5
}

export function shouldBlockHighConfidence(responseCount: number): boolean {
  return responseCount < 10
}

export function assertDistributionMessageSafe(message: string): void {
  const banned = [/grievance\s*intake/i, /base44/i]
  if (banned.some((pattern) => pattern.test(message))) {
    throw new Error('Distribution message contains disallowed language')
  }

  const lower = message.toLowerCase()
  if (lower.includes('employer audit') && !lower.includes('not an employer audit')) {
    throw new Error('Distribution message implies employer-audit framing')
  }

  if (lower.includes('patient name') && !lower.includes('do not include patient names')) {
    throw new Error('Distribution message must not request patient names')
  }
}
