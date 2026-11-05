'use client';

import { useCallback, useEffect, useState, type ReactElement } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  CheckCircle,
  Filter,
  Info,
  Loader2,
  RefreshCw,
  Settings,
  Trash2,
} from 'lucide-react';
import { ApiShapeError, readApiError } from '@/lib/client/api-envelope';
import { humanize } from '@/lib/client/row-fields';
import { inboxFrom, type Inbox } from '@/lib/notifications/inbox-record';
import { announceInboxChanged } from '@/lib/notifications/unread-count';

// The values of the type column that every writer of the inbox uses. A row of any other type is shown as the text it holds, never as one of these.
const KNOWN_TYPES = ['info', 'success', 'warning', 'error'] as const;
type KnownType = (typeof KNOWN_TYPES)[number];
const isKnownType = (type: string): type is KnownType => (KNOWN_TYPES as readonly string[]).includes(type);

const TYPE_STYLE: Record<KnownType, { icon: ReactElement; color: string }> = {
  info: { icon: <Info className="w-5 h-5" />, color: 'bg-blue-100 text-blue-700' },
  success: { icon: <CheckCircle className="w-5 h-5" />, color: 'bg-green-100 text-green-700' },
  warning: { icon: <AlertTriangle className="w-5 h-5" />, color: 'bg-yellow-100 text-yellow-700' },
  error: { icon: <AlertTriangle className="w-5 h-5" />, color: 'bg-red-100 text-red-700' },
};
const OTHER_STYLE = { icon: <Bell className="w-5 h-5" />, color: 'bg-gray-100 text-gray-700' };

/** What the user is told about a failure: the server's own message when it gave one, else the screen's wording. */
const reason = (err: unknown, fallback: string) =>
  err instanceof Error && !(err instanceof ApiShapeError) && err.message ? err.message : fallback;

/** The inbox as read, with the filter it was read for. */
type Loaded = Inbox & { view: string };

export default function NotificationsConsole() {
  const t = useTranslations();
  const params = useParams<{ locale?: string }>();
  const localePrefix = params?.locale ? `/${params.locale}` : '';

  const [typeFilter, setTypeFilter] = useState<'all' | KnownType>('all');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [inbox, setInbox] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The clock that "x minutes ago" is counted from; it advances each minute so the wording does not go stale on a page that stays open.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const view = `${typeFilter}|${unreadOnly}`;

  const read = useCallback(async (): Promise<Loaded> => {
    const query = new URLSearchParams({ limit: '100' });
    if (unreadOnly) query.set('unreadOnly', 'true');
    if (typeFilter !== 'all') query.set('type', typeFilter);
    const response = await fetch(`/api/notifications?${query.toString()}`);
    if (!response.ok) throw new Error(await readApiError(response, ''));
    return { ...inboxFrom(await response.json()), view: `${typeFilter}|${unreadOnly}` };
  }, [typeFilter, unreadOnly]);

  useEffect(() => {
    let current = true;
    read().then(
      (next) => {
        if (!current) return;
        setInbox(next);
        setLoadError(null);
        setLoading(false);
      },
      (err: unknown) => {
        if (!current) return;
        setLoadError(reason(err, t('notifications.loadFailed')));
        setLoading(false);
      },
    );
    return () => {
      current = false;
    };
  }, [read, t]);

  // Counts and rows are the server's: after anything changes, the inbox is read again instead of patched up locally.
  const reload = useCallback(async () => {
    try {
      setInbox(await read());
      setLoadError(null);
    } catch (err) {
      setLoadError(reason(err, t('notifications.loadFailed')));
    }
  }, [read, t]);

  const retry = () => {
    setLoading(true);
    setLoadError(null);
    void reload().finally(() => setLoading(false));
  };

  const act = async (call: () => Promise<Response>, fallback: string) => {
    setBusy(true);
    setActionError(null);
    try {
      const response = await call();
      if (!response.ok) throw new Error(await readApiError(response, ''));
      // The route did it: the header's unread count is read again, whether or not this screen's own re-read succeeds.
      announceInboxChanged();
      await reload();
    } catch (err) {
      setActionError(reason(err, fallback));
    } finally {
      setBusy(false);
    }
  };

  const markAsRead = (id: string) =>
    act(
      () =>
        fetch(`/api/notifications/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ read: true }),
        }),
      t('notifications.markReadFailed'),
    );

  const markAllAsRead = () => act(() => fetch('/api/notifications/mark-all-read', { method: 'POST' }), t('notifications.markAllReadFailed'));

  const deleteNotification = (id: string) =>
    act(() => fetch(`/api/notifications/${id}`, { method: 'DELETE' }), t('notifications.deleteFailed'));

  const getTimeAgo = (dateStr: string) => {
    const time = new Date(dateStr);
    if (Number.isNaN(time.getTime())) return '—';
    const diffInMinutes = Math.floor((now - time.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return t('notifications.justNow');
    if (diffInMinutes < 60) return t('notifications.minutesAgo', { minutes: diffInMinutes });
    if (diffInMinutes < 1440) return t('notifications.hoursAgo', { hours: Math.floor(diffInMinutes / 60) });
    return t('notifications.daysAgo', { days: Math.floor(diffInMinutes / 1440) });
  };

  const typeStyle = (type: string) => (isKnownType(type) ? TYPE_STYLE[type] : OTHER_STYLE);
  const typeLabel = (type: string) => (isKnownType(type) ? t(`notifications.types.${type}`) : humanize(type));

  const filters: { id: 'all' | KnownType; label: string; icon: ReactElement }[] = [
    { id: 'all', label: t('common.all'), icon: <Bell className="w-4 h-4" /> },
    ...KNOWN_TYPES.map((type) => ({ id: type, label: t(`notifications.types.${type}`), icon: TYPE_STYLE[type].icon })),
  ];
  const filtered = typeFilter !== 'all' || unreadOnly;
  // Rows and counts that belong to the previous filter stay on screen, dimmed and inert, until the answer for the chosen one arrives.
  const stale = inbox !== null && inbox.view !== view;
  const locked = busy || stale;

  if (loading) {
    return (
      <div className="p-8">
        <div className="max-w-5xl mx-auto flex items-center justify-center min-h-100">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-gray-600">{t('common.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (loadError !== null || inbox === null) {
    return (
      <div className="p-8">
        <div className="max-w-5xl mx-auto">
          <Card className="p-12 text-center bg-white/80 backdrop-blur-sm border-gray-200">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <h2 role="alert" className="text-xl font-semibold text-gray-900 mb-2">{loadError ?? t('notifications.loadFailed')}</h2>
            <button
              onClick={retry}
              className="mt-4 flex items-center gap-2 mx-auto px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              {t('common.retry')}
            </button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                {t('notifications.title')}
              </h1>
              <p className="text-gray-600">
                {t('notifications.subtitle')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {inbox.unreadCount > 0 && (
                <button
                  onClick={() => void markAllAsRead()}
                  disabled={locked}
                  className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 border border-gray-200 transition-colors disabled:opacity-50"
                >
                  <CheckCheck className="w-4 h-4" />
                  {t('notifications.markAllRead')}
                </button>
              )}
            </div>
          </div>

          {/* Stats: both figures are the route's own counts */}
          <div className={`grid grid-cols-2 gap-4 mb-6 ${stale ? 'opacity-50' : ''}`} aria-busy={stale}>
            <Card className="p-4 bg-white/80 backdrop-blur-sm border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">{t('common.total')}</p>
                  <p className="text-2xl font-bold text-gray-900">{inbox.total}</p>
                  {filtered && <p className="text-xs text-gray-500">{t('notifications.matching')}</p>}
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Bell className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-white/80 backdrop-blur-sm border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">{t('notifications.unread')}</p>
                  <p className="text-2xl font-bold text-gray-900">{inbox.unreadCount}</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </Card>
          </div>

          {/* Type Filters */}
          <div className="flex items-center gap-3 mb-4 overflow-x-auto pb-2">
            {filters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setTypeFilter(filter.id)}
                aria-pressed={typeFilter === filter.id}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  typeFilter === filter.id
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                {filter.icon}
                {filter.label}
              </button>
            ))}
          </div>

          {/* Unread Only Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setUnreadOnly(!unreadOnly)}
              aria-pressed={unreadOnly}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                unreadOnly
                  ? 'bg-orange-100 text-orange-700 border border-orange-200'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <Filter className="w-4 h-4" />
              {t('notifications.showUnreadOnly')}
            </button>
          </div>
        </div>

        {actionError !== null && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        )}

        {/* Notifications List */}
        <div className={`space-y-3 ${stale ? 'opacity-50' : ''}`} aria-busy={stale}>
          <AnimatePresence mode="popLayout">
            {inbox.notifications.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <Card className="p-12 text-center bg-white/80 backdrop-blur-sm border-gray-200">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    {!filtered ? t('notifications.noNotifications') : typeFilter === 'all' ? t('notifications.allCaughtUp') : t('notifications.noMatch')}
                  </h2>
                  {!filtered && <p className="text-gray-600">{t('notifications.youreAllCaughtUp')}</p>}
                  {filtered && typeFilter === 'all' && <p className="text-gray-600">{t('notifications.noUnread')}</p>}
                  {filtered && (
                    <button
                      onClick={() => {
                        setTypeFilter('all');
                        setUnreadOnly(false);
                      }}
                      className="mt-4 text-blue-600 hover:text-blue-700 font-medium text-sm"
                    >
                      {t('notifications.clearFilters')}
                    </button>
                  )}
                </Card>
              </motion.div>
            ) : (
              inbox.notifications.map((notification) => (
                <motion.div
                  key={notification.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card
                    className={`p-5 bg-white/80 backdrop-blur-sm border-gray-200 hover:shadow-lg transition-all ${
                      !notification.read
                        ? 'cursor-pointer border-l-4 border-l-blue-600'
                        : 'border-l-4 border-l-transparent'
                    }`}
                    onClick={notification.read || locked ? undefined : () => void markAsRead(notification.id)}
                  >
                    <div className="flex gap-4">
                      {/* Icon */}
                      <div
                        className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${
                          typeStyle(notification.type).color
                        }`}
                      >
                        {typeStyle(notification.type).icon}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3
                                className={`text-base font-semibold ${
                                  notification.read
                                    ? 'text-gray-700'
                                    : 'text-gray-900'
                                }`}
                              >
                                {notification.title}
                              </h3>
                              {!notification.read && (
                                <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                              )}
                            </div>
                            <p
                              className={`text-sm ${
                                notification.read
                                  ? 'text-gray-500'
                                  : 'text-gray-700'
                              }`}
                            >
                              {notification.message}
                            </p>
                          </div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500">
                              {getTimeAgo(notification.createdAt)}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                typeStyle(notification.type).color
                              }`}
                            >
                              {typeLabel(notification.type)}
                            </span>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2">
                            {notification.actionUrl && (
                              <Link
                                href={`${localePrefix}${notification.actionUrl}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                                className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
                              >
                                {notification.actionLabel || t('common.view')}
                              </Link>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                void deleteNotification(notification.id);
                              }}
                              disabled={locked}
                              className="p-1 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                              title={t('notifications.deleteNotification')}
                              aria-label={t('notifications.deleteNotification')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        {inbox.notifications.length < inbox.total && (
          <p className="mt-4 text-sm text-gray-500">
            {t('notifications.showingNewest', { shown: inbox.notifications.length, total: inbox.total })}
          </p>
        )}

        <div className="mt-8">
          <Link
            href={`${localePrefix}/dashboard/settings/communications`}
            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
          >
            <Settings className="w-4 h-4" />
            {t('notifications.preferencesLink')}
          </Link>
        </div>
      </div>
    </div>
  );
}
