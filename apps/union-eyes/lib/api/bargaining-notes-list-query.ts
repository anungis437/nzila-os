/**
 * Bound bargaining-note collection queries before any tenant database work.
 * Invalid filters are refused rather than silently coerced into broader reads.
 */
export class InvalidBargainingNotesListQuery extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidBargainingNotesListQuery';
  }
}

function positiveInteger(params: URLSearchParams, key: string, fallback: number, maximum: number): number {
  const raw = params.get(key);
  if (raw === null) return fallback;
  if (!/^[1-9][0-9]*$/.test(raw)) throw new InvalidBargainingNotesListQuery(`Invalid ${key}`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value > maximum) {
    throw new InvalidBargainingNotesListQuery(`Invalid ${key}`);
  }
  return value;
}

function dateBound(params: URLSearchParams, key: string): Date | undefined {
  const raw = params.get(key);
  if (raw === null) return undefined;
  // Date-only and timezone-qualified ISO timestamps are supported. Ambiguous
  // local timestamps, invalid dates, and overly long inputs are refused.
  if (raw.length > 40 || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(raw)) {
    throw new InvalidBargainingNotesListQuery(`Invalid ${key}`);
  }
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) throw new InvalidBargainingNotesListQuery(`Invalid ${key}`);
  // JS normalizes impossible calendar dates (e.g. February 30). Check the
  // date component independently of the timezone-qualified instant.
  const [year, month, day] = raw.slice(0, 10).split('-').map(Number);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) {
    throw new InvalidBargainingNotesListQuery(`Invalid ${key}`);
  }
  return date;
}

export function parseBargainingNotesListQuery(params: URLSearchParams) {
  const page = positiveInteger(params, 'page', 1, 100_000);
  const limit = positiveInteger(params, 'limit', params.has('tags') ? 50 : 20, 100);
  const sortBy = params.get('sortBy') ?? 'sessionDate';
  const sortOrder = params.get('sortOrder') ?? 'desc';
  if (sortBy !== 'sessionDate' && sortBy !== 'createdAt') {
    throw new InvalidBargainingNotesListQuery('Invalid sortBy');
  }
  if (sortOrder !== 'asc' && sortOrder !== 'desc') {
    throw new InvalidBargainingNotesListQuery('Invalid sortOrder');
  }
  const rawTags = params.get('tags');
  let tags: string[] | undefined;
  if (rawTags !== null) {
    if (rawTags.length === 0 || rawTags.length > 512) {
      throw new InvalidBargainingNotesListQuery('Invalid tags');
    }
    tags = rawTags.split(',').map(tag => tag.trim());
    if (tags.length > 20 || tags.some(tag => !tag || tag.length > 64)) {
      throw new InvalidBargainingNotesListQuery('Invalid tags');
    }
  }
  const dateFrom = dateBound(params, 'dateFrom');
  const dateTo = dateBound(params, 'dateTo');
  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw new InvalidBargainingNotesListQuery('Invalid date range');
  }
  return { page, limit, sortBy, sortOrder: sortOrder as 'asc' | 'desc', tags, dateFrom, dateTo };
}
