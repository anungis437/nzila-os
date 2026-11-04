'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { ElectionCopy } from './election-copy';

/**
 * A failed load is shown as a failure. It is never rendered as an empty list or a zero: the person reading must be
 * able to tell "there are no records" from "the records could not be read".
 */
export function ElectionLoadError({
  copy,
  httpStatus,
  onRetry,
}: {
  copy: ElectionCopy['shared'];
  httpStatus: number | null;
  onRetry: () => void;
}) {
  const message =
    httpStatus === 403 ? copy.forbidden : httpStatus === 404 ? copy.notFound : copy.loadFailed;
  const retryable = httpStatus !== 403 && httpStatus !== 404;

  return (
    <Alert variant="destructive">
      <AlertTitle>{copy.errorTitle}</AlertTitle>
      <AlertDescription>
        <p>{message}</p>
        {httpStatus !== null ? <p className="mt-1 text-xs opacity-80">{copy.httpStatus(httpStatus)}</p> : null}
        {retryable ? (
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onRetry}>
            {copy.retry}
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
