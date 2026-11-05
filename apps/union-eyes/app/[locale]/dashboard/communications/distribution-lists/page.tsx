/**
 * Distribution Lists Management Page
 * 
 * Lists all distribution lists with subscriber counts and actions
 * Path: /dashboard/communications/distribution-lists
 * 
 * Phase 4: Communications & Organizing
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { ApiShapeError, envelopePages, envelopeRows } from '@/lib/client/api-envelope';
import { envelopeTotal } from '@/lib/client/list-total';
import { asRecord, optionalString, requiredString } from '@/lib/client/row-fields';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Users, Plus, Search, RefreshCw } from 'lucide-react';

interface DistributionList {
  id: string;
  name: string;
  description: string | null;
  listType: string;
  // The table's cached subscriber counter; null when the record holds none, which is not zero.
  subscriberCount: number | null;
  isActive: boolean;
  createdAt: string | null;
}

/** A newsletter_distribution_lists record: id and name are required; a column the table leaves nullable stays null, and list type and activity read as the table's defaults. */
function listFrom(value: unknown): DistributionList {
  const row = asRecord(value, 'distribution list');
  const subscribers = row.subscriberCount;
  return {
    id: requiredString(row, 'id'),
    name: requiredString(row, 'name'),
    description: optionalString(row, 'description'),
    listType: optionalString(row, 'listType') ?? 'manual',
    subscriberCount: typeof subscribers === 'number' && Number.isFinite(subscribers) ? subscribers : null,
    isActive: row.isActive !== false,
    createdAt: optionalString(row, 'createdAt'),
  };
}

export default function DistributionListsPage() {
  const t = useTranslations('distributionListsPage');
  const tMarketing = useTranslations('marketing.distributionLists');
  const router = useRouter();
  const locale = useLocale();
  const base = `/${locale}/dashboard/communications/distribution-lists`;
  const [lists, setLists] = useState<DistributionList[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLists = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });

      const response = await fetch(`/api/communications/distribution-lists?${params}`);

      if (!response.ok) {
        throw new Error(t('errors.fetchFailed'));
      }

      // withApi wraps in { success, data: { data, pagination }, timestamp }; a body of another shape is an error, not an empty list.
      const body: unknown = await response.json();
      const rows = envelopeRows(body).map(listFrom);
      setLists(rows);
      setTotal(envelopeTotal(body));
      setTotalPages(envelopePages(body));
    } catch (err) {
      setLists([]);
      setTotal(null);
      setError(err instanceof Error && !(err instanceof ApiShapeError) ? err.message : t('errors.fetchFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLists();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const filteredLists = lists.filter(list =>
    list.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    list.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // A figure over rows that were not loaded is not zero; it is unknown. A page sum with a list that holds no counter is not worked out.
  const loaded = !loading && !error;
  const figure = (count: number | null) => (loaded && count !== null ? count : '—');
  const subscribersOnPage = lists.every((list) => list.subscriberCount !== null)
    ? lists.reduce((sum, list) => sum + (list.subscriberCount ?? 0), 0)
    : null;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{tMarketing('title')}</h1>
          <p className="text-muted-foreground">
            {t('header.description')}
          </p>
        </div>
        <Button onClick={() => router.push(`${base}/new`)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('header.createList')}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('stats.totalLists')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{figure(total)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('stats.activeLists')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {figure(loaded ? lists.filter(l => l.isActive).length : null)}
            </div>
            <p className="text-xs text-muted-foreground">{t('onThisPage')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('stats.totalSubscribers')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {figure(subscribersOnPage)}
            </div>
            <p className="text-xs text-muted-foreground">{t('onThisPage')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('search.placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button variant="outline" onClick={fetchLists}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lists Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('table.title')}</CardTitle>
          <CardDescription>
            {loaded && (searchQuery
              ? `${t('table.foundCount', { count: filteredLists.length })} (${t('onThisPage')})`
              : total !== null && t('table.foundCount', { count: total }))}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="mt-2 text-muted-foreground">{t('states.loading')}</p>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              <p>{error}</p>
              <Button variant="outline" onClick={fetchLists} className="mt-4">
                {t('states.tryAgain')}
              </Button>
            </div>
          ) : filteredLists.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">{t('states.empty')}</p>
              <Button onClick={() => router.push(`${base}/new`)} className="mt-4">
                {t('states.createFirstList')}
              </Button>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('table.columns.listName')}</TableHead>
                    <TableHead>{t('table.columns.type')}</TableHead>
                    <TableHead>{t('table.columns.subscribers')}</TableHead>
                    <TableHead>{t('table.columns.status')}</TableHead>
                    <TableHead>{t('table.columns.created')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLists.map((list) => (
                    <TableRow
                      key={list.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`${base}/${list.id}`)}
                    >
                      <TableCell>
                        <div>
                          <div className="font-medium">{list.name}</div>
                          {list.description && (
                            <div className="text-sm text-muted-foreground line-clamp-1">
                              {list.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {list.listType || t('table.manualFallback')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          {list.subscriberCount === null ? '—' : list.subscriberCount}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={list.isActive ? 'default' : 'secondary'}>
                          {list.isActive ? t('table.status.active') : t('table.status.inactive')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(list.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    {t('pagination.previous')}
                  </Button>
                  <span className="flex items-center text-sm text-muted-foreground">
                    {t('pagination.pageOf', { page, totalPages })}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    {t('pagination.next')}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
