/**
 * Reads what the application's own API answers, for browser code.
 *
 * withApi wraps whatever a handler returns as { success, data, timestamp }, so a handler that returns { data: row } (every crud-factory
 * item and list route) arrives as { success, data: { data: row } }. A failed call carries the standard error body { code, message, ... },
 * or { error: { message } } from a retired route. Nothing here substitutes a default: a body that is not the shape the caller expects is
 * an error for the caller to show, never an empty list or a blank record.
 */

export class ApiShapeError extends Error {
  constructor(what: string) {
    super(`Unexpected API response: ${what}`);
    this.name = 'ApiShapeError';
  }
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** What a withApi route returned: the body's `data`. */
export function envelopeData(body: unknown): Record<string, unknown> {
  if (isRecord(body) && isRecord(body.data)) return body.data;
  throw new ApiShapeError('no data');
}

/** The record of an item route, which returns { data: record }. */
export function envelopeRow(body: unknown): Record<string, unknown> {
  const payload = envelopeData(body);
  if (isRecord(payload.data)) return payload.data;
  throw new ApiShapeError('no record');
}

/** The records of a list route, which returns { data: records }. */
export function envelopeRows(body: unknown): unknown[] {
  const payload = envelopeData(body);
  if (Array.isArray(payload.data)) return payload.data;
  throw new ApiShapeError('no list');
}

/** The page count of a list route, which returns { data, pagination: { totalPages } }; a list whose pages are unknown is not shown as one page. */
export function envelopePages(body: unknown): number {
  const { pagination } = envelopeData(body);
  if (isRecord(pagination) && typeof pagination.totalPages === 'number' && Number.isFinite(pagination.totalPages)) return pagination.totalPages;
  throw new ApiShapeError('no page count');
}

/**
 * The message a failed answer states, from the body that was already read: `message` (the framework's own `{ code, message }`), `error.message` or `error` (a route's own).
 * A body that names none gives the fallback. A screen never reads `body.error` itself: depending on the route it is a string, an object, or not there at all.
 */
export function apiErrorMessage(body: unknown, fallback: string): string {
  if (isRecord(body)) {
    if (typeof body.message === 'string' && body.message) return body.message;
    if (isRecord(body.error) && typeof body.error.message === 'string' && body.error.message) return body.error.message;
    if (typeof body.error === 'string' && body.error) return body.error;
  }
  return fallback;
}

/** The message a failed response states; the fallback when its body is not JSON or names none. */
export async function readApiError(response: Response, fallback: string): Promise<string> {
  return apiErrorMessage(await response.json().catch(() => null), fallback);
}

/**
 * What a failed request says to the person using the screen. A request the route answered with a refusal fails with an Error made from the message it stated (`apiErrorMessage`),
 * and that is shown. A request that never got an answer fails with a TypeError whose text is the browser's own ("Failed to fetch", "Load failed"): the screen's fallback is shown instead.
 */
export function failureText(error: unknown, fallback: string): string {
  return error instanceof Error && !(error instanceof TypeError) && error.message ? error.message : fallback;
}
