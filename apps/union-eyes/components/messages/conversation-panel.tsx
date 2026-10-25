'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { assignmentProblem, MAX_BODY, pick, type AssignmentProblem } from '@/components/messages/messages-api';

export type MessagesNamespace = 'memberMessages' | 'staffMessages';

type Retention =
  | { audience: 'member'; state: 'not_closed' | 'policy_not_adopted' | 'retained' }
  | { audience: 'staff'; state: 'legal_hold' | 'not_closed' | 'policy_not_adopted' | 'closure_unrecorded' | 'retained' | 'retention_elapsed'; retainedUntil?: string };

type Detail = {
  subject: string;
  status: string;
  isArchived: boolean;
  representativeAssigned: boolean;
  viewerRole: 'member' | 'assignee';
  canReply: boolean;
  canClose: boolean;
  canArchive: boolean;
  retention?: Retention;
};

type Message = {
  id: string;
  fromMe: boolean;
  senderKind: 'member' | 'union' | 'system';
  content: string | null;
  createdAt: string;
  readByCounterpart?: boolean;
};

type Translate = (key: string, values?: Record<string, string | number>) => string;
type Confirm = 'close' | 'release' | null;

/**
 * One conversation, for either side. The member and the assigned staff member see the same messages and the same
 * lifecycle; staff additionally can release or reassign it. Whether anything is allowed is decided by the server and
 * reported in `canReply`, `canClose` and `canArchive`; this component only presents it.
 */
export function ConversationPanel({
  ns,
  threadId,
  staffActions = false,
  onBack,
  onChanged,
}: {
  ns: MessagesNamespace;
  threadId: string;
  staffActions?: boolean;
  onBack: () => void;
  onChanged: () => void;
}) {
  const t = useTranslations(ns as 'memberMessages') as unknown as Translate;
  const locale = useLocale();
  const [thread, setThread] = useState<Detail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<'failed' | 'closed' | null>(null);
  const [busy, setBusy] = useState(false);
  const [lifecycleError, setLifecycleError] = useState<'lifecycleError' | 'lifecycleConflict' | null>(null);
  const [assignmentError, setAssignmentError] = useState<AssignmentProblem | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [reassignTo, setReassignTo] = useState('');
  const requestId = useRef(crypto.randomUUID());
  const marked = useRef(false);
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });
  const base = `/api/messages/threads/${encodeURIComponent(threadId)}`;

  const load = useCallback(async () => {
    try {
      const [threadResponse, messageResponse] = await Promise.all([fetch(base), fetch(`${base}/messages`)]);
      if (threadResponse.status === 404 || messageResponse.status === 404) return setState('missing');
      if (!threadResponse.ok || !messageResponse.ok) throw new Error('load');
      const loaded = pick<Message[]>(await messageResponse.json(), 'messages') ?? [];
      setThread(pick<Detail>(await threadResponse.json(), 'thread') ?? null);
      setMessages(loaded);
      setState('ready');
      // Opening the conversation tells the other side it was read; failing to say so must not hide the conversation.
      if (!marked.current && loaded.some((m) => !m.fromMe)) {
        marked.current = true;
        void fetch(`${base}/read`, { method: 'POST' }).catch(() => undefined);
      }
    } catch {
      setState('error');
    }
  }, [base]);

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
      const response = await fetch(`${base}/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: reply.trim(), clientRequestId: requestId.current }),
      });
      if (response.status === 409) {
        setSendError('closed');
        await load();
        return;
      }
      if (response.status === 404) return setState('missing');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setReply('');
      requestId.current = crypto.randomUUID();
      marked.current = false;
      await load();
      onChanged();
    } catch {
      setSendError('failed');
    } finally {
      setSending(false);
    }
  };

  const lifecycle = async (action: 'close' | 'archive') => {
    if (busy) return;
    setBusy(true);
    setLifecycleError(null);
    setConfirm(null);
    try {
      const response = await fetch(`${base}/lifecycle`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (response.status === 404) return setState('missing');
      if (response.status === 409) {
        setLifecycleError('lifecycleConflict');
        await load();
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await load();
      onChanged();
    } catch {
      setLifecycleError('lifecycleError');
    } finally {
      setBusy(false);
    }
  };

  const assignment = async (body: { action: 'release' } | { action: 'reassign'; toStaffId: string }) => {
    if (busy) return;
    setBusy(true);
    setAssignmentError(null);
    setConfirm(null);
    try {
      const response = await fetch(`${base}/assignment`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        setAssignmentError(await assignmentProblem(response));
        return;
      }
      // The conversation is no longer this person's: it leaves their list rather than lingering unreadable.
      onChanged();
      onBack();
    } catch {
      setAssignmentError('assignmentFailed');
    } finally {
      setBusy(false);
    }
  };

  if (state === 'loading') return <Skeleton className="h-64 w-full rounded-lg" role="status" aria-busy="true" aria-label={t('loading')} />;
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

  const closed = thread.status !== 'open' || thread.isArchived;
  const retention = thread.retention;
  const retentionText = retention
    ? retention.state === 'not_closed'
      ? null
      : retention.state === 'retained' && retention.audience === 'staff' && retention.retainedUntil
        ? t('retention.retainedUntil', { date: dateFormat.format(new Date(retention.retainedUntil)) })
        : t(`retention.${retention.state}`)
    : null;
  const senderLabel = (m: Message) => (m.fromMe ? t('you') : m.senderKind === 'system' ? t('system') : m.senderKind === 'member' ? t('member') : t('union'));

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4" data-testid="thread-view">
      <div className="flex items-start gap-2">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack} aria-label={t('back')}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold break-words">{thread.subject}</h2>
          <p className="text-xs text-muted-foreground">
            {staffActions ? t('assignedToYou') : thread.representativeAssigned ? t('representativeAssigned') : t('awaitingRepresentative')}
            {thread.status !== 'open' ? ` · ${t(`status.${thread.status}`)}` : ''}
            {thread.isArchived ? ` · ${t('archived')}` : ''}
          </p>
        </div>
      </div>

      <ol className="space-y-3" aria-label={t('messagesLabel')}>
        {messages.map((m) => (
          <li key={m.id} className={`max-w-[85%] rounded-lg p-3 text-sm ${m.fromMe ? 'ml-auto bg-primary/10' : 'bg-muted'}`}>
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              {senderLabel(m)} · {dateFormat.format(new Date(m.createdAt))}
              {m.fromMe && m.senderKind !== 'system' ? (
                <span data-testid={m.readByCounterpart ? 'message-read' : 'message-unread'}> · {m.readByCounterpart ? t('readByCounterpart') : t('sentNotRead')}</span>
              ) : null}
            </p>
            <p className="whitespace-pre-wrap break-words">{m.content}</p>
          </li>
        ))}
      </ol>

      {retentionText && (
        <p className="rounded-md border bg-muted/40 p-3 text-sm" data-testid="retention-note">{retentionText}</p>
      )}

      {thread.canReply && !closed ? (
        <form onSubmit={send} className="space-y-2">
          <label htmlFor={`${ns}-reply`} className="text-sm font-medium">{t('reply')}</label>
          <textarea
            id={`${ns}-reply`}
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

      <div className="flex flex-col gap-3 border-t pt-3" aria-label={t('actionsLabel')} role="group">
        {lifecycleError && <p role="alert" className="text-sm text-destructive">{t(lifecycleError)}</p>}
        {assignmentError && <p role="alert" className="text-sm text-destructive" data-testid="assignment-error">{t(assignmentError)}</p>}

        {confirm && (
          <div role="group" aria-label={t(confirm === 'close' ? 'closeConversation' : 'release')} className="space-y-2 rounded-md border border-destructive/40 p-3 text-sm" data-testid="confirm-panel">
            <p>{t(confirm === 'close' ? 'closeConfirm' : 'releaseConfirm')}</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                disabled={busy}
                onClick={() => (confirm === 'close' ? void lifecycle('close') : void assignment({ action: 'release' }))}
              >
                {t(confirm === 'close' ? 'closeConversation' : 'release')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setConfirm(null)}>{t('cancel')}</Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {thread.canClose && <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirm('close')}>{t('closeConversation')}</Button>}
          {thread.canArchive && <Button size="sm" variant="outline" disabled={busy} onClick={() => void lifecycle('archive')}>{t('archive')}</Button>}
          {staffActions && thread.canReply && <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirm('release')}>{t('release')}</Button>}
        </div>

        {staffActions && thread.canReply && (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (reassignTo.trim()) void assignment({ action: 'reassign', toStaffId: reassignTo.trim() });
            }}
          >
            <div className="space-y-1">
              <label htmlFor="staff-reassign" className="text-sm font-medium">{t('reassignLabel')}</label>
              <input
                id="staff-reassign"
                className="w-64 max-w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={reassignTo}
                maxLength={255}
                onChange={(e) => setReassignTo(e.target.value)}
                aria-describedby="staff-reassign-help"
                autoComplete="off"
              />
            </div>
            <Button type="submit" size="sm" variant="outline" disabled={busy || !reassignTo.trim()}>{t('reassign')}</Button>
            <p id="staff-reassign-help" className="basis-full text-xs text-muted-foreground">{t('reassignHelp')}</p>
          </form>
        )}
      </div>
    </div>
  );
}
