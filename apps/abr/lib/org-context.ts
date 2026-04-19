import type { NextRequest } from 'next/server';

export interface OrgContext {
  orgId: string;
  source: 'header' | 'demo-default';
}

const ORG_ID_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,63}$/;

export function resolveOrgContext(req: NextRequest | Request): OrgContext | null {
  const headerOrgId = req.headers.get('x-org-id');
  if (headerOrgId && ORG_ID_REGEX.test(headerOrgId)) {
    return { orgId: headerOrgId, source: 'header' };
  }

  const fallbackOrg = process.env.ABR_DEMO_ORG_ID;
  if (fallbackOrg && ORG_ID_REGEX.test(fallbackOrg)) {
    return { orgId: fallbackOrg, source: 'demo-default' };
  }

  return null;
}
