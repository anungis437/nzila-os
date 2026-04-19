import type { IncidentStatus } from './types';

const TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  new: ['triage'],
  triage: ['assigned'],
  assigned: ['investigating'],
  investigating: ['action_planning'],
  action_planning: ['monitoring'],
  monitoring: ['resolved'],
  resolved: ['closed'],
  closed: ['archived'],
  archived: [],
};

export function getAllowedTransitions(status: IncidentStatus): IncidentStatus[] {
  return TRANSITIONS[status];
}

export function isValidTransition(
  from: IncidentStatus,
  to: IncidentStatus,
): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertValidTransition(
  from: IncidentStatus,
  to: IncidentStatus,
): void {
  if (!isValidTransition(from, to)) {
    throw new Error(`Invalid incident transition: ${from} -> ${to}`);
  }
}
