'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

type ExportFormat = 'json' | 'markdown';

interface ReviewPacketExportControlsProps {
  matterId: string;
  locale: string;
  canExport: boolean;
  isPacketExternalizable: boolean;
}

function parseFilenameFromDisposition(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const match = /filename="([^"]+)"/.exec(headerValue);
  return match?.[1] ?? null;
}

function fallbackFilename(format: ExportFormat): string {
  return format === 'json' ? 'courtlens-review-packet.json' : 'courtlens-review-packet.md';
}

export function ReviewPacketExportControls({
  matterId,
  locale,
  canExport,
  isPacketExternalizable,
}: ReviewPacketExportControlsProps) {
  const t = useTranslations('courtlens.reviewPacketExport');
  const [loadingFormat, setLoadingFormat] = useState<ExportFormat | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

  if (!canExport) {
    return null;
  }

  if (!isPacketExternalizable) {
    return (
      <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" data-testid="review-packet-unavailable">
        {t('packetNotExternalizable')}
      </div>
    );
  }

  async function onExport(format: ExportFormat) {
    setLoadingFormat(format);
    setStatusMessage('');

    try {
      const query = new URLSearchParams({ format, locale });
      const response = await fetch(`/api/courtlens/matters/${matterId}/review-packet?${query.toString()}`, {
        method: 'GET',
        credentials: 'same-origin',
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { code?: string };
        if (payload.code === 'REVIEW_PACKET_NOT_EXTERNALIZABLE') {
          setStatusMessage(t('packetNotExternalizable'));
          return;
        }
        if (response.status === 403) {
          setStatusMessage(t('packetUnavailable'));
          return;
        }
        setStatusMessage(t('exportFailed'));
        return;
      }

      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition');
      const filename = parseFilenameFromDisposition(disposition) ?? fallbackFilename(format);
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(href);
      setStatusMessage(t('exportSuccess'));
    } catch {
      setStatusMessage(t('exportFailed'));
    } finally {
      setLoadingFormat(null);
    }
  }

  return (
    <div className="space-y-2" data-testid="review-packet-export-controls">
      <h3 className="font-poppins text-base font-semibold text-navy">{t('title')}</h3>
      <p className="text-xs text-slate-600">{t('subtitle')}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded border border-slate-300 px-3 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
          onClick={() => onExport('json')}
          disabled={loadingFormat !== null}
          aria-label={t('jsonLabel')}
        >
          {loadingFormat === 'json' ? t('loading') : t('jsonLabel')}
        </button>
        <button
          type="button"
          className="rounded border border-slate-300 px-3 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
          onClick={() => onExport('markdown')}
          disabled={loadingFormat !== null}
          aria-label={t('markdownLabel')}
        >
          {loadingFormat === 'markdown' ? t('loading') : t('markdownLabel')}
        </button>
      </div>
      {statusMessage ? (
        <p className="text-xs text-slate-700" role="status" aria-live="polite" data-testid="review-packet-export-status">
          {statusMessage}
        </p>
      ) : null}
      <p className="text-xs text-slate-500">{t('legalBoundaryNotice')}</p>
    </div>
  );
}
