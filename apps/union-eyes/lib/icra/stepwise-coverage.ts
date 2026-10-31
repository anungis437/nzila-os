import { ALL_QUESTIONS } from '@/lib/icra/questions'
import { classifyOrgContext, routeQuestionBank, type RoutableQuestion } from '@/lib/icra/adaptation'
import { validateRoutedSubmission } from '@/lib/icra/adaptation/routedSubmissionValidator'

/**
 * The step-by-step flow collects no organization context, so the questions it must cover are those the routing engine
 * requires for an unclassified organization, the same bank the one-shot route routes an empty context to. A submission
 * that leaves any of them unanswered is not a continuity profile, and is never scored as one.
 */
export function missingRequiredAnswerIds(answeredIds: Iterable<string>): string[] {
  const routed = routeQuestionBank(ALL_QUESTIONS as unknown as RoutableQuestion[], classifyOrgContext({ rawForm: {} }))
  return [...validateRoutedSubmission(routed, answeredIds).missingRequiredIds]
}
