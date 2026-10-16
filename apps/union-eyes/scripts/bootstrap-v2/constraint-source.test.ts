import { describe, expect, it } from 'vitest'
import { hash, retainCurrentModelChecks, type CurrentModel } from './source'

const model: CurrentModel = {
  table: 'reward_wallet_ledger',
  app: 'unions',
  model: 'RewardWalletLedger',
  source: 'current-model',
  sourceDigest: hash('current-model'),
  columns: [],
  uniqueTogether: [],
  constraints: [{ name: 'wallet_balance_non_negative' }],
  databaseConstraints: [
    {
      name: 'wallet_balance_non_negative',
      kind: 'CheckConstraint',
      sql: 'CONSTRAINT "wallet_balance_non_negative" CHECK ("balance_after" >= 0)',
    },
  ],
}
const checks = {
  wallet_balance_non_negative: {
    name: 'wallet_balance_non_negative',
    value: '"reward_wallet_ledger"."balance_after" >= 0',
  },
}

describe('current-model check constraint ownership', () => {
  it('retains a matching canonical check instead of generating its duplicate ALTER', () => {
    const before = JSON.stringify(checks)
    expect(retainCurrentModelChecks(checks, model)).toEqual(checks)
    expect(JSON.stringify(checks)).toBe(before)
  })

  it('leaves genuinely new caller checks for explicit prospective production', () => {
    expect(
      retainCurrentModelChecks(
        { new_check: { name: 'new_check', value: '"balance_after" < 100' } },
        model,
      ),
    ).toEqual({})
  })

  it('rejects same-name semantic drift rather than masking it with an existence guard', () => {
    expect(() =>
      retainCurrentModelChecks(
        {
          wallet_balance_non_negative: {
            ...checks.wallet_balance_non_negative,
            value: '"balance_after" > 0',
          },
        },
        model,
      ),
    ).toThrow('UE_V2_CURRENT_CONSTRAINT_DECLARATION_CONFLICT')
  })

  it('requires source-collected SQL for a canonical same-name constraint', () => {
    expect(() =>
      retainCurrentModelChecks(checks, { ...model, databaseConstraints: undefined }),
    ).toThrow('UE_V2_CURRENT_CONSTRAINT_SQL_REQUIRED')
  })

  it('does not normalize away literal whitespace or grouping semantics', () => {
    const named = { name: 'text_check', value: '"memo" = \'two  words\'' }
    const textModel = {
      ...model,
      databaseConstraints: [
        {
          name: 'text_check',
          kind: 'CheckConstraint',
          sql: 'CONSTRAINT "text_check" CHECK ("memo" = \'two words\')',
        },
      ],
    }
    expect(() => retainCurrentModelChecks({ text_check: named }, textModel)).toThrow(
      'UE_V2_CURRENT_CONSTRAINT_DECLARATION_CONFLICT',
    )
    expect(() =>
      retainCurrentModelChecks(checks, {
        ...model,
        databaseConstraints: [
          {
            ...model.databaseConstraints![0],
            sql: 'CONSTRAINT "wallet_balance_non_negative" CHECK ("balance_after" >= 0 OR "balance_after" = -1)',
          },
        ],
      }),
    ).toThrow('UE_V2_CURRENT_CONSTRAINT_DECLARATION_CONFLICT')
  })
})
