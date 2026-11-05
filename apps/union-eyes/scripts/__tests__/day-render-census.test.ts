/**
 * The day-render census (UE-CONV-H-029): calendar days a screen reads in the reader's time zone.
 *
 * Two parts. The first pins what counts (lib/frontend-census/day-render.ts): a value named like a day (a `date` column of the schema, a key ending in Date or Deadline) formatted
 * or taken apart in the reader's zone, handed to a function that does, or compared with now as an instant; and what does not (the day read through @/lib/client/day, a
 * UTC-pinned format, a format that shows a time of day, a date written with a local time, string operations on the text). The second runs the census over the real tree and holds
 * it at zero: a contract that takes effect on 1 April read "March 2026" and a deadline shown a day early (or called overdue the evening before it is due) for every Canadian
 * reader, and no unit test sees it because the machine that runs them is in UTC. A value that really is an instant is accepted by name, with the reason, and a stale acceptance fails.
 */
import { describe, expect, it } from 'vitest'
import { findDayRenders, zoneFormatters, type DayRenderKind } from '../lib/frontend-census/day-render'
import { ACCEPTED, countByKind, runCensus, schemaDayKeys } from '../runtime/day-render-census'

const DAY_KEYS = new Set(['dueDate', 'effectiveDate', 'periodStart', 'periodEnd', 'issueDate'])
const kinds = (source: string, file = 'components/x/card.tsx', formatters: string[] = []): DayRenderKind[] =>
  findDayRenders(file, source, { dayKeys: DAY_KEYS, formatters: new Set(formatters) }).map(({ kind }) => kind)

describe('what counts as a day read in the reader\'s zone', () => {
  it('reads a day formatted or taken apart in the reader\'s zone', () => {
    expect(kinds(`export const A = ({ row }) => <td>{new Date(row.dueDate).toLocaleDateString()}</td>`)).toEqual(['DAY_IN_LOCAL_ZONE'])
    expect(kinds(`export const A = ({ row }) => <td>{new Date(row.dueDate).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}</td>`)).toEqual(['DAY_IN_LOCAL_ZONE'])
    expect(kinds(`export const A = ({ row }) => <td>{new Date(row.issueDate).getDate()}</td>`)).toEqual(['DAY_IN_LOCAL_ZONE'])
    expect(kinds(`export const A = ({ d }) => <td>{d.effectiveDate.toLocaleDateString(locale)}</td>`)).toEqual(['DAY_IN_LOCAL_ZONE'])
  })

  it('reads date-fns format of a day, and an Intl.DateTimeFormat without a pinned zone', () => {
    expect(kinds(`import { format } from 'date-fns'\nexport const A = ({ c }) => <td>{format(new Date(c.effectiveDate), 'MMM yyyy')}</td>`)).toEqual(['DAY_IN_LOCAL_ZONE'])
    expect(kinds(`export const A = ({ c }) => <td>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(c.effectiveDate))}</td>`)).toEqual(['DAY_IN_LOCAL_ZONE'])
    expect(kinds(`const fmt = new Intl.DateTimeFormat('en-CA')\nexport const A = ({ c }) => <td>{fmt.format(new Date(c.periodStart))}</td>`)).toEqual(['DAY_IN_LOCAL_ZONE'])
  })

  it('reads a day handed to a function of the file that formats its argument in the reader\'s zone', () => {
    const source = `function formatDate(value: string) { return new Date(value).toLocaleDateString('en-CA') }\nexport const A = ({ row }) => <td>{formatDate(row.dueDate)}</td>`
    expect(kinds(source)).toEqual(['DAY_VIA_LOCAL_FORMATTER'])
    // The same through a derived value, and through an arrow function.
    expect(kinds(`const show = (value: string) => { const date = new Date(value); return date.toLocaleDateString() }\nexport const A = ({ row }) => <td>{show(row.dueDate)}</td>`)).toEqual(['DAY_VIA_LOCAL_FORMATTER'])
  })

  it('reads a day handed to a formatter imported from another module of the app', () => {
    expect(kinds(`import { fmt } from '@/lib/fmt'\nexport const A = ({ row }) => <td>{fmt(row.dueDate)}</td>`, 'components/x/card.tsx', ['fmt'])).toEqual(['DAY_VIA_LOCAL_FORMATTER'])
  })

  it('reads a day compared with now as an instant, so it ends at midnight UTC', () => {
    expect(kinds(`export const A = ({ t }) => (new Date(t.dueDate) < new Date() ? 'late' : 'ok')`)).toEqual(['DAY_COMPARED_TO_NOW'])
    expect(kinds(`export const A = ({ t }) => (Date.now() > new Date(t.dueDate).getTime() ? 'late' : 'ok')`)).toEqual(['DAY_COMPARED_TO_NOW'])
    expect(kinds(`export const A = ({ t }) => Math.floor((new Date(t.dueDate).getTime() - Date.now()) / 86400000)`)).toEqual(['DAY_COMPARED_TO_NOW'])
  })

  it('reads a day the screen already holds as a Date, compared with a now it took earlier', () => {
    expect(kinds(`export const A = ({ row }) => { const now = Date.now(); return row.responseDeadline.getTime() < now ? 'late' : 'ok' }`)).toEqual(['DAY_COMPARED_TO_NOW'])
    expect(kinds(`export const A = ({ row }) => { const today = new Date(); return new Date(row.dueDate) < today ? 'late' : 'ok' }`)).toEqual(['DAY_COMPARED_TO_NOW'])
    expect(kinds(`export const A = ({ row }, now: number) => (row.dueDate.getTime() - now) / 86400000`)).toEqual(['DAY_COMPARED_TO_NOW'])
  })

  it('names the key and the line', () => {
    const [found] = findDayRenders('components/x/card.tsx', `\n\nexport const A = ({ row }) => new Date(row.dueDate).toLocaleDateString()`, { dayKeys: DAY_KEYS })
    expect(found).toMatchObject({ kind: 'DAY_IN_LOCAL_ZONE', key: 'dueDate', line: 3 })
  })
})

describe('what does not', () => {
  it('does not read a day shown through @/lib/client/day', () => {
    expect(kinds(`import { formatDay, recordedDay, isDayPast, daysUntilDay } from '@/lib/client/day'\nexport const A = ({ row }) => <td>{formatDay(row.dueDate, locale)}{recordedDay(row.dueDate).toLocaleDateString()}{isDayPast(row.dueDate) ? 'late' : ''}{daysUntilDay(row.dueDate)}</td>`)).toEqual([])
    expect(kinds(`import { format } from 'date-fns'\nimport { recordedDay } from '@/lib/client/day'\nexport const A = ({ c }) => <td>{format(recordedDay(c.effectiveDate), 'MMM yyyy')}</td>`)).toEqual([])
  })

  it('does not read a format that pins the zone to UTC, or one that shows a time of day', () => {
    expect(kinds(`export const A = ({ row }) => <td>{new Date(row.dueDate).toLocaleDateString('en-CA', { timeZone: 'UTC' })}</td>`)).toEqual([])
    expect(kinds(`export const A = ({ row }) => <td>{new Date(row.dueDate).toLocaleDateString('en-CA', { hour: 'numeric', minute: '2-digit' })}</td>`)).toEqual([])
    expect(kinds(`import { format } from 'date-fns'\nexport const A = ({ c }) => <td>{format(new Date(c.effectiveDate), 'MMM d, h:mm a')}</td>`)).toEqual([])
    expect(kinds(`export const A = ({ c }) => <td>{new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', dateStyle: 'long' }).format(new Date(c.effectiveDate))}</td>`)).toEqual([])
  })

  it('does not read a date written with a local time, nor string operations on the text of a day', () => {
    expect(kinds(`export const A = ({ row }) => <td>{new Date(\`\${row.dueDate}T00:00:00\`).toLocaleDateString()}</td>`)).toEqual([])
    expect(kinds(`export const A = ({ row }) => <td>{row.dueDate.slice(0, 10)}{row.dueDate.split('-')[0]}</td>`)).toEqual([])
    expect(kinds(`export const A = ({ row }) => <td>{row.dueDate.slice(0, 10) < today ? 'late' : ''}</td>`)).toEqual([])
  })

  it('does not read a day compared with another day as text: today as a day is not the current instant', () => {
    expect(kinds(`export const A = ({ row }) => { const today = todayDay(); return row.dueDate < today ? 'late' : 'ok' }`)).toEqual([])
    expect(kinds(`export const A = ({ row }) => (row.dueDate.slice(0, 10) < todayIso() ? 'late' : 'ok')`)).toEqual([])
  })

  it('does not read a value that is not named like a day, nor the functions and globals named for dates', () => {
    expect(kinds(`export const A = ({ row }) => <td>{new Date(row.createdAt).toLocaleDateString()}</td>`)).toEqual([])
    expect(kinds(`export const A = () => <footer>{new Date().getFullYear()}</footer>`)).toEqual([])
    expect(kinds(`export const A = ({ date }) => <td>{getDate(date)}{formatDate(date)}</td>`)).toEqual([])
    // A bare name is a day only when the schema says the column is one.
    expect(kinds(`export const A = ({ selectedDate }) => <td>{new Date(selectedDate).toLocaleDateString()}</td>`)).toEqual([])
  })

  it('reads UI modules only: not routes, not tests, not code that is not a screen', () => {
    const source = `export const A = ({ row }) => new Date(row.dueDate).toLocaleDateString()`
    expect(kinds(source, 'app/api/x/route.ts')).toEqual([])
    expect(kinds(source, 'components/x/card.test.tsx')).toEqual([])
    expect(kinds(source, 'lib/x.ts')).toEqual([])
    expect(kinds(source, 'components/x/card.stories.tsx')).toEqual([])
  })
})

describe('which functions format their argument in the reader\'s zone', () => {
  it('finds them, and which are exported for other modules to import', () => {
    const { local, exported } = zoneFormatters('lib/x.ts', `
      export function fmtLocal(value: string) { return new Date(value).toLocaleDateString() }
      export const fmtArrow = (value: string) => { const d = new Date(value); return d.getDate() }
      export function fmtUtc(value: string) { return new Date(value).toLocaleDateString('en-CA', { timeZone: 'UTC' }) }
      function privateFmt(value: string) { return new Date(value).toLocaleDateString() }
    `)
    expect([...local].sort()).toEqual(['fmtArrow', 'fmtLocal', 'privateFmt'])
    expect([...exported].sort()).toEqual(['fmtArrow', 'fmtLocal'])
  })

  it('does not count a function that reads the day through @/lib/client/day', () => {
    const { local } = zoneFormatters('lib/x.ts', `
      import { formatDay } from '@/lib/client/day'
      export function show(value: string, locale: string) { return formatDay(value, locale, 'long') }
    `)
    expect([...local]).toEqual([])
  })

  it('does not count the day API itself, which takes a day apart on purpose to read it as the day it is', () => {
    const { local, exported } = zoneFormatters('lib/client/day.ts', `
      export function recordedDay(value: string): Date {
        const parts = /^(\\d{4})-(\\d{2})-(\\d{2})/.exec(value)
        if (!parts) return new Date(value)
        const date = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]), 12)
        return date.getMonth() === Number(parts[2]) - 1 && date.getDate() === Number(parts[3]) ? date : new Date(Number.NaN)
      }
      export function formatDay(value: string) { return recordedDay(value).toLocaleDateString() }
      export function dayOf(instant: Date) { return instant.getFullYear() }
    `)
    expect([...local]).toEqual(['dayOf'])
    expect([...exported]).toEqual(['dayOf'])
  })
})

describe('the real tree', () => {
  // Days read in the reader's zone. The ceiling can only fall; the end is zero.
  const CEILING: Record<DayRenderKind, number> = { DAY_IN_LOCAL_ZONE: 0, DAY_VIA_LOCAL_FORMATTER: 0, DAY_COMPARED_TO_NOW: 0 }
  const report = runCensus()

  it('reads the frontend and the schema, so the check is not vacuous', () => {
    expect(report.files).toBeGreaterThan(500)
    expect(report.dayKeys).toBeGreaterThan(80)
    expect(schemaDayKeys().has('effectiveDate')).toBe(true)
  })

  it('holds every kind at or below its ceiling', () => {
    const counts = countByKind(report.findings)
    const over = (Object.keys(CEILING) as DayRenderKind[])
      .filter((kind) => counts[kind] > CEILING[kind])
      .map((kind) => `${kind}: ${counts[kind]} > ${CEILING[kind]}\n${report.findings.filter((finding) => finding.kind === kind).map((finding) => `  ${finding.file}:${finding.line}  [${finding.key}]  ${finding.text}`).join('\n')}`)
    expect(over).toEqual([])
  })

  it('accepts only what is named and reasoned, and no acceptance is stale', () => {
    for (const entry of ACCEPTED) {
      expect(entry.reason.length, `${entry.file}: ${entry.text}`).toBeGreaterThan(40)
      expect(report.acceptedSites.some((site) => site.file === entry.file && site.text.startsWith(entry.text)), `stale acceptance: ${entry.file}: ${entry.text}`).toBe(true)
    }
  })
})
