import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth-guard';
import { withPrincipalOnlyContext, withRLSContext, type RLSTx } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { logger } from '@/lib/logger';
import {
  authorizeExternalMatterAccess,
  holdsExternalAuthority,
  type ExternalMatterPermission,
} from '@/lib/services/external-resource-authorization-service';
import { representationAuthorityScopeEnum, type RepresentationAuthority } from '@/db/schema/representation-authority-schema';

const IDENTIFIER_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ExternalResourceContext {
  actor: {
    userId: string;
    representativeOrganizationId?: string;
  };
  organizationId: string;
  matterType: RepresentationAuthority['matterType'];
  matterId: string;
  authorityId: string;
  matterGrantId: string;
}

export type ExternalResourceParams = {
  organizationId: string;
  matterType: RepresentationAuthority['matterType'];
  matterId: string;
};

type NextRouteContext<TParams extends object> = {
  params?: TParams | Promise<TParams>;
};

type ExternalRouteContext<TParams extends object> = TParams | Promise<TParams> | NextRouteContext<TParams>;

function isPromiseLike<T>(value: unknown): value is Promise<T> {
  return Boolean(value && typeof (value as { then?: unknown }).then === 'function');
}

async function resolveRouteParams<TParams extends object>(
  params?: ExternalRouteContext<TParams>,
): Promise<TParams | undefined> {
  if (!params) {
    return undefined;
  }

  if (isPromiseLike<TParams>(params)) {
    return await params;
  }

  if ('params' in params) {
    return await params.params;
  }

  return params as TParams;
}

/** What the handler of a route that runs inside the organization transaction receives: the transaction itself, to read and write on. */
export interface ExternalResourceTxContext extends ExternalResourceContext {
  /** The organization transaction the authorization decision was made on; the handler's statements and the read record share it. */
  tx: RLSTx;
}

interface ExternalMatterResourceOptions<TParams extends object> {
  requiredPermission: ExternalMatterPermission;
  resolve: (request: Request, params?: TParams) => ExternalResourceParams;
  /**
   * Who records a successful read. 'middleware' (default): one record written here, in the same transaction as the read, carrying the
   * authorization decision. 'handler': the route writes its own, more specific record (the document download does).
   */
  readRecord?: 'middleware' | 'handler';
}

type ExternalRouteHandler<TParams extends object> = (
  request: Request,
  params?: ExternalRouteContext<TParams>,
) => Promise<Response>;

/**
 * Authorizes an external representative against one matter, then runs the handler.
 *
 * The handler normally runs inside the organization transaction the decision was made on and receives it as `context.tx`. A handler
 * that reaches storage or the network sets `transaction: 'authorization'`: only the decision (and its record) runs in a transaction,
 * the handler runs after it has closed and opens the short transactions it needs itself, so no connection is held across the slow
 * call. That mode needs `readRecord: 'handler'`, because the read record can only share a transaction with a read made on it.
 */
export function withExternalMatterResourceAuth<TParams extends object = ExternalResourceParams>(
  options: ExternalMatterResourceOptions<TParams> & { transaction: 'authorization'; readRecord: 'handler' },
  handler: (request: Request, context: ExternalResourceContext, params?: TParams) => Promise<Response> | Response,
): ExternalRouteHandler<TParams>;
export function withExternalMatterResourceAuth<TParams extends object = ExternalResourceParams>(
  options: ExternalMatterResourceOptions<TParams> & { transaction?: 'handler' },
  handler: (request: Request, context: ExternalResourceTxContext, params?: TParams) => Promise<Response> | Response,
): ExternalRouteHandler<TParams>;
export function withExternalMatterResourceAuth<TParams extends object = ExternalResourceParams>(
  options: ExternalMatterResourceOptions<TParams> & { transaction?: 'handler' | 'authorization' },
  handler: (request: Request, context: ExternalResourceTxContext, params?: TParams) => Promise<Response> | Response,
): ExternalRouteHandler<TParams> {
  if (options.transaction === 'authorization' && (options.readRecord ?? 'middleware') === 'middleware') {
    throw new Error("withExternalMatterResourceAuth: transaction 'authorization' needs readRecord 'handler'");
  }
  return async (request: Request, params?: ExternalRouteContext<TParams>) => {
    try {
      const user = await requireUser();
      const routeParams = await resolveRouteParams(params);
      const resource = options.resolve(request, routeParams);
      // A request that names no organization or no matter holds no grant: it is refused as any request without one is (default deny).
      if (!resource.organizationId || !resource.matterId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      // A malformed organization or matter identifier, or an unknown matter type, names nothing: it is a bad request, not something to
      // send to the database to fail there.
      if (
        !IDENTIFIER_PATTERN.test(resource.organizationId)
        || !IDENTIFIER_PATTERN.test(resource.matterId)
        || !(representationAuthorityScopeEnum.enumValues as readonly string[]).includes(resource.matterType)
      ) {
        return NextResponse.json({ error: 'organizationId and matterId are required' }, { status: 400 });
      }
      const actor = {
        userId: user.userId,
        representativeOrganizationId: (user as { organizationId?: string }).organizationId,
      };

      // The organization in the request is the caller's word. Before that organization's tenant transaction is opened (and before anything is
      // written to its audit trail), the caller must hold a live representation authority there for this matter, asked with no organization
      // context, where the only rows visible are the caller's own. Someone who holds none is refused here and no tenant transaction is opened.
      // An external representative is never an organization member by definition, so canonical V2's organization-membership binder is a
      // separate, non-overlapping concern and cannot stand in for this check: it runs in both legacy and V2 mode (DEF-0B8-FED-EXTERNAL-ORGANIZATION-FROM-QUERY-OPENS-TENANT-CONTEXT-AND-AUDIT-BEFORE-GRANT).
      {
        const held = await withPrincipalOnlyContext((tx) => holdsExternalAuthority(tx, {
          actorUserId: actor.userId,
          organizationId: resource.organizationId,
          matterType: resource.matterType,
          matterId: resource.matterId,
        }));
        if (!held) {
          logger.warn('External request refused before any organization context: no authority held', { permission: options.requiredPermission });
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }

      const method = request.method.toUpperCase();
      const isRead = method === 'GET' || method === 'HEAD';
      const middlewareRecordsRead = isRead && (options.readRecord ?? 'middleware') === 'middleware';

      const authorize = (tx: RLSTx) =>
        authorizeExternalMatterAccess(tx, {
          actor,
          organizationId: resource.organizationId,
          matterType: resource.matterType,
          matterId: resource.matterId,
          requiredPermission: options.requiredPermission,
        }, { recordAllowed: !middlewareRecordsRead });

      if (options.transaction === 'authorization') {
        // Only the decision is made on a transaction; the handler reaches storage or the network, so it runs once that connection is
        // released and opens its own short transactions.
        const decision = await withRLSContext({ organizationId: resource.organizationId }, authorize);
        if (!decision.allowed || !decision.authorityId || !decision.matterGrantId) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        return await handler(request, {
          actor,
          organizationId: resource.organizationId,
          matterType: resource.matterType,
          matterId: resource.matterId,
          authorityId: decision.authorityId,
          matterGrantId: decision.matterGrantId,
        } as ExternalResourceTxContext, routeParams);
      }

      return await withRLSContext({ organizationId: resource.organizationId }, async (tx) => {
        const decision = await authorize(tx);

        if (!decision.allowed || !decision.authorityId || !decision.matterGrantId) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const response = await handler(request, {
          actor,
          organizationId: resource.organizationId,
          matterType: resource.matterType,
          matterId: resource.matterId,
          authorityId: decision.authorityId,
          matterGrantId: decision.matterGrantId,
          tx,
        }, routeParams);

        // The read happened on this transaction; its record is written on it too, before the response is released. A record that cannot
        // be written throws, the transaction (and anything the read touched) is abandoned, and the outside party receives nothing.
        if (middlewareRecordsRead && response.status < 400) {
          await persistAtomicAudit(tx, {
            organizationId: resource.organizationId,
            userId: actor.userId,
            action: 'external.resource.read',
            resourceType: resource.matterType,
            resourceId: resource.matterId,
            details: {
              actorKind: 'external_representative',
              representativeOrganizationId: actor.representativeOrganizationId ?? null,
              permission: options.requiredPermission,
              reason: decision.reason,
              authorityId: decision.authorityId,
              matterGrantId: decision.matterGrantId,
              method,
              status: response.status,
              routeResourceId: typeof (routeParams as { id?: unknown } | undefined)?.id === 'string' ? (routeParams as { id: string }).id : null,
            },
          });
        }
        return response;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      logger.error('External matter resource request failed closed', error, {
        requiredPermission: options.requiredPermission,
      });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  };
}
