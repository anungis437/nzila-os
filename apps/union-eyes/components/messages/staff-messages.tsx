'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Inbox, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ConversationPanel } from '@/components/messages/conversation-panel';
import { assignmentProblem, pick, type AssignmentProblem } from '@/components/messages/messages-api';

type QueueItem = { id: string; subject: string; category: string | null; priority: string | null; createdAt: string };
type Thread = {
  id: string;
  subject: string;
  status: string;
  isArchived: boolean;
  lastMessageAt: string | null;
  createdAt: string;
  viewerRole: 'member' | 'assignee';
};
type Translate = (key: string, values?: Record<string, string | number>) => string;

const POLL_MS = 30000;

/**
 * Staff side of secure messaging. A triager with a live designation sees the unassigned queue as metadata only and can
 * assign a conversation; the assignee opens it, reads, replies, reassigns, releases or closes it. Everything shown here
 * is decided by the server: the queue answers 404 to anyone without a live designation, and a conversation that is not
 * (or is no longer) the caller's is indistinguishable from a missing one.
 */
export function StaffMessages({ userId, initialThreadId }: { userId: string; initialThreadId?: string }) {
  const t = useTranslations('staffMessages') as unknown as Translate;
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queueState, setQueueState] = useState<'loading' | 'ready' | 'denied' | 'error'>('loading');
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadState, setThreadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [activeId, setActiveId] = useState<string | null>(initialThreadId ?? null);
  const [showArchived, setShowArchived] = useState(false);

  const loadQueue = useCallback(async (quiet = false) => {
    if (!quiet) setQueueState('loading');
    try {
      const response = await fetch('/api/messages/queue');
      // Without a live triage designation the server answers 404 exactly as for a route that does not exist.
      if (response.status === 404 || response.status === 403) {
        setQueue([]);
        return setQueueState('denied');
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setQueue(pick<QueueItem[]>(await response.json(), 'queue') ?? []);
      setQueueState('ready');
    } catch {
      if (!quiet) setQueueState('error');
    }
  }, []);

  const loadThreads = useCallback(async (quiet = false) => {
    if (!quiet) setThreadState('loading');
    try {
      const response = await fetch('/api/messages/threads');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setThreads((pick<Thread[]>(await response.json(), 'threads') ?? []).filter((thread) => thread.viewerRole === 'assignee'));
      setThreadState('ready');
    } catch {
      if (!quiet) setThreadState('error');
    }
  }, []);

  const refresh = useCallback(() => {
    void loadQueue(true);
    void loadThreads(true);
  }, [loadQueue, loadThreads]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadQueue();
    void loadThreads();
    const timer = window.setInterval(refresh, POLL_MS);
    return () => window.clearInterval(timer);
  }, [loadQueue, loadThreads, refresh]);

  const visibleThreads = threads.filter((thread) => showArchived || !thread.isArchived || thread.id === activeId);
  const hasArchived = threads.some((thread) => thread.isArchived);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6" data-testid="staff-messages">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>
      <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">{t('privacyNote')}</p>

      <div className="grid gap-6 md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className={`space-y-6 ${activeId ? 'hidden md:block' : ''}`}>
          <section aria-labelledby="staff-queue-heading">
            <h2 id="staff-queue-heading" className="mb-2 text-base font-semibold">{t('queueTitle')}</h2>
            {queueState === 'loading' && <ListSkeleton label={t('loading')} />}
            {queueState === 'denied' && (
              <p role="status" className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground" data-testid="queue-denied">{t('queueDenied')}</p>
            )}
            {queueState === 'error' && (
              <div role="alert" className="rounded-lg border border-destructive/40 p-4 text-sm">
                <p>{t('queueLoadError')}</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => void loadQueue()}>{t('retry')}</Button>
              </div>
            )}
            {queueState === 'ready' && queue.length === 0 && (
              <div className="rounded-lg border border-dashed p-4 text-center" data-testid="queue-empty">
                <Inbox className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
                <p className="font-medium">{t('queueEmptyTitle')}</p>
                <p className="text-sm text-muted-foreground">{t('queueEmptyBody')}</p>
              </div>
            )}
            {queueState === 'ready' && queue.length > 0 && (
              <>
                <p className="mb-2 text-xs text-muted-foreground">{t('queueMetadataNote')}</p>
                <ul className="space-y-2">
                  {queue.map((item) => (
                    <QueueRow key={item.id} item={item} userId={userId} onAssigned={refresh} />
                  ))}
                </ul>
              </>
            )}
          </section>

          <section aria-labelledby="staff-assigned-heading">
            <h2 id="staff-assigned-heading" className="mb-2 text-base font-semibold">{t('assignedTitle')}</h2>
            {threadState === 'loading' && <ListSkeleton label={t('loading')} />}
            {threadState === 'error' && (
              <div role="alert" className="rounded-lg border border-destructive/40 p-4 text-sm">
                <p>{t('loadError')}</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => void loadThreads()}>{t('retry')}</Button>
              </div>
            )}
            {threadState === 'ready' && threads.length === 0 && (
              <div className="rounded-lg border border-dashed p-4 text-center" data-testid="assigned-empty">
                <MessageSquare className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
                <p className="font-medium">{t('assignedEmptyTitle')}</p>
                <p className="text-sm text-muted-foreground">{t('assignedEmptyBody')}</p>
              </div>
            )}
            {threadState === 'ready' && threads.length > 0 && (
              <>
                {hasArchived && (
                  <label className="mb-2 flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
                    {t('showArchived')}
                  </label>
                )}
                <ThreadList threads={visibleThreads} activeId={activeId} onOpen={setActiveId} t={t} />
              </>
            )}
          </section>
        </div>

        <section aria-live="polite" aria-label={t('conversationLabel')}>
          {activeId ? (
            <ConversationPanel
              key={activeId}
              ns="staffMessages"
              staffActions
              threadId={activeId}
              onBack={() => setActiveId(null)}
              onChanged={refresh}
            />
          ) : (
            <p className="hidden rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground md:block">{t('selectPrompt')}</p>
          )}
        </section>
      </div>
    </div>
  );
}

function ListSkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-3" role="status" aria-busy="true" aria-label={label}>
      {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
    </div>
  );
}

function ThreadList({ threads, activeId, onOpen, t }: { threads: Thread[]; activeId: string | null; onOpen: (id: string) => void; t: Translate }) {
  const locale = useLocale();
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });
  return (
    <ul className="space-y-2">
      {threads.map((thread) => (
        <li key={thread.id}>
          <button
            type="button"
            onClick={() => onOpen(thread.id)}
            aria-current={thread.id === activeId ? 'true' : undefined}
            className={`w-full rounded-lg border p-3 text-left hover:bg-muted/50 ${thread.id === activeId ? 'bg-muted' : ''}`}
          >
            <span className="line-clamp-1 font-medium">{thread.subject}</span>
            <span className="text-xs text-muted-foreground">
              {dateFormat.format(new Date(thread.lastMessageAt ?? thread.createdAt))}
              {thread.status !== 'open' ? ` · ${t(`status.${thread.status}`)}` : ''}
              {thread.isArchived ? ` · ${t('archived')}` : ''}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function QueueRow({ item, userId, onAssigned }: { item: QueueItem; userId: string; onAssigned: () => void }) {
  const t = useTranslations('staffMessages') as unknown as Translate;
  const locale = useLocale();
  const [other, setOther] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<AssignmentProblem | null>(null);
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });

  const assign = async (toStaffId: string) => {
    if (busy || !toStaffId.trim()) return;
    setBusy(true);
    setProblem(null);
    try {
      const response = await fetch(`/api/messages/threads/${encodeURIComponent(item.id)}/assignment`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'assign', toStaffId: toStaffId.trim() }),
      });
      if (!response.ok) {
        setProblem(await assignmentProblem(response));
        // The queue may have changed under this person; show it as it is now.
        if (response.status === 404 || response.status === 409) onAssigned();
        return;
      }
      onAssigned();
    } catch {
      setProblem('assignmentFailed');
    } finally {
      setBusy(false);
    }
  };

  const titleId = `queue-item-${item.id}`;
  return (
    <li className="space-y-2 rounded-lg border p-3" aria-labelledby={titleId} data-testid="queue-item">
      <div>
        <p id={titleId} className="line-clamp-2 font-medium">{item.subject}</p>
        <p className="text-xs text-muted-foreground">
          {dateFormat.format(new Date(item.createdAt))}
          {item.category ? ` · ${item.category}` : ''}
          {item.priority ? ` · ${t('priority', { priority: item.priority })}` : ''}
        </p>
      </div>
      {problem && <p role="alert" className="text-sm text-destructive">{t(problem)}</p>}
      <div className="flex flex-wrap items-end gap-2">
        <Button size="sm" disabled={busy} onClick={() => void assign(userId)} aria-label={t('assignToMeFor', { subject: item.subject })}>
          {t('assignToMe')}
        </Button>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void assign(other);
          }}
        >
          <div className="space-y-1">
            <label htmlFor={`assign-${item.id}`} className="text-xs font-medium">{t('assignToLabel')}</label>
            <input
              id={`assign-${item.id}`}
              className="w-44 max-w-full rounded-md border bg-background px-2 py-1.5 text-sm"
              value={other}
              maxLength={255}
              autoComplete="off"
              onChange={(e) => setOther(e.target.value)}
            />
          </div>
          <Button type="submit" size="sm" variant="outline" disabled={busy || !other.trim()}>{t('assign')}</Button>
        </form>
      </div>
    </li>
  );
}
