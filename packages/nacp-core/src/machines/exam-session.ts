/**
 * @nzila/nacp-core — Exam Session State Machine
 *
 * Declarative definition of the exam session lifecycle:
 * scheduled → opened → in_progress → sealed → exported → closed
 *
 * @module @nzila/nacp-core/machines
 */
import { ExamSessionStatus, NacpRole } from '../enums'
import type { MachineDefinition, TransitionDef } from '@nzila/commerce-state'
import type { ExamSession } from '../types/index'

type ESS = ExamSessionStatus

const t = (
  from: ESS,
  to: ESS,
  label: string,
  opts: Partial<Pick<TransitionDef<ESS, ExamSession, NacpRole>, 'allowedRoles' | 'guards' | 'events' | 'actions' | 'timeout'>> = {},
): TransitionDef<ESS, ExamSession, NacpRole> => ({
  from,
  to,
  label,
  allowedRoles: opts.allowedRoles ?? [],
  guards: opts.guards ?? [],
  events: opts.events ?? [{ type: `exam_session.${to}`, payload: {} }],
  actions: opts.actions ?? [],
  timeout: opts.timeout,
})

export const examSessionMachine: MachineDefinition<ESS, ExamSession, NacpRole> = {
  name: 'exam_session',
  states: [
    ExamSessionStatus.SCHEDULED,
    ExamSessionStatus.OPENED,
    ExamSessionStatus.IN_PROGRESS,
    ExamSessionStatus.SEALED,
    ExamSessionStatus.EXPORTED,
    ExamSessionStatus.CLOSED,
  ],
  initialState: ExamSessionStatus.SCHEDULED,
  terminalStates: [ExamSessionStatus.CLOSED],

  transitions: [
    // scheduled → opened
    t(ExamSessionStatus.SCHEDULED, ExamSessionStatus.OPENED, 'Open session', {
      allowedRoles: [NacpRole.ADMIN, NacpRole.DIRECTOR, NacpRole.SUPERVISOR],
      events: [{ type: 'exam_session.opened', payload: {} }],
      actions: [{ type: 'notify_invigilators', payload: {} }],
    }),

    // opened → in_progress
    t(ExamSessionStatus.OPENED, ExamSessionStatus.IN_PROGRESS, 'Start examination', {
      allowedRoles: [NacpRole.ADMIN, NacpRole.DIRECTOR, NacpRole.SUPERVISOR, NacpRole.INVIGILATOR],
      guards: [
        (_ctx, session) => session.candidateCount > 0,
      ],
      events: [{ type: 'exam_session.in_progress', payload: {} }],
    }),

    // in_progress → sealed
    t(ExamSessionStatus.IN_PROGRESS, ExamSessionStatus.SEALED, 'Seal session', {
      allowedRoles: [NacpRole.ADMIN, NacpRole.DIRECTOR, NacpRole.SUPERVISOR],
      events: [
        { type: 'exam_session.sealed', payload: {} },
        { type: 'integrity.generate_artifact', payload: {} },
      ],
      actions: [
        { type: 'generate_integrity_artifact', payload: {} },
        { type: 'lock_submissions', payload: {} },
      ],
    }),

    // sealed → exported
    t(ExamSessionStatus.SEALED, ExamSessionStatus.EXPORTED, 'Export results', {
      allowedRoles: [NacpRole.ADMIN, NacpRole.DIRECTOR],
      guards: [
        (_ctx, session) => session.integrityHash !== null,
      ],
      events: [{ type: 'exam_session.exported', payload: {} }],
      actions: [
        { type: 'generate_results_export', payload: {} },
        { type: 'emit_outbox_integrity_export', payload: {} },
      ],
    }),

    // exported → closed
    t(ExamSessionStatus.EXPORTED, ExamSessionStatus.CLOSED, 'Close session', {
      allowedRoles: [NacpRole.ADMIN, NacpRole.DIRECTOR],
      events: [{ type: 'exam_session.closed', payload: {} }],
      actions: [
        { type: 'archive_session_data', payload: {} },
        { type: 'emit_outbox_report_generation', payload: {} },
      ],
    }),
  ],
}
