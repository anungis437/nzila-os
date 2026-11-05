import { requestAuthorizedDownload } from '@/lib/documents/document-repository-client';
import type { JourneyDenial } from '@/lib/documents/canonical-journey';

/** Stop a single browser batch before it can request an unbounded number of URLs. */
export const BULK_DOWNLOAD_LIMIT = 25;

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type BulkAuthorization = 'approved' | 'denied' | 'failed';

export type BulkItemOutcome = {
  id: string;
  authorization: BulkAuthorization;
  urlIssued: boolean;
  openAttempted: boolean;
  openFailed: boolean;
  /** True only when a caller has verified the bytes were received. URL issuance never sets this. */
  transferCompleted: boolean;
  downloadUrl?: string;
  denial?: JourneyDenial;
};

export type BulkDownloadReport = {
  items: BulkItemOutcome[];
  approved: number;
  urlsIssued: number;
  denied: number;
  failed: number;
  openAttempted: number;
  openFailed: number;
  transferCompleted: number;
  truncated: boolean;
  /** Every selected id was authorized and a URL was issued. This is not a completed file transfer. */
  authorizationComplete: boolean;
};

function summarize(items: BulkItemOutcome[], uniqueCount: number, truncated: boolean): BulkDownloadReport {
  const approved = items.filter((item) => item.authorization === 'approved').length;
  const urlsIssued = items.filter((item) => item.urlIssued).length;
  const denied = items.filter((item) => item.authorization === 'denied').length;
  const failed = items.filter((item) => item.authorization === 'failed').length;
  const openAttempted = items.filter((item) => item.openAttempted).length;
  const openFailed = items.filter((item) => item.openFailed).length;
  const transferCompleted = items.filter((item) => item.transferCompleted).length;
  return {
    items,
    approved,
    urlsIssued,
    denied,
    failed,
    openAttempted,
    openFailed,
    transferCompleted,
    truncated,
    authorizationComplete: uniqueCount > 0 && urlsIssued === uniqueCount && !truncated,
  };
}

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
        items.push({
          id,
          authorization: 'approved',
          urlIssued: true,
          openAttempted: false,
          openFailed: false,
          transferCompleted: false,
          downloadUrl: result.downloadUrl,
        });
      } else {
        items.push({
          id,
          authorization: 'denied',
          urlIssued: false,
          openAttempted: false,
          openFailed: false,
          transferCompleted: false,
          denial: result.denial ?? 'unauthorized',
        });
      }
    } catch {
      items.push({
        id,
        authorization: 'failed',
        urlIssued: false,
        openAttempted: false,
        openFailed: false,
        transferCompleted: false,
        denial: 'storage_failure',
      });
    }
  }

  for (const id of unique.slice(BULK_DOWNLOAD_LIMIT)) {
    items.push({
      id,
      authorization: 'failed',
      urlIssued: false,
      openAttempted: false,
      openFailed: false,
      transferCompleted: false,
    });
  }

  return summarize(items, unique.length, truncated);
}

export function issuedDownloadUrls(report: BulkDownloadReport): string[] {
  return report.items.flatMap((item) => (item.urlIssued && item.downloadUrl ? [item.downloadUrl] : []));
}

/** Record browser open attempts. A returned window is not proof the file transferred. */
export function recordBrowserOpens(
  report: BulkDownloadReport,
  open: (url: string) => boolean,
): BulkDownloadReport {
  const items = report.items.map((item) => {
    if (!item.urlIssued || !item.downloadUrl) return item;
    const opened = open(item.downloadUrl);
    return {
      ...item,
      openAttempted: true,
      openFailed: !opened,
      transferCompleted: false,
    };
  });
  return summarize(items, report.items.length, report.truncated);
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function bulkOutcomeNotice(locale: string, report: BulkDownloadReport): string | null {
  if (report.items.length === 0) return null;
  const french = locale.toLowerCase().startsWith('fr');
  const transfer = french
    ? 'Le transfert du fichier n est pas confirme.'
    : 'File transfer is not confirmed.';
  if (french) {
    return [
      countLabel(report.urlsIssued, 'adresse emise', 'adresses emises'),
      countLabel(report.denied, 'refuse', 'refuses'),
      countLabel(report.failed, 'en echec', 'en echec'),
      countLabel(report.openAttempted, 'fenetre tentee', 'fenetres tentees'),
      countLabel(report.openFailed, 'fenetre en echec', 'fenetres en echec'),
      transfer,
    ].join('. ');
  }
  return [
    countLabel(report.urlsIssued, 'download URL issued', 'download URLs issued'),
    countLabel(report.denied, 'denied', 'denied'),
    countLabel(report.failed, 'failed', 'failed'),
    countLabel(report.openAttempted, 'browser open attempted', 'browser opens attempted'),
    countLabel(report.openFailed, 'browser open failed', 'browser opens failed'),
    transfer,
  ].join('. ');
}
