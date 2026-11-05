/**
 * withApi() request bodies: the framework reads JSON only through the bounded reader.
 *
 * It used to pre-parse every POST/PUT/PATCH/DELETE body with `request.clone().json()` and no ceiling, so any caller could make the server
 * buffer an arbitrarily large body (and a route's own `readBoundedJson(request, N)` limit was defeated: the clone had already read it all).
 * Now a body is read from the stream, counted whatever Content-Length claims, and one that exceeds `bodyLimitBytes` is a 413 before the
 * handler runs. A route without a body schema still gets `ctx.body` for JSON (the CRUD factory and older routes read it), but an upload or
 * binary payload is never read by the framework.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { z } from 'zod';

const { mockCheckRateLimit } = vi.hoisted(() => ({
  mockCheckRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: mockCheckRateLimit,
  createRateLimitHeaders: vi.fn(() => ({})),
}));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));

import { withApi, DEFAULT_JSON_BODY_LIMIT_BYTES } from '../with-api';

const URL_OF_ROUTE = 'http://localhost:3000/api/body-probe';
const JSON_HEADERS = { 'content-type': 'application/json' };

const textStream = (chunks: string[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    },
  });

const post = (body: BodyInit | null, headers: Record<string, string> = JSON_HEADERS, method = 'POST') =>
  new NextRequest(URL_OF_ROUTE, { method, headers, body, duplex: 'half' } as RequestInit);

const schema = z.object({ note: z.string() });
const publicRoute = { auth: { required: false } } as const;

describe('withApi request bodies', () => {
  beforeEach(() => vi.clearAllMocks());

  it('hands a valid JSON body to the handler, parsed by the schema', async () => {
    const handler = vi.fn(async ({ body }: { body: { note: string } }) => ({ echoed: body.note }));
    const route = withApi({ ...publicRoute, body: schema }, handler as never);

    const response = await route(post(JSON.stringify({ note: 'hello' })));
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ echoed: 'hello' });
  });

  it('answers 400 for a body that is not JSON and 400 for one the schema refuses, without running the handler', async () => {
    const handler = vi.fn(async () => ({ reached: true }));
    const route = withApi({ ...publicRoute, body: schema }, handler as never);

    const malformed = await route(post('{not json'));
    expect(malformed.status).toBe(400);
    expect((await malformed.json()).code).toBe('INVALID_FORMAT');

    const refused = await route(post(JSON.stringify({ note: 12 })));
    expect(refused.status).toBe(400);
    expect((await refused.json()).code).toBe('VALIDATION_ERROR');
    expect(handler).not.toHaveBeenCalled();
  });

  it('answers 413 before the handler runs when the declared length exceeds the limit', async () => {
    const handler = vi.fn(async () => ({ reached: true }));
    const route = withApi({ ...publicRoute, body: schema, bodyLimitBytes: 64 }, handler as never);

    const response = await route(post(JSON.stringify({ note: 'x'.repeat(200) })));
    expect(response.status).toBe(413);
    expect((await response.json()).code).toBe('PAYLOAD_TOO_LARGE');
    expect(handler).not.toHaveBeenCalled();
  });

  it('counts the bytes of the stream itself, so a body with no Content-Length cannot get past the limit', async () => {
    const handler = vi.fn(async () => ({ reached: true }));
    const route = withApi({ ...publicRoute, body: schema, bodyLimitBytes: 64 }, handler as never);

    const chunked = textStream(['{"note":"', 'x'.repeat(40), 'y'.repeat(40), '"}']);
    const response = await route(post(chunked));
    expect(response.status).toBe(413);
    expect(handler).not.toHaveBeenCalled();
  });

  it('refuses a body larger than the default ceiling, and accepts one just under it', async () => {
    const handler = vi.fn(async () => ({ reached: true }));
    const route = withApi({ ...publicRoute, body: schema }, handler as never);
    const envelope = JSON.stringify({ note: '' }).length;

    const over = await route(post(JSON.stringify({ note: 'x'.repeat(DEFAULT_JSON_BODY_LIMIT_BYTES - envelope + 1) })));
    expect(over.status).toBe(413);
    expect(handler).not.toHaveBeenCalled();

    const under = await route(post(JSON.stringify({ note: 'x'.repeat(DEFAULT_JSON_BODY_LIMIT_BYTES - envelope) })));
    expect(under.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('lets a bulk route raise the ceiling, and a sensitive one lower it', async () => {
    const handler = vi.fn(async () => ({ reached: true }));
    const bulk = withApi({ ...publicRoute, body: schema, bodyLimitBytes: DEFAULT_JSON_BODY_LIMIT_BYTES * 4 }, handler as never);
    const note = 'x'.repeat(DEFAULT_JSON_BODY_LIMIT_BYTES + 1024);
    expect((await bulk(post(JSON.stringify({ note })))).status).toBe(200);

    const small = withApi({ ...publicRoute, body: schema, bodyLimitBytes: 16 }, handler as never);
    expect((await small(post(JSON.stringify({ note: 'this body is longer than sixteen bytes' })))).status).toBe(413);
  });

  it('refuses at registration a ceiling that is not a positive whole number of bytes', () => {
    const noop = (async () => ({})) as never;
    for (const bad of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => withApi({ ...publicRoute, bodyLimitBytes: bad }, noop), String(bad)).toThrow('bodyLimitBytes');
    }
    expect(() => withApi({ ...publicRoute, bodyLimitBytes: 1 }, noop)).not.toThrow();
  });

  it('keeps the original request readable for a handler that still reads the body itself', async () => {
    let direct: unknown;
    const route = withApi({ ...publicRoute, body: schema }, (async ({ request }: { request: NextRequest }) => {
      direct = await request.json();
      return { ok: true };
    }) as never);

    expect((await route(post(JSON.stringify({ note: 'twice' })))).status).toBe(200);
    expect(direct).toEqual({ note: 'twice' });
  });

  describe('a route without a body schema', () => {
    it('still gives ctx.body to a handler that reads it (the CRUD factory and older routes), through the same bounded reader', async () => {
      let seen: unknown = 'unset';
      const route = withApi(publicRoute, (async ({ body }: { body: unknown }) => {
        seen = body;
        return { ok: true };
      }) as never);

      expect((await route(post(JSON.stringify({ any: 'thing' })))).status).toBe(200);
      expect(seen).toEqual({ any: 'thing' });
      expect((await route(post(JSON.stringify({ any: 'thing' }), { 'content-type': 'text/plain;charset=UTF-8' }))).status).toBe(200);
      expect(seen).toEqual({ any: 'thing' });
    });

    it('leaves ctx.body undefined for an empty or malformed body and still runs the handler, as before', async () => {
      let seen: unknown = 'unset';
      const route = withApi(publicRoute, (async ({ body }: { body: unknown }) => {
        seen = body;
        return { ok: true };
      }) as never);

      expect((await route(post('{oops'))).status).toBe(200);
      expect(seen).toBeUndefined();
      expect((await route(post(null))).status).toBe(200);
      expect(seen).toBeUndefined();
    });

    it('answers 413 for a JSON body over the ceiling instead of buffering it for a handler that may never read it', async () => {
      const handler = vi.fn(async () => ({ reached: true }));
      const route = withApi({ ...publicRoute, bodyLimitBytes: 64 }, handler as never);

      const response = await route(post(textStream(['{"a":"', 'x'.repeat(500), '"}'])));
      expect(response.status).toBe(413);
      expect(handler).not.toHaveBeenCalled();
    });

    it('never reads an upload or a binary payload: those are the handler\'s to stream, whatever their size', async () => {
      let seen: unknown = 'unset';
      let uploaded = 0;
      const route = withApi({ ...publicRoute, bodyLimitBytes: 64 }, (async ({ body, request }: { body: unknown; request: NextRequest }) => {
        seen = body;
        uploaded = (await request.arrayBuffer()).byteLength;
        return { ok: true };
      }) as never);

      for (const contentType of ['multipart/form-data; boundary=x', 'application/octet-stream', 'application/pdf', 'image/png']) {
        seen = 'unset';
        const response = await route(post('x'.repeat(5000), { 'content-type': contentType }));
        expect(response.status, contentType).toBe(200);
        expect(seen, contentType).toBeUndefined();
        expect(uploaded, contentType).toBe(5000);
      }
    });

    it('reads nothing for a method that carries no body', async () => {
      let seen: unknown = 'unset';
      const route = withApi(publicRoute, (async ({ body }: { body: unknown }) => {
        seen = body;
        return { ok: true };
      }) as never);

      const response = await route(new NextRequest(URL_OF_ROUTE, { method: 'GET' }));
      expect(response.status).toBe(200);
      expect(seen).toBeUndefined();
    });
  });
});
