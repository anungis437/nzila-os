import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth-guard';
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
  return async (request: Request, params?: TParams) => {
    try {
      const user = await requireUser();
      const resource = options.resolve(request, params);
      const actor = {
        userId: user.userId,
        representativeOrganizationId: (user as { organizationId?: string }).organizationId,
      };

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
      }, params);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  };
}
