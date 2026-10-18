/**
 * @nzila/tool-fabric — request / authority separation
 *
 * An agent may only say WHO it is and WHAT it wants. It can never state what
 * it is permitted to do: the strict intent schema has no field for that, and
 * unknown keys are rejected. Permitted capabilities come exclusively from a
 * trusted AgentAuthorityResolver and are carried as a runtime-minted
 * ResolvedAgentAuthority.
 *
 * No platform primitive today binds an agent identity to capabilities (there
 * is no canonical fleet registry). NullAgentAuthorityResolver is therefore
 * the default and fails closed. Do not back this with a Tool-Fabric-local
 * registry.
 */
import { createHash } from 'node:crypto'
import { z } from 'zod'

import { TOOL_SIDE_EFFECTS, type ResolvedAgentAuthority } from './types'

const bounded = z.string().max(4096).refine((s) => !s.includes('\0'))
const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9:._/@-]{0,159}$/)
export const resourceLimitsSchema = z.object({
  cpuMs: z.number().int().positive().max(300_000),
  memoryBytes: z.number().int().positive().max(1_073_741_824),
  diskBytes: z.number().int().positive().max(1_073_741_824),
  outputBytes: z.number().int().positive().max(10_485_760),
  processes: z.number().int().positive().max(8),
}).strict()

export const toolExecutionIntentSchema = z
  .object({
    requestingAgentId: identifier,
    organizationId: identifier,
    missionId: identifier,
    invocationRef: identifier,
    authorityRef: identifier,
    artifactDigest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
    nonce: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
    decisionVersion: z.literal(2),
    capability: identifier,
    toolKey: identifier,
    command: identifier,
    args: z.array(bounded).max(64),
    workingDirectory: bounded,
    allowedFilesystemRoots: z.array(bounded).max(16),
    network: z.enum(['NONE', 'ALLOWLIST']),
    networkDestinations: z.array(z.object({
      host: z.string().regex(/^[a-z0-9][a-z0-9.-]{0,252}$/),
      port: z.number().int().min(1).max(65535),
      protocol: z.enum(['https', 'tcp']),
    }).strict()).max(16),
    env: z.object({ allow: z.record(bounded).refine((r) => Object.keys(r).length <= 16) }).strict(),
    secretRefs: z.array(bounded).max(16),
    timeoutMs: z.number().int().positive().max(300_000),
    resources: resourceLimitsSchema,
    expectedOutputs: z.array(bounded).max(32),
    sideEffects: z.array(z.enum(TOOL_SIDE_EFFECTS)).max(10),
    /** Reference to a governance decision; a reference is not an approval. */
    approvalRef: identifier.optional(),
    auditCorrelationId: identifier,
  })
  .strict()

export type ToolExecutionIntent = Readonly<z.infer<typeof toolExecutionIntentSchema>>
export const toolInstallRequestSchema = z.object({
  requestedBy: z.object({ kind: z.enum(['AGENT', 'GOVERNED_INSTALLER']), id: identifier }).strict(),
  toolKey: identifier,
  digest: bounded.optional(),
  packageCoordinates: bounded.optional(),
  isolatedEnvironment: z.boolean(),
  licenseAccepted: z.boolean(),
  dependencyInspectionRef: identifier.optional(),
  auditCorrelationId: identifier,
}).strict()

/** Canonical versioned hash of the complete validated request. */
export function hashIntent(intent: ToolExecutionIntent): string {
  const parsed = toolExecutionIntentSchema.parse(intent)
  return createHash('sha256').update(canonicalJson({ version: 2, intent: parsed })).digest('hex')
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).filter((k) => record[k] !== undefined).sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(record[k])}`).join(',')}}`
}

export interface AgentAuthorityRecord {
  readonly agentId: string
  readonly capabilities: readonly string[]
  readonly source: string
  readonly authorityRef: string
  readonly organizationId?: string
  readonly missionId?: string
  readonly expiresAt?: string
  readonly status?: 'ACTIVE' | 'REVOKED'
  readonly filesystemRoots?: readonly string[]
}

export interface AgentAuthorityResolver {
  /** Authoritative lookup. null means the agent is unknown to the authority. */
  resolve(agentId: string): Promise<AgentAuthorityRecord | null>
}

export class NullAgentAuthorityResolver implements AgentAuthorityResolver {
  async resolve(): Promise<null> {
    return null
  }
}

export class AuthorityResolutionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthorityResolutionError'
  }
}

const minted = new WeakSet<object>()

const authorityRecordSchema = z.object({
  agentId: identifier,
  capabilities: z.array(z.string().min(1).max(160)).max(64),
  source: z.string().max(160),
  authorityRef: z.string().max(160),
  organizationId: identifier.optional(),
  missionId: identifier.optional(),
  expiresAt: z.string().datetime().optional(),
  status: z.enum(['ACTIVE', 'REVOKED']).optional(),
  filesystemRoots: z.array(bounded).max(16).optional(),
}).strict()

/** True only for authorities minted by resolveAgentAuthority(). */
export function isResolvedAgentAuthority(value: unknown): value is ResolvedAgentAuthority {
  return typeof value === 'object' && value !== null && minted.has(value)
}

export async function resolveAgentAuthority(
  resolver: AgentAuthorityResolver,
  agentId: string,
  now: Date = new Date(),
): Promise<ResolvedAgentAuthority> {
  if (!agentId.trim()) throw new AuthorityResolutionError('agent identity is required')
  const raw = await resolver.resolve(agentId)
  if (raw === null) throw new AuthorityResolutionError(`no authority could be resolved for agent "${agentId}"`)
  const parsed = authorityRecordSchema.safeParse(raw)
  if (!parsed.success) throw new AuthorityResolutionError('resolved authority is malformed or unbounded')
  const record = parsed.data
  if (record.agentId !== agentId) {
    throw new AuthorityResolutionError('resolver returned authority for a different agent')
  }
  if (!record.source.trim() || !record.authorityRef.trim()) {
    throw new AuthorityResolutionError('resolved authority must carry a source and authority reference')
  }
  if (record.capabilities.some((c) => c === '*' || !c.trim())) {
    throw new AuthorityResolutionError('wildcard or empty capabilities are not valid authority')
  }
  const resolved: ResolvedAgentAuthority = Object.freeze({
    agentId: record.agentId,
    capabilities: Object.freeze([...record.capabilities]),
    source: record.source,
    authorityRef: record.authorityRef,
    resolvedAt: now.toISOString(),
    organizationId: record.organizationId,
    missionId: record.missionId,
    expiresAt: record.expiresAt,
    status: record.status,
    filesystemRoots: Object.freeze([...(record.filesystemRoots ?? [])]),
  })
  minted.add(resolved)
  return resolved
}
