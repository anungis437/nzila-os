/**
 * EC-007-01 specialist journey on the synthetic grant fixture.
 *
 * Local decisions mirror the existing external grant evaluators for this
 * seed (authority + matter grant + document grant). The union-eyes test
 * checks the same rows with evaluateExternalMatterAccess and
 * evaluateExternalDocumentAccess. Hidden documents fail closed: the
 * specialist projection omits the title.
 */

import {
  ACCESS_NOT_RESPONSIBILITY,
  failCloseDemoCopy,
  HANDOFF_ANTI_CLAIM,
  OVERCLAIM_FIXTURE,
  SANDBOX_BANNER,
  surfaceContainsOverclaim,
} from './claim-labels';
import {
  isActiveInSpecialistQueue,
  type HandoffPackage,
  type HandoffQueueConfig,
  DEFAULT_HANDOFF_QUEUE_CONFIG,
} from './handoff';
import { SANDBOX_PERSONA_IDS, SANDBOX_USER_IDS, type SandboxPersonaId } from './personas';
import {
  SANDBOX_IDS,
  SANDBOX_NOW,
  type SandboxDocumentGrantRow,
  type SandboxMatterGrantRow,
  type SandboxSeed,
} from './seed';

export type JourneyStepId =
  | 'entry'
  | 'matter'
  | 'allowed_documents'
  | 'blocked_document'
  | 'next_action';

export interface JourneyStep {
  id: JourneyStepId;
  label: string;
  outcome: 'shown' | 'blocked' | 'next';
  detail: string;
}

export interface GrantDecision {
  allowed: boolean;
  reason:
    | 'allowed'
    | 'authority_invalid'
    | 'matter_grant_invalid'
    | 'permission_missing'
    | 'document_grant_missing'
    | 'document_grant_invalid';
}

export interface PersonaProjection {
  disposition: 'DEMO_CONFIGURED';
  banner: string;
  accessNotResponsibility: string;
  handoffAntiClaim: string;
  personaId: SandboxPersonaId;
  queueActive: boolean;
  handoffState: HandoffPackage['state'] | null;
  matterTitle: string | null;
  steps: JourneyStep[];
  visibleDocumentTitles: string[];
  blockedDetail: string | null;
  memberStatus: string | null;
  viewerSummary: string | null;
  adminGrantLines: string[];
  sampleBrief: string;
}

function authorityMatches(seed: SandboxSeed, actorUserId: string, now: Date): boolean {
  const authority = seed.authority;
  return (
    authority.status === 'active' &&
    authority.revokedAt == null &&
    authority.effectiveAt <= now &&
    (authority.expiresAt == null || authority.expiresAt > now) &&
    authority.representativeUserId === actorUserId &&
    authority.organizationId === seed.organizationId &&
    authority.matterId === seed.matter.id
  );
}

function matterGrantActive(grant: SandboxMatterGrantRow, now: Date): boolean {
  return grant.status === 'active' && grant.revokedAt == null && (grant.expiresAt == null || grant.expiresAt > now);
}

function documentGrantActive(grant: SandboxDocumentGrantRow, now: Date): boolean {
  return grant.status === 'active' && grant.revokedAt == null && (grant.expiresAt == null || grant.expiresAt > now);
}

export function evaluateSandboxMatterAccess(
  seed: SandboxSeed,
  actorUserId: string,
  now: Date = SANDBOX_NOW,
): GrantDecision {
  if (!authorityMatches(seed, actorUserId, now)) {
    return { allowed: false, reason: 'authority_invalid' };
  }
  const grant = seed.matterGrant;
  const matches =
    grant.authorityId === seed.authority.id &&
    grant.userId === actorUserId &&
    grant.matterId === seed.matter.id &&
    matterGrantActive(grant, now);
  if (!matches) return { allowed: false, reason: 'matter_grant_invalid' };
  if (!grant.canView) return { allowed: false, reason: 'permission_missing' };
  return { allowed: true, reason: 'allowed' };
}

export function evaluateSandboxDocumentAccess(
  seed: SandboxSeed,
  actorUserId: string,
  documentId: string,
  now: Date = SANDBOX_NOW,
): GrantDecision {
  if (!authorityMatches(seed, actorUserId, now)) {
    return { allowed: false, reason: 'authority_invalid' };
  }
  const matter = seed.matterGrant;
  const matterMatches =
    matter.authorityId === seed.authority.id &&
    matter.userId === actorUserId &&
    matter.matterId === seed.matter.id &&
    matterGrantActive(matter, now);
  if (!matterMatches) return { allowed: false, reason: 'matter_grant_invalid' };
  if (!matter.canViewDocuments) return { allowed: false, reason: 'permission_missing' };

  const grant = seed.documentGrants.find((row) => row.documentId === documentId);
  if (!grant) return { allowed: false, reason: 'document_grant_missing' };
  const grantMatches =
    grant.authorityId === seed.authority.id &&
    grant.matterGrantId === matter.id &&
    grant.userId === actorUserId &&
    grant.documentId === documentId &&
    documentGrantActive(grant, now);
  if (!grantMatches) return { allowed: false, reason: 'document_grant_invalid' };
  if (!grant.canView) return { allowed: false, reason: 'permission_missing' };
  return { allowed: true, reason: 'allowed' };
}

function specialistSteps(seed: SandboxSeed, now: Date): JourneyStep[] {
  const actorUserId = SANDBOX_USER_IDS.externalSpecialist;
  const matter = evaluateSandboxMatterAccess(seed, actorUserId, now);
  const allowed = seed.documents.filter(
    (document) => evaluateSandboxDocumentAccess(seed, actorUserId, document.id, now).allowed,
  );
  const hidden = seed.documents.filter(
    (document) => !evaluateSandboxDocumentAccess(seed, actorUserId, document.id, now).allowed,
  );

  return [
    {
      id: 'entry',
      label: 'External specialist',
      outcome: 'shown',
      detail: 'Entry uses the synthetic external specialist persona. No counterpart login is issued.',
    },
    {
      id: 'matter',
      label: 'Matter',
      outcome: matter.allowed ? 'shown' : 'blocked',
      detail: matter.allowed
        ? `Open matter: ${seed.matter.title}`
        : 'Matter grant failed closed.',
    },
    {
      id: 'allowed_documents',
      label: 'Document grant',
      outcome: 'shown',
      detail:
        allowed.length > 0
          ? `Allowed documents: ${allowed.map((document) => document.title).join(', ')}`
          : 'No document grant is visible.',
    },
    {
      id: 'blocked_document',
      label: 'Document grant',
      outcome: 'blocked',
      detail:
        hidden.length > 0
          ? 'A document on this matter has no document grant. The request fails closed and the document stays hidden.'
          : 'No hidden document is configured.',
    },
    {
      id: 'next_action',
      label: 'Next action',
      outcome: 'next',
      detail:
        'Next action: stay on the granted document, or ask the institutional admin to clarify the handoff. View access is not a transfer of responsibility.',
    },
  ];
}

export function projectSandboxForPersona(input: {
  seed: SandboxSeed;
  personaId: SandboxPersonaId;
  handoff?: HandoffPackage | null;
  config?: HandoffQueueConfig;
  now?: Date;
}): PersonaProjection {
  const now = input.now ?? SANDBOX_NOW;
  const config = input.config ?? DEFAULT_HANDOFF_QUEUE_CONFIG;
  const handoff = input.handoff ?? null;
  const actorUserId = SANDBOX_USER_IDS.externalSpecialist;
  const allowedTitles = input.seed.documents
    .filter((document) => evaluateSandboxDocumentAccess(input.seed, actorUserId, document.id, now).allowed)
    .map((document) => document.title);
  const sampleBrief = failCloseDemoCopy(OVERCLAIM_FIXTURE).text;
  const queueActive = isActiveInSpecialistQueue(handoff, config);

  const base: PersonaProjection = {
    disposition: 'DEMO_CONFIGURED',
    banner: SANDBOX_BANNER,
    accessNotResponsibility: ACCESS_NOT_RESPONSIBILITY,
    handoffAntiClaim: HANDOFF_ANTI_CLAIM,
    personaId: input.personaId,
    queueActive,
    handoffState: handoff?.state ?? null,
    matterTitle: null,
    steps: [],
    visibleDocumentTitles: [],
    blockedDetail: null,
    memberStatus: null,
    viewerSummary: null,
    adminGrantLines: [],
    sampleBrief,
  };

  if (input.personaId === SANDBOX_PERSONA_IDS.member) {
    return {
      ...base,
      memberStatus:
        'Limited status: an external specialist may have view access on a matter. Document contents stay hidden.',
    };
  }

  if (input.personaId === SANDBOX_PERSONA_IDS.unionViewer) {
    return {
      ...base,
      matterTitle: input.seed.matter.title,
      viewerSummary: `Union viewer sees matter status only. Handoff: ${handoff?.state ?? 'not offered'}. Document titles stay hidden.`,
    };
  }

  if (input.personaId === SANDBOX_PERSONA_IDS.institutionalAdmin) {
    return {
      ...base,
      matterTitle: input.seed.matter.title,
      adminGrantLines: input.seed.documents.map((document) => {
        const granted = document.id === SANDBOX_IDS.allowedDocumentId;
        return `${document.title} — ${granted ? 'document grant' : 'hidden from external specialist'}`;
      }),
    };
  }

  const steps = specialistSteps(input.seed, now);
  const projection: PersonaProjection = {
    ...base,
    matterTitle: input.seed.matter.title,
    steps,
    visibleDocumentTitles: allowedTitles,
    blockedDetail: steps.find((step) => step.id === 'blocked_document')?.detail ?? null,
  };

  if (surfaceContainsOverclaim(projection)) {
    throw new Error('Sandbox projection failed closed: overclaim text leaked');
  }

  return projection;
}
