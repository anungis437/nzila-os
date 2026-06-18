import type { Router } from "express";

interface InvokeOptions {
  body?: unknown;
  params?: Record<string, string>;
  query?: Record<string, unknown>;
  headers?: Record<string, string>;
  user?: Record<string, unknown>;
  /** Value to expose as req.file (for multipart upload handlers). */
  file?: unknown;
  /** When multiple layers share the same method+path, pick the Nth match (0-based). */
  matchIndex?: number;
}

export interface InvokeResult {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
}

/**
 * Invoke a single Express route handler in isolation (no HTTP server / supertest).
 * Locates the layer by method + registered path, builds mock req/res, and runs
 * the handler chain sequentially, stopping once a response is produced.
 */
export async function invokeRoute(
  router: Router,
  method: string,
  path: string,
  opts: InvokeOptions = {},
): Promise<InvokeResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stack: any[] = (router as any).stack ?? [];
  const matches = stack.filter(
    (l) => l.route && l.route.path === path && l.route.methods[method.toLowerCase()],
  );
  const layer = matches[opts.matchIndex ?? 0];
  if (!layer) {
    throw new Error(`Route ${method.toUpperCase()} ${path} not registered`);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlers: Array<(req: any, res: any, next: (err?: unknown) => void) => unknown> =
    layer.route.stack.map((s: { handle: unknown }) => s.handle);

  const req = {
    body: opts.body ?? {},
    params: opts.params ?? {},
    query: opts.query ?? {},
    headers: opts.headers ?? {},
    user: opts.user,
    file: opts.file,
    get(name: string) {
      return (opts.headers ?? {})[name.toLowerCase()];
    },
  };

  const result: InvokeResult = { statusCode: 200, body: undefined, headers: {} };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res: any = {
    headersSent: false,
    status(code: number) {
      result.statusCode = code;
      return res;
    },
    json(obj: unknown) {
      result.body = obj;
      res.headersSent = true;
      return res;
    },
    send(obj: unknown) {
      result.body = obj;
      res.headersSent = true;
      return res;
    },
    setHeader(k: string, v: string) {
      result.headers[k] = v;
      return res;
    },
    set(k: string, v: string) {
      result.headers[k] = v;
      return res;
    },
    type() {
      return res;
    },
    end() {
      res.headersSent = true;
      return res;
    },
  };

  for (const handle of handlers) {
    let calledNext = false;
    let nextError: unknown;
    const next = (err?: unknown) => {
      calledNext = true;
      nextError = err;
    };
    await handle(req, res, next);
    if (nextError) throw nextError;
    if (!calledNext) break;
  }

  return result;
}
