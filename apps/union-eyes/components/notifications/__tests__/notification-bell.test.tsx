// @vitest-environment jsdom
// The header bell against a mocked fetch whose answers have the shape GET /api/notifications/count really sends (withApi's { success, data: { count },
// timestamp }). They prove the number is the route's, that a read which failed or came back in a shape the bell cannot read shows a "could not load"
// marker and never a zero, that the count is read again when the inbox changes and every minute while the tab is in view (never two reads at once, and
// none while the tab is hidden), and that nothing is left running when the bell goes away. They prove nothing about the route itself.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { createTranslator } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const translate = vi.hoisted(() => (key: string, values?: Record<string, unknown>) => (values ? `${key} ${JSON.stringify(values)}` : key));
vi.mock('next-intl', async (importOriginal) => ({ ...(await importOriginal<typeof import('next-intl')>()), useTranslations: () => translate, useLocale: () => 'en-CA' }));
vi.mock('next/link', async () => {
  const React = await import('react');
  return {
    default: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & Record<string, unknown>) => React.createElement('a', { href, ...rest }, children),
  };
});

import { announceInboxChanged } from '@/lib/notifications/unread-count';
import { BELL_CHANGE_DEBOUNCE_MS, BELL_FRESH_MS, BELL_POLL_MS, NotificationBell as Bell } from '../notification-bell';

// Staff's inbox page is the default destination; the member's Home is tested apart.
const NotificationBell = ({ path = '/dashboard/notifications' }: { path?: string }) => <Bell path={path} />;

type Reply = { status?: number; body?: unknown; json?: () => Promise<unknown>; fail?: boolean };

// What the count route answers: withApi's envelope around { count }.
const answer = (count: unknown): Reply => ({ body: { success: true, data: { count }, timestamp: '2026-11-03T12:00:00.000Z' } });

/** A fetch that answers from `replies` in order (the last one repeats) and remembers every request. */
function mockCount(...replies: Array<Reply | Promise<Reply>>) {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  let next = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      calls.push({ url, init });
      const chosen = replies[Math.min(next, replies.length - 1)];
      next += 1;
      return Promise.resolve(chosen).then((reply) => {
        if (reply.fail) throw new TypeError('Failed to fetch');
        const status = reply.status ?? 200;
        return { ok: status >= 200 && status < 300, status, json: reply.json ?? (async () => reply.body) };
      });
    }),
  );
  return calls;
}

let visibility: 'visible' | 'hidden' = 'visible';
const setVisibility = (state: 'visible' | 'hidden') => {
  visibility = state;
  document.dispatchEvent(new Event('visibilitychange'));
};

const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });
const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const bell = () => screen.getByRole('link');

beforeEach(() => {
  vi.useFakeTimers();
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('the bell: what it shows', () => {
  it("links to the inbox in the person's locale and shows the unread count the route reports", async () => {
    const calls = mockCount(answer(3));
    render(<NotificationBell />);
    await flush();

    expect(bell()).toHaveAttribute('href', '/en-CA/dashboard/notifications');
    expect(bell()).toHaveAttribute('aria-label', 'unread {"count":3}');
    expect(bell()).toHaveAttribute('data-unread-state', 'ready');
    expect(bell()).toHaveTextContent('3');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/api/notifications/count');
    expect(calls[0].init).toMatchObject({ cache: 'no-store' });
  });

  it("leads to the page it is given, in the person's locale: a member's bell goes to their Home, where their unread notices are listed", async () => {
    mockCount(answer(2));
    render(<NotificationBell path="/dashboard" />);
    await flush();

    expect(bell()).toHaveAttribute('href', '/en-CA/dashboard');
  });

  it('shows no number when the route reports none unread: a zero is the route saying so, and it is not drawn as a badge', async () => {
    mockCount(answer(0));
    render(<NotificationBell />);
    await flush();

    expect(bell()).toHaveAttribute('aria-label', 'none');
    expect(bell()).toHaveAttribute('data-unread-state', 'ready');
    expect(bell()).toHaveTextContent('');
  });

  it('says 99+ for a large count and still names the exact count for a screen reader', async () => {
    mockCount(answer(250));
    render(<NotificationBell />);
    await flush();

    expect(bell()).toHaveTextContent('99+');
    expect(bell()).toHaveAttribute('aria-label', 'unread {"count":250}');
  });

  it('shows no number while the first read is under way', async () => {
    mockCount(new Promise<Reply>(() => undefined));
    render(<NotificationBell />);
    await flush();

    expect(bell()).toHaveAttribute('data-unread-state', 'loading');
    expect(bell()).toHaveAttribute('aria-label', 'title');
    expect(bell()).toHaveTextContent('');
  });
});

describe('the bell: a count that could not be read is never shown as zero', () => {
  const failures: Array<[string, Reply]> = [
    ['the route refused with a server error', { status: 500, body: { code: 'INTERNAL_ERROR', message: 'boom' } }],
    ['the session has ended', { status: 401, body: { code: 'UNAUTHORIZED', message: 'Authentication required' } }],
    ['the route could not be reached', { fail: true }],
    ['the answer is not JSON', { json: () => Promise.reject(new SyntaxError('Unexpected token <')) }],
    ['the answer has no data', { body: { success: true } }],
    ['the answer has data but no count', { body: { success: true, data: {} } }],
    ['the count is not a number', { body: { success: true, data: { count: '3' } } }],
    ['the count is null', { body: { success: true, data: { count: null } } }],
    ['the count is negative', { body: { success: true, data: { count: -1 } } }],
    ['the count is fractional', { body: { success: true, data: { count: 1.5 } } }],
    ['the answer is a bare count, not the envelope', { body: { count: 3 } }],
  ];

  it.each(failures)('shows the could-not-load marker, no number, when %s', async (_name, reply) => {
    mockCount(reply);
    render(<NotificationBell />);
    await flush();

    expect(bell()).toHaveAttribute('data-unread-state', 'failed');
    expect(bell()).toHaveAttribute('aria-label', 'failed');
    expect(bell()).toHaveAttribute('title', 'failed');
    expect(bell()).toHaveTextContent('!');
    expect(bell().textContent).not.toMatch(/\d/);
  });

  it('keeps the last count it read and marks it out of date when a later read fails, then trusts the next good read', async () => {
    mockCount(answer(5), { status: 503, body: { code: 'UNAVAILABLE', message: 'down' } }, answer(2));
    render(<NotificationBell />);
    await flush();
    expect(bell()).toHaveAttribute('data-unread-state', 'ready');

    await tick(BELL_POLL_MS);
    expect(bell()).toHaveAttribute('data-unread-state', 'stale');
    expect(bell()).toHaveAttribute('aria-label', 'stale {"count":5}');
    expect(bell()).toHaveTextContent('5');

    await tick(BELL_POLL_MS);
    expect(bell()).toHaveAttribute('data-unread-state', 'ready');
    expect(bell()).toHaveAttribute('aria-label', 'unread {"count":2}');
    expect(bell()).toHaveTextContent('2');
  });

  it('recovers from a failed first read on the next poll', async () => {
    mockCount({ status: 500, body: {} }, answer(4));
    render(<NotificationBell />);
    await flush();
    expect(bell()).toHaveAttribute('data-unread-state', 'failed');

    await tick(BELL_POLL_MS);
    expect(bell()).toHaveAttribute('data-unread-state', 'ready');
    expect(bell()).toHaveTextContent('4');
  });
});

describe('the bell: when it reads again', () => {
  it('reads every minute while the tab is in view', async () => {
    const calls = mockCount(answer(1), answer(2), answer(3));
    render(<NotificationBell />);
    await flush();
    expect(calls).toHaveLength(1);

    await tick(BELL_POLL_MS);
    expect(calls).toHaveLength(2);
    expect(bell()).toHaveTextContent('2');

    await tick(BELL_POLL_MS);
    expect(calls).toHaveLength(3);
    expect(bell()).toHaveTextContent('3');
  });

  it('reads nothing while the tab is hidden, and reads at once on return when the count is no longer fresh', async () => {
    const calls = mockCount(answer(1), answer(9));
    render(<NotificationBell />);
    await flush();

    setVisibility('hidden');
    await tick(BELL_POLL_MS * 5);
    expect(calls).toHaveLength(1);

    setVisibility('visible');
    await flush();
    expect(calls).toHaveLength(2);
    expect(bell()).toHaveTextContent('9');
  });

  it('does not read again on return to a tab whose count was read a moment ago, and resumes the minute rhythm', async () => {
    const calls = mockCount(answer(1), answer(2));
    render(<NotificationBell />);
    await flush();

    await tick(BELL_FRESH_MS - 5_000);
    setVisibility('hidden');
    setVisibility('visible');
    await flush();
    expect(calls).toHaveLength(1);

    await tick(BELL_POLL_MS);
    expect(calls).toHaveLength(2);
  });

  it('reads again when the inbox changed in this tab, once for a burst of changes', async () => {
    const calls = mockCount(answer(4), answer(1));
    render(<NotificationBell />);
    await flush();
    expect(bell()).toHaveTextContent('4');

    act(() => {
      announceInboxChanged();
      announceInboxChanged();
      announceInboxChanged();
    });
    await tick(BELL_CHANGE_DEBOUNCE_MS - 1);
    expect(calls).toHaveLength(1);

    await tick(1);
    expect(calls).toHaveLength(2);
    expect(bell()).toHaveTextContent('1');
  });

  it('never has two reads under way: a change that arrives during a read is read once that one ends, and its answer wins', async () => {
    let finishFirst: (reply: Reply) => void = () => undefined;
    const first = new Promise<Reply>((resolve) => {
      finishFirst = resolve;
    });
    const calls = mockCount(first, answer(7));
    render(<NotificationBell />);
    await flush();
    expect(calls).toHaveLength(1);

    act(() => announceInboxChanged());
    await tick(BELL_CHANGE_DEBOUNCE_MS);
    expect(calls).toHaveLength(1);

    finishFirst(answer(3));
    await flush();
    expect(calls).toHaveLength(2);
    expect(bell()).toHaveTextContent('7');
  });
});

describe('the bell: it leaves nothing running', () => {
  it('stops polling, drops the pending change read and aborts the read under way when it goes away', async () => {
    const calls = mockCount(answer(1), new Promise<Reply>(() => undefined));
    const { unmount } = render(<NotificationBell />);
    await flush();

    await tick(BELL_POLL_MS);
    expect(calls).toHaveLength(2);
    const underWay = calls[1].init?.signal;
    expect(underWay?.aborted).toBe(false);
    act(() => announceInboxChanged());

    unmount();
    expect(underWay?.aborted).toBe(true);

    await tick(BELL_POLL_MS * 3);
    act(() => announceInboxChanged());
    await tick(BELL_CHANGE_DEBOUNCE_MS * 2);
    setVisibility('hidden');
    setVisibility('visible');
    await flush();
    expect(calls).toHaveLength(2);
  });
});

describe('the bell: its words', () => {
  // The live locales; the others are laid under them.
  const LOCALES = ['en-CA', 'fr-CA'] as const;
  const messagesOf = (locale: string): Record<string, unknown> => JSON.parse(readFileSync(join(process.cwd(), 'messages', `${locale}.json`), 'utf8')) as Record<string, unknown>;
  const catalog = (locale: string): Record<string, string> => (messagesOf(locale).notificationBell as Record<string, string>);
  const argumentsOf = (message: string) => [...new Set([...message.matchAll(/\{\s*(\w+)\s*[,}]/g)].map((match) => match[1]))].sort();

  it.each(LOCALES)('has the same five messages, with the same arguments, written out, in %s', (locale) => {
    const english = catalog('en-CA');
    const own = catalog(locale);
    expect(Object.keys(own).sort()).toEqual(['failed', 'none', 'stale', 'title', 'unread']);
    for (const [key, message] of Object.entries(own)) {
      expect(message.trim(), `${locale}.${key}`).not.toBe('');
      expect(argumentsOf(message), `${locale}.${key}`).toEqual(argumentsOf(english[key]));
    }
  });

  it('is written in French in fr-CA, not left in English', () => {
    const english = catalog('en-CA');
    const french = catalog('fr-CA');
    for (const key of ['none', 'unread', 'stale', 'failed']) expect(french[key], `fr-CA.${key}`).not.toBe(english[key]);
  });

  it('formats in both languages, with the count in the message and the French plural where it belongs', () => {
    const en = createTranslator({ locale: 'en-CA', messages: messagesOf('en-CA') as never, namespace: 'notificationBell' });
    const fr = createTranslator({ locale: 'fr-CA', messages: messagesOf('fr-CA') as never, namespace: 'notificationBell' });

    expect(en('unread', { count: 3 })).toBe('Notifications, 3 unread');
    expect(en('stale', { count: 3 })).toBe('Notifications, 3 unread (could not be refreshed, may be out of date)');
    expect(en('none')).toBe('Notifications, none unread');
    expect(fr('unread', { count: 1 })).toBe('Notifications, 1 non lue');
    expect(fr('unread', { count: 3 })).toBe('Notifications, 3 non lues');
    expect(fr('stale', { count: 2 })).toContain('2 non lues');
    expect(fr('failed')).toContain('n’a pas pu');
  });
});
