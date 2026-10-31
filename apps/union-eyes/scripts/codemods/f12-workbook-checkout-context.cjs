const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.split(a).join(b)
  }
  fs.writeFileSync(f, s)
}
edit('app/api/workbook/checkout/route.ts', [
  [`import { db } from '@/db';`, `import { withSystemContext } from '@/lib/db/with-rls-context';`],
  [`    const [row] = await db
      .select({ reportTierId: workbooks.reportTierId })
      .from(workbooks)
      .where(eq(workbooks.id, workbookId))
      .limit(1);
`, `    // An unclaimed workbook (all a buyer has before paying) is invisible to the user isolation policy, so the read names the
    // system role explicitly rather than running on the pooled connection with no user context.
    const [row] = await withSystemContext(async (tx) =>
      tx
        .select({ reportTierId: workbooks.reportTierId })
        .from(workbooks)
        .where(eq(workbooks.id, workbookId))
        .limit(1),
    );
`],
])
edit('app/api/__tests__/workbook-checkout.route.test.ts', [
  [`  rows: [] as Array<{ reportTierId: string | null }>,
}));`, `  rows: [] as Array<{ reportTierId: string | null }>,
  withSystemContext: vi.fn(),
}));`],
  [`vi.mock('@/db', () => ({
  db: { select: () => ({ from: () => ({ where: () => ({ limit: async () => m.rows }) }) }) },
}));`, `vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));`],
  [`    m.rows = [{ reportTierId: null }];`, `    m.rows = [{ reportTierId: null }];
    m.withSystemContext.mockImplementation(async (work: (tx: unknown) => Promise<unknown>) =>
      work({ select: () => ({ from: () => ({ where: () => ({ limit: async () => m.rows }) }) }) }));`],
  [`  // DEF-0B12-WBK-ROUTES-LOG-THE-BEARER-WORKBOOK-ID`, `  // DEF-0B12-WBK-CHECKOUT-READS-THE-USER-OWNED-WORKBOOKS-TABLE-OUTSIDE-ANY-DATABASE-CONTEXT
  it('reads the unclaimed workbook through the system context, not the bare connection', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.test');
    const { POST } = await import('../workbook/checkout/route');
    await POST(post());
    expect(m.withSystemContext).toHaveBeenCalledTimes(1);
  });

  it('answers 404 for a workbook that is not there and 503 when the lookup fails', async () => {
    const { POST } = await import('../workbook/checkout/route');
    m.rows = [];
    expect((await POST(post())).status).toBe(404);
    m.withSystemContext.mockRejectedValueOnce(new Error('db down'));
    expect((await POST(post())).status).toBe(503);
  });

  // DEF-0B12-WBK-ROUTES-LOG-THE-BEARER-WORKBOOK-ID`],
])
console.log('ok')
