import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const WORKFLOWS = join(__dirname, '..', '..', '.github', 'workflows')

// GitHub rejects the whole workflow file, on every event, when a job-level `if`
// reads a context that does not exist at that point. The run then shows only as
// "workflow file issue" with no jobs, so no check ever reports a failure by name.
describe('Workflow context availability', () => {
  const files = readdirSync(WORKFLOWS).filter((name) => /\.ya?ml$/.test(name))

  it.each(files)('%s has no job-level condition that reads the matrix or steps context', (file) => {
    const workflow = parse(readFileSync(join(WORKFLOWS, file), 'utf8')) as {
      jobs?: Record<string, { if?: unknown }>
    }
    for (const [id, job] of Object.entries(workflow.jobs ?? {})) {
      const condition = String(job.if ?? '')
      expect(condition, `${file} job ${id}`).not.toMatch(/\bmatrix\./)
      expect(condition, `${file} job ${id}`).not.toMatch(/\bsteps\./)
    }
  })
})
