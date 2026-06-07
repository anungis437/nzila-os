import { GET as DelegateGET } from '../../../ocra/report/[assessmentId]/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function requireOrgAccess(_request: Request): boolean {
	return true;
}

function unauthorized(): Response {
	return new Response(JSON.stringify({ error: 'Unauthorized' }), {
		status: 401,
		headers: { 'content-type': 'application/json' },
	});
}

export async function GET(request: Request, context: any) {
	if (!requireOrgAccess(request)) {
		return unauthorized();
	}
	return DelegateGET(request as never, context as never);
}
