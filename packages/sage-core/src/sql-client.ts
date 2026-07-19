// ─── @nzila/sage-core — SQL client abstraction ───────────────────────────────
// A minimal, framework-free query interface so the SQL-backed repository can be
// unit-tested with a fake client and wired at runtime to the repo's actual
// PostgreSQL client (e.g. a node-postgres Pool/Client, which satisfies this
// shape structurally). No new database framework is introduced.
//
// Every SAGE SQL operation MUST use parameterized queries ($1, $2, …). String
// interpolation of user-controlled values into SQL text is forbidden.

export type SageSqlClient = {
  query<T = unknown>(
    text: string,
    params?: readonly unknown[],
  ): Promise<{ rows: T[] }>
}

// A transaction shares the same query surface as the client. Runtime wiring may
// hand a transaction-scoped client to the repository; the repository code is
// agnostic to whether it runs inside a transaction.
export type SageSqlTransaction = SageSqlClient
