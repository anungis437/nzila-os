/**
 * The fake-content census (UE-CONV-H-021): figures a screen states that nothing measured, and mailboxes it names that the product does not own.
 *
 * Two parts. The first pins what counts (lib/frontend-census/fake-content.ts): a measurement written into JSX, a binding named for sample data, a progress
 * bar whose value is a number in the source, a mailbox at a domain the product does not own, and what does not (scale labels, filter options, deadlines, marketing
 * copy, a field's placeholder example). The second runs the census over the
 * real tree and holds the findings at or below a ceiling that can only fall: a dashboard that states "+12.3%" is the same for every organization and wrong for all
 * of them, and no other test sees it. Closing findings means lowering the ceiling; a new fake figure fails here.
 */
import { describe, expect, it } from 'vitest'
import { findFakeContent, isFakeMetric } from '../lib/frontend-census/fake-content'
import { ACCEPTED, runCensus } from '../runtime/fake-content-census'

const kinds = (file: string, source: string) => findFakeContent(file, source).map(({ kind, text }) => `${kind}:${text}`)

describe('what counts as a figure no one measured', () => {
  it('reads a measurement written into JSX text', () => {
    for (const text of ['94.2%', '+12.3%', '-0.8% vs last period', 'Avg response: 45ms', '42 members at high risk', 'Next post in 2 hours', 'Instagram has your highest engagement rate at 6.5%.']) expect(isFakeMetric(text), text).toBe(true)
  })

  it('does not read a scale label, a filter option, a deadline or a sentence with no figure in it', () => {
    for (const text of ['0%', '100%', 'Last 30 days', 'Next 30 Days', 'Required within 72 hours of discovery under GDPR', 'Members', 'Page 2 of 5', '']) expect(isFakeMetric(text), text).toBe(false)
  })

  it('finds a figure in a UI file, and a sample dataset, and a progress bar fixed at a number', () => {
    const source = `
      const SAMPLE_COMPARISONS = [{ a: 1 }, { a: 2 }]
      export function Card() {
        return <div><span>+8.7%</span><Progress value={75} /><Progress value={100} /><Progress value={done} /></div>
      }`
    expect(kinds('components/x/card.tsx', source)).toEqual(['SAMPLE_DATA:SAMPLE_COMPARISONS', 'LITERAL_METRIC:+8.7%', 'LITERAL_PROGRESS:Progress value=75'])
  })

  it('reads a figure only where a person reads it: not in code, not in an expression, not on a marketing page', () => {
    expect(kinds('components/x/card.tsx', `const label = '94.2%'; export const C = () => <div>{pct}%</div>`)).toEqual([])
    expect(kinds('app/[locale]/(marketing)/pricing/page.tsx', `export default () => <p>Save 20%</p>`)).toEqual([])
    expect(kinds('components/marketing/hero.tsx', `export const H = () => <p>99.9% uptime</p>`)).toEqual([])
    expect(kinds('lib/something.ts', `const SAMPLE_X = [1, 2, 3]`)).toEqual([])
  })

  it('reads a sample binding by its name, and only when it holds a list or a record', () => {
    expect(kinds('components/x/a.ts', `const mockRows = [{ id: 1 }, { id: 2 }]`)).toEqual(['SAMPLE_DATA:mockRows'])
    expect(kinds('components/x/a.tsx', `const demoMode = true; const sampler = [1, 2]; const sampleCount = 3`)).toEqual([])
  })

  it('finds a mailbox the product does not own, in an attribute, in text and in a string', () => {
    const source = `
      const reply = 'support@unionclaims.com'
      export function Card() {
        return <div><a href="mailto:pilot-support@unioneyes.org">Write</a><p>Write to pilot@nzila.io for help</p></div>
      }`
    expect(kinds('components/x/card.tsx', source)).toEqual(['INVENTED_ADDRESS:support@unionclaims.com', 'INVENTED_ADDRESS:pilot-support@unioneyes.org', 'INVENTED_ADDRESS:pilot@nzila.io'])
    expect(kinds('lib/email-templates.tsx', `export const E = () => <p>reply to support@unionclaims.com</p>`)).toEqual(['INVENTED_ADDRESS:support@unionclaims.com'])
  })

  it("does not read the product's own mailbox, an address reserved for examples, a field's placeholder, or a marketing page", () => {
    expect(kinds('components/x/a.tsx', `export const A = () => <p>Write to support@unioneyes.app, name@example.com or a@b.test</p>`)).toEqual([])
    expect(kinds('components/x/a.tsx', `export const A = () => <input placeholder="jane@unionlocal175.org" />`)).toEqual([])
    expect(kinds('components/x/a.tsx', `export const A = () => <Field placeholder={'hr@company.com'} />`)).toEqual([])
    expect(kinds('components/x/a.ts', `const field = { placeholder: 'committee@union.org' }`)).toEqual([])
    expect(kinds('app/[locale]/(marketing)/legal/security/page.tsx', `export default () => <a href="mailto:security@nzila.app">security@nzila.app</a>`)).toEqual([])
    expect(kinds('lib/x.ts', `const a = 'someone@somewhere.org'`)).toEqual([])
  })
})

// Figures in the frontend that nothing measured. The ceiling can only fall; the end is zero.
const CEILING = 0

describe('the frontend against what it states', () => {
  it('holds the figures no one measured at or below the ceiling, and accepts only what is named and reasoned', () => {
    const report = runCensus()
    expect(report.files).toBeGreaterThan(500)
    for (const entry of ACCEPTED) expect(entry.reason.length, `${entry.file} ${entry.text}`).toBeGreaterThan(20)
    const over = report.findings.length > CEILING ? report.findings.map((finding) => `${finding.kind} ${finding.file}:${finding.line}  ${finding.text}`) : []
    expect(over).toEqual([])
  }, 120_000)
})
