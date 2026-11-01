import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
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
  type ScimConfigurationRef,
} from '../provisioned-members';
import { createScimDatabase, type ScimDatabase } from './scim-pglite';

// The data layer of the SCIM routes, run against the REAL platform 0059 migration on PGlite (constraints, partial unique indexes and all). What the same
// statements do against the combined schema, as the real roles and under concurrent requests, is proved in db/__tests__/scim-provisioning.postgres.test.ts.

let database: ScimDatabase;
const ORG = randomUUID();
const OTHER = randomUUID();
let ref: ScimConfigurationRef;
let otherRef: ScimConfigurationRef;

// Every operation runs on one transaction, as the routes run it on the system context.
const inTx = <T,>(work: (tx: never) => Promise<T>) => database.db.transaction(async (tx) => work(tx as never));
const rowOf = async (id: string) => (await database.pg.query<Record<string, any>>('SELECT * FROM scim_provisioned_users WHERE id = $1', [id])).rows[0];
const count = async () => (await database.pg.query<{ n: number }>('SELECT count(*)::int AS n FROM scim_provisioned_users')).rows[0].n;

beforeAll(async () => {
  database = await createScimDatabase();
});
afterAll(async () => {
  await database.pg.close();
});
beforeEach(async () => {
  await database.reset();
  ref = { configurationId: await database.configuration(ORG), organizationId: ORG };
  otherRef = { configurationId: await database.configuration(OTHER), organizationId: OTHER };
});

describe('provisionScimMember', () => {
  it('creates a pending person keyed by the lower-cased userName, with the identity provider\u2019s subject, and never anything else', async () => {
    const result = await inTx((tx) => provisionScimMember(tx, ref, { userName: ' Jane.Doe@Example.test ', externalId: 'idp-1', name: 'Jane Doe', email: 'jane@example.test' }));
    expect(result.outcome).toBe('created');
    expect(result.member).toMatchObject({ userName: 'Jane.Doe@Example.test', externalId: 'idp-1', name: 'Jane Doe', email: 'jane@example.test', status: 'pending' });
    expect(await rowOf(result.member!.id)).toMatchObject({
      organization_id: ORG, config_id: ref.configurationId, user_name_key: 'jane.doe@example.test', status: 'pending', deleted_at: null,
      deprovisioned_at: null, deprovisioned_by: null,
    });
  });

  it('invents nothing for what the identity provider did not send: a missing name or e-mail address stays null', async () => {
    const { member } = await inTx((tx) => provisionScimMember(tx, ref, { userName: 'bare@example.test', name: '  ', email: undefined }));
    expect(member).toMatchObject({ name: null, email: null, externalId: null });
  });

  it('reports a person that already exists, case-insensitively, and creates no second one', async () => {
    await inTx((tx) => provisionScimMember(tx, ref, { userName: 'jane@example.test' }));
    const again = await inTx((tx) => provisionScimMember(tx, ref, { userName: 'JANE@example.test', name: 'Changed' }));
    expect(again.outcome).toBe('exists');
    expect(again.member).toMatchObject({ userName: 'jane@example.test', name: null });
    expect(await count()).toBe(1);
  });

  it('reports an externalId that identifies another live person, with no member, and creates nothing', async () => {
    await inTx((tx) => provisionScimMember(tx, ref, { userName: 'one@example.test', externalId: 'idp-1' }));
    const clash = await inTx((tx) => provisionScimMember(tx, ref, { userName: 'two@example.test', externalId: 'idp-1' }));
    expect(clash).toEqual({ outcome: 'external_id_conflict', member: null });
    expect(await count()).toBe(1);
  });

  it('keeps organizations apart: the same userName and the same externalId may exist in another organization', async () => {
    await inTx((tx) => provisionScimMember(tx, ref, { userName: 'same@example.test', externalId: 'idp-1' }));
    const other = await inTx((tx) => provisionScimMember(tx, otherRef, { userName: 'same@example.test', externalId: 'idp-1' }));
    expect(other.outcome).toBe('created');
    expect(await count()).toBe(2);
  });

  it('provisions a removed person again as pending, keeping the row and clearing the deprovision', async () => {
    const { member } = await inTx((tx) => provisionScimMember(tx, ref, { userName: 'back@example.test', externalId: 'idp-1' }));
    await database.pg.query(
      `UPDATE scim_provisioned_users SET deleted_at = now(), status = 'revoked', deprovisioned_at = now(), deprovisioned_by = 'scim', deprovisioned_action = 'delete' WHERE id = $1`,
      [member!.id],
    );
    const again = await inTx((tx) => provisionScimMember(tx, ref, { userName: 'Back@example.test', email: 'new@example.test' }));
    expect(again.outcome).toBe('reprovisioned');
    expect(again.member).toMatchObject({ id: member!.id, status: 'pending', email: 'new@example.test', externalId: null });
    expect(await rowOf(member!.id)).toMatchObject({ deleted_at: null, deprovisioned_at: null, deprovisioned_by: null, deprovisioned_action: null, user_name: 'Back@example.test' });
    expect(await count()).toBe(1);
  });

  it('refuses input outside the bounds before any statement, and a configuration that is not live', async () => {
    await expect(inTx((tx) => provisionScimMember(tx, ref, { userName: '   ' }))).rejects.toThrow(RangeError);
    await expect(inTx((tx) => provisionScimMember(tx, ref, { userName: 'x'.repeat(321) }))).rejects.toThrow(RangeError);
    await expect(inTx((tx) => provisionScimMember(tx, ref, { userName: 'a', externalId: 'e'.repeat(256) }))).rejects.toThrow(RangeError);
    await expect(inTx((tx) => provisionScimMember(tx, ref, { userName: 'a', name: 'n'.repeat(401) }))).rejects.toThrow(RangeError);
    await expect(inTx((tx) => provisionScimMember(tx, ref, { userName: 'a', email: 'e'.repeat(321) }))).rejects.toThrow(RangeError);
    expect(await count()).toBe(0);
  });

  it.each([
    ['revoked', { revoked: true }],
    ['expired', { expired: true }],
    ['disabled', { enabled: false }],
    ['user sync switched off', { syncUsers: false }],
  ])('refuses a configuration that is %s, and one that belongs to another organization, and writes nothing', async (_label, overrides) => {
    const cfg = await database.configuration(randomUUID(), overrides);
    const org = (await database.pg.query<{ organization_id: string }>('SELECT organization_id FROM scim_configurations WHERE id = $1', [cfg])).rows[0].organization_id;
    await expect(inTx((tx) => provisionScimMember(tx, { configurationId: cfg, organizationId: org }, { userName: 'late@example.test' }))).rejects.toThrow(ScimConfigurationNotLiveError);
    await expect(inTx((tx) => provisionScimMember(tx, { configurationId: ref.configurationId, organizationId: OTHER }, { userName: 'x@example.test' }))).rejects.toThrow(ScimConfigurationNotLiveError);
    await expect(inTx((tx) => provisionScimMember(tx, { configurationId: randomUUID(), organizationId: ORG }, { userName: 'x@example.test' }))).rejects.toThrow(ScimConfigurationNotLiveError);
    expect(await count()).toBe(0);
  });
});

describe('listScimMembers', () => {
  it('reads the live total and then one page from a one-based start index, in creation order', async () => {
    for (let i = 1; i <= 7; i += 1) await inTx((tx) => provisionScimMember(tx, ref, { userName: `user${i}@example.test` }));
    await inTx((tx) => provisionScimMember(tx, otherRef, { userName: 'other@example.test' }));
    const first = await inTx((tx) => listScimMembers(tx, ref, { startIndex: 1, count: 3 }));
    const last = await inTx((tx) => listScimMembers(tx, ref, { startIndex: 7, count: 3 }));
    expect(first.total).toBe(7);
    expect(first.members.map((m) => m.userName)).toEqual(['user1@example.test', 'user2@example.test', 'user3@example.test']);
    expect(last.members.map((m) => m.userName)).toEqual(['user7@example.test']);
  });

  it('reads no page when none is asked for, never a negative offset, and never more than a hundred', async () => {
    await inTx((tx) => provisionScimMember(tx, ref, { userName: 'a@example.test' }));
    expect(await inTx((tx) => listScimMembers(tx, ref, { startIndex: 1, count: 0 }))).toMatchObject({ total: 1, members: [] });
    expect((await inTx((tx) => listScimMembers(tx, ref, { startIndex: -5, count: 10 }))).members).toHaveLength(1);
    for (let i = 0; i < 105; i += 1) await database.pg.query(`INSERT INTO scim_provisioned_users (organization_id, config_id, user_name, user_name_key) VALUES ($1, $2, $3, $3)`, [ORG, ref.configurationId, `bulk${i}@example.test`]);
    expect((await inTx((tx) => listScimMembers(tx, ref, { startIndex: 1, count: 500 }))).members).toHaveLength(100);
  });

  it('leaves out a removed person, and refuses a configuration that is not live', async () => {
    const { member } = await inTx((tx) => provisionScimMember(tx, ref, { userName: 'gone@example.test' }));
    await database.pg.query('UPDATE scim_provisioned_users SET deleted_at = now() WHERE id = $1', [member!.id]);
    expect(await inTx((tx) => listScimMembers(tx, ref, { startIndex: 1, count: 10 }))).toMatchObject({ total: 0, members: [] });
    await expect(inTx((tx) => listScimMembers(tx, { configurationId: ref.configurationId, organizationId: OTHER }, { startIndex: 1, count: 10 }))).rejects.toThrow(ScimConfigurationNotLiveError);
  });
});

describe('findScimMembers and getScimMember', () => {
  it('finds a person by userName without regard to case, and by externalId exactly, and shapes what comes back', async () => {
    const { member } = await inTx((tx) => provisionScimMember(tx, ref, { userName: 'Finder@Example.test', externalId: 'idp-9' }));
    expect(await inTx((tx) => findScimMembers(tx, ref, { attribute: 'userName', value: 'FINDER@example.test' }))).toEqual([member]);
    expect(await inTx((tx) => findScimMembers(tx, ref, { attribute: 'externalId', value: 'idp-9' }))).toEqual([member]);
    expect(await inTx((tx) => findScimMembers(tx, ref, { attribute: 'externalId', value: 'IDP-9' }))).toEqual([]);
    expect(await inTx((tx) => findScimMembers(tx, ref, { attribute: 'userName', value: '   ' }))).toEqual([]);
    expect(await inTx((tx) => getScimMember(tx, ref, member!.id))).toEqual(member);
  });

  it('never finds or reads a person of another organization or a removed person, whatever the id', async () => {
    const mine = await inTx((tx) => provisionScimMember(tx, ref, { userName: 'mine@example.test' }));
    const theirs = await inTx((tx) => provisionScimMember(tx, otherRef, { userName: 'mine@example.test' }));
    expect(await inTx((tx) => getScimMember(tx, ref, theirs.member!.id))).toBeNull();
    expect(await inTx((tx) => findScimMembers(tx, ref, { attribute: 'userName', value: 'mine@example.test' }))).toEqual([mine.member]);
    await database.pg.query('UPDATE scim_provisioned_users SET deleted_at = now() WHERE id = $1', [mine.member!.id]);
    expect(await inTx((tx) => getScimMember(tx, ref, mine.member!.id))).toBeNull();
    expect(await inTx((tx) => findScimMembers(tx, ref, { attribute: 'userName', value: 'mine@example.test' }))).toEqual([]);
  });

  it('refuses a configuration that is not live', async () => {
    await expect(inTx((tx) => getScimMember(tx, { configurationId: ref.configurationId, organizationId: OTHER }, randomUUID()))).rejects.toThrow(ScimConfigurationNotLiveError);
    await expect(inTx((tx) => findScimMembers(tx, { configurationId: ref.configurationId, organizationId: OTHER }, { attribute: 'userName', value: 'a' }))).rejects.toThrow(ScimConfigurationNotLiveError);
  });
});

describe('updateScimMember', () => {
  it('changes only what was stated, reports no change for the same values, and leaves the rest as it was', async () => {
    const { member } = await inTx((tx) => provisionScimMember(tx, ref, { userName: 'u@example.test', externalId: 'idp-1', name: 'Old Name', email: 'old@example.test' }));
    const changed = await inTx((tx) => updateScimMember(tx, ref, member!.id, { name: 'New Name' }));
    expect(changed).toMatchObject({ outcome: 'updated', member: { name: 'New Name', email: 'old@example.test', externalId: 'idp-1' } });
    expect(await inTx((tx) => updateScimMember(tx, ref, member!.id, { name: 'New Name', email: 'old@example.test', externalId: 'idp-1' }))).toMatchObject({ outcome: 'unchanged' });
    expect(await inTx((tx) => updateScimMember(tx, ref, member!.id, {}))).toMatchObject({ outcome: 'unchanged' });
  });

  it('changes and removes the externalId, and refuses one that identifies another live person', async () => {
    const one = await inTx((tx) => provisionScimMember(tx, ref, { userName: 'one@example.test', externalId: 'idp-1' }));
    const two = await inTx((tx) => provisionScimMember(tx, ref, { userName: 'two@example.test', externalId: 'idp-2' }));
    expect(await inTx((tx) => updateScimMember(tx, ref, two.member!.id, { externalId: 'idp-1' }))).toEqual({ outcome: 'external_id_conflict', member: null });
    expect(await inTx((tx) => updateScimMember(tx, ref, one.member!.id, { externalId: 'idp-1b' }))).toMatchObject({ outcome: 'updated', member: { externalId: 'idp-1b' } });
    expect(await inTx((tx) => updateScimMember(tx, ref, two.member!.id, { externalId: 'idp-1' }))).toMatchObject({ outcome: 'updated' });
    expect(await inTx((tx) => updateScimMember(tx, ref, two.member!.id, { externalId: null }))).toMatchObject({ outcome: 'updated', member: { externalId: null } });
    expect(await inTx((tx) => updateScimMember(tx, ref, two.member!.id, { externalId: null }))).toMatchObject({ outcome: 'unchanged' });
  });

  it('restores a person this stream deprovisioned, and holds one the organization itself suspended', async () => {
    const { member } = await inTx((tx) => provisionScimMember(tx, ref, { userName: 'r@example.test' }));
    await inTx((tx) => deprovisionScimMember(tx, ref, member!.id, 'patch'));
    const restored = await inTx((tx) => updateScimMember(tx, ref, member!.id, { reactivate: true }));
    expect(restored).toMatchObject({ outcome: 'updated', member: { status: 'pending' } });
    expect(await rowOf(member!.id)).toMatchObject({ deprovisioned_at: null, deprovisioned_action: null, deprovisioned_by: null, deprovisioned_via: null });
    expect((await rowOf(member!.id)).reactivated_at).not.toBeNull();

    await database.pg.query(`UPDATE scim_provisioned_users SET status = 'suspended', deprovisioned_at = now(), deprovisioned_by = 'organization' WHERE id = $1`, [member!.id]);
    const held = await inTx((tx) => updateScimMember(tx, ref, member!.id, { reactivate: true, name: 'Should Not Apply' }));
    expect(held).toMatchObject({ outcome: 'held', member: { status: 'suspended' } });
    expect(await rowOf(member!.id)).toMatchObject({ status: 'suspended', display_name: null, deprovisioned_by: 'organization' });
  });

  it('does not reactivate a person who is not deprovisioned, and finds no person of another organization', async () => {
    const { member } = await inTx((tx) => provisionScimMember(tx, ref, { userName: 'p@example.test' }));
    expect(await inTx((tx) => updateScimMember(tx, ref, member!.id, { reactivate: true }))).toMatchObject({ outcome: 'unchanged' });
    expect(await inTx((tx) => updateScimMember(tx, otherRef, member!.id, { name: 'x' }))).toEqual({ outcome: 'not_found', member: null });
    expect(await inTx((tx) => updateScimMember(tx, ref, randomUUID(), { name: 'x' }))).toEqual({ outcome: 'not_found', member: null });
  });

  it('refuses a configuration that is not live or has user sync off, and input outside the bounds', async () => {
    const { member } = await inTx((tx) => provisionScimMember(tx, ref, { userName: 'q@example.test' }));
    await database.pg.query('UPDATE scim_configurations SET sync_users = false WHERE id = $1', [ref.configurationId]);
    await expect(inTx((tx) => updateScimMember(tx, ref, member!.id, { name: 'x' }))).rejects.toThrow(ScimConfigurationNotLiveError);
    await database.pg.query('UPDATE scim_configurations SET sync_users = true WHERE id = $1', [ref.configurationId]);
    await expect(inTx((tx) => updateScimMember(tx, ref, member!.id, { externalId: 'e'.repeat(256) }))).rejects.toThrow(RangeError);
  });
});

describe('deprovisionScimMember', () => {
  it.each([
    ['suspend', 'suspended', false],
    ['archive', 'inactive', false],
    ['delete', 'revoked', true],
  ])('applies the organization\u2019s own configured action %s as a state change, never a removal', async (action, status, softDeleted) => {
    await database.pg.query('UPDATE scim_configurations SET deprovision_action = $2 WHERE id = $1', [ref.configurationId, action]);
    const { member } = await inTx((tx) => provisionScimMember(tx, ref, { userName: `${action}@example.test` }));
    const result = await inTx((tx) => deprovisionScimMember(tx, ref, member!.id, 'delete'));
    expect(result).toMatchObject({ outcome: 'deprovisioned', action, member: { id: member!.id, status } });
    const row = await rowOf(member!.id);
    expect(row).toMatchObject({ status, deprovisioned_action: action, deprovisioned_by: 'scim', deprovisioned_via: 'delete' });
    expect(row.deprovisioned_at).not.toBeNull();
    expect(row.deleted_at !== null).toBe(softDeleted);
    expect(await count()).toBe(1);
  });

  it('suspends, and never destroys, when the configured action is one it does not know', async () => {
    // The database vocabulary refuses an unknown action, so the stored value is bypassed to prove the reader still fails safe.
    await database.pg.query(`ALTER TABLE scim_configurations ALTER COLUMN deprovision_action TYPE text`);
    await database.pg.query(`UPDATE scim_configurations SET deprovision_action = 'obliterate' WHERE id = $1`, [ref.configurationId]);
    const { member } = await inTx((tx) => provisionScimMember(tx, ref, { userName: 'safe@example.test' }));
    expect(await inTx((tx) => deprovisionScimMember(tx, ref, member!.id, 'patch'))).toMatchObject({ outcome: 'deprovisioned', action: 'suspend', member: { status: 'suspended' } });
  });

  it('leaves a person who is already not live as they are, and reports it', async () => {
    const { member } = await inTx((tx) => provisionScimMember(tx, ref, { userName: 'twice@example.test' }));
    await inTx((tx) => deprovisionScimMember(tx, ref, member!.id, 'patch'));
    const before = await rowOf(member!.id);
    expect(await inTx((tx) => deprovisionScimMember(tx, ref, member!.id, 'put'))).toMatchObject({ outcome: 'unchanged', action: 'suspend', member: { status: 'suspended' } });
    expect(await rowOf(member!.id)).toEqual(before);
  });

  it('finds no person of another organization or a removed person, and refuses a configuration that is not live', async () => {
    const { member } = await inTx((tx) => provisionScimMember(tx, ref, { userName: 'x@example.test' }));
    expect(await inTx((tx) => deprovisionScimMember(tx, otherRef, member!.id, 'patch'))).toEqual({ outcome: 'not_found', action: null, member: null });
    await expect(inTx((tx) => deprovisionScimMember(tx, { configurationId: ref.configurationId, organizationId: OTHER }, member!.id, 'patch'))).rejects.toThrow(ScimConfigurationNotLiveError);
    expect(await rowOf(member!.id)).toMatchObject({ status: 'pending', deprovisioned_at: null });
  });
});

describe('the directory\u2019s own constraints', () => {
  it('allows one live person per userName and per externalId even without the application lock, and frees both for a removed person', async () => {
    const insert = (name: string, key: string, external: string | null = null) =>
      database.pg.query(`INSERT INTO scim_provisioned_users (organization_id, config_id, user_name, user_name_key, external_id) VALUES ($1, $2, $3, $4, $5)`, [ORG, ref.configurationId, name, key, external]);
    await insert('A@x.test', 'a@x.test', 'ext');
    await expect(insert('a@X.test', 'a@x.test')).rejects.toThrow(/unique/i);
    await expect(insert('B@x.test', 'b@x.test', 'ext')).rejects.toThrow(/unique/i);
    await database.pg.query(`UPDATE scim_provisioned_users SET deleted_at = now() WHERE user_name_key = 'a@x.test'`);
    await insert('A@x.test', 'a@x.test', 'ext');
    await expect(insert('C@x.test', 'wrong-key')).rejects.toThrow(/key_check/);
  });

  it('refuses a status outside the vocabulary and a deprovision that does not say who made it', async () => {
    const insert = (extra: string, value: string) =>
      database.pg.query(`INSERT INTO scim_provisioned_users (organization_id, config_id, user_name, user_name_key, ${extra}) VALUES ($1, $2, 'u', 'u', ${value})`, [ORG, ref.configurationId]);
    // 'active' is outside the vocabulary and is also not 'pending', so more than one constraint refuses it; Postgres names the first it checks.
    await expect(insert('status', `'active'`)).rejects.toThrow(/status_check|deprovision_check/);
    await expect(insert('status', `'suspended'`)).rejects.toThrow(/deprovision_check/);
    await expect(insert('deprovisioned_by', `'somebody'`)).rejects.toThrow(/by_check/);
  });
});

describe('toScimUser', () => {
  const member = { id: 'm1', userName: 'Jane@Example.test', externalId: 'idp-1', name: 'Jane Doe', email: 'jane@example.test', status: 'pending', provisionedAt: '2026-01-01T00:00:00.000Z', createdAt: '2026-01-02T00:00:00.000Z', updatedAt: '2026-01-03T00:00:00.000Z' };

  it('reports a provisioned person as never active, and returns the identity provider\u2019s own userName and externalId as it sent them', () => {
    expect(toScimUser(member)).toMatchObject({
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      id: 'm1',
      externalId: 'idp-1',
      userName: 'Jane@Example.test',
      name: { givenName: 'Jane', familyName: 'Doe', formatted: 'Jane Doe' },
      emails: [{ value: 'jane@example.test', primary: true, type: 'work' }],
      active: false,
      meta: { resourceType: 'User', created: '2026-01-01T00:00:00.000Z', lastModified: '2026-01-03T00:00:00.000Z' },
    });
    expect(toScimUser({ ...member, status: 'suspended' }).active).toBe(false);
  });

  it('omits what is not known: no externalId, no e-mail address, no name, and the creation time falls back to the row', () => {
    const bare = toScimUser({ ...member, externalId: null, email: null, name: null, provisionedAt: null });
    expect(bare).not.toHaveProperty('externalId');
    expect(bare.emails).toEqual([]);
    expect(bare.name).toEqual({ givenName: '', familyName: '', formatted: '' });
    expect(bare.meta.created).toBe('2026-01-02T00:00:00.000Z');
  });

  it('gives the location of the resource when it is known, and none when it is not', () => {
    expect(toScimUser(member, 'https://app.example.test/api/scim/v2/o/Users/m1').meta.location).toBe('https://app.example.test/api/scim/v2/o/Users/m1');
    expect(toScimUser(member).meta).not.toHaveProperty('location');
  });
});

describe('SCIM_MEMBER_LINK', () => {
  it('records linking as a blocked operation that never binds by an e-mail address, a userName or an externalId alone, and names the directory', () => {
    expect(SCIM_MEMBER_LINK).toMatchObject({ operation: 'scim.member.link', state: 'blocked', approvedBy: null, directory: 'public.scim_provisioned_users' });
    expect(SCIM_MEMBER_LINK.neverBindsBy).toEqual(['e-mail address', 'userName', 'externalId alone']);
    expect(SCIM_MEMBER_LINK.requires.join(' ')).toContain('UE-INST-SCIM-PROVISIONING-CREDENTIAL-AND-DEPROVISIONING-AUTHORITY');
    expect(Object.isFrozen(SCIM_MEMBER_LINK)).toBe(true);
  });
});
