'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { denialFromStatus, journeyCopy, type JourneyDenial } from '@/lib/documents/canonical-journey';
import {
  authorizedBrowserDocuments,
  browserCopy,
  pageBrowserDocuments,
  sortBrowserDocuments,
  type BrowserDocument,
  type BrowserSort,
} from '@/lib/documents/browser-repository';
import { listDenied } from '@/lib/documents/document-repository-client';
import { requestAuthorizedDownload } from '@/lib/documents/document-repository-client';

export type { BrowserDocument };

type DocumentBrowserProps = {
  onDocumentSelect?: (document: BrowserDocument) => void;
  selectionMode?: 'single' | 'multiple' | 'none';
  filterByType?: string[];
  defaultView?: 'grid' | 'list';
};

export function DocumentBrowser({
  onDocumentSelect,
  selectionMode = 'none',
  filterByType,
  defaultView = 'grid',
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
  const pageSize = 12;

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query.trim()) params.set('keyword', query.trim());
    if (filterByType?.length === 1) params.set('documentType', filterByType[0] ?? '');
    const response = await fetch(`/api/documents/repository?${params.toString()}`);
    const body = await response.json().catch(() => null);
    const denial = listDenied(response.status, body);
    if (denial) {
      setDocuments([]);
      setNotice(denialCopy[denial]);
      setLoading(false);
      return;
    }
    const rows = authorizedBrowserDocuments(body) ?? [];
    const typed = filterByType?.length
      ? rows.filter((row) => filterByType.includes(row.documentType ?? ''))
      : rows;
    setDocuments(typed);
    setNotice(null);
    setLoading(false);
  }, [denialCopy, filterByType, query]);

  useEffect(() => {
    void load();
  }, [load]);

  const ordered = useMemo(
    () => pageBrowserDocuments(sortBrowserDocuments(documents, sort, direction), page, pageSize),
    [documents, direction, page, sort],
  );
  const pageCount = Math.max(1, Math.ceil(documents.length / pageSize));

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
    const result = await requestAuthorizedDownload(id);
    if (!result.downloadUrl) {
      setNotice(denialCopy[result.denial ?? 'unauthorized']);
      return false;
    }
    window.open(result.downloadUrl, '_blank', 'noopener,noreferrer');
    return true;
  };

  const downloadSelected = async () => {
    if (selected.size === 0) {
      setNotice(denialCopy.none_selected);
      return;
    }
    const urls: string[] = [];
    for (const id of selected) {
      const result = await requestAuthorizedDownload(id);
      if (!result.downloadUrl) {
        setNotice(denialCopy[(result.denial ?? 'unauthorized') as JourneyDenial]);
        return;
      }
      urls.push(result.downloadUrl);
    }
    setNotice(null);
    for (const url of urls) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const openPreview = async (row: BrowserDocument) => {
    const response = await fetch(`/api/documents/repository/${row.id}`);
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setNotice(denialCopy[denialFromStatus(response.status)]);
      setPreview(null);
      return;
    }
    const detail = authorizedBrowserDocuments({ data: [body && typeof body === 'object' && 'data' in body ? (body as { data: unknown }).data : body] });
    setPreview(detail?.[0] ?? row);
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

      <p className="text-sm text-muted-foreground">{copy.unavailableFilters}</p>
      {notice && <p role="alert" data-testid="browser-notice" className="rounded border px-3 py-2 text-sm">{notice}</p>}

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

      {preview && (
        <div role="dialog" aria-label={copy.preview} className="rounded border p-4">
          <h3 className="font-medium">{preview.title}</h3>
          <p className="text-sm">{copy.previewMeta}</p>
          <p className="text-sm">{preview.documentType} · {preview.privacyLabel}</p>
          <Button type="button" className="mt-3" variant="outline" onClick={() => setPreview(null)}>{copy.close}</Button>
        </div>
      )}
    </section>
  );
}
