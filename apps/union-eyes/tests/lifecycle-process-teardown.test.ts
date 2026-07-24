/**
 * Phase 0C.2 §BR-4 (baseline-remediation §4) — lifecycle/process.ts
 * teardown crash guard.
 *
 * Baseline Run 2 (canonical run `20260724012756_871bd3`, then again in
 * canonical run `20260724034611_438b93`) crashed at lifecycle step 12
 * (`stop-server (sigterm)`) with:
 *
 *   Error [ERR_STREAM_WRITE_AFTER_END]: write after end
 *       at writeAfterEnd (node:internal/streams/writable:512:11)
 *       at WriteStream.Writable.write (node:internal/streams/writable:559:5)
 *       at Socket.ondata (node:internal/streams/readable:1010:22)
 *
 * Mechanism: `bootServer` pipes the child's stdout/stderr to a WriteStream
 * (`server.log`) using the default `pipe()` semantics, which auto-`end()`s
 * the destination when the source closes. On Windows Node 24, when
 * `taskkill /T /F` terminates the Next.js dev server tree, the child's
 * stdout Socket can emit one final buffered `'data'` chunk AFTER logStream
 * has already been ended. Node's readable `Socket.ondata` handler then
 * calls `logStream.write()`, which raises `ERR_STREAM_WRITE_AFTER_END`.
 * The unhandled `'error'` event on logStream propagates and kills the
 * orchestrator BEFORE steps 13 (`drop-db`) and 14 (`verify-port-release`)
 * can run, leaving orphan test DBs behind (observed: two orphans from the
 * two crashed baseline runs).
 *
 * The defect is INTERMITTENT — baseline Run 3 on the identical HEAD did
 * NOT crash — so we cannot detect it via a full lifecycle run. Instead we
 * pin the two required hardenings statically:
 *
 *  1. `pipe(logStream, { end: false })` on both stdout AND stderr — the
 *     destination lifecycle is decoupled from source closure so trailing
 *     writes go to a still-open stream.
 *
 *  2. `logStream.on('error', ...)` swallows *exactly* `ERR_STREAM_WRITE_AFTER_END`
 *     and re-throws every other error code — genuine defect signal is
 *     preserved.
 *
 *  3. `child.once('exit', () => setImmediate(() => logStream.end()))`
 *     drains trailing data then explicitly ends the stream when the
 *     child truly exits, so the log file is closed cleanly.
 *
 * This vitest source-guard is a pure static-analysis test — it does not
 * spawn processes (behavioural coverage would require a Windows child
 * process runtime and race-condition amplification).
 *
 * Placed at `apps/union-eyes/tests/` (NOT `tests/e2e/`) because vitest's
 * `exclude` in `vitest.config.ts` explicitly skips `tests/e2e/**`.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const PROCESS_PATH = resolve(HERE, '..', 'scripts', 'lifecycle', 'process.ts')
const PROCESS_SOURCE = readFileSync(PROCESS_PATH, 'utf-8')

describe('Phase 0C.2 §BR-4 — lifecycle/process.ts stopServer teardown crash guard', () => {
  it('pipes child.stdout to logStream with { end: false } to decouple stream lifecycle', () => {
    // Regex tolerates optional whitespace but requires the { end: false }
    // form on the STDOUT pipe. A future edit dropping the option would
    // fail this assertion and re-open the write-after-end race.
    const stdoutPipe = /child\.stdout\?\.pipe\(\s*logStream\s*,\s*\{\s*end\s*:\s*false\s*\}\s*\)/
    expect(PROCESS_SOURCE).toMatch(stdoutPipe)
  })

  it('pipes child.stderr to logStream with { end: false } to decouple stream lifecycle', () => {
    const stderrPipe = /child\.stderr\?\.pipe\(\s*logStream\s*,\s*\{\s*end\s*:\s*false\s*\}\s*\)/
    expect(PROCESS_SOURCE).toMatch(stderrPipe)
  })

  it('registers a logStream error handler that swallows ERR_STREAM_WRITE_AFTER_END', () => {
    // Require the exact error-code check — this is the ONLY error we
    // permit ourselves to silently drop (all others must re-throw).
    const errorHandler = /logStream\.on\(\s*['"]error['"]\s*,[\s\S]*?ERR_STREAM_WRITE_AFTER_END[\s\S]*?return/
    expect(PROCESS_SOURCE).toMatch(errorHandler)
  })

  it('re-throws non-write-after-end logStream errors instead of silently swallowing them', () => {
    // Ensure the handler does NOT unconditionally swallow every error.
    // A future refactor collapsing the `if` into `return;` would pass
    // the previous assertion but silently hide genuine stream defects.
    const rethrowSection = PROCESS_SOURCE.match(
      /logStream\.on\(\s*['"]error['"]\s*,[\s\S]*?\n\s*\}\s*\)/,
    )?.[0]
    expect(rethrowSection, 'logStream.on("error", ...) handler not found').toBeTruthy()
    expect(rethrowSection).toMatch(/throw\s+err/)
  })

  it('ends logStream on child exit via setImmediate to drain trailing buffered writes', () => {
    // Three conditions: (a) child.once('exit', ...) is wired, (b) a
    // setImmediate call appears WITHIN ~400 chars of it (same handler
    // body region, tolerant of try/catch nesting so a naive brace-match
    // regex is not required), (c) logStream.end() appears in that same
    // region. The 400-char window is generous enough for reasonable
    // formatting yet tight enough to reject accidental co-location.
    const exitIdx = PROCESS_SOURCE.search(/child\.once\(\s*['"]exit['"]\s*,/)
    expect(exitIdx, "child.once('exit', ...) hook not found in bootServer").toBeGreaterThan(-1)
    const handlerRegion = PROCESS_SOURCE.slice(exitIdx, exitIdx + 400)
    expect(handlerRegion).toMatch(/setImmediate/)
    expect(handlerRegion).toMatch(/logStream\.end\(\s*\)/)
  })

  it('does NOT use the default (auto-end) pipe form on child.stdout or child.stderr', () => {
    // Defense-in-depth: reject bare `child.stdout.pipe(logStream)` /
    // `child.stderr.pipe(logStream)` calls that would re-introduce the
    // race even if the { end: false } variants remained present.
    const defaultStdoutPipe = /child\.stdout\?\.pipe\(\s*logStream\s*\)/
    const defaultStderrPipe = /child\.stderr\?\.pipe\(\s*logStream\s*\)/
    expect(PROCESS_SOURCE).not.toMatch(defaultStdoutPipe)
    expect(PROCESS_SOURCE).not.toMatch(defaultStderrPipe)
  })

  it('references the §BR-4 fix rationale in a source comment (traceability)', () => {
    // Prevent silent removal of the rationale comment during future
    // refactors — the "why" must stay in the file so a maintainer
    // reading only process.ts understands the { end: false } / error
    // handler pattern is intentional, not vestigial.
    expect(PROCESS_SOURCE).toMatch(/§BR-4|baseline-remediation\s+§4/i)
    expect(PROCESS_SOURCE).toMatch(/ERR_STREAM_WRITE_AFTER_END/)
  })
})
