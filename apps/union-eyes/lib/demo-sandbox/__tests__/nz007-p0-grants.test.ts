/**
 * EC-007-01 grant allow/deny on the existing external authorization evaluators.
 * The synthetic rows come from the demo sandbox fixture. No new schema.
 */
import { describe, expect, it } from 'vitest';
import {
  evaluateExternalDocumentAccess,
  evaluateExternalMatterAccess,
} from '@/lib/services/external-resource-authorization-service';
import { failCloseDemoCopy, SANDBOX_BANNER } from '../../../../union-eyes-demo/lib/demo/sandbox/claim-labels';
import {
  createOfferedHandoff,
  isActiveInSpecialistQueue,
  transitionHandoff,
} from '../../../../union-eyes-demo/lib/demo/sandbox/handoff';
import {
  evaluateSandboxDocumentAccess,
  projectSandboxForPersona,
} from '../../../../union-eyes-demo/lib/demo/sandbox/journey';
import { buildSandboxSeed, SANDBOX_IDS, SANDBOX_NOW } from '../../../../union-eyes-demo/lib/demo/sandbox/seed';

describe('NZ-007 sandbox grants on existing evaluators', () => {
  const seed = buildSandboxSeed();
  const actor = {
    userId: seed.authority.representativeUserId,
    representativeOrganizationId: seed.authority.representativeOrganizationId,
  };

  it('allows the granted matter and document and denies the hidden document', () => {
    const matter = evaluateExternalMatterAccess({
      actor,
      organizationId: seed.organizationId,
      matterType: seed.matter.matterType,
      matterId: seed.matter.id,
      requiredPermission: 'view',
      authority: seed.authority,
      matterGrant: seed.matterGrant,
      now: SANDBOX_NOW,
    });
    expect(matter).toEqual(expect.objectContaining({ allowed: true, reason: 'allowed' }));

    const allowed = evaluateExternalDocumentAccess({
      actor,
      organizationId: seed.organizationId,
      matterType: seed.matter.matterType,
      matterId: seed.matter.id,
      documentId: SANDBOX_IDS.allowedDocumentId,
      requiredPermission: 'view',
      authority: seed.authority,
      matterGrant: seed.matterGrant,
      documentGrant: seed.documentGrants[0],
      now: SANDBOX_NOW,
    });
    expect(allowed).toEqual(expect.objectContaining({ allowed: true, reason: 'allowed' }));

    const hidden = evaluateExternalDocumentAccess({
      actor,
      organizationId: seed.organizationId,
      matterType: seed.matter.matterType,
      matterId: seed.matter.id,
      documentId: SANDBOX_IDS.hiddenDocumentId,
      requiredPermission: 'view',
      authority: seed.authority,
      matterGrant: seed.matterGrant,
      documentGrant: undefined,
      now: SANDBOX_NOW,
    });
    expect(hidden).toEqual(expect.objectContaining({
      allowed: false,
      reason: 'document_grant_missing',
    }));

    expect(evaluateSandboxDocumentAccess(seed, actor.userId, SANDBOX_IDS.allowedDocumentId).allowed).toBe(true);
    expect(evaluateSandboxDocumentAccess(seed, actor.userId, SANDBOX_IDS.hiddenDocumentId).reason).toBe(
      'document_grant_missing',
    );
  });

  it('fails closed for a different actor and keeps the specialist projection claim-safe', () => {
    const outsider = evaluateExternalMatterAccess({
      actor: { userId: seed.authority.createdBy, representativeOrganizationId: seed.specialistOrganizationId },
      organizationId: seed.organizationId,
      matterType: seed.matter.matterType,
      matterId: seed.matter.id,
      requiredPermission: 'view',
      authority: seed.authority,
      matterGrant: seed.matterGrant,
      now: SANDBOX_NOW,
    });
    expect(outsider.allowed).toBe(false);

    const projection = projectSandboxForPersona({ seed, personaId: 'external_specialist' });
    expect(JSON.stringify(projection)).not.toContain('Synthetic identity packet');
    expect(projection.banner).toBe(SANDBOX_BANNER);
    expect(failCloseDemoCopy('PROVEN WSIB').text).not.toMatch(/proven\s+wsib/i);
  });

  it('keeps the specialist queue inactive until view access is acknowledged', () => {
    const offered = createOfferedHandoff({ seed });
    expect(isActiveInSpecialistQueue(offered)).toBe(false);
    const accepted = transitionHandoff(offered, 'acknowledge', seed.authority.representativeUserId);
    expect(accepted.ok).toBe(true);
    if (accepted.ok) {
      expect(accepted.handoff.state).toBe('ACCEPTED_VIEW');
      expect(isActiveInSpecialistQueue(accepted.handoff)).toBe(true);
    }
  });
});
