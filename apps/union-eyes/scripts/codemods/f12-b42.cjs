const fs = require('fs')
const path = require('path')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.split(a).join(b)
  }
  fs.writeFileSync(f, s)
}
edit('lib/knowledge-transfer/indexing/semantic-indexer.ts', [
  [`  | { indexed: false; reason: string };`, `  | { indexed: false; reason: string; failed?: true };`],
  [`    return { indexed: false, reason: String(err) };`, `    // The error text stays in the audit record; the caller is told only that indexing failed.
    return { indexed: false, reason: 'Indexing failed', failed: true };`],
])
edit('app/api/exit-interviews/[id]/index/route.ts', [
  [`    return { data: result };`, `    // A failed indexing is a failure of the request, not a 200 carrying the error text.
    if (!result.indexed && 'failed' in result && result.failed) throw ApiError.internal('Indexing failed');

    return { data: result };`],
])
edit('lib/knowledge-transfer/indexing/__tests__/semantic-indexer.test.ts', [
  [`expect((result as { reason: string }).reason).toContain('audit down');`, `expect(result).toEqual({ indexed: false, reason: 'Indexing failed', failed: true });
    expect(JSON.stringify(result)).not.toContain('audit down');`],
])
edit('app/api/__tests__/exit-interviews-index.route.test.ts', [
  [`    conflict: (msg: string) => Object.assign(new Error(msg), { status: 409 }),`, `    conflict: (msg: string) => Object.assign(new Error(msg), { status: 409 }),
    internal: (msg: string) => Object.assign(new Error(msg), { status: 500 }),`],
  [`  it('refuses to index an interview that is not published', async () => {`, `  // DEF-0B7-EXC-INDEX-FAILURE-RETURNS-200-WITH-RAW-ERROR-TEXT
  it('answers a failed indexing as a 500 without the error text', async () => {
    m.db.select.mockReturnValueOnce({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => [{ id: 'ei_1', status: 'published', sensitivityLevel: 'public_internal', consentGranted: true }]) })) })) } as any);
    m.indexExitInterview.mockResolvedValueOnce({ indexed: false, reason: 'Indexing failed', failed: true });
    const { POST } = await loadRoute();

    await expect(POST({ params: { id: 'ei_1' }, organizationId: 'org_1', userId: 'u1' })).rejects.toMatchObject({ status: 500, message: 'Indexing failed' });
  });

  it('refuses to index an interview that is not published', async () => {`],
])
edit('app/api/exit-interviews/propagation/route.ts', [
  [`import { withApi } from '@/lib/api/framework';`, `import { withApi, ApiError, z } from '@/lib/api/framework';`],
  [`export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    entitlement: 'union_knowledge_suite',
  },
  async ({ organizationId, request }) => {
    const { searchParams } = new URL(request.url);
    const nodeId = searchParams.get('nodeId');
    const analysisType = searchParams.get('analysisType') || 'full';
`, `const querySchema = z.object({
  nodeId: z.string().trim().min(1).max(200).optional(),
  analysisType: z.enum(['downstream', 'upstream', 'coupling', 'full']).default('full'),
}).strict();

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    entitlement: 'union_knowledge_suite',
  },
  async ({ organizationId, request }) => {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(searchParams.entries()));
    if (!parsed.success) throw ApiError.badRequest('nodeId must be text and analysisType one of downstream, upstream, coupling or full');
    const { nodeId, analysisType } = parsed.data;
`],
  [`        throw new Error('Node not found');`, `        throw ApiError.notFound('Node not found');`],
])
fs.writeFileSync('lib/api/__tests__/f12-b42-answers.contract.test.ts', `import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (relative: string) => readFileSync(join(__dirname, '..', '..', '..', relative), 'utf8')

describe('F12 answers that state a failure as a failure', () => {
  // DEF-0B7-COGB-PROPAGATION-UNKNOWN-NODE-ANSWERS-500-AND-ANALYSIS-TYPE-NOT-VALIDATED
  it('the propagation route validates its query and answers an unknown node as not found', () => {
    const source = read('app/api/exit-interviews/propagation/route.ts')
    expect(source).toContain("analysisType: z.enum(['downstream', 'upstream', 'coupling', 'full'])")
    expect(source).toContain('.strict()')
    expect(source).toContain("ApiError.notFound('Node not found')")
    expect(source).not.toContain("throw new Error('Node not found')")
  })

  // DEF-0B7-EXC-INDEX-FAILURE-RETURNS-200-WITH-RAW-ERROR-TEXT
  it('the indexer reports a failure without its error text', () => {
    const source = read('lib/knowledge-transfer/indexing/semantic-indexer.ts')
    expect(source).not.toContain('reason: String(err)')
    expect(source).toContain("reason: 'Indexing failed', failed: true")
  })
})
`)
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const ID = 'B42-F12-FAILURES-ARE-STATED-AS-FAILURES'
if (ledger.batches.some((b) => b.id === ID)) { console.log('B42 present'); process.exit(0) }
const A = 'apps/union-eyes/'
const C = A + 'lib/api/__tests__/f12-b42-answers.contract.test.ts'
const item = (prefix, files, explanation, extra = {}) => ({ prefix, status: 'IMPLEMENTED_PENDING_QUALIFICATION', files, explanation, ...extra })
ledger.batches.push({
  id: ID,
  family: 'F12: a failure is answered as a failure without internal text, and a query is validated',
  evidenceCommit: null,
  items: [
    item('DEF-0B7-EXC-INDEX-FAILURE-RETURNS-200-WITH-RAW-ERROR-TEXT', [A + 'lib/knowledge-transfer/indexing/semantic-indexer.ts', A + 'app/api/exit-interviews/[id]/index/route.ts', A + 'lib/knowledge-transfer/indexing/__tests__/semantic-indexer.test.ts', A + 'app/api/__tests__/exit-interviews-index.route.test.ts', C],
      'A failed indexing now returns a result flagged failed with the fixed text "Indexing failed" (the error stays in the audit record), and the index route answers it 500 instead of 200 carrying the error. Two existing indexer assertions adapted: they required the raw error text ("audit down", "embed boom") in the reason, which is the defect; they now require the fixed text and the absence of the error text.'),
    item('DEF-0B7-COGB-PROPAGATION-UNKNOWN-NODE-ANSWERS-500-AND-ANALYSIS-TYPE-NOT-VALIDATED', [A + 'app/api/exit-interviews/propagation/route.ts', C],
      'The query is validated (nodeId bounded text, analysisType one of four values, unknown parameters refused), an unknown node answers 404 instead of a thrown 500.',
      { status: 'PARTIAL', remaining: 'The contract test pins the source only; no behavioural test drives the route with an unknown node.' }),
  ],
})
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B42 added')
