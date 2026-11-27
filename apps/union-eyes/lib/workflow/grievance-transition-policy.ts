import { grievanceStatusEnum, type grievances } from '@/db/schema/domains/claims/grievances'
import { validateTransition, type TransitionContext } from './case-lifecycle'
import { caseLifecycleActorRole } from './claim-transition-policy'
import { storedCaseTransitionFacts } from './claim-transition-facts'
import { toLifecycleState } from './state-bridge'

type Source = Pick<typeof grievances.$inferSelect,
  'id' | 'status' | 'description' | 'unionRepId' | 'representedMemberUserId' | 'priority' | 'createdAt' | 'updatedAt'>
type Event = { eventType: string; createdAt: Date }
const lifecycleOf = (status: string) => toLifecycleState('grievance', status) ?? toLifecycleState('cupe', status)

/** The same stored facts drive the offered actions and the locked write. */
export function grievanceTransitionContext(
  source: Source, events: readonly Event[], role: string, target: string, notes?: string,
): TransitionContext | null {
  const actorRole = caseLifecycleActorRole(role)
  const currentState = lifecycleOf(source.status)
  const targetState = lifecycleOf(target)
  if (!actorRole || !currentState || !targetState) return null
  // Archiving a settlement must not rewrite its outcome as denied/withdrawn
  // just because those different database statuses map to the same FSM state.
  if (source.status === 'settled' && target !== 'closed') return null
  const stateEvents = events.filter(event => ['status_changed', 'converted_to_case', 'closed'].includes(event.eventType))
  const statusChangedAt = stateEvents.reduce<Date | null>((latest, event) =>
    !latest || event.createdAt > latest ? event.createdAt : latest, null) ?? source.createdAt
  return {
    actorRole, caseId: source.id, currentState, targetState, assignedTo: source.unionRepId,
    ...storedCaseTransitionFacts({
      claimId: source.id, status: source.status, description: source.description,
      assignedTo: source.unionRepId, memberId: source.representedMemberUserId,
      priority: source.priority === 'urgent' ? 'critical' : source.priority ?? 'medium',
      createdAt: source.createdAt, updatedAt: source.updatedAt, statusChangedAt,
    }, currentState, notes),
  }
}

export function allowedGrievanceStatuses(
  source: Source, events: readonly Event[], role: string,
  authority: { canTransition: boolean; canCloseCase: boolean },
) {
  if (!authority.canTransition) return []
  return grievanceStatusEnum.enumValues.filter(target => {
    if (target === source.status) return false
    const context = grievanceTransitionContext(source, events, role, target)
    if (!context || ((context.currentState === 'closed' || context.targetState === 'closed') && !authority.canCloseCase)) return false
    return validateTransition(context).allowed
  })
}
