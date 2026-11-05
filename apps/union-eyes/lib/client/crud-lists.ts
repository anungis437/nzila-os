/**
 * Reads of the CRUD factory's list routes (/api/employers, /api/worksites, /api/units, /api/committees, /api/health-safety/inspections ...).
 *
 * withApi sends { success, data: { data: rows, pagination: { page, limit, total, totalPages } }, timestamp } and a page holds at most
 * 100 rows. A response that is not that shape is an error here, never an empty list or a count of zero.
 */
import { ApiShapeError, envelopeData, isRecord, readApiError } from "./api-envelope";

const PAGE_LIMIT = 100;

async function readPage(path: string, page: number): Promise<{ rows: unknown[]; totalPages: number }> {
  const response = await fetch(`${path}?limit=${PAGE_LIMIT}&page=${page}`);
  if (!response.ok) throw new Error(await readApiError(response, `Request failed with status ${response.status}`));
  const payload = envelopeData(await response.json());
  if (!Array.isArray(payload.data)) throw new ApiShapeError("no list");
  const totalPages = isRecord(payload.pagination) ? Number(payload.pagination.totalPages) : Number.NaN;
  if (!Number.isInteger(totalPages) || totalPages < 0) throw new ApiShapeError("no pagination");
  return { rows: payload.data, totalPages };
}

/** Every row of a list: all of its pages. */
export async function fetchAllRows<T>(path: string): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 1; ; page += 1) {
    const result = await readPage(path, page);
    rows.push(...(result.rows as T[]));
    if (page >= result.totalPages) return rows;
  }
}
