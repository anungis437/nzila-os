/**
 * ARTIFACT TYPE: Priority Model (pure)
 * MODULE: OCRA Dynamic Questionnaire Adaptation
 *
 * Sorts included questions for presentation. Stable, deterministic:
 * ties resolve on `section` (alphabetical) and finally on `order`.
 */

import type { RoutableQuestion } from './routingTypes';

const BAND_RANK: Record<'core' | 'required' | 'recommended' | 'contextual', number> = {
  core: 0,
  required: 1,
  recommended: 2,
  contextual: 3,
};

export interface PrioritizedQuestion {
  readonly question: RoutableQuestion;
  readonly band: 'core' | 'required' | 'recommended' | 'contextual';
}

/**
 * Sort by (band rank, original section, original order). Stable; never
 * shuffles questions inside the same band/section/order.
 */
export function prioritize(items: readonly PrioritizedQuestion[]): readonly PrioritizedQuestion[] {
  return [...items].sort((a, b) => {
    const rankDiff = BAND_RANK[a.band] - BAND_RANK[b.band];
    if (rankDiff !== 0) return rankDiff;
    if (a.question.section !== b.question.section) {
      return a.question.section < b.question.section ? -1 : 1;
    }
    return a.question.order - b.question.order;
  });
}
