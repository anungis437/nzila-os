export type ApprovalAction =
  | 'discount_override'
  | 'margin_exception'
  | 'rush_order'
  | 'refund_request'
  | 'supplier_spend'
  | 'ad_budget_change'

export interface ApprovalDecision {
  required: boolean
  reason: string
  threshold: string
}

export interface ApprovalInput {
  action: ApprovalAction
  value: number
  marginPercent?: number
}

export function evaluateApproval(input: ApprovalInput): ApprovalDecision {
  switch (input.action) {
    case 'discount_override':
      return {
        required: input.value > 500,
        reason: 'Discount amount exceeds delegated limit.',
        threshold: '$500',
      }
    case 'margin_exception':
      return {
        required: (input.marginPercent ?? 100) < 30,
        reason: 'Gross margin below 30% floor.',
        threshold: '30% margin floor',
      }
    case 'rush_order':
      return {
        required: input.value > 1500,
        reason: 'Rush surcharge and execution risk require owner visibility.',
        threshold: '$1,500 order value',
      }
    case 'refund_request':
      return {
        required: input.value > 300,
        reason: 'Refund amount exceeds frontline cap.',
        threshold: '$300 refund cap',
      }
    case 'supplier_spend':
      return {
        required: input.value > 2000,
        reason: 'PO amount exceeds delegated procurement spending cap.',
        threshold: '$2,000 PO cap',
      }
    case 'ad_budget_change':
      return {
        required: input.value > 1200,
        reason: 'Budget shift creates material media risk.',
        threshold: '$1,200 campaign delta',
      }
    default:
      return { required: false, reason: 'No policy match.', threshold: 'n/a' }
  }
}
