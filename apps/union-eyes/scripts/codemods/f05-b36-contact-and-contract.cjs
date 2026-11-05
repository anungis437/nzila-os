const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.split(a).join(b)
  }
  fs.writeFileSync(f, s)
}
edit('app/api/contact/route.ts', [
  [`const contactSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  email: z.string().email(),
  organization: z.string().optional(),
  role: z.string().optional(),
  inquiryType: z.string().optional(),
  message: z.string().max(2000).optional(),
});`, `// Every field is bounded: an anonymous submission is stored as typed, so none may be unbounded.
const contactSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().max(100).optional(),
  email: z.string().trim().max(254).email(),
  organization: z.string().trim().max(200).optional(),
  role: z.string().trim().max(100).optional(),
  inquiryType: z.string().trim().max(100).optional(),
  message: z.string().max(2000).optional(),
});`],
  [`    logger.info('contact_form:submitted', { email, organization, inquiryType });`, `    // The visitor's address is personal data and is not written to the log.
    logger.info('contact_form:submitted', { organization, inquiryType });`],
])
edit('app/api/__tests__/contact-acknowledgement.route.test.ts', [
  [`  it('refuses an invalid submission with 400 before contacting the CRM', async () => {`, `  // DEF-0B6-SYS-CONTACT-UNBOUNDED-FIELDS-AND-EMAIL-LOGGED
  it('refuses an oversized field with 400 before contacting the CRM', async () => {
    m.guard.mockResolvedValue({ ok: true, json: { ...body, organization: 'x'.repeat(201) } });

    const response = await post();

    expect(response.status).toBe(400);
    expect(m.upsertContact).not.toHaveBeenCalled();
  });

  it('does not write the visitor\\'s e-mail address to the log', async () => {
    const { logger } = await import('@/lib/logger');
    m.upsertContact.mockResolvedValue('contact-1');
    m.createDeal.mockResolvedValue('deal-1');

    await post();

    expect(JSON.stringify((logger.info as ReturnType<typeof vi.fn>).mock.calls)).not.toContain(body.email);
  });

  it('refuses an invalid submission with 400 before contacting the CRM', async () => {`],
])
fs.writeFileSync('lib/api/__tests__/f05-b36-bounds.contract.test.ts', `import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (relative: string) => readFileSync(join(__dirname, '..', '..', '..', relative), 'utf8')

describe('F05 lists and reads are bounded, and a GET writes nothing', () => {
  // DEF-0B10-PEN-PENSION-LIST-READS-HAVE-NO-LIMIT-OR-PAGINATION
  it.each(['plans', 'trustees', 'members', 'benefits', 'contributions', 't4a'])('pension/%s lists at most LIST_LIMIT rows', (route) => {
    const source = read(\`app/api/pension/\${route}/route.ts\`)
    expect(source).toContain('const LIST_LIMIT = 200;')
    expect(source).toContain('.limit(LIST_LIMIT)')
  })

  // DEF-0B4-CBAS-LIST-LIMIT-UNBOUNDED, DEF-0B4-CBAS-DETAIL-GET-WRITES-VIEW-COUNT
  it('the agreement list refuses an invalid or oversized page and the detail read counts no view', () => {
    const list = read('app/api/cbas/route.ts')
    expect(list).toContain("'Invalid pagination: page must be 1..10000 and limit 1..100'")
    expect(list).not.toContain("parseInt(url.searchParams.get('limit')")
    expect(read('app/api/cbas/[id]/route.ts')).toContain('{ countView: false }')
    expect(read('app/api/cbas/[id]/route.ts')).not.toContain('countView: includeAnalytics')
  })

  // DEF-0B6-CMP-COMPLIANCE-LISTS-UNBOUNDED
  it.each(['alerts', 'reports'])('compliance/%s lists at most 500 rows', (route) => {
    expect(read(\`app/api/compliance/\${route}/route.ts\`)).toContain('.limit(500)')
  })

  // DEF-0B11-PRP-PRECEDENT-COLLECTION-GET-TAKES-UNBOUNDED-LIMIT-AND-PAGE-FROM-THE-QUERY-STRING
  it('the precedent collection refuses an invalid page or a limit above 100', () => {
    const source = read('app/api/precedents/route.ts')
    expect(source).toContain('boundedPositiveInt(searchParams.get("limit")')
    expect(source).toContain('limit 1..100')
  })
})
`)
console.log('ok')
