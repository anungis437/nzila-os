/**
 * Shared next-intl test mock for CourtLens UI tests.
 *
 * Resolves message keys against the real `messages/en-CA.json` so that
 * copy-based assertions (`getByText(/not legal advice/i)`) still work.
 * Falls back to returning the key path when a message is missing, which
 * surfaces missing translations as test failures.
 *
 * Usage in a test file:
 *   vi.mock('next-intl', async () => (await import('@/lib/test/next-intl-mock')).clientMock);
 *   vi.mock('next-intl/server', async () => (await import('@/lib/test/next-intl-mock')).serverMock);
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const messagesPath = resolve(__dirname, '..', '..', 'messages', 'en-CA.json');
const enMessages = JSON.parse(readFileSync(messagesPath, 'utf8')) as Record<string, unknown>;

function resolveKey(namespace: string, key: string): string {
  const path = `${namespace}.${key}`.split('.');
  let cur: unknown = enMessages;
  for (const seg of path) {
    if (typeof cur === 'object' && cur !== null && seg in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[seg];
    } else {
      return path.join('.');
    }
  }
  return typeof cur === 'string' ? cur : path.join('.');
}

export function makeT(namespace: string) {
  return (key: string) => resolveKey(namespace, key);
}

export const clientMock = {
  useTranslations: (namespace: string) => makeT(namespace),
};

export const serverMock = {
  getTranslations: async (arg: string | { namespace: string; locale?: string }) => {
    const namespace = typeof arg === 'string' ? arg : arg.namespace;
    return makeT(namespace);
  },
};
