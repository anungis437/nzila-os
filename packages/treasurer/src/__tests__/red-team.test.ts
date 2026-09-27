import { describe, expect, it } from 'vitest'

import { ACCEPTED_LIMITATIONS, RED_TEAM_ATTACKS, renderRedTeamReport, runRedTeam } from '../red-team'

describe('red team', () => {
  it('blocks every catalogued attack', () => {
    const executed = runRedTeam()
    expect(executed.pass).toBe(true)
    expect(executed.results).toHaveLength(RED_TEAM_ATTACKS.length)
    for (const result of executed.results) {
      expect(result.blocked).toBe(true)
    }
  })

  it('records attacks, findings, remediations, and accepted limitations', () => {
    const report = renderRedTeamReport()
    expect(report).toContain('## Attacks')
    expect(report).toContain('## Findings')
    expect(report).toContain('## Remediations')
    expect(report).toContain('## Accepted limitations')
    expect(report).toContain('RED_TEAM_PASS: YES')
    expect(report).not.toContain('OPEN')
    for (const attack of RED_TEAM_ATTACKS) {
      expect(report).toContain(attack.id)
      expect(attack.disposition).toBe('RESOLVED')
    }
    for (const limitation of ACCEPTED_LIMITATIONS) {
      expect(report).toContain(limitation.id)
    }
  })
})
