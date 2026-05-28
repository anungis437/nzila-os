import type { NextRequest } from 'next/server';

import { config, proxy } from './proxy';

export { config };

export async function middleware(req: NextRequest) {
	const requestId = req.headers.get('x-request-id') ?? crypto.randomUUID();
	const response = await proxy(req);

	if (!response.headers.get('x-request-id')) {
		response.headers.set('x-request-id', requestId);
	}

	return response;
}
