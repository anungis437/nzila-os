import { describe, it, expect } from 'vitest';
import { is } from 'drizzle-orm';
import { Table } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';

import {
  UE_ORG_SCOPED_TABLES,
  UE_NON_ORG_SCOPED_TABLES,
  UE_ORG_SCOPED_TABLE_SET,
  UE_NON_ORG_SCOPED_TABLE_SET,
} from '../org-registry';
import { applications } from '../schema-applications';
import { seedChildOrganizations } from '../seeds/seed-child-orgs';
import { seedOrganizationHierarchy } from '../seeds/seed-org-hierarchy';

describe('db/org-registry', () => {
  it('derives the non-org-scoped table-name set from the registry', () => {
    // Importing the module runs the `.map((t) => t.table)` callback that builds
    // UE_NON_ORG_SCOPED_TABLE_SET.
    expect(UE_NON_ORG_SCOPED_TABLE_SET.has('users')).toBe(true);
    expect(UE_NON_ORG_SCOPED_TABLE_SET.size).toBe(UE_NON_ORG_SCOPED_TABLES.length);
  });

  it('keeps the org-scoped registry and its set in sync', () => {
    expect(UE_ORG_SCOPED_TABLE_SET.has('organizations')).toBe(true);
    expect(UE_ORG_SCOPED_TABLE_SET.size).toBe(UE_ORG_SCOPED_TABLES.length);
  });
});

describe('db/schema-applications', () => {
  it('defines the applications table with its indexes', () => {
    expect(is(applications, Table)).toBe(true);
    const config = getTableConfig(applications);
    expect(config.name).toBe('applications');
    expect(config.indexes.length).toBeGreaterThanOrEqual(2);
  });
});

describe('db/seeds', () => {
  it('seedChildOrganizations returns an empty seed summary', async () => {
    await expect(seedChildOrganizations()).resolves.toEqual({
      localsCreated: 0,
      districtsCreated: 0,
      skipped: [],
    });
  });

  it('seedOrganizationHierarchy returns an empty seed summary', async () => {
    await expect(seedOrganizationHierarchy()).resolves.toEqual({
      federationsCreated: 0,
      affiliatesCreated: 0,
      skipped: [],
    });
  });
});
