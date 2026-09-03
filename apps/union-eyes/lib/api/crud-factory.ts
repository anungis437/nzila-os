/**
 * CRUD Route Factory
 *
 * Generates standard withApi-wrapped handlers for common CRUD operations
 * on a Drizzle pgTable. Replaces hundreds of Django proxy routes with
 * real database queries.
 *
 * @example
 * // Collection route (route.ts)
 * import { crudRoutes } from '@/lib/api/crud-factory';
 * import { analyticsMetrics } from '@/db/schema';
 * const { GET, POST } = crudRoutes({
 *   table: analyticsMetrics,
 *   pk: 'id',
 *   tags: ['Analytics'],
 *   orgScoped: true,
 * });
 * export { GET, POST };
 *
 * // Item route ([id]/route.ts)
 * const { GET, PATCH, DELETE } = crudRoutes({
 *   table: analyticsMetrics,
 *   pk: 'id',
 *   tags: ['Analytics'],
 *   orgScoped: true,
 *   itemRoute: true,
 *   paramName: 'id',
 * });
 * export { GET, PATCH, DELETE };
 */
import { withApi } from './with-api';
import { ApiError } from './errors';
import { db } from '@/db/db';
import { eq, and, desc, count, sql, type SQL } from 'drizzle-orm';
import type { PgTable, PgColumn } from 'drizzle-orm/pg-core';
import type { NextRequest } from 'next/server';
import type { UserRole } from '@/lib/api-auth-guard';

// crud-factory's readRole/writeRole accept the full canonical role hierarchy
// (same set withApi's auth.minRole already enforces via ROLE_HIERARCHY), not
// just the 4 legacy shorthand values — so specialized roles like
// 'health_safety_rep' can be expressed without bypassing the type system.
type MinRole = UserRole;
type RouteHandler = (request: NextRequest, nextContext?: { params?: Record<string, string> | Promise<Record<string, string>> }) => Promise<Response>;

interface CollectionHandlers { GET: RouteHandler; POST: RouteHandler; }
interface ItemHandlers { GET: RouteHandler; PATCH: RouteHandler; DELETE: RouteHandler; }

export interface CrudOptions {
  /** The Drizzle pgTable reference */
  table: PgTable;
  /** Primary key column name (e.g. 'id', 'claimId', 'auditId'). Auto-detected if omitted or wrong. */
  pk?: string;
  /** OpenAPI tags */
  tags: string[];
  /** Whether the table has an organization_id column for scoping */
  orgScoped?: boolean;
  /** Column name to auto-filter by authenticated userId (e.g. 'memberId'). Restricts reads to the current user's own rows. */
  ownerColumn?: string;
  /** Whether this is an item route ([id]/route.ts) vs collection */
  itemRoute?: boolean;
  /** URL param name for the item ID (default: 'id') */
  paramName?: string;
  /** Column to order by (default: 'createdAt') */
  orderBy?: string;
  /** Minimum role for read operations (default: 'member') */
  readRole?: MinRole;
  /** Minimum role for write operations (default: 'steward') */
  writeRole?: MinRole;
  /** Default page size limit (default: 50) */
  defaultLimit?: number;
  /** Resource name for error messages (auto-derived from table name) */
  resourceName?: string;
  /** Platform module key for entitlement check (from PLATFORM_MODULES) */
  entitlement?: string;
  /**
   * Fields that cannot be mutated via PATCH (in addition to pk and organizationId).
   * Use for FSM-governed fields like `status` that must only change via explicit workflow APIs.
   */
  blockedPatchFields?: string[];
  /**
   * Optional transform applied to the insert payload before create, after
   * organizationId/createdBy are auto-set. Use this to normalize client field
   * names to schema column names, derive required unique identifiers (e.g.
   * report numbers), or fill in server-computed defaults.
   *
   * Security note: the factory re-asserts organizationId/createdBy from the
   * pre-transform values AFTER this hook runs, so this hook cannot remove or
   * override tenant/audit scoping even if it tries to (whether by accident or
   * by a bug in a future hook) — those two fields are always taken from the
   * authenticated request context, never from this hook's return value.
   */
  beforeCreate?: (
    values: Record<string, unknown>,
    ctx: { organizationId?: string | null; userId?: string | null },
  ) => Record<string, unknown> | Promise<Record<string, unknown>>;
  /**
   * Optional transform applied to the PATCH payload, after
   * `blockedPatchFields` have been stripped, before `.set(...)`. Receives
   * the row's CURRENT (pre-update) values via one extra SELECT — only
   * fetched when this hook is configured, so it costs nothing for the
   * ~300+ other crudRoutes() call sites that don't use it.
   *
   * Use this to protect a nested/JSON subfield that a flat
   * `blockedPatchFields` list can't reach — e.g. preserving one key inside
   * a JSONB column while still allowing the rest of that column to be
   * edited via ordinary PATCH.
   */
  beforeUpdate?: (
    updates: Record<string, unknown>,
    ctx: { id: string; organizationId?: string | null; userId?: string | null; existing: Record<string, unknown> },
  ) => Record<string, unknown> | Promise<Record<string, unknown>>;
  /**
   * JSONB column names whose PATCH value should be MERGED into the
   * existing value (`col || value`, via a locked read-then-write
   * transaction) rather than replacing the whole column.
   *
   * Use for a JSONB column that mixes server-owned and client-editable
   * keys: a plain `.set({col: mergedObject})` requires reading the row,
   * copying server-owned keys' current values into the merged object, then
   * writing the WHOLE column back — a lost-update race if anything else
   * changes a server-owned key between the read and the write (the PATCH
   * would overwrite it with the value it read earlier). A JSONB merge
   * never mentions server-owned keys at all (the caller is expected to
   * have already stripped them from the PATCH value, e.g. via a
   * `beforeUpdate` hook), so a concurrent write to one can never be
   * reverted — no lock across business logic required, only around the
   * read+write itself, which this option adds automatically.
   */
  mergeJsonColumns?: string[];
  /**
   * Re-authorizes the caller against the row loaded UNDER the PATCH's own
   * `SELECT ... FOR UPDATE` lock, immediately after it is acquired and
   * before `beforeUpdate`/the write (PR #752 round 25).
   *
   * A caller that enforces ownership/tenancy via a SEPARATE, unlocked
   * pre-check before ever invoking this factory (e.g. `withPilotOwnership`
   * wrapping the pilot item route) closes only part of the race: the row
   * can still change between that pre-check and this PATCH's own lock
   * being acquired (a concurrent platform rebind, for example) — the
   * pre-check's decision and the actual mutation are not atomic. This hook
   * lets the SAME ownership rule be re-evaluated against the row this
   * transaction is about to write, so the check and the mutation are
   * atomic with respect to that rule, regardless of what any earlier,
   * unlocked pre-check decided. Only invoked when `beforeUpdate` or
   * `mergeJsonColumns` is also configured (the transactional PATCH path);
   * a caller relying solely on this option with neither configured would
   * get no lock to re-authorize under.
   */
  lockedAuthCheck?: (
    existing: Record<string, unknown>,
    ctx: { id: string; organizationId?: string | null; userId?: string | null },
  ) => Promise<{ ok: true } | { ok: false; status: 401 | 403 }>;
}

function getColumn(table: PgTable, name: string): PgColumn | undefined {
  return (table as unknown as Record<string, PgColumn>)[name];
}

/** Auto-detect the primary key column on a Drizzle pgTable */
function findPrimaryKeyColumn(table: PgTable): { name: string; col: PgColumn } | undefined {
  for (const [name, col] of Object.entries(table as unknown as Record<string, unknown>)) {
    if (col && typeof col === 'object' && (col as { primary?: boolean }).primary === true) {
      return { name, col: col as PgColumn };
    }
    // Drizzle stores primaryKey flag in config
    if (col && typeof col === 'object' && (col as { config?: { primaryKey?: boolean } }).config?.primaryKey === true) {
      return { name, col: col as PgColumn };
    }
  }
  return undefined;
}

function getTableName(table: PgTable): string {
  const sym = Object.getOwnPropertySymbols(table).find(s => s.toString().includes('Name'));
  if (sym) return String((table as unknown as Record<symbol, unknown>)[sym]);
  return 'resource';
}

/**
 * Re-asserts factory-owned tenant/audit scoping on a `beforeCreate` result.
 * A hostile or buggy `beforeCreate` hook must never be able to remove or
 * replace `organizationId`/`createdBy` — those two fields always come from
 * the authenticated request context, never from a hook's return value.
 * Exported for direct unit testing of this invariant in isolation.
 */
export function enforceCreateSecurityInvariants(
  transformed: Record<string, unknown>,
  guard: {
    organizationId?: string | null;
    userId?: string | null;
    hasOrgColumn: boolean;
    hasCreatedByColumn: boolean;
  },
): Record<string, unknown> {
  const finalValues: Record<string, unknown> = { ...transformed };
  if (guard.hasOrgColumn && guard.organizationId) {
    finalValues.organizationId = guard.organizationId;
  }
  if (guard.hasCreatedByColumn && guard.userId) {
    finalValues.createdBy = guard.userId;
  }
  return finalValues;
}

/**
 * Strips PK, org-scope, and `blockedPatchFields` keys from a raw PATCH body
 * before it reaches `.set(...)`. Exported for direct unit testing of this
 * invariant in isolation (PR #752 round 21) — a route that forgets to list
 * a server-controlled column in `blockedPatchFields` is a silent bypass of
 * whatever platform-only flow was supposed to be the only writer of that
 * column (e.g. `verifiedOrganizationId`, FSM-governed `status`).
 */
export function stripBlockedPatchFields(
  body: unknown,
  guard: { pk: string; orgScoped: boolean; blockedPatchFields: string[] },
): Record<string, unknown> {
  const updates: Record<string, unknown> =
    body && typeof body === 'object' && !Array.isArray(body)
      ? { ...(body as Record<string, unknown>) }
      : {};

  delete updates[guard.pk];
  if (guard.orgScoped) delete updates.organizationId;
  for (const f of guard.blockedPatchFields) {
    delete updates[f];
  }
  return updates;
}

/**
 * Converts each column listed in `mergeJsonColumns` from a plain
 * replacement value into a JSONB merge SQL fragment
 * (`COALESCE(col, '{}'::jsonb) || value::jsonb`), when its PATCH value is a
 * plain object. Exported for direct unit testing of the merge-fragment
 * construction, independent of the transaction/lock wiring around it (PR
 * #752 round 24) — see `mergeJsonColumns`'s doc comment on `CrudOptions`
 * for why a merge (vs. a full-column replace) closes a lost-update race.
 */
export function buildMergeSetValues(
  updates: Record<string, unknown>,
  table: PgTable,
  mergeJsonColumns: string[],
): Record<string, unknown> {
  const setValues: Record<string, unknown> = { ...updates };
  for (const col of mergeJsonColumns) {
    if (!(col in setValues)) continue;
    const value = setValues[col];
    const colRef = getColumn(table, col);
    if (colRef && value && typeof value === 'object' && !Array.isArray(value)) {
      setValues[col] = sql`COALESCE(${colRef}, '{}'::jsonb) || ${JSON.stringify(value)}::jsonb`;
    }
  }
  return setValues;
}

/**
 * Rejects any `mergeJsonColumns` value that is present but NOT a plain JSON
 * object (PR #752 round 25). `buildMergeSetValues()` only converts a
 * merge column's value into a JSONB merge fragment when the value is a
 * plain object — an array, `null`, or a scalar falls through UNCHANGED and
 * reaches `.set()` as a literal, full-column REPLACEMENT. Since the whole
 * point of `mergeJsonColumns` is to make server-owned keys structurally
 * unreachable by a PATCH fragment, silently falling back to replacement
 * semantics for a non-object value is a direct bypass: a same-org steward
 * submitting `{"responses":[]}` would wipe `commercialState`, transition
 * history, scoring evidence, artifact/reference versions, monetization
 * state, and the ownership claim in one call, since `stripReservedResponsesKeysForPatch`-style
 * `beforeUpdate` hooks also only strip when the value is a non-array
 * object and otherwise leave it untouched. Called BEFORE any
 * `beforeUpdate` hook runs (fail closed at the door, not after a hook has
 * had a chance to "fix" the shape) — exported for direct unit testing.
 */
export function validateMergeJsonColumnValues(
  updates: Record<string, unknown>,
  mergeJsonColumns: string[],
): void {
  for (const col of mergeJsonColumns) {
    if (!(col in updates)) continue;
    const value = updates[col];
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw ApiError.badRequest(`${col} must be a JSON object`);
    }
  }
}

export function crudRoutes(opts: CrudOptions & { itemRoute: true }): ItemHandlers;
export function crudRoutes(opts: CrudOptions & { itemRoute?: false | undefined }): CollectionHandlers;
export function crudRoutes(opts: CrudOptions): CollectionHandlers | ItemHandlers {
  const {
    table,
    pk = 'id',
    tags,
    orgScoped = true,
    itemRoute = false,
    paramName = 'id',
    orderBy = 'createdAt',
    readRole = 'member',
    writeRole = 'steward',
    defaultLimit = 50,
    blockedPatchFields = [],
    mergeJsonColumns = [],
  } = opts;

  const resourceName = opts.resourceName ?? getTableName(table);

  // Resolve PK: try specified name first, then auto-detect from schema
  let pkCol = getColumn(table, pk);
  let resolvedPk = pk;
  if (!pkCol) {
    const detected = findPrimaryKeyColumn(table);
    if (detected) {
      pkCol = detected.col;
      resolvedPk = detected.name;
    }
  }

  const orgCol = orgScoped ? getColumn(table, 'organizationId') : undefined;
  const ownerCol = opts.ownerColumn ? getColumn(table, opts.ownerColumn) : undefined;
  const orderCol = getColumn(table, orderBy);

  if (itemRoute) {
    return buildItemHandlers();
  }
  return buildCollectionHandlers();

  function buildCollectionHandlers() {
    const GET = withApi(
      {
        auth: { required: true, minRole: readRole },
        entitlement: opts.entitlement,
        openapi: {
          tags,
          summary: `List ${resourceName}`,
          description: `Returns a paginated list of ${resourceName}.`,
        },
      },
      async ({ request, organizationId, userId }) => {
        const url = new URL(request.url);
        const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
        const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || String(defaultLimit))));
        const offset = (page - 1) * limit;

        const conditions: SQL[] = [];
        if (orgScoped && orgCol && organizationId) {
          conditions.push(eq(orgCol, organizationId));
        }
        if (ownerCol && userId) {
          conditions.push(eq(ownerCol, userId));
        }

        const whereClause = conditions.length > 0
          ? and(...conditions)
          : undefined;

        const baseQuery = db.select().from(table);
        const countQuery = db.select({ total: count() }).from(table);

        const withWhere = whereClause
          ? [
              baseQuery.where(whereClause),
              countQuery.where(whereClause),
            ] as const
          : [baseQuery, countQuery] as const;

        const ordered = orderCol
          ? withWhere[0].orderBy(desc(orderCol))
          : withWhere[0];

        const [rows, totalResult] = await Promise.all([
          ordered.limit(limit).offset(offset),
          withWhere[1],
        ]);

        const total = totalResult[0]?.total ?? 0;

        return {
          data: rows,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        };
      },
    );

    const POST = withApi(
      {
        auth: { required: true, minRole: writeRole },
        entitlement: opts.entitlement,
        openapi: {
          tags,
          summary: `Create ${resourceName}`,
          description: `Creates a new ${resourceName} record.`,
        },
      },
      async ({ body, organizationId, userId }) => {
        const values: Record<string, unknown> =
          body && typeof body === 'object' && !Array.isArray(body)
            ? { ...(body as Record<string, unknown>) }
            : {};

        if (orgScoped && orgCol && organizationId) {
          values.organizationId = organizationId;
        }

        // Auto-set common audit fields
        const createdByCol = getColumn(table, 'createdBy');
        if (createdByCol && userId) {
          values.createdBy = userId;
        }

        const transformed = opts.beforeCreate
          ? await opts.beforeCreate(values, { organizationId, userId })
          : values;

        // Security invariant: beforeCreate may normalize/derive business
        // fields, but it must never be able to remove or override the
        // factory-established tenant/audit scoping. Re-assert both values
        // from the pre-transform object after the hook runs, no matter what
        // the hook returned.
        const finalValues = enforceCreateSecurityInvariants(transformed, {
          organizationId,
          userId,
          hasOrgColumn: Boolean(orgScoped && orgCol),
          hasCreatedByColumn: Boolean(createdByCol),
        });

        const [row] = await db.insert(table).values(finalValues).returning();
        return { data: row };
      },
    );

    return { GET, POST };
  }

  function buildItemHandlers() {
    if (!pkCol) {
      throw new Error(`crud-factory: PK column "${resolvedPk}" not found on table "${resourceName}" (tried "${pk}" and auto-detect)`);
    }

    const GET = withApi(
      {
        auth: { required: true, minRole: readRole },
        entitlement: opts.entitlement,
        openapi: {
          tags,
          summary: `Get ${resourceName} by ID`,
          description: `Returns a single ${resourceName} record.`,
        },
      },
      async ({ params, organizationId }) => {
        const id = params[paramName];
        const conditions: SQL[] = [eq(pkCol, id)];
        if (orgScoped && orgCol && organizationId) {
          conditions.push(eq(orgCol, organizationId));
        }

        const [row] = await db.select().from(table).where(and(...conditions));
        if (!row) throw ApiError.notFound(`${resourceName} not found`);
        return { data: row };
      },
    );

    const PATCH = withApi(
      {
        auth: { required: true, minRole: writeRole },
        entitlement: opts.entitlement,
        openapi: {
          tags,
          summary: `Update ${resourceName}`,
          description: `Updates an existing ${resourceName} record.`,
        },
      },
      async ({ body, params, organizationId, userId }) => {
        const id = params[paramName];
        let updates = stripBlockedPatchFields(body, { pk, orgScoped, blockedPatchFields });

        // Fail closed BEFORE opening a transaction or running any hook: a
        // merge column can only ever be safely converted into a JSONB
        // merge fragment when its value is a plain object (PR #752
        // round 25) — see validateMergeJsonColumnValues's doc comment.
        if (mergeJsonColumns.length > 0) {
          validateMergeJsonColumnValues(updates, mergeJsonColumns);
        }

        const conditions: SQL[] = [eq(pkCol, id)];
        if (orgScoped && orgCol && organizationId) {
          conditions.push(eq(orgCol, organizationId));
        }

        if (opts.beforeUpdate || mergeJsonColumns.length > 0) {
          // Locked read-then-write: the row cannot change between the hook
          // seeing it and the final write, closing the lost-update race a
          // plain read-then-`.set()` (below) cannot. `mergeJsonColumns`
          // additionally turns each listed column's value into a JSONB
          // merge (`col || value`) rather than a full-column replace, so a
          // concurrent write to a key the merge fragment doesn't mention
          // can never be reverted by this PATCH.
          const [row] = await db.transaction(async (tx) => {
            const [existingRow] = await tx
              .select()
              .from(table)
              .where(and(...conditions))
              .limit(1)
              .for('update');
            if (!existingRow) throw ApiError.notFound(`${resourceName} not found`);

            if (opts.lockedAuthCheck) {
              // Re-evaluate ownership/tenancy against THIS locked, guaranteed-
              // fresh row — not whatever an earlier, unlocked pre-check saw
              // (PR #752 round 25 rebind-TOCTOU fix).
              const authResult = await opts.lockedAuthCheck(existingRow as Record<string, unknown>, {
                id,
                organizationId,
                userId,
              });
              if (!authResult.ok) {
                throw authResult.status === 401 ? ApiError.unauthorized() : ApiError.forbidden();
              }
            }

            if (opts.beforeUpdate) {
              updates = await opts.beforeUpdate(updates, {
                id,
                organizationId,
                userId,
                existing: existingRow as Record<string, unknown>,
              });
            }

            const updatedAtCol = getColumn(table, 'updatedAt');
            if (updatedAtCol) {
              updates.updatedAt = new Date();
            }

            const setValues = buildMergeSetValues(updates, table, mergeJsonColumns);

            return tx.update(table).set(setValues).where(and(...conditions)).returning();
          });

          if (!row) throw ApiError.notFound(`${resourceName} not found`);
          return { data: row };
        }

        // Auto-set updatedAt if column exists
        const updatedAtCol = getColumn(table, 'updatedAt');
        if (updatedAtCol) {
          updates.updatedAt = new Date();
        }

        const [row] = await db.update(table)
          .set(updates)
          .where(and(...conditions))
          .returning();

        if (!row) throw ApiError.notFound(`${resourceName} not found`);
        return { data: row };
      },
    );

    const DELETE = withApi(
      {
        auth: { required: true, minRole: 'admin' },
        entitlement: opts.entitlement,
        openapi: {
          tags,
          summary: `Delete ${resourceName}`,
          description: `Soft-deletes a ${resourceName} record (sets status to archived).`,
        },
      },
      async ({ params, organizationId }) => {
        const id = params[paramName];
        const conditions: SQL[] = [eq(pkCol, id)];
        if (orgScoped && orgCol && organizationId) {
          conditions.push(eq(orgCol, organizationId));
        }

        // Try soft delete first (status → archived), fall back to hard delete
        const statusCol = getColumn(table, 'status');
        if (statusCol) {
          const [row] = await db.update(table)
            .set({ status: 'archived', updatedAt: new Date() } as Record<string, unknown>)
            .where(and(...conditions))
            .returning();
          if (!row) throw ApiError.notFound(`${resourceName} not found`);
          return { data: row };
        }

        // Hard delete for tables without a status column
        const [deleted] = await db.delete(table)
          .where(and(...conditions))
          .returning();
        if (!deleted) throw ApiError.notFound(`${resourceName} not found`);
        return { data: deleted };
      },
    );

    return { GET, PATCH, DELETE };
  }
}
