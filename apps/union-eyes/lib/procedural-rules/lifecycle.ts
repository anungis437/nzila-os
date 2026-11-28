/**
 * Adoption lifecycle: draft → reviewed → adopted (→ superseded | retired). Pure decision; the service persists it.
 *
 * - A reviewer must be a person other than the drafter.
 * - An adopter must be a person other than the drafter (the reviewer may adopt).
 * - Content is frozen once reviewed: a change makes a new draft version.
 * - An AI-assisted extraction only ever creates a draft. It is never a reviewer or adopter: only a human actor can move a
 *   rule past draft.
 */
import type { RuleLifecycleStatus, RuleOrigin } from './types';

export interface LifecycleActor {
  userId: string;
  kind: 'human' | 'automated';
}

export interface LifecycleSubject {
  status: RuleLifecycleStatus;
  origin: RuleOrigin;
  draftedBy: string;
  reviewedBy: string | null;
}

export type LifecycleDecision = { ok: true; next: RuleLifecycleStatus } | { ok: false; code: LifecycleRefusal; message: string };

export type LifecycleRefusal = 'illegal_transition' | 'automated_actor' | 'self_review' | 'self_adoption';

const ALLOWED: Record<RuleLifecycleStatus, RuleLifecycleStatus[]> = {
  draft: ['reviewed', 'retired'],
  reviewed: ['adopted', 'draft', 'retired'],
  adopted: ['superseded', 'retired'],
  superseded: [],
  retired: [],
};

export function decideLifecycleTransition(subject: LifecycleSubject, target: RuleLifecycleStatus, actor: LifecycleActor): LifecycleDecision {
  if (!ALLOWED[subject.status].includes(target)) {
    return { ok: false, code: 'illegal_transition', message: `A rule cannot move from ${subject.status} to ${target}.` };
  }
  if (actor.kind !== 'human') {
    return { ok: false, code: 'automated_actor', message: 'Only a human may review, adopt, supersede or retire a procedural rule.' };
  }
  if (target === 'reviewed' && actor.userId === subject.draftedBy) {
    return { ok: false, code: 'self_review', message: 'The reviewer must be someone other than the person who drafted the rule.' };
  }
  if (target === 'adopted' && actor.userId === subject.draftedBy) {
    return { ok: false, code: 'self_adoption', message: 'The adopter must be someone other than the person who drafted the rule.' };
  }
  return { ok: true, next: target };
}

/** The only status a newly created record may take, whatever its origin. */
export function initialStatusFor(_origin: RuleOrigin): 'draft' {
  return 'draft';
}
