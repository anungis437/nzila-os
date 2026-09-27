import { describe, expect, it } from 'vitest'

import { ACCEPTED_LIMITATIONS, RED_TEAM_ATTACKS, renderRedTeamReport, runRedTeam } from '../red-team'

describe('red team', () => {
  it('blocks every catalogued attack, including the unrelated-id split', () => {
    const executed = runRedTeam()
    expect(executed.pass).toBe(true)
    expect(executed.redTeamPass).toBe(true)
    expect(executed.openIds).toEqual([])
    expect(executed.results).toHaveLength(RED_TEAM_ATTACKS.length)
    for (const attack of RED_TEAM_ATTACKS) {
      const result = executed.results.find((item) => item.id === attack.id)
      expect(result?.blocked).toBe(true)
      expect(attack.disposition).toBe('RESOLVED')
    }
    const split = executed.results.find((item) => item.id === 'unrelated-id-concentration-split')
    expect(split?.code).toBe('CONCENTRATION_UNPROVEN')
  })

  it('records attacks, findings, remediations, and accepted limitations', () => {
    const report = renderRedTeamReport()
    expect(report).toContain('## Attacks')
    expect(report).toContain('## Findings')
    expect(report).toContain('## Remediations')
    expect(report).toContain('## Accepted limitations')
    expect(report).toContain('RED_TEAM_PASS: YES')
    expect(report).toContain('RESOLVED_ATTACKS_BLOCKED: YES')
    expect(report).not.toContain('Disposition: OPEN')
    expect(report).toContain('LOCAL_RED_TEAM is not Fleet REDTEAM')
    expect(report).toContain('FLEET_CERTIFIED: NO')
    expect(report).toContain('TREASURER_CERTIFIED: NO')
    for (const attack of RED_TEAM_ATTACKS) {
      expect(report).toContain(attack.id)
      expect(report).toContain(`Disposition: ${attack.disposition}`)
    }
    for (const limitation of ACCEPTED_LIMITATIONS) {
      expect(report).toContain(limitation.id)
    }
    expect(report).toContain('RELATEDNESS_REQUIRES_ISSUER_EVIDENCE')
    expect(report).not.toContain('NO_ISSUER_REGISTRY_RELATED_ASSETS')
  })
})
