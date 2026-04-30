import type { FlowPoInvoiceInput, FlowPoInvoiceState } from './types'

export function createPoInvoiceStage(input: FlowPoInvoiceInput): FlowPoInvoiceState {
  return {
    moduleId: 'flow.po-invoice',
    summary: `Prepared ${input.documentKind}`,
    nextAction: 'dispatch-task',
    documentKind: input.documentKind,
  }
}