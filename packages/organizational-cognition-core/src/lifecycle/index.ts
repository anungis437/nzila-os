/**
 * Cognition Lifecycle
 *
 * Standard adaptation/deprecation policy for cognition engines.
 */

export type LifecycleStage = 'experimental' | 'stable' | 'deprecated' | 'retired';

export interface LifecyclePolicy {
  stage: LifecycleStage;
  /** ISO date when the stage was entered. */
  enteredAt: string;
  /** Optional notes for governance reviewers. */
  notes?: string;
  /** When deprecated, the migration target engine id. */
  migrateTo?: string;
}

export function isInvocable(policy: LifecyclePolicy): boolean {
  return policy.stage === 'experimental' || policy.stage === 'stable' || policy.stage === 'deprecated';
}
