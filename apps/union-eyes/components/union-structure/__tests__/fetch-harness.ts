import { vi } from 'vitest';

export interface Call {
  url: string;
  method: string;
  body: unknown;
}

export interface Answer {
  status: number;
  body: unknown;
}

/** Replaces fetch with a stub that records every call and answers it from `answer`; the calls are returned for the test to inspect. */
export function installFetch(answer: (call: Call) => Answer): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const call: Call = { url, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined };
      calls.push(call);
      const { status, body } = answer(call);
      return { ok: status >= 200 && status < 300, status, json: async () => body };
    }),
  );
  return calls;
}

export const writesOf = (calls: Call[]) => calls.filter((call) => call.method !== 'GET');
