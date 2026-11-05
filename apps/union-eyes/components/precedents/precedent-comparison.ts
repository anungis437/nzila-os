/**
 * Side-by-side precedent comparison.
 *
 * There is no compare route. The selected decisions are read one by one from GET /api/arbitration/precedents/:id, which applies the same
 * visibility rule as the list they were chosen from, and are shown as they are. No analysis summary is produced: nothing computes one,
 * and none is made up. If any decision cannot be read the comparison fails as a whole, so a partial comparison is never presented as the
 * one that was asked for.
 */
import { readPrecedent, type PrecedentRecord } from '@/components/precedents/precedent-record';
import { readApiError } from '@/lib/client/api-envelope';

type Reader = (url: string) => Promise<Response>;

/** The selected decisions, in the order they were selected. Rejects, with what the server said, if any of them cannot be read. */
export async function fetchPrecedentComparison(ids: readonly string[], read: Reader = (url) => fetch(url)): Promise<PrecedentRecord[]> {
  return Promise.all(
    ids.map(async (id) => {
      const response = await read(`/api/arbitration/precedents/${encodeURIComponent(id)}`);
      if (!response.ok) throw new Error(await readApiError(response, `HTTP ${response.status}`));
      return readPrecedent(await response.json());
    }),
  );
}
