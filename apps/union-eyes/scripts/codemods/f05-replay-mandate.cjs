const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.replace(a, b)
  }
  fs.writeFileSync(f, s)
}
edit('app/api/employer-execution/replay/[runId]/route.ts', [
  [`import { recordedRunAmounts } from "@/lib/employer-execution/run-duties";`,
   `import { recordedRunAmounts } from "@/lib/employer-execution/run-duties";\nimport { requireLiveFinancialMandate } from "@/lib/finance/require-live-financial-mandate";`],
  [`    if (typeof runId !== "string") throw ApiError.badRequest("Source payroll run id is required");
`, `    if (typeof runId !== "string") throw ApiError.badRequest("Source payroll run id is required");

    // A replay reads every payroll item of the run and returns per-employee differences: the role title alone is not
    // financial authority, so it needs the same live view mandate as the run's own detail.
    await withRLSContext({ organizationId, userId }, (tx) =>
      requireLiveFinancialMandate(tx, { organizationId, userId, action: "finance:view", resourceId: runId }),
    );
`],
])
edit('app/api/__tests__/employer-replay-run-id.route.test.ts', [
  [`  buildEvaluationGraphDiff: vi.fn(),
}));`, `  buildEvaluationGraphDiff: vi.fn(),
  requireLiveFinancialMandate: vi.fn(),
}));`],
  [`vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));`,
   `vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));\nvi.mock('@/lib/finance/require-live-financial-mandate', () => ({ requireLiveFinancialMandate: m.requireLiveFinancialMandate }));`],
  [`    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.sha256`, `    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.requireLiveFinancialMandate.mockResolvedValue({});
    m.sha256`],
])
let t = fs.readFileSync('app/api/__tests__/employer-replay-run-id.route.test.ts', 'utf8').replace(/\r\n/g, '\n')
// The mandate check is itself a transaction; what these tests pin is that nothing is written.
t = t.split("expect(m.withRLSContext).not.toHaveBeenCalled();").join("expect(m.inserts).toHaveLength(0);")
t = t.replace(`  it('answers a repeated identical replay`, `  it('refuses a role holder who has no live financial view mandate, before reading any payroll item', async () => {
    const { POST } = await loadRoute();
    m.requireLiveFinancialMandate.mockRejectedValueOnce(Object.assign(new Error('Financial mandate required'), { status: 403 }));
    queueReplayInputs();

    await expect(POST({ organizationId: 'org_1', userId: 'user_1', params: { runId: 'run_1' }, body: { mode: 'exact' } } as any)).rejects.toMatchObject({ status: 403 });

    expect(m.requireLiveFinancialMandate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'finance:view', resourceId: 'run_1', organizationId: 'org_1', userId: 'user_1' }));
    expect(mockDb.select).not.toHaveBeenCalled();
    expect(m.inserts).toHaveLength(0);
  });

  it('answers a repeated identical replay`)
fs.writeFileSync('app/api/__tests__/employer-replay-run-id.route.test.ts', t)
console.log('ok')
