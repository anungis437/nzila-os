import { describe, expect, it } from 'vitest'
import {
  authenticateInvocation, DenyInvocationAuthenticator, type InvocationAuthenticator,
} from './invocation'
import {
  DenyApprovalLeaseStore, ToolPolicy, ToolProviderRegistry,
  ToolRegistry, classifyDrift, hashIntent, resolveAgentAuthority,
  toolExecutionIntentSchema, type ToolExecutionIntent,
  type ToolSideEffect,
} from './index'
import {
  approvalFor, approve, authorityFor, authorityRecord, DIGEST, grant, intent,
  invocationFor, KEY, NOW, NOW_DATE, pinned,
} from './fixtures'
import { StaticAgentAuthorityResolver } from './testing'
import { summarizeIntentForAudit } from './audit'

async function setup(highRisk = false, effect: ToolSideEffect = 'DESTRUCTIVE_OPERATION') {
  const tools = new ToolRegistry()
  tools.register(pinned(highRisk ? {
    commands: [{ name: 'imgtool', sideEffects: ['FILESYSTEM_READ', effect], supportsJsonOutput: true }],
    declaredSideEffects: ['FILESYSTEM_READ', effect],
  } : {}))
  await approve(tools, KEY, 'APPROVED', highRisk ? {
    ...grant, allowedSideEffects: ['FILESYSTEM_READ', effect],
  } : grant)
  const authority = await authorityFor('agent-a', ['image.convert'])
  const invocation = await invocationFor()
  const policy = new ToolPolicy(tools, new ToolProviderRegistry(), { now: () => NOW_DATE })
  return { tools, policy, authority, invocation }
}

describe('TF-A authenticated host binding', () => {
  it('A01 denies missing or JSON-forged host assertions despite valid agent resolution', async () => {
    const e = await setup()
    expect(e.policy.evaluateExecution(intent(), { authority: e.authority, approval: null }).allowed).toBe(false)
    expect(e.policy.evaluateExecution(intent(), {
      authority: e.authority, approval: null, invocation: JSON.parse(JSON.stringify(e.invocation)),
    }).allowed).toBe(false)
    await expect(authenticateInvocation(new DenyInvocationAuthenticator(), {}, NOW_DATE)).rejects.toThrow('UNAUTHENTICATED')
  })

  it.each(['requestingAgentId', 'organizationId', 'missionId', 'invocationRef', 'authorityRef'] as const)(
    'A02 rejects spoofed %s independently of grants', async (key) => {
      const e = await setup()
      const result = e.policy.evaluateExecution(intent({ [key]: 'attacker' }), {
        authority: e.authority, invocation: e.invocation, approval: null,
      })
      expect(result.allowed).toBe(false)
    },
  )

  it('A03 denies revoked authority on re-resolution and expired host assertions', async () => {
    const e = await setup()
    const authority = await resolveAgentAuthority(new StaticAgentAuthorityResolver([{
      ...authorityRecord, status: 'REVOKED', agentId: 'agent-a',
      capabilities: ['image.convert'], source: 'host', authorityRef: 'AUTH-agent-a',
    }]), 'agent-a', NOW_DATE)
    expect(e.policy.evaluateExecution(intent(), { authority, invocation: e.invocation, approval: null }).allowed).toBe(false)
    const authenticator: InvocationAuthenticator = {
      async authenticate() { return { ...e.invocation, expiresAt: NOW } },
    }
    await expect(authenticateInvocation(authenticator, {}, NOW_DATE)).rejects.toThrow('STALE')
    expect(toolExecutionIntentSchema.safeParse({ ...intent(), authorityResolver: {} }).success).toBe(false)
  })

  it('A04 cannot reuse another mission trust decision with a freshly authenticated matching identity', async () => {
    const e = await setup()
    const authority = await resolveAgentAuthority(new StaticAgentAuthorityResolver([{
      ...authorityRecord, organizationId: 'org-b', missionId: 'mission-b', agentId: 'agent-a',
      capabilities: ['image.convert'], source: 'host', authorityRef: 'AUTH-agent-a',
    }]), 'agent-a', NOW_DATE)
    const invocation = await invocationFor({ organizationId: 'org-b', missionId: 'mission-b' })
    const result = e.policy.evaluateExecution(intent({ organizationId: 'org-b', missionId: 'mission-b' }), {
      authority, invocation, approval: null,
    })
    expect(result.allowed).toBe(false)
    expect(result.reasons).toContain('TRUST_DECISION_SCOPE_MISMATCH')
  })

  it('A05 bounds malformed authoritative responses before minting', async () => {
    await expect(resolveAgentAuthority(new StaticAgentAuthorityResolver([{
      ...authorityRecord, agentId: 'agent-a', capabilities: ['image.convert'],
      source: 'x'.repeat(161), authorityRef: 'AUTH-agent-a',
    }]), 'agent-a', NOW_DATE)).rejects.toThrow(/unbounded/)
  })
})

describe('TF-C command side-effect floor', () => {
  it.each(['DESTRUCTIVE_OPERATION', 'CREDENTIAL_ACCESS', 'EXTERNAL_PUBLICATION'] as const)(
    'C00 requires a distinct approver for declared %s regardless of request omission', async (effect) => {
      const e = await setup(true, effect)
      const request = intent({ sideEffects: ['FILESYSTEM_READ', effect], approvalRef: 'approval-high-risk' })
      expect(e.policy.evaluateExecution(request, {
        authority: e.authority, invocation: e.invocation, approval: null,
      }).allowed).toBe(false)
      const approval = await approvalFor(request)
      expect(e.policy.evaluateExecution(request, {
        authority: e.authority, invocation: e.invocation, approval,
      }).allowed).toBe(true)
      const omitted = e.policy.evaluateExecution(intent({ sideEffects: ['FILESYSTEM_READ'] }), {
        authority: e.authority, invocation: e.invocation, approval: null,
      })
      expect(omitted.reasons).toContain('COMMAND_EFFECTS_OMITTED')
      expect(omitted.reasons.join()).toMatch(/per-request approval/)
    },
  )
  it('C01 omitted destructive effects deny and cannot lower per-request approval risk', async () => {
    const e = await setup(true)
    const result = e.policy.evaluateExecution(intent({ sideEffects: ['FILESYSTEM_READ'] }), {
      authority: e.authority, invocation: e.invocation, approval: null,
    })
    expect(result.allowed).toBe(false)
    expect(result.reasons).toContain('COMMAND_EFFECTS_OMITTED')
    expect(result.reasons.join()).toMatch(/per-request approval/)
  })

  it('C02 rejects unknown commands and duplicate/conflicting declarations at approval', async () => {
    const e = await setup()
    expect(e.policy.evaluateExecution(intent({ command: 'unknown' }), {
      authority: e.authority, invocation: e.invocation, approval: null,
    }).reasons).toContain('COMMAND_UNKNOWN_OR_AMBIGUOUS')
    for (const commands of [
      [...pinned().commands, ...pinned().commands],
      [{ name: 'imgtool', sideEffects: ['DESTRUCTIVE_OPERATION'] as const, supportsJsonOutput: true }],
    ]) {
      const reg = new ToolRegistry()
      reg.register(pinned({ commands }))
      await expect(approve(reg, KEY)).rejects.toThrow(/duplicate|contradict/)
    }
  })
})

const mutations: ReadonlyArray<readonly [string, Partial<ToolExecutionIntent>]> = [
  ['actor', { requestingAgentId: 'agent-b' }],
  ['organization', { organizationId: 'org-b' }],
  ['mission', { missionId: 'mission-b' }],
  ['invocation', { invocationRef: 'invocation-b' }],
  ['authority revision', { authorityRef: 'AUTH-new' }],
  ['artifact digest', { artifactDigest: `sha256:${'b'.repeat(64)}` }],
  ['tool', { toolKey: 'other/tool@1' }],
  ['capability', { capability: 'other.capability' }],
  ['command', { command: 'other' }],
  ['ordered argv', { args: ['in.png', 'convert'] }],
  ['cwd', { workingDirectory: '/work/job1/sub' }],
  ['roots', { allowedFilesystemRoots: ['/work/job1/sub'] }],
  ['outputs', { expectedOutputs: ['/work/job1/other.png'] }],
  ['network', { network: 'ALLOWLIST' }],
  ['destinations', { networkDestinations: [{ host: 'example.test', port: 443, protocol: 'https' }] }],
  ['environment', { env: { allow: { LANG: 'C' } } }],
  ['secret identity', { secretRefs: ['secretref:test-only'] }],
  ['timeout', { timeoutMs: 1234 }],
  ['resources', { resources: { ...intent().resources, outputBytes: 128 } }],
  ['cpu', { resources: { ...intent().resources, cpuMs: 1001 } }],
  ['memory', { resources: { ...intent().resources, memoryBytes: 1 } }],
  ['disk', { resources: { ...intent().resources, diskBytes: 1 } }],
  ['processes', { resources: { ...intent().resources, processes: 2 } }],
  ['effects', { sideEffects: ['FILESYSTEM_READ', 'FILESYSTEM_WRITE', 'EXTERNAL_PUBLICATION'] }],
  ['correlation', { auditCorrelationId: 'other-correlation' }],
  ['nonce', { nonce: 'nonce_synthetic_0002' }],
  ['approval reference', { approvalRef: 'approval-other' }],
]

describe('TF-D complete v2 approval binding and CLOSED replay boundary', () => {
  it.each(mutations)('D01 binds %s', (_name, mutation) => {
    expect(hashIntent(intent(mutation))).not.toBe(hashIntent(intent()))
  })

  it('D02 canonicalizes object keys, rejects version downgrade and bounds total argv', () => {
    const original = intent({ env: { allow: { LANG: 'C', TZ: 'UTC' } } })
    expect(hashIntent({ ...original, env: { allow: { TZ: 'UTC', LANG: 'C' } } })).toBe(hashIntent(original))
    expect(toolExecutionIntentSchema.safeParse({ ...intent(), decisionVersion: 1 }).success).toBe(false)
    expect(toolExecutionIntentSchema.safeParse({ ...intent(), args: Array(65).fill('x') }).success).toBe(false)
    expect(toolExecutionIntentSchema.safeParse({ ...intent(), timeoutMs: Infinity }).success).toBe(false)
  })

  it('D03 fully bound high-risk approval is policy eligibility, never a one-shot execution lease', async () => {
    const e = await setup(true)
    const request = intent({ sideEffects: ['FILESYSTEM_READ', 'DESTRUCTIVE_OPERATION'], approvalRef: 'approval-a' })
    const approval = await approvalFor(request)
    expect(e.policy.evaluateExecution(request, { authority: e.authority, invocation: e.invocation, approval }).allowed).toBe(true)
    for (const over of [{ nonce: 'nonce_synthetic_0002' }, { organizationId: 'org-b' }]) {
      const bad = await approvalFor(request, over)
      expect(e.policy.evaluateExecution(request, { authority: e.authority, invocation: e.invocation, approval: bad }).allowed).toBe(false)
    }
    const store = new DenyApprovalLeaseStore()
    expect(store.durability).toBe('UNAVAILABLE')
    await expect(store.consumeOnce()).rejects.toThrow('EXECUTION_CLOSED')
    await expect(store.consumeOnce()).rejects.toThrow('EXECUTION_CLOSED')
  })

  it('D04 rejects expired, missing, rebound and self-issued approvals', async () => {
    const e = await setup(true)
    const request = intent({ sideEffects: ['FILESYSTEM_READ', 'DESTRUCTIVE_OPERATION'], approvalRef: 'approval-a' })
    for (const over of [
      { approverId: 'agent-a' }, { approverId: 'author-a' }, { approverId: 'reviewer-a' },
      { approverId: undefined }, { decidedByRole: 'agent' }, { subjectDigest: `sha256:${'b'.repeat(64)}` },
      { decisionRef: 'rebound' }, { boundIntentHash: 'a'.repeat(64) }, { missionId: 'other-mission' },
    ]) {
      const approval = await approvalFor(request, over)
      expect(e.policy.evaluateExecution(request, {
        authority: e.authority, invocation: e.invocation, approval,
      }).allowed).toBe(false)
    }
    await expect(approvalFor(request, { validUntil: NOW })).rejects.toThrow(/expired/)
  })
})

describe('TF-F/G resource boundaries', () => {
  it.each([
    '/', 'C:\\', 'C:relative', '\\\\server\\share\\out', '\\\\?\\C:\\work',
    '/work/job1/../escape', '/work/job1/file:stream', '/work/job1/NUL',
    '/work/job1/trailing.', '/work/job1/\0x', '/work/job1/\u202eescape',
  ])('F01 denies dangerous lexical path %s', async (path) => {
    const e = await setup()
    expect(e.policy.evaluateExecution(intent({ workingDirectory: path, allowedFilesystemRoots: [path] }), {
      authority: e.authority, invocation: e.invocation, approval: null,
    }).allowed).toBe(false)
  })

  it('F02 requested roots cannot grant themselves scope and outputs cannot escape', async () => {
    const e = await setup()
    for (const over of [
      { workingDirectory: '/private', allowedFilesystemRoots: ['/private'] },
      { expectedOutputs: ['/work/job10/out'] },
      { resources: { ...intent().resources, processes: 2 } },
    ]) {
      expect(e.policy.evaluateExecution(intent(over), {
        authority: e.authority, invocation: e.invocation, approval: null,
      }).allowed).toBe(false)
    }
  })

  it('G01 denies network, arbitrary environment and interpreters without treating denylists as a sandbox', async () => {
    const e = await setup()
    const requests: Partial<ToolExecutionIntent>[] = [
      { network: 'ALLOWLIST' as const, networkDestinations: [{ host: 'example.test', port: 443, protocol: 'https' as const }] },
      { env: { allow: { GIT_CONFIG_COUNT: '1' } } },
      { env: { allow: { NODE_OPTIONS: '--inspect' } } },
      { command: 'python3.exe' },
      { secretRefs: ['secretref:ungranted'] },
    ]
    for (const over of requests) {
      expect(e.policy.evaluateExecution(intent(over), {
        authority: e.authority, invocation: e.invocation, approval: null,
      }).allowed).toBe(false)
    }
  })
})

describe('TF-H immutable identity and metadata drift', () => {
  it.each([
    { identity: { ...pinned().identity, providerId: 'other' } },
    { identity: { ...pinned().identity, license: 'other' } },
    { identity: { ...pinned().identity, packageCoordinates: 'other' } },
    { sourceClass: 'EXTERNAL_UNREVIEWED' as const },
    { commands: [{ name: 'imgtool', sideEffects: ['DESTRUCTIVE_OPERATION'] as const, supportsJsonOutput: true }] },
  ])('H01 security metadata changes suspend even at the same digest: %j', (over) => {
    expect(classifyDrift(pinned(), pinned(over)).material).toBe(true)
  })

  describe('TF-L bounded external ingestion and data-minimal audit', () => {
    it('L01 caps malformed summaries without retaining unrecognized effect text or argument hashes', () => {
      const result = summarizeIntentForAudit({
        args: Array(1000).fill('private-value'),
        env: { allow: Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`key${i}`, 'private-value'])) },
        secretRefs: Array(1000).fill('private-ref'),
        sideEffects: ['PRIVATE_EXFILTRATION', 'FILESYSTEM_READ'],
      })
      expect(result).toEqual({
        commandSha256: null, argsSha256: null, argCount: 65,
        envKeyCount: 17, secretRefCount: 17, sideEffects: ['FILESYSTEM_READ'],
      })
      expect(JSON.stringify(result)).not.toMatch(/private/i)
    })
  })

  it('H02 records cannot be mutated through returned objects or caller-owned grant', async () => {
    const e = await setup()
    expect(() => Object.assign(e.tools.get(KEY)!.descriptor.identity, { digest: 'bad' })).toThrow()
    expect(e.tools.get(KEY)!.descriptor.identity.digest).toBe(DIGEST)
    expect(classifyDrift(pinned(), pinned({ displayName: 'new label' })).material).toBe(false)
  })
})
