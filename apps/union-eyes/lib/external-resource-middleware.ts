import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth-guard';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { logger } from '@/lib/logger';
import {
  authorizeExternalMatterAccess,
  type ExternalMatterPermission,
} from '@/lib/services/external-resource-authorization-service';
import type { RepresentationAuthority } from '@/db/schema/representation-authority-schema';

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

export function withExternalMatterResourceAuth<TParams extends object = ExternalResourceParams>(
  options: {
    requiredPermission: ExternalMatterPermission;
    resolve: (request: Request, params?: TParams) => ExternalResourceParams;
    /**
     * Who records a successful read. 'middleware' (default): one record written here, in the same transaction as the read, carrying the
     * authorization decision. 'handler': the route writes its own, more specific record (the document download does).
     */
    readRecord?: 'middleware' | 'handler';
  },
  handler: (
    request: Request,
    context: ExternalResourceContext,
    params?: TParams,
  ) => Promise<Response> | Response,
) {
  return async (request: Request, params?: ExternalRouteContext<TParams>) => {
    try {
      const user = await requireUser();
      const routeParams = await resolveRouteParams(params);
      const resource = options.resolve(request, routeParams);
      const actor = {
        userId: user.userId,
        representativeOrganizationId: (user as { organizationId?: string }).organizationId,
      };

      const method = request.method.toUpperCase();
      const isRead = method === 'GET' || method === 'HEAD';
      const middlewareRecordsRead = isRead && (options.readRecord ?? 'middleware') === 'middleware';

      return await withRLSContext({ organizationId: resource.organizationId }, async (tx) => {
        const decision = await authorizeExternalMatterAccess({
          actor,
          organizationId: resource.organizationId,
          matterType: resource.matterType,
          matterId: resource.matterId,
          requiredPermission: options.requiredPermission,
        }, { recordAllowed: !middlewareRecordsRead });

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
