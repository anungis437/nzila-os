/**
 * Phase 0C.2 §4 — Playwright E2E auth-bypass hardening (direct tests)
 *
 * These tests exercise the pure-function gate `isPlaywrightE2EAuthAllowed`
 * that guards the E2E auth bypass. Passing tests here PROVE that the bypass
 * is structurally impossible outside of a governed test environment — even
 * if PLAYWRIGHT_TEST_AUTH=true and the magic User-Agent both leak into
 * production.
 *
 * Gate contract (all six must pass simultaneously):
 *   1. PLAYWRIGHT_TEST_AUTH === 'true'
 *   2. QA_TEST_ENV          === 'true'
 *   3. NODE_ENV             ∈ { 'test', 'development' }
 *   4. DATABASE_URL         resolves to a loopback host
 *   5. NEXT_PUBLIC_APP_URL  resolves to a loopback host
 *   6. request User-Agent   contains 'playwright-e2e-auth'
 *
 * Every negative test in this file asserts that failing exactly one gate
 * (with every other gate satisfied) causes the bypass to refuse.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  isPlaywrightE2EAuthAllowed,
  __resetPlaywrightBypassWarnCacheForTests,
  type PlaywrightBypassEnv,
} from './auth-service'

/** Canonical governed-test env — all six gates green. */
const governedEnv: PlaywrightBypassEnv = {
  PLAYWRIGHT_TEST_AUTH: 'true',
  QA_TEST_ENV: 'true',
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://nzila:nzila_dev@localhost:5433/ue_e2e_run_x',
  NEXT_PUBLIC_APP_URL: 'http://localhost:3002',
}

const playwrightUa = {
  userAgent:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 playwright-e2e-auth/1.0',
}

/** Sanity: the fully-green case must actually allow the bypass — otherwise
 *  every negative test is meaningless. */
describe('§4 baseline — all gates satisfied', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    __resetPlaywrightBypassWarnCacheForTests()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('ALLOWS bypass when all six gates pass', () => {
    expect(isPlaywrightE2EAuthAllowed(playwrightUa, governedEnv)).toBe(true)
  })

  it('ALLOWS bypass when NODE_ENV is development (not just test)', () => {
    expect(
      isPlaywrightE2EAuthAllowed(playwrightUa, {
        ...governedEnv,
        NODE_ENV: 'development',
      }),
    ).toBe(true)
  })

  it('ALLOWS bypass with 127.0.0.1 loopback DATABASE_URL', () => {
    expect(
      isPlaywrightE2EAuthAllowed(playwrightUa, {
        ...governedEnv,
        DATABASE_URL: 'postgres://nzila:nzila_dev@127.0.0.1:5433/ue_e2e',
      }),
    ).toBe(true)
  })

  it('ALLOWS bypass with 0.0.0.0 loopback NEXT_PUBLIC_APP_URL', () => {
    expect(
      isPlaywrightE2EAuthAllowed(playwrightUa, {
        ...governedEnv,
        NEXT_PUBLIC_APP_URL: 'http://0.0.0.0:3002',
      }),
    ).toBe(true)
  })
})

describe('§4 gate 6 — User-Agent absence is silent (no warn)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    __resetPlaywrightBypassWarnCacheForTests()
  })

  it('REFUSES bypass when UA is missing entirely, without warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(isPlaywrightE2EAuthAllowed({ userAgent: null }, governedEnv)).toBe(
      false,
    )
    expect(warn).not.toHaveBeenCalled()
  })

  it('REFUSES bypass for an ordinary browser UA, without warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      isPlaywrightE2EAuthAllowed(
        { userAgent: 'Mozilla/5.0 (Macintosh) Chrome/126.0 Safari/537.36' },
        governedEnv,
      ),
    ).toBe(false)
    expect(warn).not.toHaveBeenCalled()
  })

  it('REFUSES bypass for empty-string UA, without warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(isPlaywrightE2EAuthAllowed({ userAgent: '' }, governedEnv)).toBe(
      false,
    )
    expect(warn).not.toHaveBeenCalled()
  })
})

describe('§4 gate 1 — PLAYWRIGHT_TEST_AUTH', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    __resetPlaywrightBypassWarnCacheForTests()
  })

  it('REFUSES bypass when PLAYWRIGHT_TEST_AUTH is undefined, and WARNS', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      isPlaywrightE2EAuthAllowed(playwrightUa, {
        ...governedEnv,
        PLAYWRIGHT_TEST_AUTH: undefined,
      }),
    ).toBe(false)
    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0]?.[0]).toContain('gate=PLAYWRIGHT_TEST_AUTH')
  })

  it('REFUSES bypass when PLAYWRIGHT_TEST_AUTH="false"', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      isPlaywrightE2EAuthAllowed(playwrightUa, {
        ...governedEnv,
        PLAYWRIGHT_TEST_AUTH: 'false',
      }),
    ).toBe(false)
  })

  it('REFUSES bypass when PLAYWRIGHT_TEST_AUTH="1" (must be literal "true")', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      isPlaywrightE2EAuthAllowed(playwrightUa, {
        ...governedEnv,
        PLAYWRIGHT_TEST_AUTH: '1',
      }),
    ).toBe(false)
  })
})

describe('§4 gate 2 — QA_TEST_ENV', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    __resetPlaywrightBypassWarnCacheForTests()
  })

  it('REFUSES bypass when QA_TEST_ENV is undefined, and WARNS', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      isPlaywrightE2EAuthAllowed(playwrightUa, {
        ...governedEnv,
        QA_TEST_ENV: undefined,
      }),
    ).toBe(false)
    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0]?.[0]).toContain('gate=QA_TEST_ENV')
  })

  it('REFUSES bypass when QA_TEST_ENV="false"', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      isPlaywrightE2EAuthAllowed(playwrightUa, {
        ...governedEnv,
        QA_TEST_ENV: 'false',
      }),
    ).toBe(false)
  })
})

describe('§4 gate 3 — NODE_ENV never production', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    __resetPlaywrightBypassWarnCacheForTests()
  })

  it('REFUSES bypass when NODE_ENV="production" (all other gates green!), and WARNS', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      isPlaywrightE2EAuthAllowed(playwrightUa, {
        ...governedEnv,
        NODE_ENV: 'production',
      }),
    ).toBe(false)
    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0]?.[0]).toContain('gate=NODE_ENV')
  })

  it('REFUSES bypass when NODE_ENV="staging"', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      isPlaywrightE2EAuthAllowed(playwrightUa, {
        ...governedEnv,
        NODE_ENV: 'staging',
      }),
    ).toBe(false)
  })

  it('REFUSES bypass when NODE_ENV is undefined (fail-closed)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      isPlaywrightE2EAuthAllowed(playwrightUa, {
        ...governedEnv,
        NODE_ENV: undefined,
      }),
    ).toBe(false)
  })

  it('REFUSES bypass when NODE_ENV is empty string (fail-closed)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      isPlaywrightE2EAuthAllowed(playwrightUa, {
        ...governedEnv,
        NODE_ENV: '',
      }),
    ).toBe(false)
  })
})

describe('§4 gate 4 — DATABASE_URL must be loopback', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    __resetPlaywrightBypassWarnCacheForTests()
  })

  it('REFUSES bypass when DATABASE_URL points at Azure Flexible Server', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      isPlaywrightE2EAuthAllowed(playwrightUa, {
        ...governedEnv,
        DATABASE_URL:
          'postgres://nzila_admin:secret@nzila-prod-db.postgres.database.azure.com:5432/union_eyes',
      }),
    ).toBe(false)
    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0]?.[0]).toContain('gate=DATABASE_URL')
  })

  it('REFUSES bypass when DATABASE_URL points at AWS RDS', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      isPlaywrightE2EAuthAllowed(playwrightUa, {
        ...governedEnv,
        DATABASE_URL:
          'postgres://u:p@my-cluster.abc123.us-east-1.rds.amazonaws.com:5432/db',
      }),
    ).toBe(false)
  })

  it('REFUSES bypass when DATABASE_URL points at Supabase', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      isPlaywrightE2EAuthAllowed(playwrightUa, {
        ...governedEnv,
        DATABASE_URL: 'postgres://u:p@db.abc.supabase.co:5432/postgres',
      }),
    ).toBe(false)
  })

  it('REFUSES bypass when DATABASE_URL is undefined', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      isPlaywrightE2EAuthAllowed(playwrightUa, {
        ...governedEnv,
        DATABASE_URL: undefined,
      }),
    ).toBe(false)
  })

  it('REFUSES bypass when DATABASE_URL is unparseable', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      isPlaywrightE2EAuthAllowed(playwrightUa, {
        ...governedEnv,
        DATABASE_URL: 'not-a-url',
      }),
    ).toBe(false)
  })

  it('REFUSES bypass when DATABASE_URL host is a public IP', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      isPlaywrightE2EAuthAllowed(playwrightUa, {
        ...governedEnv,
        DATABASE_URL: 'postgres://u:p@8.8.8.8:5432/db',
      }),
    ).toBe(false)
  })
})

describe('§4 gate 5 — NEXT_PUBLIC_APP_URL must be loopback', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    __resetPlaywrightBypassWarnCacheForTests()
  })

  it('REFUSES bypass when NEXT_PUBLIC_APP_URL is the production unioneyes.app hostname', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      isPlaywrightE2EAuthAllowed(playwrightUa, {
        ...governedEnv,
        NEXT_PUBLIC_APP_URL: 'https://app.unioneyes.app',
      }),
    ).toBe(false)
    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0]?.[0]).toContain('gate=NEXT_PUBLIC_APP_URL')
  })

  it('REFUSES bypass when NEXT_PUBLIC_APP_URL is the staging staging.unioneyes.app hostname', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      isPlaywrightE2EAuthAllowed(playwrightUa, {
        ...governedEnv,
        NEXT_PUBLIC_APP_URL: 'https://staging.unioneyes.app',
      }),
    ).toBe(false)
  })

  it('REFUSES bypass when NEXT_PUBLIC_APP_URL is an Azure Container Apps hostname', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      isPlaywrightE2EAuthAllowed(playwrightUa, {
        ...governedEnv,
        NEXT_PUBLIC_APP_URL:
          'https://nzila-os-union-eyes-staging.jollydune-88c1e97f.canadacentral.azurecontainerapps.io',
      }),
    ).toBe(false)
  })

  it('REFUSES bypass when NEXT_PUBLIC_APP_URL is undefined', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      isPlaywrightE2EAuthAllowed(playwrightUa, {
        ...governedEnv,
        NEXT_PUBLIC_APP_URL: undefined,
      }),
    ).toBe(false)
  })

  it('REFUSES bypass when NEXT_PUBLIC_APP_URL is unparseable', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      isPlaywrightE2EAuthAllowed(playwrightUa, {
        ...governedEnv,
        NEXT_PUBLIC_APP_URL: '//broken',
      }),
    ).toBe(false)
  })
})

describe('§4 defense-in-depth — worst-case leak scenarios', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    __resetPlaywrightBypassWarnCacheForTests()
  })

  it('REFUSES bypass in production even when both bypass flags are true and UA is correct', () => {
    // This is the scenario the caveat requires us to prove: someone copies
    // the test env vars into a production deployment. The bypass must still
    // refuse because DATABASE_URL + NEXT_PUBLIC_APP_URL + NODE_ENV are all
    // production-shaped.
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      isPlaywrightE2EAuthAllowed(playwrightUa, {
        PLAYWRIGHT_TEST_AUTH: 'true',
        QA_TEST_ENV: 'true',
        NODE_ENV: 'production',
        DATABASE_URL:
          'postgres://prod:secret@nzila-prod-db.postgres.database.azure.com:5432/ue',
        NEXT_PUBLIC_APP_URL: 'https://app.unioneyes.app',
      }),
    ).toBe(false)
  })

  it('REFUSES bypass in staging (loopback flags but staging URLs)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      isPlaywrightE2EAuthAllowed(playwrightUa, {
        PLAYWRIGHT_TEST_AUTH: 'true',
        QA_TEST_ENV: 'true',
        NODE_ENV: 'production',
        DATABASE_URL:
          'postgres://staging:s@nzila-staging-db.postgres.database.azure.com:5432/ue',
        NEXT_PUBLIC_APP_URL: 'https://staging.unioneyes.app',
      }),
    ).toBe(false)
  })

  it('REFUSES bypass in ordinary local dev without QA_TEST_ENV', () => {
    // Everyday developer running `pnpm dev` locally: loopback URLs, NODE_ENV=development,
    // but they did not opt in via QA_TEST_ENV. A stray UA marker must not bypass.
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      isPlaywrightE2EAuthAllowed(playwrightUa, {
        PLAYWRIGHT_TEST_AUTH: undefined,
        QA_TEST_ENV: undefined,
        NODE_ENV: 'development',
        DATABASE_URL: 'postgres://nzila:nzila_dev@localhost:5433/nzila_automation',
        NEXT_PUBLIC_APP_URL: 'http://localhost:3002',
      }),
    ).toBe(false)
  })

  it('REFUSES bypass for any request that does not present the magic UA, even in a fully-green env', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      isPlaywrightE2EAuthAllowed({ userAgent: 'chrome' }, governedEnv),
    ).toBe(false)
  })
})

describe('§4 warn-once behaviour', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    __resetPlaywrightBypassWarnCacheForTests()
  })

  it('emits the refusal warning only once per (gate, UA-prefix) pair', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const badEnv = { ...governedEnv, NODE_ENV: 'production' }
    isPlaywrightE2EAuthAllowed(playwrightUa, badEnv)
    isPlaywrightE2EAuthAllowed(playwrightUa, badEnv)
    isPlaywrightE2EAuthAllowed(playwrightUa, badEnv)
    expect(warn).toHaveBeenCalledOnce()
  })
})
