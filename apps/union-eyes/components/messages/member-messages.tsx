'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, MessageSquare, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

type Thread = {
  id: string;
  subject: string;
  status: string;
  lastMessageAt: string | null;
  createdAt: string;
  representativeAssigned: boolean;
};

type Message = {
  id: string;
  fromMe: boolean;
  senderKind: 'member' | 'union' | 'system';
  content: string | null;
  createdAt: string;
};

const MAX_SUBJECT = 200;
const MAX_BODY = 5000;

/** Handlers wrap plain objects as { data: ... }; direct responses use the same envelope. */
export function pick<T>(payload: unknown, key: string): T | undefined {
  const p = payload as Record<string, any> | null;
  return (p?.data?.[key] ?? p?.[key] ?? p?.data?.data?.[key]) as T | undefined;
}

export function MemberMessages({ initialThreadId, compose }: { initialThreadId?: string; compose?: 'privacy' }) {
  const t = useTranslations('memberMessages');
  const locale = useLocale();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [listState, setListState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [activeId, setActiveId] = useState<string | null>(initialThreadId ?? null);
  const [composing, setComposing] = useState(Boolean(compose) && !initialThreadId);
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });

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
            <ul className="space-y-2">
              {threads.map((thread) => (
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
                    </span>
                  </button>
                </li>
              ))}
            </ul>
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
            <ThreadView
              key={activeId}
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

function ThreadView({ threadId, onBack, onChanged }: { threadId: string; onBack: () => void; onChanged: () => void }) {
  const t = useTranslations('memberMessages');
  const locale = useLocale();
  const [thread, setThread] = useState<{ subject: string; status: string; isArchived: boolean; representativeAssigned: boolean } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<'failed' | 'closed' | null>(null);
  const requestId = useRef(crypto.randomUUID());
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });

  const load = useCallback(async () => {
    try {
      const [threadResponse, messageResponse] = await Promise.all([
        fetch(`/api/messages/threads/${encodeURIComponent(threadId)}`),
        fetch(`/api/messages/threads/${encodeURIComponent(threadId)}/messages`),
      ]);
      if (threadResponse.status === 404 || messageResponse.status === 404) return setState('missing');
      if (!threadResponse.ok || !messageResponse.ok) throw new Error('load');
      setThread(pick(await threadResponse.json(), 'thread') ?? null);
      setMessages(pick<Message[]>(await messageResponse.json(), 'messages') ?? []);
      setState('ready');
    } catch {
      setState('error');
    }
  }, [threadId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (sending || !reply.trim()) return;
    setSending(true);
    setSendError(null);
    try {
      const response = await fetch(`/api/messages/threads/${encodeURIComponent(threadId)}/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: reply.trim(), clientRequestId: requestId.current }),
      });
      if (response.status === 409) return setSendError('closed');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setReply('');
      requestId.current = crypto.randomUUID();
      await load();
      onChanged();
    } catch {
      setSendError('failed');
    } finally {
      setSending(false);
    }
  };

  if (state === 'loading') return <Skeleton className="h-64 w-full rounded-lg" role="status" aria-busy="true" />;
  if (state === 'missing') {
    return (
      <div role="alert" className="rounded-lg border p-6" data-testid="thread-unavailable">
        <p className="font-medium">{t('unavailableTitle')}</p>
        <p className="text-sm text-muted-foreground">{t('unavailableBody')}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={onBack}>{t('back')}</Button>
      </div>
    );
  }
  if (state === 'error' || !thread) {
    return (
      <div role="alert" className="rounded-lg border border-destructive/40 p-4 text-sm">
        <p>{t('loadError')}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => { setState('loading'); void load(); }}>{t('retry')}</Button>
      </div>
    );
  }

  const open = thread.status === 'open' && !thread.isArchived;
  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4" data-testid="thread-view">
      <div className="flex items-start gap-2">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack} aria-label={t('back')}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </Button>
        <div>
          <h2 className="text-lg font-semibold">{thread.subject}</h2>
          <p className="text-xs text-muted-foreground">{thread.representativeAssigned ? t('representativeAssigned') : t('awaitingRepresentative')}</p>
        </div>
      </div>
      <ol className="space-y-3">
        {messages.map((m) => (
          <li key={m.id} className={`max-w-[85%] rounded-lg p-3 text-sm ${m.fromMe ? 'ml-auto bg-primary/10' : 'bg-muted'}`}>
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              {m.fromMe ? t('you') : m.senderKind === 'system' ? t('system') : t('union')} · {dateFormat.format(new Date(m.createdAt))}
            </p>
            <p className="whitespace-pre-wrap break-words">{m.content}</p>
          </li>
        ))}
      </ol>
      {open ? (
        <form onSubmit={send} className="space-y-2">
          <label htmlFor="msg-reply" className="text-sm font-medium">{t('reply')}</label>
          <textarea
            id="msg-reply"
            className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={reply}
            maxLength={MAX_BODY}
            onChange={(e) => setReply(e.target.value)}
            placeholder={t('replyPlaceholder')}
          />
          {sendError === 'failed' && <p role="alert" className="text-sm text-destructive">{t('sendError')}</p>}
          {sendError === 'closed' && <p role="alert" className="text-sm text-destructive">{t('closedNotice')}</p>}
          <Button type="submit" disabled={sending || !reply.trim()}>{sending ? t('sending') : t('send')}</Button>
        </form>
      ) : (
        <p className="rounded-md border bg-muted/40 p-3 text-sm" data-testid="thread-closed">{t('closedNotice')}</p>
      )}
    </div>
  );
}
