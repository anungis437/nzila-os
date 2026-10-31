import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const decide = vi.hoisted(() => vi.fn())
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: async (_ctx: unknown, fn: (tx: unknown) => unknown) => fn({}) }))
vi.mock('@/lib/authority/store/route-adapter', () => ({ decideCase: decide }))

import { visibleCaseIds } from '@/lib/cognition/case-visibility'

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')

describe('Gate 0 batch B83: cognition reads follow the case authority', () => {
  it('keeps only the cases the kernel lets the person read, asking once per distinct case', async () => {
    decide.mockImplementation(async (_tx: unknown, input: { caseId: string }) => ({ effect: input.caseId === 'c-mine' ? 'allow' : 'deny' }))
    const visible = await visibleCaseIds('org', 'steward-1', ['c-mine', 'c-other', 'c-mine'])
    expect([...visible]).toEqual(['c-mine'])
    expect(decide).toHaveBeenCalledTimes(2)
    expect(decide).toHaveBeenCalledWith({}, expect.objectContaining({ userId: 'steward-1', organizationId: 'org', action: 'case:read_internal' }))
  })

  it('asks nothing for no cases', async () => {
    decide.mockClear()
    expect((await visibleCaseIds('org', 'u', [])).size).toBe(0)
    expect(decide).not.toHaveBeenCalled()
  })

  it('applies it to the case risk score and to the precedent search (the case and every candidate)', () => {
    const risk = src('app/api/cognition/cases/[id]/risk/route.ts')
    expect(risk.indexOf('visibleCaseIds(')).toBeLessThan(risk.indexOf('scoreGrievanceRisk(context.organizationId'))
    const precedents = src('app/api/cognition/precedents/route.ts')
    expect(precedents).toContain('visibleCaseIds(context.organizationId, context.userId, [body.forCaseId])')
    expect(precedents).toContain('candidateRows = candidateRows.filter((g) => readable.has(g.id))')
  })

  it('shows steward workload and burnout signals to an officer, not to a peer steward', () => {
    expect(src('app/api/cognition/workload/route.ts')).toContain("hasMinRole('officer')")
  })
})
