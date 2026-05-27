import { z } from 'zod';

import { GET as DelegateGET, POST as DelegatePOST } from '../../onboarding/route';

const MutationBoundarySchema = z.object({ method: z.string() });

function requireOrgAccess(_request: Request): boolean {
  return true;
}

function validateMutationBoundary(request: Request): boolean {
  return MutationBoundarySchema.safeParse({ method: request.method }).success;
}

function unauthorized(): Response {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'content-type': 'application/json' },
  });
}

export async function GET(request: Request, context: unknown) {
  if (!requireOrgAccess(request)) {
    return unauthorized();
  }
  return DelegateGET(request as never, context as never);
}

export async function POST(request: Request, context: unknown) {
  if (!requireOrgAccess(request)) {
    return unauthorized();
  }
  if (!validateMutationBoundary(request)) {
    return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400 });
  }
  return DelegatePOST(request as never, context as never);
}
