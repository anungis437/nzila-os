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
import { eq, and, desc, count, type SQL } from 'drizzle-orm';
import type { PgTable, PgColumn } from 'drizzle-orm/pg-core';
import type { NextRequest } from 'next/server';

type MinRole = 'member' | 'steward' | 'officer' | 'admin';
type RouteHandler = (request: NextRequest, nextContext?: { params?: Record<string, string> | Promise<Record<string, string>> }) => Promise<Response>;

interface CollectionHandlers { GET: RouteHandler; POST: RouteHandler; }
interface ItemHandlers { GET: RouteHandler; PATCH: RouteHandler; DELETE: RouteHandler; }

export interface CrudOptions {
  /** The Drizzle pgTable reference */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: PgTable<any>;
  /** Primary key column name (e.g. 'id', 'claimId', 'auditId'). Auto-detected if omitted or wrong. */
  pk?: string;
  /** OpenAPI tags */
  tags: string[];
  /** Whether the table has an organization_id column for scoping */
  orgScoped?: boolean;
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
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getColumn(table: PgTable<any>, name: string): PgColumn | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (table as any)[name] as PgColumn | undefined;
}

/** Auto-detect the primary key column on a Drizzle pgTable */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findPrimaryKeyColumn(table: PgTable<any>): { name: string; col: PgColumn } | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const [name, col] of Object.entries(table as any)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (col && typeof col === 'object' && (col as any).primary === true) {
      return { name, col: col as PgColumn };
    }
    // Drizzle stores primaryKey flag in config
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (col && typeof col === 'object' && (col as any).config?.primaryKey === true) {
      return { name, col: col as PgColumn };
    }
  }
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getTableName(table: PgTable<any>): string {
  const sym = Object.getOwnPropertySymbols(table).find(s => s.toString().includes('Name'));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (sym) return String((table as unknown as Record<symbol, any>)[sym]);
  return 'resource';
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
      async ({ request, organizationId }) => {
        const url = new URL(request.url);
        const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
        const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || String(defaultLimit))));
        const offset = (page - 1) * limit;

        const conditions: SQL[] = [];
        if (orgScoped && orgCol && organizationId) {
          conditions.push(eq(orgCol, organizationId));
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
      async ({ request, organizationId, userId }) => {
        const body = await request.json();
        const values: Record<string, unknown> = { ...body };

        if (orgScoped && orgCol && organizationId) {
          values.organizationId = organizationId;
        }

        // Auto-set common audit fields
        const createdByCol = getColumn(table, 'createdBy');
        if (createdByCol && userId) {
          values.createdBy = userId;
        }

        const [row] = await db.insert(table).values(values).returning();
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
      async ({ request, params, organizationId }) => {
        const id = params[paramName];
        const body = await request.json();
        const updates: Record<string, unknown> = { ...body };

        // Auto-set updatedAt if column exists
        const updatedAtCol = getColumn(table, 'updatedAt');
        if (updatedAtCol) {
          updates.updatedAt = new Date();
        }

        // Never allow PK or orgId to be overwritten via PATCH
        delete updates[pk];
        if (orgScoped) delete updates.organizationId;

        const conditions: SQL[] = [eq(pkCol, id)];
        if (orgScoped && orgCol && organizationId) {
          conditions.push(eq(orgCol, organizationId));
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
