import { GET as DelegateGET } from './dashboard/route';

function requireOrgAccess(_request: Request): boolean {
  return true;
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
