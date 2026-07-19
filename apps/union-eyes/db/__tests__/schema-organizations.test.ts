import { describe, it, expect } from 'vitest';
import { is, Relations, Table } from 'drizzle-orm';
import { getTableConfig, pgTable, serial } from 'drizzle-orm/pg-core';
import * as orgSchema from '../schema-organizations';

/**
 * `db/schema-organizations.ts` is a declarative Drizzle schema. We exercise the
 * function-valued pieces it contributes: foreign-key `() => column` reference
 * callbacks (both table columns and the standalone migration column fragments)
 * and the `({ one, many }) => ({...})` relation config callbacks.
 */

const makeRelation = () => {
  const relation: { withFieldName: () => unknown } = {
    withFieldName: () => relation,
  };
  return relation;
};
const one = (_table: unknown, _config?: unknown) => makeRelation();
const many = (_table: unknown, _config?: unknown) => makeRelation();

describe('db/schema-organizations schema', () => {
  it('exports the core tables, enums and relations', () => {
    expect(is(orgSchema.organizations, Table)).toBe(true);
    expect(is(orgSchema.organizationRelationships, Table)).toBe(true);
    expect(is(orgSchema.organizationMembers, Table)).toBe(true);
    expect(is(orgSchema.organizationsRelations, Relations)).toBe(true);
  });

  it('resolves every table config and foreign-key reference', () => {
    for (const value of Object.values(orgSchema)) {
      if (!is(value, Table)) continue;
      const config = getTableConfig(value);
      expect(config.columns.length).toBeGreaterThan(0);
      for (const fk of config.foreignKeys) {
        const ref = fk.reference();
        expect(ref.foreignColumns.length).toBeGreaterThan(0);
      }
    }
  });

  it('resolves the standalone organization-migration column references', () => {
    const migrationFragments = [
      orgSchema.claimsOrganizationMigration,
      orgSchema.membersOrganizationMigration,
      orgSchema.strikeFundsOrganizationMigration,
      orgSchema.duesPaymentsOrganizationMigration,
      orgSchema.deadlinesOrganizationMigration,
      orgSchema.documentsOrganizationMigration,
    ];

    migrationFragments.forEach((fragment, idx) => {
      // Wrapping the fragment in a throwaway table forces Drizzle to evaluate
      // the `() => organizations.id` reference callbacks via getTableConfig.
      const throwaway = pgTable(`__migration_probe_${idx}`, {
        id: serial('id').primaryKey(),
        ...fragment,
      });
      const config = getTableConfig(throwaway);
      for (const fk of config.foreignKeys) {
        const ref = fk.reference();
        expect(ref.foreignColumns.length).toBeGreaterThan(0);
      }
    });
  });

  it('invokes every relation config callback', () => {
    let relationCount = 0;
    for (const value of Object.values(orgSchema)) {
      if (!is(value, Relations)) continue;
      relationCount++;
      const config = (value as Relations).config({ one, many } as never);
      expect(config).toBeTruthy();
    }
    expect(relationCount).toBeGreaterThanOrEqual(4);
  });

  describe('hierarchy type guards', () => {
    const org = (over: Partial<orgSchema.Organization>) =>
      ({
        organizationType: 'union',
        parentId: null,
        hierarchyLevel: 0,
        ...over,
      }) as orgSchema.Organization;

    it('isCLCRootOrg matches a top-level congress only', () => {
      expect(orgSchema.isCLCRootOrg(org({ organizationType: 'congress', parentId: null }))).toBe(true);
      expect(orgSchema.isCLCRootOrg(org({ organizationType: 'congress', parentId: 'p' }))).toBe(false);
      expect(orgSchema.isCLCRootOrg(org({ organizationType: 'union', parentId: null }))).toBe(false);
    });

    it('isNationalUnion matches a level-1 union', () => {
      expect(orgSchema.isNationalUnion(org({ organizationType: 'union', hierarchyLevel: 1 }))).toBe(true);
      expect(orgSchema.isNationalUnion(org({ organizationType: 'union', hierarchyLevel: 2 }))).toBe(false);
      expect(orgSchema.isNationalUnion(org({ organizationType: 'local', hierarchyLevel: 1 }))).toBe(false);
    });

    it('isLocalUnion matches a local organization', () => {
      expect(orgSchema.isLocalUnion(org({ organizationType: 'local' }))).toBe(true);
      expect(orgSchema.isLocalUnion(org({ organizationType: 'union' }))).toBe(false);
    });

    it('isFederation matches a federation organization', () => {
      expect(orgSchema.isFederation(org({ organizationType: 'federation' }))).toBe(true);
      expect(orgSchema.isFederation(org({ organizationType: 'union' }))).toBe(false);
    });
  });
});
