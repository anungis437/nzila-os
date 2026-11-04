import { readFileSync } from 'node:fs';
import { getTableColumns } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { bargainingUnits, committees, employers, worksites } from '@/db/schema/union-structure-schema';

/** The columns a route leaves out of what it sends (its `omitFromResponse`), read from the route so a fixture cannot drift from it. */
function omittedBy(routeFile: string): string[] {
  const source = readFileSync(`app/api/${routeFile}/route.ts`, 'utf8');
  const list = /omitFromResponse:\s*\[([^\]]*)\]/.exec(source)?.[1] ?? '';
  return [...list.matchAll(/'([^']+)'/g)].map((match) => match[1]);
}

/**
 * A row exactly as a CRUD-factory list route sends it: every column of the table, by its property name, except the ones the route omits, each
 * null unless the test gives a value. A value for a name the route does not send is a mistake in the test, so it is refused.
 */
function routeRow(table: PgTable, routeFile: string, values: Record<string, unknown>): Record<string, unknown> {
  const omitted = omittedBy(routeFile);
  const row: Record<string, unknown> = {};
  for (const key of Object.keys(getTableColumns(table))) if (!omitted.includes(key)) row[key] = null;
  for (const key of Object.keys(values)) {
    if (!(key in row)) throw new Error(`${key} is not a field /api/${routeFile} sends`);
  }
  return { ...row, ...values };
}

const STAMPS = { createdAt: '2026-03-04T10:00:00.000Z', updatedAt: '2026-03-04T10:00:00.000Z' };

export const employerRow = (values: Record<string, unknown>) =>
  routeRow(employers, 'employers', {
    id: 'emp-1',
    organizationId: 'org-1',
    name: 'Acme Corp',
    employerType: 'private',
    status: 'active',
    ...STAMPS,
    ...values,
  });

export const worksiteRow = (values: Record<string, unknown>) =>
  routeRow(worksites, 'worksites', {
    id: 'ws-1',
    organizationId: 'org-1',
    employerId: 'emp-1',
    name: 'Plant A',
    status: 'active',
    operatesWeekends: false,
    operates24Hours: false,
    ...STAMPS,
    ...values,
  });

export const unitRow = (values: Record<string, unknown>) =>
  routeRow(bargainingUnits, 'units', {
    id: 'unit-1',
    organizationId: 'org-1',
    employerId: 'emp-1',
    name: 'Maintenance Unit',
    unitType: 'full_time',
    status: 'active',
    memberCount: 0,
    ...STAMPS,
    ...values,
  });

export const committeeRow = (values: Record<string, unknown>) =>
  routeRow(committees, 'committees', {
    id: 'com-1',
    organizationId: 'org-1',
    name: 'Bargaining Committee',
    committeeType: 'bargaining',
    status: 'active',
    isOrganizationWide: false,
    currentMemberCount: 0,
    requiresAppointment: false,
    requiresElection: false,
    ...STAMPS,
    ...values,
  });

/** What a CRUD-factory list sends: { data: rows, pagination } inside withApi's { success, data, timestamp } envelope. */
export const list = (rows: unknown[], page = 1, totalPages = 1) => ({
  success: true,
  data: { data: rows, pagination: { page, limit: 100, total: rows.length, totalPages } },
  timestamp: '2026-03-04T00:00:00.000Z',
});

/** What a CRUD-factory item route sends for a write. */
export const item = (row: unknown) => ({ success: true, data: { data: row }, timestamp: '2026-03-04T00:00:00.000Z' });
