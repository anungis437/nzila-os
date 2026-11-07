import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { getTableName } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { assertCrudWrite, crudGovernanceFor } from '../crud-governance';

// DEF-0B3-CRUD-BODY-MASS-ASSIGNMENT: every generic CRUD route that exposes a write must name, explicitly, the minimal
// set of body fields its screens send. The factory fails closed without that list (see crud-factory-fields.test.ts);
// this census enumerates every crudRoutes( usage under app/api, loads the route, and checks each exported writer.

type Captured = { opts: Record<string, unknown>; handlers: Record<string, unknown> };
const calls = vi.hoisted(() => ({ current: [] as Captured[] }));

vi.mock('@/lib/api/crud-factory', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    crudRoutes: (opts: Record<string, unknown>) => {
      const handlers = opts.itemRoute
        ? { GET: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() }
        : { GET: vi.fn(), POST: vi.fn() };
      calls.current.push({ opts, handlers });
      return handlers;
    },
  };
});

const APP = fileURLToPath(new URL('../../../', import.meta.url));
const API = join(APP, 'app', 'api');

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : routeFiles(path);
    return name === 'route.ts' && readFileSync(path, 'utf8').includes('crudRoutes(') ? [path] : [];
  });
}

/** Columns a client body must never set: identity, tenancy, attribution, lifecycle stamps and certification facts. */
const NEVER_CLIENT_WRITABLE = new Set([
  'id', 'organizationId', 'createdBy', 'updatedBy', 'deletedBy', 'createdAt', 'updatedAt', 'deletedAt', 'archivedAt',
  'verifiedAt', 'verifiedBy', 'approvedAt', 'approvedBy', 'submittedAt', 'reviewedAt', 'reviewedBy', 'publishedAt', 'publishedBy',
  'certificationNumber', 'certificationDate', 'certificationBody', 'certificationExpiryDate', 'chiefStewardId', 'bargainingChairId',
  'memberCount',
]);

const files = routeFiles(API).sort();

function governanceAllowsWrite(table: PgTable, hasOwnerColumn: boolean): boolean {
  try {
    assertCrudWrite({ ...crudGovernanceFor(table), hasOwnerColumn });
    return true;
  } catch {
    return false;
  }
}

describe('every generic CRUD writer declares an explicit, minimal writableFields list', () => {
  it('finds the generic routes (guards against the census silently scanning nothing)', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it.each(files.map((file) => [relative(API, file).split(sep).join('/')]))('%s', async (route) => {
    calls.current = [];
    const mod = (await import(/* @vite-ignore */ join(API, route))) as Record<string, unknown>;
    expect(calls.current.length, 'route builds at least one crudRoutes() handler set').toBeGreaterThan(0);
    for (const { opts, handlers } of calls.current) {
      const exportedWriters = (['POST', 'PATCH'] as const).filter((verb) => handlers[verb] && mod[verb] === handlers[verb]);
      if (exportedWriters.length === 0) continue;
      const table = opts.table as PgTable;
      // A table whose governance class refuses every generic write (DENIED, READ_ONLY, OWN_ROWS_READ, or subject-owned without an owner
      // column) answers 403 before any field is read, so its exported writer writes nothing and needs no list.
      if (!governanceAllowsWrite(table, Boolean(opts.ownerColumn))) continue;
      const writable = opts.writableFields as readonly string[] | undefined;
      expect(Array.isArray(writable), `${route} exports ${exportedWriters.join('/')} over ${getTableName(table)} with no writableFields`).toBe(true);
      const owner = opts.ownerColumn as string | undefined;
      const blocked = new Set((opts.blockedPatchFields as string[] | undefined) ?? []);
      for (const field of writable!) {
        expect((table as unknown as Record<string, unknown>)[field], `${route}: ${field} is not a column of ${getTableName(table)}`).toBeDefined();
        expect(NEVER_CLIENT_WRITABLE.has(field), `${route}: ${field} is server-owned`).toBe(false);
        expect(blocked.has(field), `${route}: ${field} is both writable and blocked`).toBe(false);
        if (field === owner) expect(opts.staffMayNameOwner, `${route}: owner column ${field} writable without staffMayNameOwner`).toBe(true);
        const pk = (opts.pk as string | undefined) ?? 'id';
        expect(field, `${route}: primary key is writable`).not.toBe(pk);
      }
    }
  });
});
