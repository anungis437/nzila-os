import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth-guard';
import { withRLSContext } from '@/lib/db/with-rls-context';
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

      return await withRLSContext({ organizationId: resource.organizationId }, async () => {
        const decision = await authorizeExternalMatterAccess({
          actor,
          organizationId: resource.organizationId,
          matterType: resource.matterType,
          matterId: resource.matterId,
          requiredPermission: options.requiredPermission,
        });

        if (!decision.allowed || !decision.authorityId || !decision.matterGrantId) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        return handler(request, {
          actor,
          organizationId: resource.organizationId,
          matterType: resource.matterType,
          matterId: resource.matterId,
          authorityId: decision.authorityId,
          matterGrantId: decision.matterGrantId,
        }, routeParams);
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
