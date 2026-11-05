/**
 * The silent-catch census (UE-CONV-H-026): errors a screen swallows.
 *
 * Two parts. The first pins what counts (lib/frontend-census/silent-catch.ts): a catch with nothing in it or only a placeholder comment, and `.catch(() => {})` on a request;
 * and what does not (a catch that says why the failure is harmless, a catch that acts, a failed parse of a response body that was not JSON). The second runs the census over the
 * real tree and holds each kind at or below a ceiling that can only fall: a request that fails and tells nobody leaves stale numbers, an empty list that reads as "no results" or a
 * form that looks saved, and no unit test sees it because the component is tested with a request that succeeds. Closing findings means lowering the ceiling; a new swallowed error
 * fails here.
 */
import { describe, expect, it } from 'vitest'
import { findSilentCatches, type SilentCatchKind } from '../lib/frontend-census/silent-catch'
import { ACCEPTED, countByKind, runCensus } from '../runtime/silent-catch-census'

const kinds = (source: string, file = 'components/x/card.tsx') => findSilentCatches(file, source).map(({ kind }) => kind)

describe('what counts as a swallowed error', () => {
  it('reads a catch with nothing in it, and one with only a placeholder comment', () => {
    expect(kinds(`export const A = () => { try { go() } catch (e) { } return null }`)).toEqual(['EMPTY_CATCH'])
    expect(kinds(`export const A = () => { try { go() } catch { // handle error\n } return null }`)).toEqual(['EMPTY_CATCH'])
    expect(kinds(`export const A = () => { try { go() } catch { /* ignore */ } return null }`)).toEqual(['EMPTY_CATCH'])
  })

  it('does not read a catch that says why the failure is harmless, or one that acts', () => {
    expect(kinds(`export const A = () => { try { go() } catch { // storage is not available in private browsing; the preference is simply not remembered\n } return null }`)).toEqual([])
    expect(kinds(`export const A = () => { try { go() } catch (e) { setError(String(e)) } return null }`)).toEqual([])
  })

  it('reads a promise catch that does nothing', () => {
    expect(kinds(`export const A = () => { load().catch(() => {}); load().catch(() => undefined); load().catch(noop); return null }`)).toEqual(['EMPTY_PROMISE_CATCH', 'EMPTY_PROMISE_CATCH', 'EMPTY_PROMISE_CATCH'])
  })

  it('does not read a promise catch that acts, nor the failed parse of a body that was not JSON', () => {
    expect(kinds(`export const A = () => { load().catch((e) => setError(e)); return null }`)).toEqual([])
    expect(kinds(`export const A = () => { const body = response.json().catch(() => {}); return body }`)).toEqual([])
  })

  it('reads UI modules only: not the primitives, not tests, not code that is not a component', () => {
    const source = `export const A = () => { try { go() } catch { } return null }`
    expect(kinds(source, 'components/ui/button.tsx')).toEqual([])
    expect(kinds(source, 'components/x/card.test.tsx')).toEqual([])
    expect(findSilentCatches('lib/x.ts', `try { go() } catch { }`)).toEqual([])
  })
})

describe('the real tree', () => {
  // Errors the frontend swallows. Each ceiling can only fall; the end is zero.
  const CEILING: Record<SilentCatchKind, number> = { EMPTY_CATCH: 0, EMPTY_PROMISE_CATCH: 0 }
  const report = runCensus()

  it('reads the frontend, so the check is not vacuous', () => {
    expect(report.files).toBeGreaterThan(500)
  })

  it('holds every kind at or below its ceiling, and accepts only what is named and reasoned', () => {
    const counts = countByKind(report.findings)
    const over = (Object.keys(CEILING) as SilentCatchKind[])
      .filter((kind) => counts[kind] > CEILING[kind])
      .map((kind) => `${kind}: ${counts[kind]} > ${CEILING[kind]}\n${report.findings.filter((finding) => finding.kind === kind).map((finding) => `  ${finding.file}:${finding.line}  ${finding.text}`).join('\n')}`)
    expect(over).toEqual([])
    for (const entry of ACCEPTED) expect(entry.reason.length, `${entry.file}: ${entry.text}`).toBeGreaterThan(20)
  })
})
