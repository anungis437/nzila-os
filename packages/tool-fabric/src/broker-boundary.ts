export const TOOL_FABRIC_AUTHORIZATION = Object.freeze({
  brokerReadiness: 'HOLD',
  execution: 'CLOSED',
  installation: 'CLOSED',
  persistence: 'CONTRACT_ONLY',
} as const)

export interface ApprovalConsumption {
  readonly decisionRef: string
  readonly decisionVersion: 2
  readonly intentHash: string
  readonly nonce: string
  readonly organizationId: string
  readonly missionId: string
  readonly subject: string
  readonly artifactDigest: string
  readonly expiresAt: string
  readonly expectedTrustRevision: number
}

/** Future host transaction must atomically consume once and recheck revocation. */
export interface ApprovalLeaseStore {
  readonly durability: 'DURABLE' | 'UNAVAILABLE'
  consumeOnce(binding: ApprovalConsumption): Promise<{
    readonly consumed: boolean
    readonly leaseRef: string | null
  }>
}

export class DenyApprovalLeaseStore implements ApprovalLeaseStore {
  readonly durability = 'UNAVAILABLE' as const

  async consumeOnce(): Promise<never> {
    throw new Error('DURABLE_APPROVAL_CONSUMPTION_NOT_CONFIGURED_EXECUTION_CLOSED')
  }
}
