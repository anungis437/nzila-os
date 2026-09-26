/**
 * EC-007-02 — handoff acknowledgement UX.
 *
 * States are product UX, tied to an existing representation grant.
 * They are not a legal status and they do not move responsibility.
 */

import { SANDBOX_IDS, type SandboxSeed } from './seed';
import { SANDBOX_USER_IDS } from './personas';

export type HandoffUxState =
  | 'OFFERED'
  | 'ACCEPTED_VIEW'
  | 'RETURNED'
  | 'AWAITING_EXTERNAL'
  | 'REJECTED'
  | 'CLARIFY';

export type HandoffAction =
  | 'acknowledge'
  | 'return'
  | 'await_external'
  | 'reject'
  | 'clarify';

export interface HandoffPackage {
  id: string;
  authorityId: string;
  matterGrantId: string;
  matterId: string;
  state: HandoffUxState;
  offeredByUserId: string;
  acknowledgedByUserId: string | null;
}

export interface HandoffQueueConfig {
  /** When true, the specialist queue stays inactive until ACCEPTED_VIEW. */
  requireAcknowledgementBeforeActiveQueue: boolean;
}

export const DEFAULT_HANDOFF_QUEUE_CONFIG: HandoffQueueConfig = {
  requireAcknowledgementBeforeActiveQueue: true,
};

const ACK_REQUIRED_ACTIVE: ReadonlySet<HandoffUxState> = new Set([
  'ACCEPTED_VIEW',
  'AWAITING_EXTERNAL',
]);

const ACK_OPTIONAL_ACTIVE: ReadonlySet<HandoffUxState> = new Set([
  'OFFERED',
  'ACCEPTED_VIEW',
  'AWAITING_EXTERNAL',
]);

const TRANSITIONS: Record<HandoffUxState, Partial<Record<HandoffAction, HandoffUxState>>> = {
  OFFERED: {
    acknowledge: 'ACCEPTED_VIEW',
    return: 'RETURNED',
    await_external: 'AWAITING_EXTERNAL',
    reject: 'REJECTED',
    clarify: 'CLARIFY',
  },
  ACCEPTED_VIEW: {
    return: 'RETURNED',
    await_external: 'AWAITING_EXTERNAL',
    reject: 'REJECTED',
    clarify: 'CLARIFY',
  },
  RETURNED: {},
  AWAITING_EXTERNAL: {
    return: 'RETURNED',
    clarify: 'CLARIFY',
  },
  REJECTED: {
    clarify: 'CLARIFY',
  },
  CLARIFY: {
    acknowledge: 'ACCEPTED_VIEW',
    reject: 'REJECTED',
  },
};

export function readHandoffQueueConfig(
  env: Record<string, string | undefined> = process.env,
): HandoffQueueConfig {
  const raw = (env.DEMO_SANDBOX_REQUIRE_HANDOFF_ACK ?? '').trim().toLowerCase();
  if (raw === '0' || raw === 'false' || raw === 'no') {
    return { requireAcknowledgementBeforeActiveQueue: false };
  }
  return DEFAULT_HANDOFF_QUEUE_CONFIG;
}

export function createOfferedHandoff(input: {
  seed: SandboxSeed;
  offeredByUserId?: string;
}): HandoffPackage {
  const offeredByUserId = input.offeredByUserId ?? SANDBOX_USER_IDS.institutionalAdmin;
  if (offeredByUserId !== SANDBOX_USER_IDS.institutionalAdmin) {
    throw new Error('Only the institutional admin persona can offer this access package');
  }
  if (input.seed.authority.id !== SANDBOX_IDS.authorityId) {
    throw new Error('Handoff must be tied to the representation grant');
  }
  if (input.seed.matterGrant.id !== SANDBOX_IDS.matterGrantId) {
    throw new Error('Handoff must be tied to the matter access grant');
  }
  if (input.seed.matterGrant.authorityId !== input.seed.authority.id) {
    throw new Error('Handoff must be tied to the representation grant');
  }

  return {
    id: SANDBOX_IDS.handoffId,
    authorityId: input.seed.authority.id,
    matterGrantId: input.seed.matterGrant.id,
    matterId: input.seed.matter.id,
    state: 'OFFERED',
    offeredByUserId,
    acknowledgedByUserId: null,
  };
}

export function transitionHandoff(
  handoff: HandoffPackage,
  action: HandoffAction,
  actorUserId: string,
): { ok: true; handoff: HandoffPackage } | { ok: false; reason: string } {
  const next = TRANSITIONS[handoff.state][action];
  if (!next) {
    return { ok: false, reason: `Cannot ${action} from ${handoff.state}` };
  }

  if (action === 'acknowledge' && actorUserId !== SANDBOX_USER_IDS.externalSpecialist) {
    return { ok: false, reason: 'Only the external specialist can acknowledge view access' };
  }

  return {
    ok: true,
    handoff: {
      ...handoff,
      state: next,
      acknowledgedByUserId:
        next === 'ACCEPTED_VIEW' ? actorUserId : handoff.acknowledgedByUserId,
    },
  };
}

export function isActiveInSpecialistQueue(
  handoff: HandoffPackage | null,
  config: HandoffQueueConfig = DEFAULT_HANDOFF_QUEUE_CONFIG,
): boolean {
  if (!handoff) return false;
  const active = config.requireAcknowledgementBeforeActiveQueue
    ? ACK_REQUIRED_ACTIVE
    : ACK_OPTIONAL_ACTIVE;
  return active.has(handoff.state);
}
