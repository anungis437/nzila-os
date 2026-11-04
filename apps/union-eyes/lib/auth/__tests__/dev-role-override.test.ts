/**
 * DEV_ROLE_OVERRIDE is a developer's convenience (UE-CONV-H-024): act as another role. It is honoured on a developer's machine and refused on every deployed runtime,
 * so a stray value in a deployed environment cannot make a person a steward or an administrator.
 */
import { describe, expect, it } from 'vitest'
import { devRoleOverride } from '../dev-role-override'
import { UserRole } from '../roles'

const DEPLOYED: ReadonlyArray<Record<string, string>> = [
  { NODE_ENV: 'production' },
  { NODE_ENV: 'production', UE_ENVIRONMENT: 'production' },
  // A production container labelled development does not open it.
  { NODE_ENV: 'development', UE_ENVIRONMENT: 'production' },
  { NODE_ENV: 'development', NEXT_PUBLIC_APP_ENV: 'production' },
  { NODE_ENV: 'development', UE_ENVIRONMENT: 'staging' },
  { NODE_ENV: 'development', UE_ENVIRONMENT: 'pilot' },
  { NODE_ENV: 'development', NZILA_MODE: 'production' },
  { NODE_ENV: 'development', TARGET_ENVIRONMENT: 'prod' },
]

describe('DEV_ROLE_OVERRIDE', () => {
  it('forces the role it names on a developer machine', () => {
    expect(devRoleOverride({ NODE_ENV: 'development', DEV_ROLE_OVERRIDE: 'steward' })).toBe(UserRole.STEWARD)
    expect(devRoleOverride({ NODE_ENV: 'development', UE_ENVIRONMENT: 'local', DEV_ROLE_OVERRIDE: 'member' })).toBe(UserRole.MEMBER)
  })

  it.each(DEPLOYED)('is refused on a deployed runtime, whatever role it names: %o', (identity) => {
    for (const role of ['steward', 'admin', 'system_admin', 'app_owner']) expect(devRoleOverride({ ...identity, DEV_ROLE_OVERRIDE: role })).toBeNull()
  })

  it('is not honoured outside development either: a test run or an unlabelled process gets no override', () => {
    expect(devRoleOverride({ NODE_ENV: 'test', DEV_ROLE_OVERRIDE: 'steward' })).toBeNull()
    expect(devRoleOverride({ DEV_ROLE_OVERRIDE: 'steward' })).toBeNull()
  })

  it('ignores a value that is not a role, and an empty one', () => {
    expect(devRoleOverride({ NODE_ENV: 'development', DEV_ROLE_OVERRIDE: 'root' })).toBeNull()
    expect(devRoleOverride({ NODE_ENV: 'development', DEV_ROLE_OVERRIDE: '' })).toBeNull()
    expect(devRoleOverride({ NODE_ENV: 'development' })).toBeNull()
  })
})
