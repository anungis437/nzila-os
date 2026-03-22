/**
 * Workflows layer — state machines and lifecycle transitions for CFO.
 *
 * Re-exports from lib/ during migration. Workflow automation engine
 * and pre-built templates for accounting firms.
 */

// Workflow automation — event-driven trigger evaluation
export {
  evaluateTriggers,
  evaluateCondition,
  getTriggeredWorkflow,
  DEFAULT_TRIGGER_RULES,
  AUTOMATION_SCHEDULES,
  type WorkflowTriggerEvent,
  type TriggerRule,
  type TriggerCondition,
  type TriggerEvaluation,
  type AutomationSchedule,
} from '../lib/workflow-automation'

// Workflow templates — pre-built accounting firm workflows with SLA tracking
export {
  WORKFLOW_TEMPLATE_LIBRARY,
  YEAR_END_CLOSE,
  CLIENT_ONBOARDING,
  MONTHLY_RECONCILIATION,
  GST_HST_FILING,
  T1_PERSONAL_TAX,
  AUDIT_PREPARATION,
  evaluateWorkflowSla,
  type WorkflowTemplatePreset,
  type SlaStatus,
  type WorkflowSlaReport,
} from '../lib/workflow-templates'
