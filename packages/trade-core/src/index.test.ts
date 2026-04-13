import { describe, it, expect } from 'vitest'
import * as tradeCore from './index'

describe('trade-core barrel exports', () => {
  it('exports runtime modules from the package root', () => {
    expect(tradeCore.TradeDealStage.LEAD).toBe('lead')
    expect(tradeCore.tradeDealMachine.name).toBe('trade_deal')
    expect(tradeCore.attemptDealTransition).toBeTypeOf('function')
    expect(tradeCore.buildTransitionAuditEntry).toBeTypeOf('function')
    expect(tradeCore.hashAuditEntry).toBeTypeOf('function')
    expect(tradeCore.TradeEventTypes.DEAL_CREATED).toBe('trade.deal.created')
    expect(tradeCore.createDealSchema).toBeDefined()
  })
})
