import type { FlowEngineModuleDefinition } from './types'

export { createIntakeStage } from './intake'
export { createRoutingStage } from './routing'
export { createApprovalStage } from './approvals'
export { createQuotingStage } from './quoting'
export { createPoInvoiceStage } from './po-invoice'
export { createTaskStage } from './tasks'
export { createStatusStage } from './status'
export { createAutomationStage } from './automations'
export {
  canGeneratePO,
  canShipOrder,
  canStartProduction,
  explainBlock,
  getPaymentGateState,
  outstandingBalance,
  requiresDeposit,
} from './payment-gating'

export type { FlowEngineInput, FlowEngineModuleDefinition, FlowEngineState } from './types'
export type { FlowIntakeInput, FlowIntakeState } from './intake'
export type { FlowRoutingInput, FlowRoutingState } from './routing'
export type { FlowApprovalInput, FlowApprovalState } from './approvals'
export type { FlowQuotingInput, FlowQuotingState } from './quoting'
export type { FlowPoInvoiceInput, FlowPoInvoiceState } from './po-invoice'
export type { FlowTaskInput, FlowTaskState } from './tasks'
export type { FlowStatusInput, FlowStatusState } from './status'
export type { FlowAutomationInput, FlowAutomationState } from './automations'
export type {
  DepositRequirement,
  FlowPaymentGateOrder,
  PaymentGateResult,
  PaymentGateType,
} from './payment-gating'

export function listFlowEngineModules(): FlowEngineModuleDefinition[] {
  return [
    {
      id: 'flow.intake',
      name: 'Intake',
      icon: '🧾',
      description: 'Capture work requests from storefront, phone, or operations handoff.',
      bullets: ['Structured request intake', 'Manual and imported channels', 'Consistent work capture'],
    },
    {
      id: 'flow.routing',
      name: 'Routing',
      icon: '🧭',
      description: 'Assign the work to the correct queue, lane, or operator.',
      bullets: ['Queue assignment', 'Lane-based distribution', 'Operational triage'],
    },
    {
      id: 'flow.approvals',
      name: 'Approvals',
      icon: '✅',
      description: 'Collect owner or finance approvals before work continues.',
      bullets: ['Owner approval gates', 'Finance sign-off', 'Escalation-ready handoffs'],
    },
    {
      id: 'flow.quoting',
      name: 'Quoting',
      icon: '📋',
      description: 'Prepare branded quotes without embedding brand concerns in the engine.',
      bullets: ['Proposal generation', 'Margin-aware quoting', 'Reusable pricing handoff'],
    },
    {
      id: 'flow.po-invoice',
      name: 'PO / Invoice',
      icon: '📄',
      description: 'Issue purchasing and billing documents through the workflow boundary.',
      bullets: ['Purchase order issuance', 'Invoice preparation', 'Document boundary control'],
    },
    {
      id: 'flow.tasks',
      name: 'Tasks',
      icon: '🛠️',
      description: 'Queue and coordinate execution tasks across the workflow.',
      bullets: ['Execution task queues', 'Cross-team coordination', 'Operational workload tracking'],
    },
    {
      id: 'flow.status',
      name: 'Status',
      icon: '📍',
      description: 'Track workflow progress with a product-neutral state model.',
      bullets: ['State progression', 'Progress visibility', 'Consistent workflow telemetry'],
    },
    {
      id: 'flow.automations',
      name: 'Automations',
      icon: '⚙️',
      description: 'Run follow-up and closeout automations behind the public SDK.',
      bullets: ['Follow-up recipes', 'Closeout triggers', 'Reusable automation hooks'],
    },
  ]
}