import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { queryIdMutations } from '../crud-factory';

// DEF-0B6-EDU-UI-CALLS-OPERATIONS-THE-ROUTES-DO-NOT-EXPORT: education/sessions, education/programs and
// education/certifications have no [id]/route.ts; their admin screens submit PATCH/DELETE with `?id=`
// on the collection URL instead. queryIdMutations exposes an item route's PATCH/DELETE there, reading
// the target id from that query parameter rather than a path segment.
describe('crud-factory queryIdMutations', () => {
  it('reads the id query parameter and delegates to the item handler with it as params.id', async () => {
    const patch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const del = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const { PATCH, DELETE } = queryIdMutations({ PATCH: patch, DELETE: del });

    const request = new NextRequest('http://localhost/api/education/sessions?id=session-123');
    await PATCH(request);
    await DELETE(request);

    expect(patch).toHaveBeenCalledWith(request, { params: { id: 'session-123' } });
    expect(del).toHaveBeenCalledWith(request, { params: { id: 'session-123' } });
  });

  it('passes an empty string (never undefined/null) when the id query parameter is missing, so the item handler takes its own not-found path rather than throwing', async () => {
    const patch = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    const { PATCH } = queryIdMutations({ PATCH: patch, DELETE: vi.fn() });

    const request = new NextRequest('http://localhost/api/education/sessions');
    await PATCH(request);

    expect(patch).toHaveBeenCalledWith(request, { params: { id: '' } });
  });

  it('honours a custom paramName, matching a non-default paramName on the underlying crudRoutes options', async () => {
    const del = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const { DELETE } = queryIdMutations({ PATCH: vi.fn(), DELETE: del }, 'certificationId');

    const request = new NextRequest('http://localhost/api/education/certifications?certificationId=cert-9');
    await DELETE(request);

    expect(del).toHaveBeenCalledWith(request, { params: { certificationId: 'cert-9' } });
  });
});
