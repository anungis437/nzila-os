/**
 * Legacy event URL delegates to the canonical privacy-enforcing API.
 * Keep a locally declared authorization and organization guard so this
 * redirect cannot accidentally become an unprotected route.
 */
import { withApi } from '@/lib/api/framework';
import {
  GET as canonicalGET,
  PATCH as canonicalPATCH,
  DELETE as canonicalDELETE,
} from '@/app/api/calendar/events/[id]/route';

export const dynamic = 'force-dynamic';

export const GET = withApi({
  auth: { required: true, minRole: 'member' },
  requireOrg: true,
  openapi: { tags: ['Scheduling'], summary: 'Read event through the canonical privacy boundary' },
}, async ({ request, params }) => canonicalGET(request, { params }));

export const PATCH = withApi({
  auth: { required: true, minRole: 'steward' },
  requireOrg: true,
  openapi: { tags: ['Scheduling'], summary: 'Update event through the canonical privacy boundary' },
}, async ({ request, params }) => canonicalPATCH(request, { params }));

export const DELETE = withApi({
  auth: { required: true, minRole: 'steward' },
  requireOrg: true,
  openapi: { tags: ['Scheduling'], summary: 'Delete event through the canonical privacy boundary' },
}, async ({ request, params }) => canonicalDELETE(request, { params }));
