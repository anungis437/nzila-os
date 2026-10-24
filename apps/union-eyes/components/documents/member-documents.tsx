'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

type MemberDocument = {
  id: string;
  title: string;
  documentType: string;
  privacyLabel: string;
  createdAt: Date;
};

/** The API wraps lists as { success, data } (sometimes nested); accept both shapes. */
export function parseDocumentList(payload: unknown): MemberDocument[] {
  const root = payload as { data?: unknown } | unknown[] | null;
  const inner = Array.isArray(root) ? root : (root as { data?: unknown } | null)?.data;
  const list = Array.isArray(inner) ? inner : (inner as { data?: unknown } | null)?.data;
  if (!Array.isArray(list)) return [];
  return list.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id ?? ''),
      title: String(r.title ?? r.filename ?? r.name ?? ''),
      documentType: String(r.documentType ?? ''),
      privacyLabel: String(r.privacyLabel ?? ''),
      createdAt: new Date(String(r.createdAt ?? r.updatedAt ?? '')),
    };
  }).filter((doc) => doc.id);
}

function humanize(value: string): string {
  const spaced = value.replace(/[-_]+/g, ' ').trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : '';
}

export function MemberDocuments() {
  const t = useTranslations('memberDocuments');
  const locale = useLocale();
  const [documents, setDocuments] = useState<MemberDocument[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const response = await fetch('/api/documents/repository');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setDocuments(parseDocumentList(await response.json()));
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const download = async (id: string) => {
    setDownloadError(null);
    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(id)}/download`);
      const body = response.ok ? await response.json() : null;
      const url = body?.data?.downloadUrl ?? body?.data?.data?.downloadUrl ?? body?.downloadUrl;
      if (!url) throw new Error('unavailable');
      window.open(String(url), '_blank', 'noopener,noreferrer');
    } catch {
      setDownloadError(id);
    }
  };

  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6" data-testid="member-documents">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>

      {state === 'loading' && (
        <div className="space-y-3" role="status" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      )}

      {state === 'error' && (
        <div className="flex flex-col items-start gap-3 rounded-lg border p-6" role="alert">
          <p className="text-sm">{t('loadError')}</p>
          <Button variant="outline" size="sm" onClick={() => void load()}>{t('retry')}</Button>
        </div>
      )}

      {state === 'ready' && documents.length === 0 && (
        <div className="rounded-lg border border-dashed p-12 text-center" data-testid="member-documents-empty">
          <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-base font-medium">{t('emptyTitle')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('emptyBody')}</p>
        </div>
      )}

      {state === 'ready' && documents.length > 0 && (
        <ul className="divide-y rounded-lg border" data-testid="member-documents-list">
          {documents.map((doc) => (
            <li key={doc.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="break-words font-medium">{doc.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {doc.documentType && <span>{humanize(doc.documentType)}</span>}
                  {!Number.isNaN(doc.createdAt.getTime()) && <span>{dateFormat.format(doc.createdAt)}</span>}
                  <Badge variant="secondary">
                    {doc.privacyLabel === 'public_internal' ? t('sourceShared') : t('sourceOwn')}
                  </Badge>
                </div>
                {downloadError === doc.id && (
                  <p className="mt-2 text-xs text-destructive" role="alert">{t('downloadUnavailable')}</p>
                )}
              </div>
              <Button variant="outline" size="sm" aria-label={`${t('download')} ${doc.title}`} onClick={() => void download(doc.id)}>
                {t('download')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
