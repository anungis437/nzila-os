/**
 * ARTIFACT TYPE: Government-Readiness Additive Layer — Test
 * MODULE: Public-sector kill switch for `Answer.note` (free-text field)
 * DOCTRINE: docs/oci/superseded/government-readiness/SECURITY_AND_DATA_HANDLING_BRIEF.md §2.1
 * STATUS: INTERNALLY_TESTED
 *
 * Proves the deployment-time enforcement of the documented "callers must
 * disable free-text `note` in public-sector engagements" posture. With
 * `OCI_PUBLIC_SECTOR_MODE=1`, `buildAnswer` refuses any non-empty note.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { buildAnswer, isPublicSectorModeEnabled } from '../../scoring'
import { ALL_QUESTIONS } from '../../questions'

const anyLikert = ALL_QUESTIONS.find((q) => q.type === 'likert_5')!

describe('public-sector free-text kill switch', () => {
  const originalEnv = process.env.OCI_PUBLIC_SECTOR_MODE

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.OCI_PUBLIC_SECTOR_MODE
    } else {
      process.env.OCI_PUBLIC_SECTOR_MODE = originalEnv
    }
  })

  it('is disabled by default (backward-compatible with existing callers)', () => {
    delete process.env.OCI_PUBLIC_SECTOR_MODE
    expect(isPublicSectorModeEnabled()).toBe(false)
    // note is accepted (documented as sensitive; caller is responsible)
    const answer = buildAnswer(anyLikert, '3', 'reviewer said the ED is retiring next month')
    expect(answer.note).toBe('reviewer said the ED is retiring next month')
  })

  it.each(['1', 'true', 'TRUE', 'yes', 'on', ' 1 '])(
    'is enabled when OCI_PUBLIC_SECTOR_MODE=%s',
    (value) => {
      process.env.OCI_PUBLIC_SECTOR_MODE = value
      expect(isPublicSectorModeEnabled()).toBe(true)
    },
  )

  it('throws when a non-empty note is supplied under public-sector mode', () => {
    process.env.OCI_PUBLIC_SECTOR_MODE = '1'
    expect(() => buildAnswer(anyLikert, '3', 'confidential board matter')).toThrow(
      /OCI_PUBLIC_SECTOR_MODE/,
    )
  })

  it('still accepts an omitted or empty note under public-sector mode', () => {
    process.env.OCI_PUBLIC_SECTOR_MODE = '1'
    expect(() => buildAnswer(anyLikert, '3')).not.toThrow()
    expect(() => buildAnswer(anyLikert, '3', '')).not.toThrow()
    expect(() => buildAnswer(anyLikert, '3', '   ')).not.toThrow()
    const answer = buildAnswer(anyLikert, '3')
    expect(answer.note).toBeUndefined()
  })

  it('names the doctrine section in the thrown message so operators can act', () => {
    process.env.OCI_PUBLIC_SECTOR_MODE = '1'
    expect(() => buildAnswer(anyLikert, '3', 'sensitive')).toThrow(
      /SECURITY_AND_DATA_HANDLING_BRIEF\.md/,
    )
  })
})
