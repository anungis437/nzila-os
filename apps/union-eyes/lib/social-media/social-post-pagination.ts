/** Reject malformed or unbounded pagination before querying social posts. */
export function parseSocialPostPagination(params: URLSearchParams): { limit: number; offset: number } | null {
  const parse = (name: string, fallback: number, minimum: number, maximum: number) => {
    const raw = params.get(name);
    if (raw === null) return fallback;
    if (!/^(0|[1-9][0-9]*)$/.test(raw)) return null;
    const value = Number(raw);
    return Number.isSafeInteger(value) && value >= minimum && value <= maximum ? value : null;
  };
  const limit = parse('limit', 20, 1, 100);
  const offset = parse('offset', 0, 0, 10000);
  return limit === null || offset === null ? null : { limit, offset };
}
