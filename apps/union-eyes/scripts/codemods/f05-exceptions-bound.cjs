const fs = require('fs')
const file = 'services/platform-economics/reconciliation-service.ts'
let t = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
const from = `export async function listExceptions(
  organizationId: string,
  statusFilter: ('open' | 'under_review' | 'resolved' | 'written_off')[] = ['open', 'under_review'],
): Promise<ReconciliationException[]> {
  return await db
    .select()
    .from(reconciliationExceptions)
    .where(
      and(
        eq(reconciliationExceptions.organizationId, organizationId),
        inArray(reconciliationExceptions.status, statusFilter),
      ),
    );
}`
if (!t.includes(from)) throw new Error('marker')
t = t.replace(
  from,
  `export const EXCEPTION_STATUSES = ['open', 'under_review', 'resolved', 'written_off'] as const;
export const MAX_EXCEPTIONS_PER_READ = 200;

export async function listExceptions(
  organizationId: string,
  statusFilter: readonly string[] = ['open', 'under_review'],
  limit: number = MAX_EXCEPTIONS_PER_READ,
): Promise<ReconciliationException[]> {
  // A status outside the vocabulary is the caller's error, not a cast that reaches the database as an invalid enum value, and the list is
  // bounded and ordered, so a large backlog is read in pages rather than whole.
  const valid = statusFilter.filter((s): s is (typeof EXCEPTION_STATUSES)[number] => (EXCEPTION_STATUSES as readonly string[]).includes(s));
  if (valid.length === 0 || valid.length !== statusFilter.length) {
    throw ApiError.badRequest(\`status must be one or more of: \${EXCEPTION_STATUSES.join(', ')}\`);
  }
  const bounded = Math.min(MAX_EXCEPTIONS_PER_READ, Math.max(1, Math.trunc(limit) || MAX_EXCEPTIONS_PER_READ));
  return await db
    .select()
    .from(reconciliationExceptions)
    .where(
      and(
        eq(reconciliationExceptions.organizationId, organizationId),
        inArray(reconciliationExceptions.status, valid),
      ),
    )
    .orderBy(desc(reconciliationExceptions.createdAt))
    .limit(bounded);
}`,
)
t = t.replace("import { eq, and, gte, lte, inArray, isNull, sql } from 'drizzle-orm';", "import { eq, and, gte, lte, inArray, isNull, sql, desc } from 'drizzle-orm';")
fs.writeFileSync(file, t)

const tf = 'services/platform-economics/__tests__/reconciliation-service.test.ts'
let s = fs.readFileSync(tf, 'utf8').replace(/\r\n/g, '\n')
s = s.replace("  inArray: vi.fn(() => ({})),\n}));", "  inArray: vi.fn(() => ({})),\n  desc: vi.fn(() => ({})),\n}));")
fs.writeFileSync(tf, s)
console.log('ok')
