/**
 * Stand-in for the system-role transaction of `@/lib/db/with-rls-context` in the unit tests of the platform jobs.
 *
 * It runs the callback like the real one: with the transaction handle the test supplies, committing when the callback returns and rolling back
 * (rethrowing) when it throws. It records each context (so a test can tell which work shared a transaction and which rolled back), the order of
 * what happened, and how deeply the running code is nested in one: code that must run as the system role is called with `depth() === 1`.
 *
 * Use: `vi.mock('@/lib/db/with-rls-context', async () => (await import('./system-context-double')).systemContextModule)`.
 */
export interface SystemContextRecord {
  index: number;
  committed: boolean;
  rolledBack: boolean;
}

export const systemContext = {
  contexts: [] as SystemContextRecord[],
  events: [] as string[],
  depth: 0,
  tx: undefined as unknown,
  reset(tx?: unknown): void {
    this.contexts = [];
    this.events = [];
    this.depth = 0;
    this.tx = tx;
  },
  note(event: string): void {
    this.events.push(event);
  },
  async run<T>(work: (tx: unknown) => Promise<T>): Promise<T> {
    const record: SystemContextRecord = { index: this.contexts.length + 1, committed: false, rolledBack: false };
    this.contexts.push(record);
    this.events.push(`open ${record.index}`);
    this.depth += 1;
    try {
      const result = await work(this.tx);
      record.committed = true;
      this.events.push(`commit ${record.index}`);
      return result;
    } catch (error) {
      record.rolledBack = true;
      this.events.push(`rollback ${record.index}`);
      throw error;
    } finally {
      this.depth -= 1;
    }
  },
};

export const systemContextModule = {
  withSystemContext: (work: (tx: unknown) => Promise<unknown>) => systemContext.run(work),
};
