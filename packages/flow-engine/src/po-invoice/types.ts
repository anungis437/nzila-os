import type { FlowEngineInput, FlowEngineState } from '../types'

export interface FlowPoInvoiceInput extends FlowEngineInput {
  documentKind: 'purchase-order' | 'invoice'
}

export interface FlowPoInvoiceState extends FlowEngineState {
  documentKind: FlowPoInvoiceInput['documentKind']
}