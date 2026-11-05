import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiShapeError } from '../api-envelope';
import { fetchAllRows } from '../crud-lists';

const reply = (status: number, body: unknown) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
const page = (rows: unknown[], pageNumber: number, totalPages: number) => ({
  success: true,
  data: { data: rows, pagination: { page: pageNumber, limit: 100, total: rows.length, totalPages } },
  timestamp: '2026-03-04T00:00:00.000Z',
});

afterEach(() => vi.unstubAllGlobals());

describe('fetchAllRows', () => {
  it('reads every page, 100 rows at a time, and returns the rows in order', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      urls.push(url);
      const pageNumber = Number(new URL(url, 'http://localhost').searchParams.get('page'));
      return reply(200, page([{ id: `row-${pageNumber}` }], pageNumber, 3));
    }));
    await expect(fetchAllRows('/api/employers')).resolves.toEqual([{ id: 'row-1' }, { id: 'row-2' }, { id: 'row-3' }]);
    expect(urls).toEqual(['/api/employers?limit=100&page=1', '/api/employers?limit=100&page=2', '/api/employers?limit=100&page=3']);
  });

  it('returns an empty list, with one request, when the list really is empty', async () => {
    const fetchMock = vi.fn(async () => reply(200, page([], 1, 0)));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchAllRows('/api/units')).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fails with the route’s own message when a page is refused, and stops reading', async () => {
    const fetchMock = vi.fn(async (url: string) => (url.endsWith('page=1')
      ? reply(200, page([{ id: 'a' }], 1, 2))
      : reply(403, { code: 'INSUFFICIENT_PERMISSIONS', message: "Requires at least 'member' role" })));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchAllRows('/api/units')).rejects.toThrow("Requires at least 'member' role");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to the status when the refusal states no reason', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reply(502, '<html>gateway</html>')));
    await expect(fetchAllRows('/api/units')).rejects.toThrow('Request failed with status 502');
  });

  it.each([
    ['rows directly under data', { success: true, data: [] }],
    ['no pagination', { success: true, data: { data: [] } }],
    ['a page count that is not a number', { success: true, data: { data: [], pagination: { totalPages: 'many' } } }],
    ['a negative page count', { success: true, data: { data: [], pagination: { totalPages: -1 } } }],
    ['an empty object', {}],
    ['null', null],
  ])('treats %s as an error, never as an empty list', async (_label, body) => {
    vi.stubGlobal('fetch', vi.fn(async () => reply(200, body)));
    await expect(fetchAllRows('/api/units')).rejects.toBeInstanceOf(ApiShapeError);
  });
});
