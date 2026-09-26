import { describe, expect, it } from 'vitest';
import { failCloseDemoCopy, OVERCLAIM_FIXTURE, SANDBOX_BANNER, surfaceContainsOverclaim } from '../claim-labels';
import {
  createOfferedHandoff,
  isActiveInSpecialistQueue,
  readHandoffQueueConfig,
  transitionHandoff,
} from '../handoff';
import { evaluateSandboxDocumentAccess, projectSandboxForPersona } from '../journey';
import { formatPersonaLoadGuide, SANDBOX_PERSONAS } from '../personas';
import { buildSandboxSeed, SANDBOX_IDS } from '../seed';

describe('EC-007-06 synthetic personas', () => {
  it('seeds four demo-domain personas and never embeds password values', () => {
    expect(SANDBOX_PERSONAS.map((persona) => persona.id)).toEqual([
      'external_specialist',
      'institutional_admin',
      'union_viewer',
      'member',
    ]);
    for (const persona of SANDBOX_PERSONAS) {
      expect(persona.email.endsWith('@persona.demo.invalid')).toBe(true);
      expect(persona.passwordEnvVar).toMatch(/^DEMO_SANDBOX_[A-Z_]+_PASSWORD$/);
      expect(persona).not.toHaveProperty('password');
    }

    const guide = formatPersonaLoadGuide();
    expect(guide).toContain('Do not email passwords');
    expect(guide).not.toMatch(/password\s*[:=]\s*\S+/i);
    expect(guide.toLowerCase()).not.toContain('angelo');
    expect(guide.toLowerCase()).not.toContain('domenic');
  });
});

describe('EC-007-01 specialist journey', () => {
  it('is idempotent and scopes one granted document plus one hidden document', () => {
    const first = buildSandboxSeed();
    const second = buildSandboxSeed();
    expect(JSON.stringify(first)).toEqual(JSON.stringify(second));
    expect(first.documentGrants).toHaveLength(1);
    expect(first.documentGrants[0]?.documentId).toBe(SANDBOX_IDS.allowedDocumentId);
    expect(first.documents.map((document) => document.id)).toContain(SANDBOX_IDS.hiddenDocumentId);
    expect(first.disposition).toBe('DEMO_CONFIGURED');
  });

  it('shows the allowed document and fails closed on the hidden document', () => {
    const seed = buildSandboxSeed();
    const specialistId = seed.authority.representativeUserId;
    expect(evaluateSandboxDocumentAccess(seed, specialistId, SANDBOX_IDS.allowedDocumentId)).toEqual({
      allowed: true,
      reason: 'allowed',
    });
    expect(evaluateSandboxDocumentAccess(seed, specialistId, SANDBOX_IDS.hiddenDocumentId)).toEqual({
      allowed: false,
      reason: 'document_grant_missing',
    });

    const projection = projectSandboxForPersona({ seed, personaId: 'external_specialist' });
    expect(projection.steps.map((step) => step.id)).toEqual([
      'entry',
      'matter',
      'allowed_documents',
      'blocked_document',
      'next_action',
    ]);
    expect(projection.visibleDocumentTitles).toEqual(['Synthetic intake summary']);
    expect(JSON.stringify(projection)).not.toContain('Synthetic identity packet');
    expect(projection.steps.find((step) => step.id === 'blocked_document')?.outcome).toBe('blocked');
    expect(projection.steps.find((step) => step.id === 'next_action')?.detail).toMatch(/Next action/);
    expect(projection.disposition).toBe('DEMO_CONFIGURED');
  });

  it('keeps the member view limited', () => {
    const projection = projectSandboxForPersona({
      seed: buildSandboxSeed(),
      personaId: 'member',
    });
    expect(projection.memberStatus).toMatch(/Document contents stay hidden/);
    expect(projection.visibleDocumentTitles).toEqual([]);
    expect(JSON.stringify(projection)).not.toContain('Synthetic intake summary');
    expect(JSON.stringify(projection)).not.toContain('Synthetic identity packet');
  });
});

describe('EC-007-05 claim labels', () => {
  it('rewrites partnership, practice-system, and PROVEN compensation overclaims', () => {
    const result = failCloseDemoCopy(OVERCLAIM_FIXTURE);
    expect(result.rewritten).toBe(true);
    expect(result.blocked).toEqual(['partnership-agreed', 'clio-integrated', 'proven-wsib']);
    expect(result.text).not.toMatch(/partnership[-\s]?agreed/i);
    expect(result.text).not.toMatch(/clio[-\s]?integrated/i);
    expect(result.text).not.toMatch(/proven\s+wsib/i);
    expect(result.text).toContain('PROPOSED');
    expect(result.text).toContain('DEMO');

    const projection = projectSandboxForPersona({
      seed: buildSandboxSeed(),
      personaId: 'external_specialist',
    });
    expect(projection.banner).toBe(SANDBOX_BANNER);
    expect(surfaceContainsOverclaim(projection)).toBe(false);
  });
});

describe('EC-007-02 handoff acknowledgement', () => {
  it('requires specialist acknowledgement before the matter is active in the queue', () => {
    const seed = buildSandboxSeed();
    const offered = createOfferedHandoff({ seed });
    expect(offered.state).toBe('OFFERED');
    expect(offered.authorityId).toBe(seed.authority.id);
    expect(offered.matterGrantId).toBe(seed.matterGrant.id);
    expect(isActiveInSpecialistQueue(offered)).toBe(false);

    const accepted = transitionHandoff(offered, 'acknowledge', seed.authority.representativeUserId);
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(accepted.handoff.state).toBe('ACCEPTED_VIEW');
    expect(isActiveInSpecialistQueue(accepted.handoff)).toBe(true);

    const adminAttempt = transitionHandoff(offered, 'acknowledge', seed.authority.createdBy);
    expect(adminAttempt.ok).toBe(false);

    expect(
      isActiveInSpecialistQueue(offered, { requireAcknowledgementBeforeActiveQueue: false }),
    ).toBe(true);
    expect(readHandoffQueueConfig({ DEMO_SANDBOX_REQUIRE_HANDOFF_ACK: '0' })).toEqual({
      requireAcknowledgementBeforeActiveQueue: false,
    });
  });

  it('reaches the remaining handoff states without treating them as responsibility', () => {
    const seed = buildSandboxSeed();
    const offered = createOfferedHandoff({ seed });
    const returned = transitionHandoff(offered, 'return', seed.authority.createdBy);
    const waiting = transitionHandoff(offered, 'await_external', seed.authority.createdBy);
    const rejected = transitionHandoff(offered, 'reject', seed.authority.representativeUserId);
    expect(returned.ok && returned.handoff.state).toBe('RETURNED');
    expect(waiting.ok && waiting.handoff.state).toBe('AWAITING_EXTERNAL');
    expect(rejected.ok && rejected.handoff.state).toBe('REJECTED');
    if (!rejected.ok) return;
    const clarify = transitionHandoff(rejected.handoff, 'clarify', seed.authority.createdBy);
    expect(clarify.ok && clarify.handoff.state).toBe('CLARIFY');
    expect(isActiveInSpecialistQueue(returned.ok ? returned.handoff : offered)).toBe(false);
  });
});
