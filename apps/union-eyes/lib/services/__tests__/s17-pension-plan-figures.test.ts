import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { planFigureFields, memberSafePlan } from '@/lib/pension/plan-input'

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')
const figures = z.object(planFigureFields).strict()

describe('Gate 0 batch B73: pension plan figures and reads', () => {
  it('accepts only amounts and percentages the numeric columns can hold', () => {
    expect(figures.safeParse({ totalAssets: '1250000.50', fundingStatus: '98.25' }).success).toBe(true)
    for (const bad of [{ totalAssets: 'lots' }, { totalAssets: '-5' }, { totalAssets: '1.234' }, { totalAssets: '12345678901234' }, { fundingStatus: 'high' }, { fundingStatus: '1000' }, { fundingStatus: '99.999' }]) {
      expect(figures.safeParse(bad).success, JSON.stringify(bad)).toBe(false)
    }
  })

  it('does not accept a typed active-member count and rejects unknown plan fields', () => {
    for (const path of ['app/api/pension/plans/route.ts', 'app/api/pension/plans/[id]/route.ts']) {
      const route = src(path)
      expect(route, path).not.toMatch(/activeMembers: z\./)
      expect(route, path).toContain('.strict()')
      expect(route, path).toContain('activeEnrolmentCount(pensionPlans.id)')
    }
  })

  it('shows a member the plan without its assets or funding figures', () => {
    const plan = { id: 'p', planName: 'Main', planType: 'hybrid', status: 'active', description: null, totalAssets: '9', fundingStatus: '80', activeMembers: 3 }
    expect(memberSafePlan(plan)).toEqual({ id: 'p', planName: 'Main', planType: 'hybrid', status: 'active', description: null })
    for (const path of ['app/api/pension/plans/route.ts', 'app/api/pension/plans/[id]/route.ts']) {
      expect(src(path), path).toContain('isPensionAdministrator(user?.role)')
      expect(src(path), path).toContain('withRLSContext({ organizationId, userId }')
    }
  })

  it('lists the organization\'s pension members to an administrator with a read record, and limits everyone else to their own', () => {
    const route = src('app/api/pension/members/route.ts')
    expect(route).toContain('isPensionAdministrator(user?.role)')
    expect(route).toContain("action: 'pension.members.read'")
    expect(route).toContain('if (!administrator)')
    expect(route).toContain('withRLSContext({ organizationId, userId }')
    expect(route).not.toContain("from '@/db/db'")
  })
})
