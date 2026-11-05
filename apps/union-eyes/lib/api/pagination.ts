import { ApiError } from './errors';

/** Strict, bounded pagination for a collection: positive integers only, at most 100 rows a page and 10,000 pages. */
export function parseCrudPagination(params: URLSearchParams, defaultLimit = 50): { page: number; limit: number; offset: number } {
  const rawPage = params.get('page') ?? '1';
  const rawLimit = params.get('limit') ?? String(defaultLimit);
  if (!/^[1-9]\d*$/.test(rawPage) || !/^[1-9]\d*$/.test(rawLimit)) {
    throw ApiError.badRequest('Invalid pagination parameters');
  }
  const page = Number(rawPage);
  const limit = Number(rawLimit);
  if (!Number.isSafeInteger(page) || page > 10000 || !Number.isSafeInteger(limit) || limit > 100) {
    throw ApiError.badRequest('Pagination out of bounds');
  }
  return { page, limit, offset: (page - 1) * limit };
}
