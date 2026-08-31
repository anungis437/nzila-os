import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock('@/lib/api/crud-factory', () => ({
  crudRoutes: vi.fn(() => ({
    GET: mockGet,
    POST: mockPost,
  })),
}));
vi.mock('@/db/schema', () => ({ deadlines: {} }));

describe('GET /api/deadlines/upcoming', () => {
  it('passes through a genuine 200 empty result unchanged', async () => {
    const empty = NextResponse.json({ data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } });
    mockGet.mockResolvedValueOnce(empty);

    const { GET } = await import('../route');
    const response = await GET(new NextRequest('http://localhost/api/deadlines/upcoming'));

    expect(response).toBe(empty);
    expect(response.status).toBe(200);
    expect(await response.clone().json()).toEqual({
      data: [],
      pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
    });
  });

  it('passes through a genuine 200 non-empty result unchanged', async () => {
    const nonEmpty = NextResponse.json({
      data: [{ id: 'd1' }, { id: 'd2' }],
      pagination: { page: 1, limit: 50, total: 2, totalPages: 1 },
    });
    mockGet.mockResolvedValueOnce(nonEmpty);

    const { GET } = await import('../route');
    const response = await GET(new NextRequest('http://localhost/api/deadlines/upcoming'));

    expect(response).toBe(nonEmpty);
    const body = await response.clone().json();
    expect(body.data).toHaveLength(2);
  });

  it('does not rewrite an underlying 401 into a fake empty success', async () => {
    const unauthorized = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    mockGet.mockResolvedValueOnce(unauthorized);

    const { GET } = await import('../route');
    const response = await GET(new NextRequest('http://localhost/api/deadlines/upcoming'));

    expect(response).toBe(unauthorized);
    expect(response.status).toBe(401);
  });

  it('does not rewrite an underlying 403 into a fake empty success', async () => {
    const forbidden = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    mockGet.mockResolvedValueOnce(forbidden);

    const { GET } = await import('../route');
    const response = await GET(new NextRequest('http://localhost/api/deadlines/upcoming'));

    expect(response).toBe(forbidden);
    expect(response.status).toBe(403);
  });

  it('does not rewrite an underlying 500 into a fake empty success', async () => {
    const serverError = NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    mockGet.mockResolvedValueOnce(serverError);

    const { GET } = await import('../route');
    const response = await GET(new NextRequest('http://localhost/api/deadlines/upcoming'));

    expect(response).toBe(serverError);
    expect(response.status).toBe(500);
    const body = await response.clone().json();
    expect(body).not.toEqual({ data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } });
  });

  it('exports POST as the underlying crud handler unchanged', async () => {
    const route = await import('../route');
    expect(route.POST).toBe(mockPost);
  });
});
