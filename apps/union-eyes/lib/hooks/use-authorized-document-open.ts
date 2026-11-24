'use client';

import { useCallback, useState } from 'react';
import { useLocale } from 'next-intl';
import { journeyCopy } from '@/lib/documents/canonical-journey';
import { requestAuthorizedDownload } from '@/lib/documents/document-repository-client';

/**
 * A document opens only through its audited, time-limited link. Screens that list documents keep no
 * stored address; this is the one path from a list row to the file, and it says why when it is refused.
 */
export function useAuthorizedDocumentOpen() {
  const locale = useLocale();
  const copy = journeyCopy(locale);
  const [opening, setOpening] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const open = useCallback(
    async (documentId: string) => {
      setNotice(null);
      setOpening(documentId);
      try {
        const result = await requestAuthorizedDownload(documentId);
        if (!result.downloadUrl) {
          setNotice(copy[result.denial ?? 'unauthorized']);
          return;
        }
        window.open(result.downloadUrl, '_blank', 'noopener,noreferrer');
      } catch {
        setNotice(copy.read_unavailable);
      } finally {
        setOpening(null);
      }
    },
    [copy],
  );

  return { open, opening, notice, copy };
}
