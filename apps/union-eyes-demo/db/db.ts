/**
 * Demo-local database client shim.
 *
 * Wave 0 §2 + §4 remediation: replaces `@/db/db` (operational Drizzle
 * client) with an externally-inert stub.
 *
 * Semantics:
 *   - Every `SELECT` returns `[]`. Callers designed with a static
 *     fixture fallback (see `lib/demo/server/cupe4373-cases-repo.ts`)
 *     will engage that fallback path.
 *   - Every write (`INSERT`, `UPDATE`, `DELETE`) throws
 *     `DEMO_NO_EXTERNAL_SIDE_EFFECT`. The demo app MUST NOT mutate any
 *     backing store.
 *   - `db.execute(sql...)` returns an empty array.
 *
 * This satisfies the Wave 0 §4 rule that the demo cannot cause external
 * side effects. If a real demo DB overlay is added later (via
 * `DEMO_DATABASE_URL`), replace this file — do NOT reach into the
 * operational `@/db/db`.
 */

const NO_SIDE_EFFECT_ERROR = new Error(
  'DEMO_NO_EXTERNAL_SIDE_EFFECT: @nzila/union-eyes-demo attempted a database ' +
    'write. Demo builds cannot mutate any backing store. If persistent ' +
    'behavior is genuinely required, wire a separate DEMO_DATABASE_URL ' +
    'and DEMO-scoped schema; never reach into the operational app.',
);

interface QueryBuilder {
  from(_table: unknown): QueryBuilder;
  where(_predicate: unknown): QueryBuilder;
  orderBy(..._args: unknown[]): QueryBuilder;
  limit(_n: number): QueryBuilder;
  offset(_n: number): QueryBuilder;
  leftJoin(..._args: unknown[]): QueryBuilder;
  innerJoin(..._args: unknown[]): QueryBuilder;
  rightJoin(..._args: unknown[]): QueryBuilder;
  groupBy(..._args: unknown[]): QueryBuilder;
  having(..._args: unknown[]): QueryBuilder;
  then<TResult1 = unknown[], TResult2 = never>(
    onfulfilled?: ((value: unknown[]) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null,
  ): Promise<TResult1 | TResult2>;
}

function readBuilder(): QueryBuilder {
  const builder: QueryBuilder = {
    from: () => builder,
    where: () => builder,
    orderBy: () => builder,
    limit: () => builder,
    offset: () => builder,
    leftJoin: () => builder,
    innerJoin: () => builder,
    rightJoin: () => builder,
    groupBy: () => builder,
    having: () => builder,
    then: (onfulfilled) => Promise.resolve([]).then(onfulfilled ?? undefined),
  };
  return builder;
}

function throwOnWrite(): never {
  throw NO_SIDE_EFFECT_ERROR;
}

interface DemoDb {
  select: (_columns?: unknown) => QueryBuilder;
  selectDistinct: (_columns?: unknown) => QueryBuilder;
  insert: (..._args: unknown[]) => never;
  update: (..._args: unknown[]) => never;
  delete: (..._args: unknown[]) => never;
  execute: (_query: unknown) => Promise<unknown[]>;
  transaction: <T>(callback: (tx: DemoDb) => Promise<T>) => Promise<T>;
  query: Record<string, { findMany: () => Promise<unknown[]>; findFirst: () => Promise<undefined> }>;
}

export const db: DemoDb = {
  select: (_columns?: unknown): QueryBuilder => readBuilder(),
  selectDistinct: (_columns?: unknown): QueryBuilder => readBuilder(),
  insert: () => throwOnWrite(),
  update: () => throwOnWrite(),
  delete: () => throwOnWrite(),
  execute: async (_query: unknown): Promise<unknown[]> => [],
  transaction: async <T,>(callback: (tx: DemoDb) => Promise<T>): Promise<T> => callback(db),
  query: new Proxy(
    {},
    {
      get: () => ({
        findMany: async () => [],
        findFirst: async () => undefined,
      }),
    },
  ) as DemoDb['query'],
};

export const client: {
  end: (_opts?: unknown) => Promise<void>;
  [key: string]: unknown;
} = new Proxy(
  {},
  {
    get: (_target, prop) => {
      // Allow `.end()` (postgres.js teardown) so scripts that guard with
      // try/finally can complete cleanly without triggering a write throw.
      if (prop === 'end') return async () => undefined;
      throwOnWrite();
    },
  },
) as { end: (_opts?: unknown) => Promise<void>; [key: string]: unknown };
