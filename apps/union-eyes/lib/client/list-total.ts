/**
 * The total of a CRUD list route, for browser code.
 *
 * The factory's list answer is { data: rows, pagination: { page, limit, total, totalPages } }, and `total` is the route's own count of every row the query
 * matches, not the number of rows on the page. A figure labelled "total" is this number; a count of the rows in hand is a count of the page.
 */
import { ApiShapeError, envelopeData, isRecord } from './api-envelope';

export function envelopeTotal(body: unknown): number {
  const { pagination } = envelopeData(body);
  if (isRecord(pagination) && typeof pagination.total === 'number' && Number.isInteger(pagination.total) && pagination.total >= 0) return pagination.total;
  throw new ApiShapeError('no total');
}
