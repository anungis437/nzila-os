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

export const toolExecutionIntentSchema = z
  .object({
    requestingAgentId: z.string().min(1),
    capability: z.string().min(1),
    toolKey: z.string().min(1),
    command: z.string().min(1),
    args: z.array(z.string()),
    workingDirectory: z.string(),
    allowedFilesystemRoots: z.array(z.string()),
    network: z.enum(['NONE', 'ALLOWLIST']),
    env: z.object({ allow: z.record(z.string()) }).strict(),
    secretRefs: z.array(z.string()),
    timeoutMs: z.number(),
    expectedOutputs: z.array(z.string()),
    sideEffects: z.array(z.enum(TOOL_SIDE_EFFECTS)),
    /** Reference to a governance decision; a reference is not an approval. */
    approvalRef: z.string().min(1).optional(),
    auditCorrelationId: z.string().min(1),
  })
  .strict()

export type ToolExecutionIntent = Readonly<z.infer<typeof toolExecutionIntentSchema>>

/** Canonical hash of the parts of an intent an execution approval binds to. */
export function hashIntent(intent: ToolExecutionIntent): string {
  const canonical = JSON.stringify({
    agent: intent.requestingAgentId,
    capability: intent.capability,
    tool: intent.toolKey,
    command: intent.command,
    args: intent.args,
    workingDirectory: intent.workingDirectory,
    sideEffects: [...intent.sideEffects].sort(),
  })
  return createHash('sha256').update(canonical).digest('hex')
}

export interface AgentAuthorityRecord {
  readonly agentId: string
  readonly capabilities: readonly string[]
  readonly source: string
  readonly authorityRef: string
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
  const record = await resolver.resolve(agentId)
  if (record === null) throw new AuthorityResolutionError(`no authority could be resolved for agent "${agentId}"`)
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
  })
  minted.add(resolved)
  return resolved
}
