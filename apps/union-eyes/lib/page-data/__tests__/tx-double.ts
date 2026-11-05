/**
 * A database double for unit tests of code that reads or writes inside withRLSContext / withSystemContext.
 *
 * `txDouble.withRLSContext` records the context it opens and hands `txDouble.tx` to the work; every statement the work issues is recorded
 * (its kind, the SQL and parameters of its where condition rendered by the real PostgreSQL dialect, and the context it ran in) and resolves
 * the next queued result, an Error in the queue rejecting. The database is not exercised here: db/__tests__/*.postgres.test.ts runs the same
 * code against real PostgreSQL as the real roles.
 *
 *   vi.mock('@/lib/db/with-rls-context', async () => (await import('@/lib/page-data/__tests__/tx-double')).txDoubleModule())
 */
import { PgDialect } from 'drizzle-orm/pg-core';

const dialect = new PgDialect();

export interface RenderedCondition {
  sql: string;
  params: unknown[];
}

export interface RecordedStatement {
  kind: 'select' | 'insert' | 'update' | 'delete' | 'execute' | 'query';
  where?: RenderedCondition;
  values?: unknown;
  set?: unknown;
  /** The context the statement ran in: the organization id, 'system', or null outside any context. */
  context: string | null;
}

function render(condition: unknown): RenderedCondition | undefined {
  if (condition === undefined || condition === null) return undefined;
  try {
    const query = dialect.sqlToQuery(condition as never);
    return { sql: query.sql, params: query.params };
  } catch {
    return { sql: String(condition), params: [] };
  }
}

class TxDouble {
  results: unknown[] = [];
  contexts: Array<{ organizationId: string; userId?: string }> = [];
  systemContexts = 0;
  statements: RecordedStatement[] = [];
  private active: string | null = null;

  reset(): void {
    this.results = [];
    this.contexts = [];
    this.systemContexts = 0;
    this.statements = [];
    this.active = null;
  }

  /** Queue the results of the next statements, in order. */
  queue(...results: unknown[]): void {
    this.results.push(...results);
  }

  private next(): Promise<unknown> {
    const result = this.results.length ? this.results.shift() : [];
    return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
  }

  private chain(kind: RecordedStatement['kind']): unknown {
    const statement: RecordedStatement = { kind, context: this.active };
    this.statements.push(statement);
    const proxy: unknown = new Proxy(function () {}, {
      get: (_target, property) => {
        if (property === 'then') return (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => this.next().then(resolve, reject);
        if (property === 'where') return (condition: unknown) => ((statement.where = render(condition)), proxy);
        if (property === 'values') return (values: unknown) => ((statement.values = values), proxy);
        if (property === 'set') return (values: unknown) => ((statement.set = values), proxy);
        return () => proxy;
      },
    });
    return proxy;
  }

  readonly tx: Record<string, unknown> = {
    select: () => this.chain('select'),
    insert: () => this.chain('insert'),
    update: () => this.chain('update'),
    delete: () => this.chain('delete'),
    execute: (query: unknown) => {
      this.statements.push({ kind: 'execute', where: render(query), context: this.active });
      return this.next();
    },
    transaction: async (work: (tx: unknown) => Promise<unknown>) => work(this.tx),
    query: new Proxy(
      {},
      {
        get: () => ({
          findFirst: (options?: { where?: unknown }) => {
            this.statements.push({ kind: 'query', where: render(options?.where), context: this.active });
            return this.next();
          },
          findMany: (options?: { where?: unknown }) => {
            this.statements.push({ kind: 'query', where: render(options?.where), context: this.active });
            return this.next();
          },
        }),
      },
    ),
  };

  readonly withRLSContext = async (
    context: { organizationId: string; userId?: string },
    work: (tx: unknown) => Promise<unknown>,
  ): Promise<unknown> => {
    this.contexts.push(context);
    const outer = this.active;
    this.active = context.organizationId;
    try {
      return await work(this.tx);
    } finally {
      this.active = outer;
    }
  };

  readonly withSystemContext = async (work: (tx: unknown) => Promise<unknown>): Promise<unknown> => {
    this.systemContexts += 1;
    const outer = this.active;
    this.active = 'system';
    try {
      return await work(this.tx);
    } finally {
      this.active = outer;
    }
  };
}

export const txDouble = new TxDouble();

/** The module to return from vi.mock('@/lib/db/with-rls-context', ...). */
export function txDoubleModule() {
  return {
    withRLSContext: txDouble.withRLSContext,
    withSystemContext: txDouble.withSystemContext,
  };
}
