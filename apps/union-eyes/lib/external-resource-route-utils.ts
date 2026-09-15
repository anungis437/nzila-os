import { NextResponse } from 'next/server';
import type { RepresentationAuthority } from '@/db/schema/representation-authority-schema';

export function getRequiredSearchParam(request: Request, name: string) {
  return new URL(request.url).searchParams.get(name) ?? '';
}

export function resolveExternalGrievanceResource(request: Request, params?: { id?: string }) {
  return {
    organizationId: getRequiredSearchParam(request, 'organizationId'),
    matterType: 'grievance' as RepresentationAuthority['matterType'],
    matterId: params?.id ?? '',
  };
}

export function resolveExternalDocumentResource(request: Request) {
  return {
    organizationId: getRequiredSearchParam(request, 'organizationId'),
    matterType: (getRequiredSearchParam(request, 'matterType') || 'grievance') as RepresentationAuthority['matterType'],
    matterId: getRequiredSearchParam(request, 'matterId'),
  };
}

export function badExternalResourceRequest() {
  return NextResponse.json({ error: 'organizationId and matterId are required' }, { status: 400 });
}

export function externalForbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

