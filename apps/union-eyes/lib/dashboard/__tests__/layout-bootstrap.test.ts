import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ audit: vi.fn() }));

vi.mock('@/lib/db/with-rls-context', async () => (await import('@/lib/page-data/__tests__/tx-double')).txDoubleModule());
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: mocks.audit }));

import { txDouble } from '@/lib/page-data/__tests__/tx-double';
import { ensureOrganizationMembership, isSeedMembershipLinkingAllowed } from '../layout-bootstrap';

const DEFAULT_ORG = '11111111-1111-4111-8111-111111111111';
const ORG_A = '22222222-2222-4222-8222-222222222222';
const ORG_B = '33333333-3333-4333-8333-333333333333';
const PERSON = 'entra-person';

const base = { userId: PERSON, email: 'Pilot.User@Example.TEST', name: 'Pilot User', defaultOrganizationId: DEFAULT_ORG, allowAutoProvisioning: true };
const linking = { ...base, linkSeededMemberships: true };
const seed = (id: string, organizationId: string, userId = `placeholder-${id}`) => ({ id, organizationId, userId });

const statementsIn = (context: string) => txDouble.statements.filter((statement) => statement.context === context);

beforeEach(() => {
  txDouble.reset();
  mocks.audit.mockReset();
  mocks.audit.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('isSeedMembershipLinkingAllowed', () => {
  it('is off unless it is switched on on purpose', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('UE_ALLOW_SEED_MEMBERSHIP_LINKING', '');
    expect(isSeedMembershipLinkingAllowed()).toBe(false);
    vi.stubEnv('UE_ALLOW_SEED_MEMBERSHIP_LINKING', 'yes');
    expect(isSeedMembershipLinkingAllowed()).toBe(false);
    vi.stubEnv('UE_ALLOW_SEED_MEMBERSHIP_LINKING', 'true');
    expect(isSeedMembershipLinkingAllowed()).toBe(true);
  });

  it('is never on in a deployment, whatever the switch says', () => {
    vi.stubEnv('UE_ALLOW_SEED_MEMBERSHIP_LINKING', 'true');
    vi.stubEnv('NODE_ENV', 'production');
    expect(isSeedMembershipLinkingAllowed()).toBe(false);
    // A production container labelled development does not open it either.
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('UE_ENVIRONMENT', 'production');
    expect(isSeedMembershipLinkingAllowed()).toBe(false);
    vi.stubEnv('UE_ENVIRONMENT', 'staging');
    expect(isSeedMembershipLinkingAllowed()).toBe(false);
  });
});

describe('ensureOrganizationMembership', () => {
  describe('a membership already linked to the person', () => {
    it('is found by the person id, as the system role, with nothing written and no e-mail looked up', async () => {
      txDouble.queue([{ id: 'own' }]);

      expect(await ensureOrganizationMembership(linking)).toBe('existing');

      expect(txDouble.statements.map((statement) => statement.kind)).toEqual(['select']);
      expect(txDouble.statements[0]).toMatchObject({ context: 'system', where: { params: [PERSON] } });
      expect(mocks.audit).not.toHaveBeenCalled();
    });
  });

  describe('a membership seeded under the person e-mail', () => {
    it('is never looked for unless linking is switched on: the person gets a membership of their own or none', async () => {
      txDouble.queue([]);
      expect(await ensureOrganizationMembership({ ...base, allowAutoProvisioning: false })).toBe('none');
      expect(txDouble.statements.map((statement) => statement.kind)).toEqual(['select']);

      txDouble.reset();
      txDouble.queue([]);
      expect(await ensureOrganizationMembership(base)).toBe('provisioned');
      expect(txDouble.statements.map((statement) => statement.kind)).toEqual(['select', 'insert']);
      expect(txDouble.statements.some((statement) => statement.kind === 'update')).toBe(false);
    });

    it('is never looked for in production, even when the caller asks for it', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      txDouble.queue([]);

      expect(await ensureOrganizationMembership({ ...linking, allowAutoProvisioning: false })).toBe('none');

      expect(txDouble.statements.map((statement) => statement.kind)).toEqual(['select']);
      expect(mocks.audit).not.toHaveBeenCalled();
    });

    it('is not looked for with no e-mail, or an e-mail that is only blanks', async () => {
      for (const email of ['', '   ']) {
        txDouble.reset();
        txDouble.queue([]);
        expect(await ensureOrganizationMembership({ ...linking, email, allowAutoProvisioning: false })).toBe('none');
        expect(txDouble.statements).toHaveLength(1);
      }
    });

    it('is linked to the person, once, in its own organization, in the same transaction as its security audit event', async () => {
      txDouble.queue([], [seed('m1', ORG_A)], [{ id: 'm1' }]);

      expect(await ensureOrganizationMembership(linking)).toBe('linked');

      expect(txDouble.contexts).toEqual([{ organizationId: ORG_A, userId: PERSON }]);
      const update = statementsIn(ORG_A).find((statement) => statement.kind === 'update');
      expect(update?.set).toMatchObject({ userId: PERSON });
      // The audit row is written on the transaction that holds the update: no audit, no link.
      expect(mocks.audit).toHaveBeenCalledTimes(1);
      expect(mocks.audit).toHaveBeenCalledWith(txDouble.tx, {
        organizationId: ORG_A,
        userId: PERSON,
        action: 'membership.link_by_email',
        resourceType: 'organization_members',
        resourceId: 'm1',
        details: { previousUserId: 'placeholder-m1', matchedOn: 'email', trigger: 'dashboard_layout_sign_in' },
      });
    });

    it('is found by the e-mail with both sides lowered, so a mixed-case e-mail on either side matches, and with no whitespace', async () => {
      txDouble.queue([], []);

      await ensureOrganizationMembership({ ...linking, email: '  Pilot.User@Example.TEST ', allowAutoProvisioning: false });

      const lookup = statementsIn('system')[1];
      expect(lookup.where?.sql).toContain('lower("organization_members"."email") = lower($1)');
      expect(lookup.where?.params[0]).toBe('Pilot.User@Example.TEST');
    });

    it('is only an active membership that is not deleted, of another user id that nobody has signed in as', async () => {
      txDouble.queue([], []);

      await ensureOrganizationMembership({ ...linking, allowAutoProvisioning: false });

      const { sql, params } = statementsIn('system')[1].where!;
      expect(sql).toContain('"organization_members"."status" = $');
      expect(params).toContain('active');
      expect(sql).toContain('"organization_members"."deleted_at" is null');
      expect(sql).toContain('"organization_members"."user_id" <> $');
      expect(params).toContain(PERSON);
      // A membership of a person who has a profile (who has signed in as that user id) belongs to that person.
      expect(sql).toContain('not exists (select 1 from "profiles" where "profiles"."user_id" = "organization_members"."user_id")');
    });

    it('is changed only from the user id it was found with, so a concurrent request that took it first keeps it', async () => {
      txDouble.queue([], [seed('m1', ORG_A, 'placeholder-original')], [{ id: 'm1' }]);

      await ensureOrganizationMembership(linking);

      const update = statementsIn(ORG_A).find((statement) => statement.kind === 'update')!;
      expect(update.where?.sql).toContain('"organization_members"."user_id" = $');
      expect(update.where?.params).toContain('placeholder-original');
      expect(update.where?.params).toContain('m1');
      expect(update.where?.params).toContain(ORG_A);
      expect(update.where?.sql).toContain('"organization_members"."deleted_at" is null');
    });

    it('is not linked, and not audited, when another request took it first: the person finds that one', async () => {
      txDouble.queue([], [seed('m1', ORG_A)], [], [{ id: 'taken-by-the-other-request' }]);

      expect(await ensureOrganizationMembership(linking)).toBe('existing');
      expect(mocks.audit).not.toHaveBeenCalled();
    });

    it('is not linked when none is left, and the person is provisioned or sent on as without it', async () => {
      txDouble.queue([], [seed('m1', ORG_A)], [], []);

      expect(await ensureOrganizationMembership({ ...linking, allowAutoProvisioning: false })).toBe('none');
      expect(mocks.audit).not.toHaveBeenCalled();
    });

    it('links the oldest of the seeds of one organization only, and one of each organization', async () => {
      txDouble.queue([], [seed('old-a', ORG_A), seed('new-a', ORG_A), seed('only-b', ORG_B)], [{ id: 'old-a' }], [{ id: 'only-b' }]);

      expect(await ensureOrganizationMembership(linking)).toBe('linked');

      expect(txDouble.contexts).toEqual([
        { organizationId: ORG_A, userId: PERSON },
        { organizationId: ORG_B, userId: PERSON },
      ]);
      expect(mocks.audit.mock.calls.map(([, entry]) => entry.resourceId)).toEqual(['old-a', 'only-b']);
    });

    it('is not an outcome when its audit event cannot be written: the failure reaches the caller and nothing is reported linked', async () => {
      txDouble.queue([], [seed('m1', ORG_A)], [{ id: 'm1' }]);
      mocks.audit.mockRejectedValueOnce(new Error('audit sink unavailable'));

      await expect(ensureOrganizationMembership(linking)).rejects.toThrow('audit sink unavailable');
    });
  });

  describe('a person with no membership at all', () => {
    it('becomes an active, primary member of the default organization, as the runtime role in that organization, when that is permitted', async () => {
      txDouble.queue([]);

      expect(await ensureOrganizationMembership(base)).toBe('provisioned');

      expect(txDouble.contexts).toEqual([{ organizationId: DEFAULT_ORG, userId: PERSON }]);
      expect(statementsIn(DEFAULT_ORG)[0]).toMatchObject({
        kind: 'insert',
        values: { userId: PERSON, organizationId: DEFAULT_ORG, role: 'member', status: 'active', isPrimary: true, email: base.email },
      });
    });

    it('is told to request access when it is not', async () => {
      txDouble.queue([]);

      expect(await ensureOrganizationMembership({ ...base, allowAutoProvisioning: false })).toBe('none');
      expect(txDouble.contexts).toEqual([]);
    });
  });
});
