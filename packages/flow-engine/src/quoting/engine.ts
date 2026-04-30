import type { FlowQuotingInput, FlowQuotingState } from './types'

export function createQuotingStage(input: FlowQuotingInput): FlowQuotingState {
  return {
    moduleId: 'flow.quoting',
    summary: `Quote prepared in ${input.currency}`,
    nextAction: 'issue-po-invoice',
    currency: input.currency,
  }
}