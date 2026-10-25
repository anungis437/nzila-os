'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { MessageSquare, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ConversationPanel } from '@/components/messages/conversation-panel';
import { MAX_BODY, MAX_SUBJECT, pick } from '@/components/messages/messages-api';

export { pick };

type Thread = {
  id: string;
  subject: string;
  status: string;
  isArchived?: boolean;
  lastMessageAt: string | null;
  createdAt: string;
  representativeAssigned: boolean;
};

export function MemberMessages({ initialThreadId, compose }: { initialThreadId?: string; compose?: 'privacy' }) {
  const t = useTranslations('memberMessages');
  const locale = useLocale();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [listState, setListState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [activeId, setActiveId] = useState<string | null>(initialThreadId ?? null);
  const [composing, setComposing] = useState(Boolean(compose) && !initialThreadId);
  const [showArchived, setShowArchived] = useState(false);
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });
  const visibleThreads = threads.filter((thread) => showArchived || !thread.isArchived || thread.id === activeId);
  const hasArchived = threads.some((thread) => thread.isArchived);

  const loadThreads = useCallback(async (quiet = false) => {
    if (!quiet) setListState('loading');
    try {
      const response = await fetch('/api/messages/threads');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setThreads(pick<Thread[]>(await response.json(), 'threads') ?? []);
      setListState('ready');
    } catch {
      if (!quiet) setListState('error');
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadThreads();
    const timer = window.setInterval(() => void loadThreads(true), 30000);
    return () => window.clearInterval(timer);
  }, [loadThreads]);

  const open = (id: string) => {
    setComposing(false);
    setActiveId(id);
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6" data-testid="member-messages">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div>
        <Button onClick={() => { setComposing(true); setActiveId(null); }} data-testid="new-conversation">
          <Plus className="mr-2 h-4 w-4" aria-hidden />
          {t('newConversation')}
        </Button>
      </div>
      <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">{t('privacyNote')}</p>

      <div className="grid gap-6 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <section aria-label={t('listLabel')} className={activeId || composing ? 'hidden md:block' : ''}>
          {listState === 'loading' && (
            <div className="space-y-3" role="status" aria-busy="true">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
            </div>
          )}
          {listState === 'error' && (
            <div role="alert" className="rounded-lg border border-destructive/40 p-4 text-sm">
              <p>{t('loadError')}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => void loadThreads()}>{t('retry')}</Button>
            </div>
          )}
          {listState === 'ready' && threads.length === 0 && (
            <div className="rounded-lg border border-dashed p-6 text-center" data-testid="messages-empty">
              <MessageSquare className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
              <p className="font-medium">{t('emptyTitle')}</p>
              <p className="text-sm text-muted-foreground">{t('emptyBody')}</p>
            </div>
          )}
          {listState === 'ready' && threads.length > 0 && (
            <>
              {hasArchived && (
                <label className="mb-2 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
                  {t('showArchived')}
                </label>
              )}
              <ul className="space-y-2">
                {visibleThreads.map((thread) => (
                  <li key={thread.id}>
                    <button
                      type="button"
                      onClick={() => open(thread.id)}
                      aria-current={thread.id === activeId ? 'true' : undefined}
                      className={`w-full rounded-lg border p-3 text-left hover:bg-muted/50 ${thread.id === activeId ? 'bg-muted' : ''}`}
                    >
                      <span className="line-clamp-1 font-medium">{thread.subject}</span>
                      <span className="text-xs text-muted-foreground">
                        {dateFormat.format(new Date(thread.lastMessageAt ?? thread.createdAt))}
                        {thread.status !== 'open' ? ` · ${t(`status.${thread.status}` as never)}` : ''}
                        {thread.isArchived ? ` · ${t('archived')}` : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section aria-live="polite">
          {composing && (
            <NewConversation
              initialSubject={compose === 'privacy' ? t('privacySubject') : ''}
              onCancel={() => setComposing(false)}
              onCreated={(id) => { setComposing(false); setActiveId(id); void loadThreads(true); }}
            />
          )}
          {!composing && activeId && (
            <ConversationPanel
              key={activeId}
              ns="memberMessages"
              threadId={activeId}
              onBack={() => setActiveId(null)}
              onChanged={() => void loadThreads(true)}
            />
          )}
          {!composing && !activeId && listState === 'ready' && threads.length > 0 && (
            <p className="hidden rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground md:block">{t('selectPrompt')}</p>
          )}
        </section>
      </div>
    </div>
  );
}

function NewConversation({ initialSubject, onCancel, onCreated }: { initialSubject: string; onCancel: () => void; onCreated: (id: string) => void }) {
  const t = useTranslations('memberMessages');
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);
  // One id per composed message: a retry after a dropped connection cannot create a duplicate.
  const requestId = useRef(crypto.randomUUID());

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (sending || !subject.trim() || !body.trim()) return;
    setSending(true);
    setError(false);
    try {
      const response = await fetch('/api/messages/threads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subject: subject.trim(), body: body.trim(), clientRequestId: requestId.current }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const id = pick<string>(await response.json(), 'id');
      if (!id) throw new Error('missing id');
      onCreated(id);
    } catch {
      setError(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border p-4" data-testid="new-conversation-form">
      <h2 className="text-lg font-semibold">{t('newConversation')}</h2>
      <div className="space-y-1">
        <label htmlFor="msg-subject" className="text-sm font-medium">{t('subject')}</label>
        <input
          id="msg-subject"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={subject}
          maxLength={MAX_SUBJECT}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={t('subjectPlaceholder')}
          required
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="msg-body" className="text-sm font-medium">{t('message')}</label>
        <textarea
          id="msg-body"
          className="min-h-32 w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={body}
          maxLength={MAX_BODY}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t('messagePlaceholder')}
          required
        />
        <p className="text-xs text-muted-foreground">{t('attachmentsUnavailable')}</p>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{t('sendError')}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={sending || !subject.trim() || !body.trim()}>{sending ? t('sending') : t('send')}</Button>
        <Button type="button" variant="outline" onClick={onCancel}>{t('cancel')}</Button>
      </div>
    </form>
  );
}
