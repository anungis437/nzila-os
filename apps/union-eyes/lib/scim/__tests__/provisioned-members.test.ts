import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('drizzle-orm', () => ({
  sql: Object.assign((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }), {}),
}));

import {
  deprovisionScimMember,
  findScimMembers,
  getScimMember,
  listScimMembers,
  provisionScimMember,
  SCIM_MEMBER_LINK,
  ScimConfigurationNotLiveError,
  toScimUser,
  updateScimMember,
  type ScimMember,
} from '../provisioned-members';

const REF = { configurationId: '11111111-1111-4111-8111-111111111111', organizationId: '22222222-2222-4222-8222-222222222222' };

const calls: Array<{ text: string; values: unknown[] }> = [];
const answers: unknown[] = [];
const tx = {
  execute: vi.fn(async (query: { strings: readonly string[]; values: unknown[] }) => {
    calls.push({ text: query.strings.join('?'), values: query.values });
    const next = answers.shift();
    if (next instanceof Error) throw next;
    return next ?? [];
  }),
} as never;

const columns = (over: Record<string, unknown> = {}) => ({
  o_id: 'm1', o_user_id: 'scim:o:jane', o_name: 'Jane Doe', o_email: 'jane@example.test', o_status: 'pending',
  o_joined_at: null, o_created_at: '2026-01-01', o_updated_at: '2026-01-02', o_metadata: null, ...over,
});

beforeEach(() => {
  calls.length = 0;
  answers.length = 0;
  vi.clearAllMocks();
});

describe('provisionScimMember', () => {
  it('passes the configuration, the organization and the person, with a missing externalId or name as null, and no role or status', async () => {
    answers.push([{ o_outcome: 'created', ...columns() }]);
    const result = await provisionScimMember(tx, REF, { userName: 'jane@example.test' });
    expect(result.outcome).toBe('created');
    expect(result.member).toMatchObject({ id: 'm1', userId: 'scim:o:jane', status: 'pending', email: 'jane@example.test' });
    expect(calls[0].text).toContain('public.ue_scim_provision_member(');
    expect(calls[0].values).toEqual([REF.configurationId, REF.organizationId, 'jane@example.test', null, null, null]);
  });

  it('reads the result whether the driver returns an array or an object with rows', async () => {
    answers.push({ rows: [{ o_outcome: 'reprovisioned', ...columns() }] });
    expect((await provisionScimMember(tx, REF, { userName: 'a' })).outcome).toBe('reprovisioned');
  });

  it('reports a conflict with no member, because the database returns no row of data for it', async () => {
    answers.push([{ o_outcome: 'external_id_conflict', ...columns({ o_id: null, o_user_id: null, o_status: null }) }]);
    expect(await provisionScimMember(tx, REF, { userName: 'a', externalId: 'x' })).toEqual({ outcome: 'external_id_conflict', member: null });
  });

  it('fails when the database returns nothing at all', async () => {
    answers.push([]);
    await expect(provisionScimMember(tx, REF, { userName: 'a' })).rejects.toThrow('returned no result');
  });

  it('turns the database\'s permission refusal, direct or wrapped by the driver, into one error, and lets every other error through', async () => {
    answers.push(Object.assign(new Error('refused'), { code: '42501' }));
    await expect(provisionScimMember(tx, REF, { userName: 'a' })).rejects.toBeInstanceOf(ScimConfigurationNotLiveError);
    answers.push(Object.assign(new Error('Failed query'), { cause: { code: '42501' } }));
    await expect(provisionScimMember(tx, REF, { userName: 'a' })).rejects.toBeInstanceOf(ScimConfigurationNotLiveError);
    answers.push(Object.assign(new Error('deadlock'), { code: '40P01' }));
    await expect(provisionScimMember(tx, REF, { userName: 'a' })).rejects.toThrow('deadlock');
  });
});

describe('listScimMembers', () => {
  it('reads the live total and then one page from a zero-based offset', async () => {
    answers.push([{ total: '12' }], [columns({ o_id: 'm1' }), columns({ o_id: 'm2' })]);
    const result = await listScimMembers(tx, REF, { startIndex: 11, count: 2 });
    expect(result.total).toBe(12);
    expect(result.members.map((member) => member.id)).toEqual(['m1', 'm2']);
    expect(calls[1].text).toContain('public.ue_scim_list_members(');
    expect(calls[1].values).toEqual([REF.configurationId, REF.organizationId, 10, 2]);
  });

  it('reads no page when none is asked for, and never a negative offset', async () => {
    answers.push([{ total: 3 }]);
    expect(await listScimMembers(tx, REF, { startIndex: 1, count: 0 })).toEqual({ total: 3, members: [] });
    expect(calls).toHaveLength(1);
    answers.push([{ total: 3 }], []);
    await listScimMembers(tx, REF, { startIndex: -5, count: 5 });
    expect(calls[2].values[2]).toBe(0);
  });

  it('turns a configuration the database refuses into the one error', async () => {
    answers.push(Object.assign(new Error('refused'), { code: '42501' }));
    await expect(listScimMembers(tx, REF, { startIndex: 1, count: 5 })).rejects.toBeInstanceOf(ScimConfigurationNotLiveError);
  });
});

describe('findScimMembers and getScimMember', () => {
  it('asks the database for one person by the attribute and value, and by id, and shapes what comes back', async () => {
    answers.push([columns({ o_id: 'm1' })]);
    const found = await findScimMembers(tx, REF, { attribute: 'userName', value: 'Jane@Example.test' });
    expect(found.map((member) => member.id)).toEqual(['m1']);
    expect(calls[0].text).toContain('public.ue_scim_find_member(');
    expect(calls[0].values).toEqual([REF.configurationId, REF.organizationId, 'userName', 'Jane@Example.test']);

    answers.push([columns({ o_id: 'm2' })]);
    expect((await getScimMember(tx, REF, '33333333-3333-4333-8333-333333333333'))?.id).toBe('m2');
    expect(calls[1].text).toContain('public.ue_scim_get_member(');
    expect(calls[1].values).toEqual([REF.configurationId, REF.organizationId, '33333333-3333-4333-8333-333333333333']);

    answers.push([]);
    expect(await getScimMember(tx, REF, '33333333-3333-4333-8333-333333333333')).toBeNull();
  });

  it('turns a configuration the database refuses into the one error', async () => {
    answers.push(Object.assign(new Error('refused'), { code: '42501' }));
    await expect(findScimMembers(tx, REF, { attribute: 'externalId', value: 'x' })).rejects.toBeInstanceOf(ScimConfigurationNotLiveError);
    answers.push(Object.assign(new Error('Failed query'), { cause: { code: '42501' } }));
    await expect(getScimMember(tx, REF, 'id')).rejects.toBeInstanceOf(ScimConfigurationNotLiveError);
  });
});

describe('updateScimMember and deprovisionScimMember', () => {
  it('passes only the attributes that were stated, and a removal of the externalId as a removal', async () => {
    answers.push([{ o_outcome: 'updated', ...columns() }]);
    expect((await updateScimMember(tx, REF, 'm1', { name: 'Janet Doe', email: 'janet@example.test', externalId: 'idp-2' })).outcome).toBe('updated');
    expect(calls[0].text).toContain('public.ue_scim_update_member(');
    expect(calls[0].values).toEqual([REF.configurationId, REF.organizationId, 'm1', 'Janet Doe', 'janet@example.test', 'idp-2', false, false]);

    answers.push([{ o_outcome: 'updated', ...columns() }]);
    await updateScimMember(tx, REF, 'm1', { externalId: null });
    expect(calls[1].values).toEqual([REF.configurationId, REF.organizationId, 'm1', null, null, null, true, false]);

    answers.push([{ o_outcome: 'updated', ...columns() }]);
    await updateScimMember(tx, REF, 'm1', { reactivate: true });
    expect(calls[2].values).toEqual([REF.configurationId, REF.organizationId, 'm1', null, null, null, false, true]);
  });

  it('reports a refusal with no member, because the database returns no row of data for it', async () => {
    for (const outcome of ['not_found', 'external_id_conflict']) {
      answers.push([{ o_outcome: outcome, ...columns({ o_id: null, o_user_id: null, o_status: null }) }]);
      expect(await updateScimMember(tx, REF, 'm1', { name: 'x' })).toEqual({ outcome, member: null });
    }
    answers.push([{ o_outcome: 'held', ...columns({ o_status: 'suspended' }) }]);
    expect(await updateScimMember(tx, REF, 'm1', { reactivate: true })).toMatchObject({ outcome: 'held', member: { status: 'suspended' } });
  });

  it('names no action when it deprovisions: the database reads the organization\u2019s own configured one', async () => {
    answers.push([{ o_outcome: 'deprovisioned', o_action: 'archive', ...columns({ o_status: 'inactive' }) }]);
    const result = await deprovisionScimMember(tx, REF, 'm1', 'delete');
    expect(result).toMatchObject({ outcome: 'deprovisioned', action: 'archive', member: { status: 'inactive' } });
    expect(calls[0].text).toContain('public.ue_scim_deprovision_member(');
    expect(calls[0].values).toEqual([REF.configurationId, REF.organizationId, 'm1', 'delete']);

    answers.push([{ o_outcome: 'not_found', o_action: null, ...columns({ o_id: null, o_user_id: null, o_status: null }) }]);
    expect(await deprovisionScimMember(tx, REF, 'm1', 'patch')).toEqual({ outcome: 'not_found', action: null, member: null });
  });

  it('fails when the database returns nothing, and turns a refused configuration into the one error', async () => {
    answers.push([]);
    await expect(updateScimMember(tx, REF, 'm1', { name: 'x' })).rejects.toThrow('returned no result');
    answers.push([]);
    await expect(deprovisionScimMember(tx, REF, 'm1', 'patch')).rejects.toThrow('returned no result');
    answers.push(Object.assign(new Error('refused'), { code: '42501' }));
    await expect(updateScimMember(tx, REF, 'm1', { name: 'x' })).rejects.toBeInstanceOf(ScimConfigurationNotLiveError);
    answers.push(Object.assign(new Error('Failed query'), { cause: { code: '42501' } }));
    await expect(deprovisionScimMember(tx, REF, 'm1', 'patch')).rejects.toBeInstanceOf(ScimConfigurationNotLiveError);
  });
});

describe('toScimUser', () => {
  const member = (over: Partial<ScimMember> = {}): ScimMember => ({
    id: 'm1', userId: 'scim:o:jane', name: 'Jane Q Doe', email: 'jane@example.test', status: 'pending',
    joinedAt: null, createdAt: '2026-01-01', updatedAt: '2026-01-02', metadata: null, ...over,
  });

  it('reports a pending member as not active and returns the identity provider\'s own userName and externalId as it sent them', () => {
    const user = toScimUser(member({ metadata: { scim: { userName: 'Jane.Doe@Example.test', externalId: 'idp-1', link: 'unlinked' } } }));
    expect(user).toMatchObject({ id: 'm1', externalId: 'idp-1', userName: 'Jane.Doe@Example.test', active: false, name: { givenName: 'Jane', familyName: 'Q Doe', formatted: 'Jane Q Doe' } });
    expect(user.meta).toEqual({ resourceType: 'User', created: '2026-01-01', lastModified: '2026-01-02' });
  });

  it('reports only an active member as active, and falls back to the e-mail and then the key for a member the stream did not provision', () => {
    expect(toScimUser(member({ status: 'active' })).active).toBe(true);
    // A deprovisioned person is not active, whichever status the organization's configured action gave them.
    for (const status of ['suspended', 'inactive', 'revoked', 'pending']) expect(toScimUser(member({ status })).active, status).toBe(false);
    expect(toScimUser(member({ status: 'removed' })).active).toBe(false);
    expect(toScimUser(member()).userName).toBe('jane@example.test');
    expect(toScimUser(member({ email: null })).userName).toBe('scim:o:jane');
    expect(toScimUser(member({ email: null })).emails).toEqual([]);
    expect('externalId' in toScimUser(member())).toBe(false);
  });

  it('gives the location of the resource when it is known, and none when it is not', () => {
    expect(toScimUser(member(), 'https://app.example.test/api/scim/v2/o/Users/m1').meta).toMatchObject({ resourceType: 'User', location: 'https://app.example.test/api/scim/v2/o/Users/m1' });
    expect('location' in toScimUser(member()).meta).toBe(false);
  });

  it('ignores stored scim details that are not text', () => {
    expect(toScimUser(member({ metadata: { scim: { userName: 7, externalId: { x: 1 } } } })).userName).toBe('jane@example.test');
    expect(toScimUser(member({ metadata: { scim: 'x' } })).userName).toBe('jane@example.test');
  });
});

describe('SCIM_MEMBER_LINK', () => {
  it('records linking as a blocked operation that never binds by an e-mail address, a userName or an externalId alone', () => {
    expect(SCIM_MEMBER_LINK).toMatchObject({ operation: 'scim.member.link', state: 'blocked', approvedBy: null, provisionalKeyPrefix: 'scim:' });
    expect(SCIM_MEMBER_LINK.neverBindsBy).toEqual(expect.arrayContaining(['e-mail address', 'userName', 'externalId alone']));
    expect(SCIM_MEMBER_LINK.requires.length).toBeGreaterThanOrEqual(3);
    // What a deprovision means for a person who is linked to an account is an open institutional decision, named here.
    expect(SCIM_MEMBER_LINK.requires.join(' ')).toContain('UE-INST-SCIM-PROVISIONING-CREDENTIAL-AND-DEPROVISIONING-AUTHORITY');
    expect(Object.isFrozen(SCIM_MEMBER_LINK)).toBe(true);
  });
});
