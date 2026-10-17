import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { rewardWalletLedger } from '../../db/schema/domains/infrastructure/rewards';
import { rewardWalletLedger as awardLedger } from '../../db/schema/domains/infrastructure/awards';
import { rewardWalletLedger as barrelLedger } from '../../db/schema';

describe('bootstrap V2 current reward source contract', () => {
  it('uses one current declaration for direct wallet, awards compatibility and root barrel callers', () => {
    expect(awardLedger).toBe(rewardWalletLedger);
    expect(barrelLedger).toBe(rewardWalletLedger);
    const config = getTableConfig(rewardWalletLedger);
    expect(config.name).toBe('reward_wallet_ledger');
    expect(config.columns.map((column) => column.name)).toEqual([
      'id', 'org_id', 'user_id', 'event_type', 'amount_credits', 'balance_after',
      'source_type', 'source_id', 'memo', 'expires_at', 'created_at', 'updated_at',
    ]);
    expect(config.columns.find((column) => column.name === 'org_id')?.notNull).toBe(true);
    expect(config.columns.find((column) => column.name === 'user_id')?.notNull).toBe(true);
    expect(config.columns.find((column) => column.name === 'expires_at')?.notNull).toBe(false);
    expect(rewardWalletLedger.eventType.getSQLType()).toBe('varchar(16)');
    expect(rewardWalletLedger.sourceType.getSQLType()).toBe('varchar(32)');
    expect(config.checks.map((constraint) => constraint.name).sort()).toEqual([
      'wallet_balance_non_negative', 'wallet_event_type_valid', 'wallet_source_type_valid',
    ]);
  });

  it('prospectively declares entity fields in Django rather than synthesizing them from runtime drift', () => {
    const source = readFileSync(path.resolve(__dirname, '../../backend/unions/models.py'), 'utf8');
    const model = source.split('class RewardWalletLedger(BaseModel):')[1].split('\nclass BudgetPool')[0];
    for (const field of [
      'org', 'user_id', 'event_type', 'amount_credits', 'balance_after',
      'source_type', 'source_id', 'memo', 'expires_at',
    ]) {
      expect(model, field).toMatch(new RegExp(`\\b${field} = models\\.`));
    }
    expect(model).toContain('db_column="org_id"');
    expect(model).toContain('wallet_balance_non_negative');
    expect(model).not.toMatch(/points_change|transaction_type|expiration_scheduled/);
  });
});
