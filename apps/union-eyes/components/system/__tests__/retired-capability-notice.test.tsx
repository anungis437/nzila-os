// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const intl = vi.hoisted(() => ({ locale: 'en-CA' }));
vi.mock('next-intl', () => ({ useLocale: () => intl.locale }));

import { RetiredCapabilityNotice, retiredCapabilityPath } from '../retired-capability-notice';
import { CapabilityUnavailable } from '../capability-unavailable';

describe('retiredCapabilityPath', () => {
  it('names only a 410 answer from the retired /api/v2 mirror', () => {
    expect(retiredCapabilityPath('/api/v2/analytics/overview?range=30d', 410)).toBe('/api/v2/analytics/overview');
    expect(retiredCapabilityPath(new URL('https://app.example/api/v2/clc/sync'), 410)).toBe('/api/v2/clc/sync');
    expect(retiredCapabilityPath(new Request('https://app.example/api/v2/stewards'), 410)).toBe('/api/v2/stewards');
  });

  it('ignores every other status and every other path', () => {
    expect(retiredCapabilityPath('/api/v2/analytics/overview', 200)).toBeNull();
    expect(retiredCapabilityPath('/api/v2/analytics/overview', 404)).toBeNull();
    expect(retiredCapabilityPath('/api/claims', 410)).toBeNull();
    expect(retiredCapabilityPath('https://api.whop.com/api/v2/checkout_sessions', 410)).toBe('/api/v2/checkout_sessions');
  });
});

describe('RetiredCapabilityNotice', () => {
  const realFetch = globalThis.fetch;
  beforeEach(() => {
    intl.locale = 'en-CA';
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      return new Response('{}', { status: url.includes('/api/v2/') ? 410 : 200 });
    }) as typeof fetch;
  });
  afterEach(() => {
    cleanup();
    globalThis.fetch = realFetch;
  });

  it('says nothing until a retired capability answers 410, and not for a working call', async () => {
    render(<RetiredCapabilityNotice />);
    await act(async () => { await fetch('/api/claims'); });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('announces a retired capability once, with its path, and leaves the response intact', async () => {
    render(<RetiredCapabilityNotice />);
    let response: Response | undefined;
    await act(async () => { response = await fetch('/api/v2/analytics/overview?range=30d'); });
    await act(async () => { await fetch('/api/v2/analytics/overview?range=7d'); });
    expect(response?.status).toBe(410);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Part of this page is not available');
    expect(alert.textContent?.match(/\/api\/v2\/analytics\/overview/g)).toHaveLength(1);
    expect(alert).toHaveTextContent('Nothing was changed');
  });

  it('can be dismissed, and speaks French when the locale is French', async () => {
    intl.locale = 'fr-CA';
    render(<RetiredCapabilityNotice />);
    await act(async () => { await fetch('/api/v2/clc/sync'); });
    expect(screen.getByRole('alert')).toHaveTextContent('Une partie de cette page n’est pas disponible');
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('restores the original fetch when it unmounts', () => {
    const before = globalThis.fetch;
    const { unmount } = render(<RetiredCapabilityNotice />);
    expect(globalThis.fetch).not.toBe(before);
    unmount();
    expect(globalThis.fetch).toBe(before);
  });
});

describe('CapabilityUnavailable', () => {
  afterEach(cleanup);
  it('is an alert in English by default and in French on request', () => {
    const { rerender } = render(<CapabilityUnavailable capability="federation/remittances" />);
    expect(screen.getByRole('alert')).toHaveTextContent('This information is not available');
    expect(screen.getByRole('alert')).toHaveTextContent('federation/remittances');
    rerender(<CapabilityUnavailable locale="fr-CA" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Cette information n’est pas disponible');
  });
});
