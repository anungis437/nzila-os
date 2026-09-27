import { describe, expect, it } from 'vitest'

import { ACCEPTED_LIMITATIONS, RED_TEAM_ATTACKS, renderRedTeamReport, runRedTeam } from '../red-team'

describe('red team', () => {
  it('blocks every resolved attack and leaves the unrelated-id residual open', () => {
    const executed = runRedTeam()
    expect(executed.pass).toBe(true)
    expect(executed.redTeamPass).toBe(false)
    expect(executed.openIds).toEqual(['unrelated-id-concentration-split'])
    expect(executed.results).toHaveLength(RED_TEAM_ATTACKS.length)
    for (const attack of RED_TEAM_ATTACKS) {
      const result = executed.results.find((item) => item.id === attack.id)
      expect(result).toBeDefined()
      if (attack.disposition === 'RESOLVED') expect(result?.blocked).toBe(true)
      if (attack.disposition === 'OPEN') expect(result?.blocked).toBe(false)
    }
  })

  it('records attacks, findings, remediations, and accepted limitations without hiding OPEN', () => {
    const report = renderRedTeamReport()
    expect(report).toContain('## Attacks')
    expect(report).toContain('## Findings')
    expect(report).toContain('## Remediations')
    expect(report).toContain('## Accepted limitations')
    expect(report).toContain('RED_TEAM_PASS: NO')
    expect(report).toContain('RESOLVED_ATTACKS_BLOCKED: YES')
    expect(report).toContain('Disposition: OPEN')
    expect(report).toContain('FLEET_CERTIFIED: NO')
    expect(report).toContain('TREASURER_CERTIFIED: NO')
    expect(report).toContain('LOCAL_RED_TEAM is not Fleet REDTEAM')
    for (const attack of RED_TEAM_ATTACKS) {
      expect(report).toContain(attack.id)
      expect(report).toContain(`Disposition: ${attack.disposition}`)
    }
    for (const limitation of ACCEPTED_LIMITATIONS) {
      expect(report).toContain(limitation.id)
    }
    expect(report).toContain('NO_CRYPTOGRAPHIC_PRINCIPAL_BINDING')
    expect(report).toContain('NO_ISSUER_REGISTRY_RELATED_ASSETS')
  })
})
