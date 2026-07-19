import { describe, expect, it, vi } from 'vitest';

import type { IncidentDetail } from '@/modules/incidents/types';

import type { CourtLensMatter } from '../courtlens';
import {
  buildCourtLensReviewPacket,
  buildReviewPacketFilename,
  normalizeReviewPacketLocale,
  serializeReviewPacketJson,
  serializeReviewPacketMarkdown,
} from '../courtlens-review-packet';

function makeMatter(overrides: Partial<CourtLensMatter> = {}): CourtLensMatter {
  return {
    id: 'inc-123',
    orgId: 'metro-university',
    title: 'Housing intake',
    category: 'service_delivery',
    severity: 'high',
    status: 'investigating',
    intakeChannel: 'web',
    createdBy: 'user_1',
    assignedTo: 'reviewer-1',
    openedAt: '2026-07-10T12:00:00Z',
    dueAt: null,
    closedAt: null,
    summary: 'Summary',
    createdAt: '2026-07-10T12:00:00Z',
    updatedAt: '2026-07-10T12:30:00Z',
    practiceArea: 'housing',
    subIssue: 'eviction',
    aiSummaryStatus: 'approved',
    referralStatus: 'approved',
    riskFlags: {
      risk_lockout: false,
      risk_eviction: true,
      risk_utility_shutoff: false,
      risk_safety: false,
      risk_homelessness: false,
      risk_income_loss: false,
      risk_unsafe_work: false,
      risk_retaliation: false,
      risk_garnishment: false,
      risk_bank_freeze: false,
      risk_identity_theft: false,
      risk_essential_services: false,
      risk_harassment: false,
    },
    clientGoal: 'Avoid eviction',
    hearingDate: '2026-08-01',
    deadlineDate: '2026-07-25',
    clientProfile: {
      clientName: 'Jane Doe',
      clientContact: 'jane@example.com',
      householdSize: 3,
      hasChildren: true,
      hasDisability: false,
      consentStatus: 'granted',
    },
    ...overrides,
  };
}

function makeDetail(matter: CourtLensMatter): IncidentDetail {
  return {
    incident: {
      id: matter.id,
      orgId: matter.orgId,
      title: matter.title,
      category: matter.category,
      severity: matter.severity,
      status: matter.status,
      intakeChannel: matter.intakeChannel,
      createdBy: matter.createdBy,
      assignedTo: matter.assignedTo,
      openedAt: matter.openedAt,
      dueAt: matter.dueAt,
      closedAt: matter.closedAt,
      summary: matter.summary,
      createdAt: matter.createdAt,
      updatedAt: matter.updatedAt,
    },
    events: [
      {
        id: 'evt-1',
        incidentId: matter.id,
        actorId: 'actor-1',
        type: 'created',
        payloadJson: { foo: 'bar' },
        createdAt: '2026-07-10T12:00:00Z',
      },
      {
        id: 'evt-2',
        incidentId: matter.id,
        actorId: 'actor-2',
        type: 'courtlens_event',
        payloadJson: { clEventType: 'courtlens_fields_set', fields: { practiceArea: 'housing' } },
        createdAt: '2026-07-10T12:02:00Z',
      },
    ],
    actions: [],
    notes: [
      {
        id: 'note-1',
        incidentId: matter.id,
        authorId: 'reviewer-1',
        visibilityScope: 'investigator_only',
        content: 'Needs follow-up',
        createdAt: '2026-07-10T12:05:00Z',
      },
      {
        id: 'note-2',
        incidentId: matter.id,
        authorId: 'exec-1',
        visibilityScope: 'executive_safe',
        content: 'Executive summary note',
        createdAt: '2026-07-10T12:06:00Z',
      },
    ],
    timeline: [
      {
        id: 'tl-1',
        incidentId: matter.id,
        happenedAt: '2026-07-10T12:00:00Z',
        actorId: 'reviewer-1',
        type: 'created',
        description: 'created',
        data: { payloadJson: 'must-not-leak' },
      },
    ],
  };
}

describe('courtlens-review-packet projection', () => {
  it('builds externalizable packet for investigator and includes schema metadata', () => {
    const matter = makeMatter();
    const detail = makeDetail(matter);

    const packet = buildCourtLensReviewPacket(matter, detail, 'investigator', 'en-CA');

    expect(packet.schemaVersion).toBe('courtlens.review-packet.v1');
    expect(packet.projectionVersion).toBe('v1');
    expect(packet.packet.documentReadiness.isPacketExternalizable).toBe(true);
    expect(packet.packet.legalBoundaryNotice).toContain('does not provide legal advice');
    expect(packet.packet.orgId).toBe('metro-university');
  });

  it('uses French legal boundary notice for fr-CA locale', () => {
    const matter = makeMatter();
    const detail = makeDetail(matter);

    const packet = buildCourtLensReviewPacket(matter, detail, 'investigator', 'fr-CA');

    expect(packet.packet.legalBoundaryNotice.toLowerCase()).toContain('avis juridique');
  });

  it('does not include orgId for aggregate-only role', () => {
    const matter = makeMatter();
    const detail = makeDetail(matter);

    const packet = buildCourtLensReviewPacket(matter, detail, 'executive_viewer', 'en-CA');

    expect(packet.packet).not.toHaveProperty('orgId');
  });

  it('redaction from existing path is preserved per role', () => {
    const matter = makeMatter();
    const detail = makeDetail(matter);

    const packet = buildCourtLensReviewPacket(matter, detail, 'executive_viewer', 'en-CA');

    expect(packet.packet.intakeFacts.clientGoal).toBeNull();
    expect(packet.packet.intakeFacts.riskFlags).toBeNull();
    expect(packet.packet.reviewerNotes.every((n) => n.visibilityScope === 'executive_safe')).toBe(true);
  });

  it('never includes raw event payloadJson in projection', () => {
    const matter = makeMatter();
    const detail = makeDetail(matter);

    const packet = buildCourtLensReviewPacket(matter, detail, 'investigator', 'en-CA');

    const serialized = JSON.stringify(packet);
    expect(serialized).not.toContain('payloadJson');
    expect(serialized).not.toContain('must-not-leak');
  });
});

describe('courtlens-review-packet serializers', () => {
  it('serializes json deterministically and includes schema metadata', () => {
    const matter = makeMatter();
    const detail = makeDetail(matter);
    const packet = buildCourtLensReviewPacket(matter, detail, 'investigator', 'en-CA');

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-18T12:34:56.000Z'));
    const json = serializeReviewPacketJson(packet);
    vi.useRealTimers();

    expect(json).toContain('"schemaVersion": "courtlens.review-packet.v1"');
    expect(json.endsWith('\n')).toBe(true);
  });

  it('serializes markdown with no html blocks', () => {
    const matter = makeMatter();
    const detail = makeDetail(matter);
    const packet = buildCourtLensReviewPacket(matter, detail, 'investigator', 'en-CA');

    const markdown = serializeReviewPacketMarkdown(packet);

    expect(markdown).toContain('# CourtLens Review Packet');
    expect(markdown).not.toContain('<div');
    expect(markdown).toContain('Legal Boundary Notice');
  });

  it('builds safe deterministic filename and strips unsafe characters', () => {
    const matter = makeMatter({ id: 'inc/unsafe?name\r\n..\\payload' });
    const detail = makeDetail(matter);
    const packet = buildCourtLensReviewPacket(matter, detail, 'investigator', 'en-CA');

    const filename = buildReviewPacketFilename(packet, 'markdown');

    expect(filename.startsWith('courtlens-review-packet-inc-unsafe-name-')).toBe(true);
    expect(filename.endsWith('.md')).toBe(true);
    expect(filename).not.toContain('/');
    expect(filename).not.toContain('\\');
    expect(filename).not.toContain('?');
    expect(filename).not.toContain('..');
    expect(filename).not.toContain('\r');
    expect(filename).not.toContain('\n');
  });

  it('normalizes unsupported locale input to en-CA', () => {
    expect(normalizeReviewPacketLocale('fr-CA')).toBe('fr-CA');
    expect(normalizeReviewPacketLocale('es-ES')).toBe('en-CA');
    expect(normalizeReviewPacketLocale(undefined)).toBe('en-CA');
  });

  it('prevents markdown structural injection from reviewer-generated text', () => {
    const matter = makeMatter();
    const detail = makeDetail(matter);
    detail.notes = [
      {
        id: 'note-evil',
        incidentId: matter.id,
        authorId: 'reviewer-1',
        visibilityScope: 'investigator_only',
        content: '# injected-heading\n[click](javascript:alert(1))\n<div>bad</div>',
        createdAt: '2026-07-10T12:05:00Z',
      },
    ];
    detail.timeline = [
      {
        id: 'tl-evil',
        incidentId: matter.id,
        happenedAt: '2026-07-10T12:00:00Z',
        actorId: 'reviewer-1',
        type: 'note_added',
        description: '### fake-title\n<script>alert(1)</script>',
        data: {},
      },
    ];

    const packet = buildCourtLensReviewPacket(matter, detail, 'investigator', 'en-CA');
    const markdown = serializeReviewPacketMarkdown(packet);

    expect(markdown).toContain('## Reviewer Notes');
    expect(markdown).toContain('    # injected-heading');
    expect(markdown).toContain('[click](javascript:alert(1))');
    expect(markdown).toContain('    <div>bad</div>');
    expect(markdown).toContain('## Timeline');
    expect(markdown).toContain('### fake-title');
    expect(markdown).toContain('    <script>alert(1)</script>');
  });
});
