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
