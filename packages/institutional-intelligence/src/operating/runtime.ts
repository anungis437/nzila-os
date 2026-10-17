import { z } from 'zod'
import { institutionalReferenceSchema } from '@nzila/platform-contracts'
import type { InstitutionalMutationBoundary } from '../foundation/audit'
import { OperatingGuard, type OperatingSourcePorts } from './sources'
import { estateMutation, relationshipMutation, estateTraversal } from './estate'
import { raidCreate, raidTransition, missionBlockers } from './raid'
import { institutionalCommandSchema } from '../foundation/authority'
import { operationalLink, engagementTerms, specialistVisibility, specialistGuard, laneCreate, laneReserve, operatingComposition } from './operations'
import { benefitCreate, benefitObserve, benefitAccept, benefitDisposition } from './value'
import { InstitutionalFoundationRuntime } from '../foundation/runtime'

export const operatingActions = ['estate.record', 'relationship.record', 'raid.create', 'raid.propose', 'raid.transition',
  'operations.link', 'engagement.terms', 'lane.create', 'lane.reserve',
  'benefit.create', 'benefit.observe', 'benefit.accept', 'benefit.disposition'] as const
export type OperatingAction = typeof operatingActions[number]
export class InstitutionalOperatingRuntime {
  readonly guard: OperatingGuard
  readonly foundation: InstitutionalFoundationRuntime
  constructor(readonly boundary: InstitutionalMutationBoundary, sources: OperatingSourcePorts) {
    this.guard = new OperatingGuard(boundary, sources)
    this.foundation = new InstitutionalFoundationRuntime(boundary, this.missionGuard, this.specialistGuard)
  }
  execute(session: string, action: OperatingAction, raw: unknown) {
    z.enum(operatingActions).parse(action)
    const authorityAction = ['raid.transition', 'benefit.disposition'].includes(action)
      ? `${action.split('.')[0]}.${z.object({ next: z.string() }).parse(institutionalCommandSchema.parse(raw).payload).next.toLowerCase()}` : action
    const { context, command } = this.boundary.authority.resolve(session, authorityAction, raw)
    const row = this.boundary.commit(context, command.expectedVersion, () => {
      switch (action) {
        case 'estate.record': return estateMutation(this.guard, context, command)
        case 'relationship.record': return relationshipMutation(this.guard, context, command)
        case 'raid.create': return raidCreate(this.guard, context, command)
        case 'raid.propose': return raidCreate(this.guard, context, command, true)
        case 'raid.transition': return raidTransition(this.guard, context, command)
        case 'operations.link': return operationalLink(this.guard, context, command)
        case 'engagement.terms': return engagementTerms(this.guard, context, command)
        case 'lane.create': return laneCreate(this.guard, context, command)
        case 'lane.reserve': return laneReserve(this.guard, context, command)
        case 'benefit.create': return benefitCreate(this.guard, context, command)
        case 'benefit.observe': return benefitObserve(this.guard, context, command)
        case 'benefit.accept': return benefitAccept(this.guard, context, command)
        case 'benefit.disposition': return benefitDisposition(this.guard, context, command)
      }
    })
    return { ...row, auditDelivery: this.boundary.deliveryState(row.scope, context.requestId) }
  }
  readonly missionGuard = (context: import('@nzila/platform-contracts').InstitutionalMutationContext, next: string): void => {
    if (['active', 'completed', 'closed'].includes(next) && missionBlockers(this.guard, context).length) {
      this.guard.deny(context, 'MISSION_REQUIRED_RAID_UNRESOLVED')
    }
  }
  readonly specialistGuard = (context: import('@nzila/platform-contracts').InstitutionalMutationContext,
    engagement: import('@nzila/platform-contracts').InstitutionalReference): void => specialistGuard(this.guard, context, engagement)
  operations(session: string, raw: unknown) {
    const { context, command } = this.boundary.authority.resolve(session, 'operations.read', raw)
    return operatingComposition(this.guard, context, z.object({ ref: institutionalReferenceSchema }).strict().parse(command.payload).ref)
  }
  specialist(session: string, raw: unknown) {
    const { context, command } = this.boundary.authority.resolve(session, 'engagement.read', raw)
    return specialistVisibility(this.guard, context, z.object({ id: z.string() }).strict().parse(command.payload).id)
  }
  async traverse(session: string, raw: unknown) {
    const { context, command } = this.boundary.authority.resolve(session, 'estate.read', raw)
    return estateTraversal(this.guard, context, command.payload)
  }
}
