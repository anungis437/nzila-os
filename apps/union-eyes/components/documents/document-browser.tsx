'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { denialFromStatus, journeyCopy } from '@/lib/documents/canonical-journey';
import {
  authorizedBrowserDocuments,
  browserCopy,
  pageBrowserDocuments,
  sortBrowserDocuments,
  type BrowserDocument,
  type BrowserSort,
} from '@/lib/documents/browser-repository';
import { authorizeBulkDownload, bulkOutcomeNotice, recordBrowserOpens } from '@/lib/documents/bulk-download';
import { listDenied, requestAuthorizedDownload } from '@/lib/documents/document-repository-client';
import { OCRUpload } from '@/components/documents/ocr-upload';
import { TranscriptReview } from '@/components/documents/transcript-review';

export type { BrowserDocument };

type DocumentBrowserProps = {
  onDocumentSelect?: (document: BrowserDocument) => void;
  selectionMode?: 'single' | 'multiple' | 'none';
  filterByType?: string[];
  defaultView?: 'grid' | 'list';
  organizationId?: string;
};

export function DocumentBrowser({
  onDocumentSelect,
  selectionMode = 'none',
  filterByType,
  defaultView = 'grid',
  organizationId,
}: DocumentBrowserProps) {
  const locale = useLocale();
  const copy = useMemo(() => browserCopy(locale), [locale]);
  const denialCopy = useMemo(() => journeyCopy(locale), [locale]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(defaultView);
  const [documents, setDocuments] = useState<BrowserDocument[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<BrowserSort>('updatedAt');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<BrowserDocument | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const scope = JSON.stringify([organizationId ?? null, locale, filterByType ?? []]);
  const [loadedScope, setLoadedScope] = useState(scope);
  const activeScope = useRef(scope);
  const mounted = useRef(false);
  const listRead = useRef<AbortController | null>(null);
  const previewRead = useRef<AbortController | null>(null);
  const listRevision = useRef(0);
  const previewRevision = useRef(0);
  const pageSize = 12;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; listRead.current?.abort(); previewRead.current?.abort(); };
  }, []);
  useEffect(() => {
    activeScope.current = scope;
    return () => { listRead.current?.abort(); previewRead.current?.abort(); };
  }, [scope]);

  const load = useCallback(async () => {
    if (!mounted.current || activeScope.current !== scope) return;
    listRead.current?.abort(); previewRead.current?.abort(); previewRevision.current++;
    const controller = new AbortController(); listRead.current = controller;
    const revision = ++listRevision.current;
    const current = () => mounted.current && !controller.signal.aborted && revision === listRevision.current && activeScope.current === scope;
    setLoading(true);
    setLoadedScope(scope); setDocuments([]); setSelected(new Set()); setPreview(null); setPreviewLoading(false);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('keyword', query.trim());
      if (filterByType?.length === 1) params.set('documentType', filterByType[0] ?? '');
      const response = await fetch(`/api/documents/repository?${params.toString()}`, { signal: controller.signal });
      const body = await response.json();
      if (!current()) return;
      const denial = listDenied(response.status, body);
      if (denial) { setNotice(denialCopy[denial]); return; }
      const rows = authorizedBrowserDocuments(body);
      if (!rows) throw new Error('DOCUMENT_LIST_SHAPE');
      setDocuments(filterByType?.length ? rows.filter(row => filterByType.includes(row.documentType ?? '')) : rows);
      setNotice(null);
    } catch {
      if (current()) { setDocuments([]); setNotice(denialCopy.list_unavailable); }
    } finally {
      if (current()) setLoading(false);
    }
  }, [denialCopy, filterByType, query, scope]);

  useEffect(() => {
    void load();
    return () => listRead.current?.abort();
  }, [load]);

  const ordered = useMemo(
    () => pageBrowserDocuments(sortBrowserDocuments(loadedScope === scope ? documents : [], sort, direction), page, pageSize),
    [documents, direction, page, sort, loadedScope, scope],
  );
  const pageCount = Math.max(1, Math.ceil((loadedScope === scope ? documents.length : 0) / pageSize));

  const toggle = (id: string) => {
    if (selectionMode === 'none') return;
    setSelected((current) => {
      const next = new Set(selectionMode === 'single' ? [] : current);
      if (current.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    const row = documents.find((document) => document.id === id);
    if (row) onDocumentSelect?.(row);
  };

  const downloadOne = async (id: string) => {
    const revision = listRevision.current;
    try {
      const result = await requestAuthorizedDownload(id);
      if (!mounted.current || activeScope.current !== scope || listRevision.current !== revision) return false;
      if (!result.downloadUrl) { setNotice(denialCopy[result.denial ?? 'unauthorized']); return false; }
      setNotice(null);
      window.open(result.downloadUrl, '_blank', 'noopener,noreferrer');
      return true;
    } catch {
      if (mounted.current && activeScope.current === scope && listRevision.current === revision) setNotice(denialCopy.read_unavailable);
      return false;
    }
  };

  const downloadSelected = async () => {
    if (selected.size === 0) {
      setNotice(denialCopy.none_selected);
      return;
    }
    const revision = listRevision.current;
    let authorized: Awaited<ReturnType<typeof authorizeBulkDownload>>;
    try { authorized = await authorizeBulkDownload([...selected]); }
    catch { if (mounted.current && activeScope.current === scope && listRevision.current === revision) setNotice(denialCopy.bulk_unavailable); return; }
    if (!mounted.current || activeScope.current !== scope || listRevision.current !== revision) return;
    const report = recordBrowserOpens(authorized, (url) => {
      const popup = window.open(url, '_blank', 'noopener,noreferrer');
      return popup != null;
    });
    setNotice(bulkOutcomeNotice(locale, report));
  };

  const openPreview = async (row: BrowserDocument) => {
    previewRead.current?.abort();
    const controller = new AbortController(); previewRead.current = controller;
    const revision = ++previewRevision.current, list = listRevision.current;
    const current = () => mounted.current && !controller.signal.aborted && revision === previewRevision.current && list === listRevision.current && activeScope.current === scope;
    setPreview(null); setPreviewLoading(true);
    try {
      const response = await fetch(`/api/documents/repository/${row.id}`, { signal: controller.signal });
      const body = await response.json();
      if (!current()) return;
      if (!response.ok) { setNotice(denialCopy[denialFromStatus(response.status)]); return; }
      const detail = authorizedBrowserDocuments({ data: [body && typeof body === 'object' && 'data' in body ? (body as { data: unknown }).data : body] });
      if (detail?.length !== 1 || detail[0]?.id !== row.id) throw new Error('DOCUMENT_DETAIL_SHAPE');
      setPreview(detail[0]); setNotice(null);
    } catch {
      if (current()) { setPreview(null); setNotice(denialCopy.read_unavailable); }
    } finally {
      if (current()) setPreviewLoading(false);
    }
  };

  return (
    <section className="space-y-4" data-testid="document-browser">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">{copy.title}</h2>
          <p className="text-sm text-muted-foreground">{copy.pageNote}</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant={viewMode === 'grid' ? 'default' : 'outline'} onClick={() => setViewMode('grid')}>{copy.grid}</Button>
          <Button type="button" variant={viewMode === 'list' ? 'default' : 'outline'} onClick={() => setViewMode('list')}>{copy.list}</Button>
        </div>
      </div>

      {organizationId ? (
        <OCRUpload
          organizationId={organizationId}
          onUploadComplete={() => {
            void load();
          }}
        />
      ) : null}
      <p className="text-sm text-muted-foreground">{copy.unavailableFilters}</p>
      {notice && loadedScope === scope && <p role="alert" data-testid="browser-notice" className="rounded border px-3 py-2 text-sm">{notice}</p>}

      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          void load();
        }}
      >
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.search} aria-label={copy.search} />
        <select aria-label={copy.sort} value={sort} onChange={(event) => setSort(event.target.value as BrowserSort)} className="rounded border px-3 py-2 text-sm">
          <option value="updatedAt">{copy.sortUpdated}</option>
          <option value="title">{copy.sortTitle}</option>
          <option value="documentType">{copy.sortType}</option>
        </select>
        <Button type="button" variant="outline" onClick={() => setDirection((value) => value === 'asc' ? 'desc' : 'asc')}>{direction}</Button>
        <Button type="submit">{copy.submit}</Button>
      </form>

      {selectionMode !== 'none' && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void downloadSelected()}>{copy.download}</Button>
          <Button type="button" variant="outline" onClick={() => setNotice(copy.share)}>{locale.startsWith('fr') ? 'Partager' : 'Share'}</Button>
          <Button type="button" variant="outline" onClick={() => setNotice(copy.remove)}>{locale.startsWith('fr') ? 'Supprimer' : 'Delete'}</Button>
        </div>
      )}

      {loading && <p>{copy.loading}</p>}
      {previewLoading && <p role="status">{copy.loading}</p>}
      {!loading && ordered.length === 0 && !notice && <p>{copy.empty}</p>}

      <div className={viewMode === 'grid' ? 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3' : 'space-y-2'}>
        {ordered.map((document) => (
          <article key={document.id} className="rounded border p-3">
            <div className="flex items-start gap-2">
              {selectionMode !== 'none' && (
                <Checkbox
                  checked={selected.has(document.id)}
                  onCheckedChange={() => toggle(document.id)}
                  aria-label={document.title}
                />
              )}
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-medium">{document.title}</h3>
                <p className="text-xs text-muted-foreground">{document.documentType ?? '-'} · {document.privacyLabel ?? '-'}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => void openPreview(document)}>{copy.preview}</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => void downloadOne(document.id)}>{copy.download}</Button>
            </div>
          </article>
        ))}
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>{copy.previous}</Button>
        <span className="self-center text-sm">{page} / {pageCount}</span>
        <Button type="button" variant="outline" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}>{copy.next}</Button>
      </div>

      {preview && loadedScope === scope && (
        <div role="dialog" aria-label={copy.preview} className="rounded border p-4">
          <h3 className="font-medium">{preview.title}</h3>
          <p className="text-sm">{copy.previewMeta}</p>
          <p className="text-sm">{preview.documentType} · {preview.privacyLabel}</p>
          <TranscriptReview key={preview.id} documentId={preview.id} />
          <Button type="button" className="mt-3" variant="outline" onClick={() => { previewRead.current?.abort(); previewRevision.current++; setPreview(null); setPreviewLoading(false); }}>{copy.close}</Button>
        </div>
      )}
    </section>
  );
}
