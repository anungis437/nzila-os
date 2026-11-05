'use client';


export const dynamic = 'force-dynamic';
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { MobileHeader } from '@/components/mobile/MobileHeader';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { useLocale, useTranslations } from "next-intl";
import { ApiShapeError, envelopeData, readApiError } from '@/lib/client/api-envelope';
import { asRecord, humanize, optionalString, requiredString } from '@/lib/client/row-fields';

const PAGE_SIZE = 50;
const STATUS_FILTERS = ['all', 'active', 'inactive', 'pending'] as const;

/** What GET /api/members sends for a member (lib/members/directory-access.ts): no first and last name, no union local, and no sync state. */
interface DirectoryMember {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  status: string;
}

function toDirectoryMember(raw: unknown): DirectoryMember {
  const row = asRecord(raw, 'member');
  return {
    id: requiredString(row, 'id'),
    name: optionalString(row, 'name'),
    email: optionalString(row, 'email'),
    role: requiredString(row, 'role'),
    status: requiredString(row, 'status'),
  };
}

interface DirectoryPage {
  members: DirectoryMember[];
  total: number;
}

/**
 * One page of the directory the caller may see. The route answers { success, data: { members, total }, timestamp }, where total is the
 * number of members matching the search and status, not the number on the page. A body that is not that is an error, never an empty list.
 */
async function fetchDirectoryPage(filters: { search: string; status: string; offset: number }): Promise<DirectoryPage> {
  const query = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(filters.offset) });
  if (filters.search) query.set('search', filters.search);
  if (filters.status !== 'all') query.set('status', filters.status);
  const response = await fetch(`/api/members?${query.toString()}`);
  if (!response.ok) throw new Error(await readApiError(response, `Request failed with status ${response.status}`));
  const payload = envelopeData(await response.json());
  if (!Array.isArray(payload.members)) throw new ApiShapeError('no members');
  const { total } = payload;
  if (typeof total !== 'number' || !Number.isInteger(total) || total < 0) throw new ApiShapeError('no total');
  return { members: payload.members.map(toDirectoryMember), total };
}

const initialsOf = (member: DirectoryMember) =>
  (member.name ?? member.email ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

function subscribeToConnection(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/**
 * Mobile members list page: the same directory as the desktop console, searched and filtered by the server.
 * Nothing is kept on the device, so offline there is nothing to show but the fact that it is offline.
 */
export default function MobileMembersPage() {
  const t = useTranslations("mobile.members");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [members, setMembers] = useState<DirectoryMember[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const isOffline = useSyncExternalStore(subscribeToConnection, () => !navigator.onLine, () => false);
  // Counts the loads of the first page, so a "load more" that was answered after the search or filter changed is not added to the new list.
  const generation = useRef(0);

  // The server searches once the typing pauses.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let current = true;
    generation.current += 1;
    fetchDirectoryPage({ search, status: statusFilter, offset: 0 }).then(
      (page) => {
        if (!current) return;
        setMembers(page.members);
        setTotal(page.total);
        setLoadError(null);
        setMoreError(null);
        setIsLoading(false);
      },
      (error: unknown) => {
        logger.error('Failed to load members:', error);
        if (!current) return;
        setMembers([]);
        setTotal(null);
        setLoadError(error instanceof Error ? error.message : '');
        setIsLoading(false);
      },
    );
    return () => {
      current = false;
    };
  }, [search, statusFilter, reloadKey]);

  const retry = () => {
    setIsLoading(true);
    setReloadKey((key) => key + 1);
  };

  const loadMore = async () => {
    const mine = generation.current;
    setIsLoadingMore(true);
    setMoreError(null);
    try {
      const page = await fetchDirectoryPage({ search, status: statusFilter, offset: members.length });
      if (generation.current !== mine) return;
      setMembers((loaded) => [...loaded, ...page.members.filter((next) => !loaded.some((member) => member.id === next.id))]);
      setTotal(page.total);
    } catch (error) {
      logger.error('Failed to load more members:', error);
      if (generation.current === mine) setMoreError(error instanceof Error ? error.message : '');
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <div className="min-w-0 space-y-6 bg-background">
      <MobileHeader title={t("title")} />

      {/* Search bar */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="relative">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
              clipRule="evenodd"
            />
          </svg>
          <input
            type="search"
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="min-h-11 w-full pl-10 pr-4 py-2 bg-muted rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Status filter */}
        <div className="flex flex-wrap gap-2 mt-3">
          {STATUS_FILTERS.map((status) => (
            <button
              key={status}
              type="button"
              aria-pressed={statusFilter === status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                'min-h-11 px-3 py-2 text-sm font-medium rounded-full whitespace-normal transition-colors',
                statusFilter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600'
              )}
            >
              {t(`filter${status.charAt(0).toUpperCase() + status.slice(1)}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Members list */}
      <div className="p-4 space-y-2">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-full" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))
        ) : loadError !== null ? (
          <div className="text-center py-12 space-y-3">
            <p role="alert" className="text-sm text-red-600">
              {t("loadFailed")}{loadError ? ` ${loadError}` : ''}
            </p>
            <button
              type="button"
              onClick={retry}
              className="min-h-11 px-4 py-2 text-sm font-medium rounded-full bg-blue-600 text-white"
            >
              {tCommon("retry")}
            </button>
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-12">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12 mx-auto text-gray-400 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            <p className="text-gray-500">
              {search ? t("noResultsSearch") : t("noResultsEmpty")}
            </p>
          </div>
        ) : (
          <>
            {members.map((member) => (
              <Link
                key={member.id}
                href={`/${locale}/dashboard/members/${member.id}`}
                className="block bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center text-white font-medium',
                    member.status === 'active' ? 'bg-green-500' :
                    member.status === 'pending' ? 'bg-yellow-500' :
                    'bg-gray-400'
                  )}>
                    {initialsOf(member)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">
                      {member.name ?? member.email ?? '—'}
                    </h3>
                    {member.name && member.email && (
                      <p className="text-sm text-gray-500 truncate">{member.email}</p>
                    )}
                    <p className="text-xs text-gray-400">{humanize(member.role)}</p>
                  </div>

                  {/* Status badge */}
                  <span className={cn(
                    'px-2 py-1 text-xs font-medium rounded-full',
                    member.status === 'active' && 'bg-green-100 text-green-700',
                    member.status === 'pending' && 'bg-yellow-100 text-yellow-700',
                    member.status !== 'active' && member.status !== 'pending' && 'bg-gray-100 text-gray-600'
                  )}>
                    {humanize(member.status)}
                  </span>
                </div>
              </Link>
            ))}

            {total !== null && total > members.length && (
              <div className="text-center pt-2 space-y-2">
                <p className="text-sm text-gray-500">{t("showing", { shown: members.length, total })}</p>
                {moreError !== null && (
                  <p role="alert" className="text-sm text-red-600">
                    {t("loadFailed")}{moreError ? ` ${moreError}` : ''}
                  </p>
                )}
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={isLoadingMore}
                  className="min-h-11 px-4 py-2 text-sm font-medium rounded-full bg-blue-600 text-white disabled:opacity-60"
                >
                  {t("loadMore")}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Offline indicator */}
      {isOffline && (
        <div className="fixed bottom-20 left-4 right-4 bg-amber-500 text-white px-4 py-2 rounded-lg text-center text-sm">
          {t("offlineBanner")}
        </div>
      )}
    </div>
  );
}
