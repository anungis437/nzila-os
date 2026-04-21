/**
 * @nzila/itsm-core — Ticket FSM definition
 *
 * Wraps @nzila/fsm-core with the canonical ITSM ticket lifecycle.
 * Roles: itsm_agent, itsm_manager, itsm_change_approver, org_admin
 *
 * Terminal states: closed
 */
import type { MachineDefinition } from '@nzila/fsm-core'
import type { TicketStatus, ItsmRole } from './types'

/** Minimal ticket entity shape required by FSM guards */
export interface TicketEntity {
  readonly orgId: string
  readonly status: TicketStatus
  readonly priority: string
  readonly assignedToId: string | null | undefined
}

export const ticketMachine: MachineDefinition<TicketStatus, TicketEntity, ItsmRole> = {
  name: 'itsm_ticket',
  version: '1.0.0',
  initialState: 'new',
  terminalStates: ['closed'],
  states: [
    'new',
    'triage',
    'assigned',
    'in_progress',
    'waiting_user',
    'waiting_vendor',
    'resolved',
    'closed',
    'reopened',
  ],
  transitions: [
    // ── Intake flow ─────────────────────────────────────────────────
    {
      from: 'new',
      to: 'triage',
      label: 'Start triage',
      allowedRoles: ['itsm_agent', 'itsm_manager', 'org_admin'],
      guards: [],
      events: [{ type: 'itsm.ticket.triage_started', payload: {} }],
      actions: [],
    },
    {
      from: 'new',
      to: 'assigned',
      label: 'Assign directly',
      allowedRoles: ['itsm_manager', 'org_admin'],
      guards: [],
      events: [{ type: 'itsm.ticket.assigned', payload: {} }],
      actions: [],
    },
    // ── Triage ──────────────────────────────────────────────────────
    {
      from: 'triage',
      to: 'assigned',
      label: 'Assign to agent',
      allowedRoles: ['itsm_agent', 'itsm_manager', 'org_admin'],
      guards: [],
      events: [{ type: 'itsm.ticket.assigned', payload: {} }],
      actions: [],
    },
    {
      from: 'triage',
      to: 'closed',
      label: 'Close as duplicate / no action',
      allowedRoles: ['itsm_manager', 'org_admin'],
      guards: [],
      events: [{ type: 'itsm.ticket.closed', payload: {} }],
      actions: [],
    },
    // ── Working ──────────────────────────────────────────────────────
    {
      from: 'assigned',
      to: 'in_progress',
      label: 'Start work',
      allowedRoles: ['itsm_agent', 'itsm_manager', 'org_admin'],
      guards: [],
      events: [{ type: 'itsm.ticket.work_started', payload: {} }],
      actions: [],
    },
    {
      from: 'in_progress',
      to: 'waiting_user',
      label: 'Waiting for user response',
      allowedRoles: ['itsm_agent', 'itsm_manager', 'org_admin'],
      guards: [],
      events: [{ type: 'itsm.ticket.waiting_user', payload: {} }],
      actions: [],
    },
    {
      from: 'in_progress',
      to: 'waiting_vendor',
      label: 'Waiting for vendor',
      allowedRoles: ['itsm_agent', 'itsm_manager', 'org_admin'],
      guards: [],
      events: [{ type: 'itsm.ticket.waiting_vendor', payload: {} }],
      actions: [],
    },
    // ── Return from waiting ──────────────────────────────────────────
    {
      from: 'waiting_user',
      to: 'in_progress',
      label: 'User responded',
      allowedRoles: ['itsm_agent', 'itsm_manager', 'org_admin'],
      guards: [],
      events: [{ type: 'itsm.ticket.resumed', payload: {} }],
      actions: [],
    },
    {
      from: 'waiting_vendor',
      to: 'in_progress',
      label: 'Vendor responded',
      allowedRoles: ['itsm_agent', 'itsm_manager', 'org_admin'],
      guards: [],
      events: [{ type: 'itsm.ticket.resumed', payload: {} }],
      actions: [],
    },
    // ── Resolution ───────────────────────────────────────────────────
    {
      from: 'in_progress',
      to: 'resolved',
      label: 'Resolve ticket',
      allowedRoles: ['itsm_agent', 'itsm_manager', 'org_admin'],
      guards: [],
      events: [{ type: 'itsm.ticket.resolved', payload: {} }],
      actions: [],
    },
    {
      from: 'waiting_user',
      to: 'resolved',
      label: 'Auto-resolve (no user response)',
      allowedRoles: ['itsm_agent', 'itsm_manager', 'org_admin'],
      guards: [],
      events: [{ type: 'itsm.ticket.resolved', payload: {} }],
      actions: [],
    },
    {
      from: 'resolved',
      to: 'closed',
      label: 'Close ticket',
      allowedRoles: ['itsm_agent', 'itsm_manager', 'org_admin'],
      guards: [],
      events: [{ type: 'itsm.ticket.closed', payload: {} }],
      actions: [],
    },
    // ── Reopen ───────────────────────────────────────────────────────
    {
      from: 'resolved',
      to: 'reopened',
      label: 'Reopen ticket',
      allowedRoles: ['itsm_agent', 'itsm_manager', 'org_admin'],
      guards: [],
      events: [{ type: 'itsm.ticket.reopened', payload: {} }],
      actions: [],
    },
    {
      from: 'reopened',
      to: 'in_progress',
      label: 'Resume work',
      allowedRoles: ['itsm_agent', 'itsm_manager', 'org_admin'],
      guards: [],
      events: [{ type: 'itsm.ticket.work_started', payload: {} }],
      actions: [],
    },
    // ── Escalation / priority transitions ────────────────────────────
    {
      from: 'assigned',
      to: 'triage',
      label: 'Return to triage (wrong queue)',
      allowedRoles: ['itsm_manager', 'org_admin'],
      guards: [],
      events: [{ type: 'itsm.ticket.returned_to_triage', payload: {} }],
      actions: [],
    },
  ],
}
