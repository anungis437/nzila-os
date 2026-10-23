import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  stored: { value: null as unknown },
  update: vi.fn(),
}));

vi.mock('@/db/db', () => ({
  db: {
    query: { orgConfigurations: { findFirst: vi.fn(async () => (m.stored.value === null ? undefined : { value: m.stored.value })) } },
    update: vi.fn(() => ({ set: vi.fn((v: unknown) => ({ where: vi.fn(async () => m.update(v)) })) })),
    insert: vi.fn(),
    delete: vi.fn(),
  },
}));
vi.mock('@/db/schema', () => ({
  orgConfigurations: { organizationId: 'organizationId', category: 'category', key: 'key' },
}));

import {
  PROTOCOL_LRO_LED,
  PROTOCOL_STEWARD_LED,
  PROTOCOL_NATIONAL_REP_LED,
  resolveStoredProtocol,
  parseStoredProtocol,
} from '../protocol-types';
import {
  approveRepresentationProtocol,
  requireExecutableRepresentationProtocol,
  resolveRepresentationProtocol,
  getRepresentationProtocol,
  RepresentationProtocolNotExecutableError,
} from '../protocol-service';

const approved = (base = PROTOCOL_LRO_LED) => ({
  ...base,
  approval: { configuredBy: 'admin-a', configuredAt: '2026-10-01T00:00:00Z', approvedBy: 'admin-b', approvedAt: '2026-10-02T00:00:00Z' },
});

describe('representation protocol execution status (P0-C)', () => {
  beforeEach(() => {
    m.stored.value = null;
    m.update.mockClear();
  });

  it('a missing configuration yields the steward default for display only', () => {
    const r = resolveStoredProtocol(null);
    expect(r).toMatchObject({ status: 'missing', executable: false });
    expect(r.protocol).toBe(PROTOCOL_STEWARD_LED);
  });

  it('a preset without provenance is not executable', () => {
    expect(resolveStoredProtocol(PROTOCOL_LRO_LED)).toMatchObject({ status: 'invalid', executable: false, reason: 'missing_provenance' });
  });

  it.each([
    ['a string', 'steward'],
    ['an array', []],
    ['wrong version', { ...PROTOCOL_LRO_LED, version: 2 }],
    ['unknown representative', { ...PROTOCOL_LRO_LED, primaryRepresentative: 'chief_steward' }],
    ['partial permissions', { ...PROTOCOL_LRO_LED, stewardPermissions: { canFileGrievance: true } }],
    ['non-boolean permission', { ...PROTOCOL_LRO_LED, stewardPermissions: { ...PROTOCOL_LRO_LED.stewardPermissions, canEscalate: 'yes' } }],
    ['blank role', { ...PROTOCOL_LRO_LED, minimumFilingRole: ' ' }],
  ])('malformed value (%s) fails closed and falls back to the default for display', (_label, value) => {
    const r = resolveStoredProtocol(value);
    expect(r.executable).toBe(false);
    expect(r.status).toBe('invalid');
    expect(r.protocol).toBe(PROTOCOL_STEWARD_LED);
    expect(parseStoredProtocol(value).ok).toBe(false);
  });

  it('a configured but unapproved protocol is pending and not executable', () => {
    const value = { ...PROTOCOL_LRO_LED, approval: { configuredBy: 'admin-a', configuredAt: '2026-10-01T00:00:00Z' } };
    expect(resolveStoredProtocol(value)).toMatchObject({ status: 'pending_approval', executable: false });
  });

  it('self-approval is not independent approval', () => {
    const value = { ...PROTOCOL_LRO_LED, approval: { configuredBy: 'a', configuredAt: '2026-10-01T00:00:00Z', approvedBy: 'a', approvedAt: '2026-10-02T00:00:00Z' } };
    expect(resolveStoredProtocol(value)).toMatchObject({ status: 'invalid', executable: false, reason: 'approval_not_independent' });
  });

  it.each([
    ['CAPE LRO-led', PROTOCOL_LRO_LED, 'lro'],
    ['CUPE national-rep-led', PROTOCOL_NATIONAL_REP_LED, 'national_rep'],
    ['steward-led local', PROTOCOL_STEWARD_LED, 'steward'],
  ])('an independently approved %s protocol is executable with its own authority', (_label, base, primary) => {
    const r = resolveStoredProtocol(approved(base));
    expect(r.executable).toBe(true);
    expect(r.protocol.primaryRepresentative).toBe(primary);
  });

  it('requireExecutableRepresentationProtocol throws for default and unapproved, returns approved', async () => {
    await expect(requireExecutableRepresentationProtocol('org')).rejects.toBeInstanceOf(RepresentationProtocolNotExecutableError);

    m.stored.value = PROTOCOL_LRO_LED;
    await expect(requireExecutableRepresentationProtocol('org')).rejects.toMatchObject({ code: 'REPRESENTATION_PROTOCOL_NOT_EXECUTABLE' });

    m.stored.value = approved();
    await expect(requireExecutableRepresentationProtocol('org')).resolves.toMatchObject({ primaryRepresentative: 'lro' });
  });

  it('getRepresentationProtocol still serves a display default without granting authority', async () => {
    expect(await getRepresentationProtocol('org')).toBe(PROTOCOL_STEWARD_LED);
    expect((await resolveRepresentationProtocol('org')).executable).toBe(false);
  });

  it('approval is refused for the author and for nothing-to-approve, and recorded for another admin', async () => {
    expect(await approveRepresentationProtocol('org', 'admin-a')).toMatchObject({ ok: false, code: 'NOT_FOUND' });

    m.stored.value = { ...PROTOCOL_LRO_LED, approval: { configuredBy: 'admin-a', configuredAt: '2026-10-01T00:00:00Z' } };
    expect(await approveRepresentationProtocol('org', 'admin-a')).toMatchObject({ ok: false, code: 'SELF_APPROVAL_FORBIDDEN' });
    expect(m.update).not.toHaveBeenCalled();

    expect(await approveRepresentationProtocol('org', 'admin-b')).toMatchObject({ ok: true });
    const written = m.update.mock.calls[0][0] as { value: { approval: { approvedBy: string } } };
    expect(written.value.approval.approvedBy).toBe('admin-b');

    m.stored.value = approved();
    expect(await approveRepresentationProtocol('org', 'admin-c')).toMatchObject({ ok: false, code: 'NOT_PENDING' });
  });
});
