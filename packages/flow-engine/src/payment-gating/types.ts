export interface FlowPaymentGateOrder {
  id: string
  total_amount: number
  payment_status: string
  status: string
}

export interface DepositRequirement {
  required: boolean
  percent: number | null
  amount: number | null
  due_before_production: boolean
}

export interface PaymentGateResult {
  allowed: boolean
  blockers: string[]
  order_id: string
  outstanding_balance: number
}

export type PaymentGateType = 'po_creation' | 'production_start' | 'shipment'
