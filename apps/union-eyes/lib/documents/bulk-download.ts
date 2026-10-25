import { requestAuthorizedDownload } from '@/lib/documents/document-repository-client';
import type { JourneyDenial } from '@/lib/documents/canonical-journey';

/** Stop a single browser batch before it can request an unbounded number of URLs. */
export const BULK_DOWNLOAD_LIMIT = 25;

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type BulkItemOutcome = {
  id: string;
  outcome: 'permitted' | 'denied' | 'failed';
  downloadUrl?: string;
  denial?: JourneyDenial;
};

export type BulkDownloadReport = {
  items: BulkItemOutcome[];
  permitted: number;
  denied: number;
  failed: number;
  truncated: boolean;
  complete: boolean;
};

export async function authorizeBulkDownload(
  ids: string[],
  fetchImpl?: FetchLike,
): Promise<BulkDownloadReport> {
  const unique = [...new Set(ids)];
  const truncated = unique.length > BULK_DOWNLOAD_LIMIT;
  const batch = unique.slice(0, BULK_DOWNLOAD_LIMIT);
  const items: BulkItemOutcome[] = [];

  for (const id of batch) {
    try {
      const result = await requestAuthorizedDownload(id, fetchImpl);
      if (result.downloadUrl) {
        items.push({ id, outcome: 'permitted', downloadUrl: result.downloadUrl });
      } else {
        items.push({ id, outcome: 'denied', denial: result.denial ?? 'unauthorized' });
      }
    } catch {
      items.push({ id, outcome: 'failed', denial: 'storage_failure' });
    }
  }

  for (const id of unique.slice(BULK_DOWNLOAD_LIMIT)) {
    items.push({ id, outcome: 'failed' });
  }

  const permitted = items.filter((item) => item.outcome === 'permitted').length;
  const denied = items.filter((item) => item.outcome === 'denied').length;
  const failed = items.filter((item) => item.outcome === 'failed').length;
  return {
    items,
    permitted,
    denied,
    failed,
    truncated,
    complete: permitted === unique.length && unique.length > 0,
  };
}

export function permittedDownloadUrls(report: BulkDownloadReport): string[] {
  return report.items.flatMap((item) => (item.outcome === 'permitted' && item.downloadUrl ? [item.downloadUrl] : []));
}

export function bulkOutcomeNotice(locale: string, report: BulkDownloadReport): string | null {
  if (report.complete) return null;
  if (locale.toLowerCase().startsWith('fr')) {
    return `${report.permitted} telecharges. ${report.denied} refuses. ${report.failed} en echec.`;
  }
  return `${report.permitted} downloaded. ${report.denied} denied. ${report.failed} failed.`;
}
